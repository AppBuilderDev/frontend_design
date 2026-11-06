import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { IncomingMessage } from 'node:http';
import { PlatformStore, fail } from './store.ts';

const derive = promisify(scrypt);
const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128);
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const key = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hash, 'hex'));
}
interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
}
export class PlatformAuth {
  constructor(readonly store: PlatformStore) {}
  session(userId: string) {
    const user = this.store.db.prepare('SELECT id,name,email FROM users WHERE id=?').get(userId) as
      Omit<UserRow, 'password'> | undefined;
    return user
      ? { user, projects: this.store.projects(userId) }
      : fail(401, 'Inicia sesión para continuar');
  }
  user(req: IncomingMessage): string {
    const raw = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('ab_session='))
      ?.slice(11);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return fail(401, 'Inicia sesión para continuar');
    const session = this.store.db
      .prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?')
      .get(tokenHash(raw), Date.now()) as { user_id: string } | undefined;
    return session?.user_id ?? fail(401, 'La sesión caducó. Inicia sesión de nuevo.');
  }
  private issue(userId: string) {
    const token = randomBytes(32).toString('hex');
    this.store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    this.store.db
      .prepare('INSERT INTO sessions VALUES (?,?,?)')
      .run(tokenHash(token), userId, Date.now() + 8 * 60 * 60 * 1000);
    return { token, session: this.session(userId) };
  }
  async register(input: unknown, ip: string) {
    this.limit('register:' + ip, 10);
    const data = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: emailSchema,
        password: passwordSchema,
        organization: z.string().trim().min(1).max(80).optional(),
        invitation: z.string().optional(),
      })
      .parse(input);
    if (!data.organization && !data.invitation) fail(400, 'Escribe el nombre de tu organización');
    const password = await hashPassword(data.password);
    return this.store.db
      .transaction(() => {
        if (this.store.db.prepare('SELECT id FROM users WHERE email=?').get(data.email))
          fail(409, 'No se pudo crear la cuenta con ese correo. Intenta iniciar sesión.');
        const id = randomUUID();
        this.store.db
          .prepare('INSERT INTO users VALUES (?,?,?,?)')
          .run(id, data.email, data.name, password);
        if (data.invitation) this.accept(data.invitation, id);
        else {
          const org = randomUUID(),
            project = randomUUID();
          this.store.db
            .prepare('INSERT INTO organizations VALUES (?,?,?)')
            .run(org, data.organization, id);
          this.store.db
            .prepare('INSERT INTO projects(id,organization_id,name) VALUES (?,?,?)')
            .run(project, org, 'Mi aplicación');
          this.store.db.prepare('INSERT INTO members VALUES (?,?,?)').run(project, id, 'owner');
          this.store.audit(project, id, 'organization.create', org);
        }
        return this.issue(id);
      })
      .immediate();
  }
  private limit(key: string, max: number) {
    const now = Date.now();
    this.store.db.prepare('DELETE FROM login_attempts WHERE expires_at<=?').run(now);
    const row = this.store.db
      .prepare('SELECT attempts FROM login_attempts WHERE key=?')
      .get(key) as { attempts: number } | undefined;
    if (row && row.attempts >= max)
      fail(429, 'Demasiados intentos. Espera 15 minutos y vuelve a intentarlo.');
    this.store.db
      .prepare(
        'INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1',
      )
      .run(key, now + 15 * 60 * 1000);
  }
  async login(input: unknown, ip: string) {
    const data = z
      .object({ email: emailSchema, password: z.string().min(1).max(128) })
      .parse(input);
    const key = ip + ':' + data.email;
    this.limit(key, 10);
    this.limit('login-ip:' + ip, 100);
    const user = this.store.db.prepare('SELECT * FROM users WHERE email=?').get(data.email) as
      UserRow | undefined;
    // Derive even for unknown users to avoid a cheap email enumeration timing path.
    const valid = await verifyPassword(
      data.password,
      user?.password ?? '00000000000000000000000000000000:' + '00'.repeat(64),
    );
    if (!user || !valid) fail(401, 'Correo o contraseña incorrectos');
    this.store.db.prepare('DELETE FROM login_attempts WHERE key=?').run(key);
    return this.issue(user.id);
  }
  logout(req: IncomingMessage) {
    const token = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('ab_session='))
      ?.slice(11);
    if (token)
      this.store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
  }
  invite(projectId: string, userId: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const data = z.object({ email: emailSchema, role: z.enum(['editor', 'reader']) }).parse(input);
    const existing = this.store.db
      .prepare(
        'SELECT u.id FROM users u JOIN members m ON m.user_id=u.id WHERE m.project_id=? AND u.email=?',
      )
      .get(projectId, data.email);
    if (existing) fail(409, 'Ese usuario ya pertenece al proyecto');
    const token = randomBytes(32).toString('hex'),
      id = randomUUID(),
      expires = Date.now() + 72 * 60 * 60 * 1000;
    this.store.db
      .prepare('DELETE FROM invitations WHERE project_id=? AND email=?')
      .run(projectId, data.email);
    this.store.db
      .prepare('INSERT INTO invitations VALUES (?,?,?,?,?,?)')
      .run(id, projectId, data.email, data.role, tokenHash(token), expires);
    this.store.audit(projectId, userId, 'member.invite', id);
    return {
      id,
      email: data.email,
      role: data.role,
      token,
      expiresAt: new Date(expires).toISOString(),
    };
  }
  accept(token: string, userId: string) {
    return this.store.db
      .transaction(() => {
        const invitation = this.store.db
          .prepare('SELECT * FROM invitations WHERE token_hash=? AND expires_at>?')
          .get(tokenHash(token), Date.now()) as
          { id: string; project_id: string; email: string; role: string } | undefined;
        if (!invitation) fail(400, 'Invitación inválida o caducada');
        const user = this.session(userId).user;
        if (user.email !== invitation.email) fail(403, 'La invitación está dirigida a otro correo');
        const p = this.store.db
          .prepare('SELECT archived FROM projects WHERE id=?')
          .get(invitation.project_id) as { archived: number };
        if (p.archived) fail(409, 'El proyecto está archivado');
        this.store.db
          .prepare(
            "INSERT INTO members VALUES (?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role WHERE members.role<>'owner'",
          )
          .run(invitation.project_id, userId, invitation.role);
        this.store.db.prepare('DELETE FROM invitations WHERE id=?').run(invitation.id);
        this.store.audit(invitation.project_id, userId, 'member.accept', userId);
        return this.session(userId);
      })
      .immediate();
  }
}
