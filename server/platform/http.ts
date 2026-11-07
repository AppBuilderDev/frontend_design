import { ConnectionsStore, type ConnectionOptions } from './connections.ts';
import { environmentSchema } from '../../src/models/connections.ts';
import { OperationsStore } from './operations.ts';
import { InventoryStore } from './inventory.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { z } from 'zod';

import { PlatformAuth } from './auth.ts';

import { PlatformStore, PlatformError, fail } from './store.ts';

import { blockInputSchema } from '../../src/models/blocks.ts';

import { randomUUID } from 'node:crypto';

export function createPlatform(
  store: PlatformStore,
  options: { connections?: ConnectionOptions } = {},
) {
  const connections = new ConnectionsStore(store, options.connections);
  const auth = new PlatformAuth(store);
  const inventory = new InventoryStore(store);
  const operations = new OperationsStore(store);

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    readBody: () => Promise<unknown>,
  ): Promise<boolean> => {
    if (!url.pathname.startsWith('/api/v1/')) return false;

    const method = req.method ?? 'GET';

    const send = (status: number, data?: unknown) => {
      res.writeHead(status);
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };

    try {
      if (!['GET', 'HEAD'].includes(method) && req.headers['x-requested-with'] !== 'AppBuilderDev')
        fail(403, 'Falta la cabecera de protección de la solicitud');

      const path = url.pathname.slice('/api/v1'.length);

      const ip = req.socket.remoteAddress ?? 'local';

      const setCookie = (token: string) =>
        res.setHeader(
          'Set-Cookie',
          `ab_session=${token}; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        );

      if (path === '/auth/register' && method === 'POST') {
        const result = await auth.register(await readBody(), ip);
        setCookie(result.token);
        send(201, result.session);
        return true;
      }

      if (path === '/auth/login' && method === 'POST') {
        const result = await auth.login(await readBody(), ip);
        setCookie(result.token);
        send(200, result.session);
        return true;
      }

      if (path === '/auth/logout' && method === 'POST') {
        auth.logout(req);
        res.setHeader(
          'Set-Cookie',
          `ab_session=; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        );
        send(204);
        return true;
      }

      const userId = auth.user(req);

      if (path === '/auth/session' && method === 'GET') {
        send(200, auth.session(userId));
        return true;
      }

      if (path === '/invitations/accept' && method === 'POST') {
        const data = z.object({ token: z.string().min(1) }).parse(await readBody());
        send(200, auth.accept(data.token, userId));
        return true;
      }

      const runtime = /^\/runtime\/projects\/([^/]+)\/(pages\/by-path|navigation)$/.exec(path);

      if (runtime && method === 'GET') {
        let p = store.projects(userId).find((p) => p.id === runtime[1]);
        if (p) {
          store.access(p.id, userId);
        } else {
          inventory.access(runtime[1], userId);
          const app =
            inventory.applications(userId).find((p) => p.id === runtime[1]) ??
            fail(404, 'Proyecto no encontrado');
          const organization = store.db
            .prepare('SELECT organization_id FROM projects WHERE id=?')
            .get(app.id) as { organization_id: string };
          p = { ...app, organizationId: organization.organization_id, role: 'reader' };
        }

        if (runtime[2] === 'pages/by-path')
          send(200, store.published(p.id, url.searchParams.get('path') ?? '/'));
        else {
          const rows = store.db
            .prepare(
              'SELECT published FROM pages WHERE project_id=? AND published IS NOT NULL ORDER BY code',
            )
            .all(p.id) as { published: string }[];
          send(200, {
            project: p,
            pages: rows.map((r) => {
              const page = JSON.parse(r.published);
              return { name: page.name, code: page.code };
            }),
          });
        }

        return true;
      }

      const match = /^\/projects\/([^/]+)(?:\/(.*))?$/.exec(path);

      if (!match) fail(404, 'Endpoint no encontrado');

      const projectId = match[1],
        rest = match[2] ?? '';

      if (rest === 'connections' || rest.startsWith('connections/')) {
        const runtime = /^connections\/([^/]+)\/(query|access)$/.exec(rest);
        if (runtime) {
          if (runtime[2] === 'query' && method === 'POST') {
            send(200, await connections.query(projectId, userId, runtime[1], await readBody()));
            return true;
          }
          if (runtime[2] === 'access' && method === 'GET') {
            const version = z.coerce
              .number()
              .int()
              .positive()
              .parse(url.searchParams.get('version'));
            send(200, connections.access(projectId, userId, runtime[1], version));
            return true;
          }
          fail(404, 'Endpoint no encontrado');
        }
        store.access(projectId, userId, !['GET', 'HEAD'].includes(method));
        if (rest === 'connections/policy' && method === 'GET') {
          store.access(projectId, userId, false, true);
          send(200, connections.policy());
          return true;
        }
        if (rest === 'connections') {
          if (method === 'GET') {
            send(200, connections.list(projectId));
            return true;
          }
          if (method === 'POST') {
            send(201, connections.save(projectId, userId, await readBody()));
            return true;
          }
        }
        const environment = /^connections\/([^/]+)\/environments(?:\/([^/]+))?$/.exec(rest);
        if (environment) {
          if (!environment[2] && method === 'GET') {
            send(200, connections.environments(projectId, userId, environment[1]));
            return true;
          }
          if (environment[2] && method === 'PUT') {
            send(
              200,
              connections.configureEnvironment(
                projectId,
                userId,
                environment[1],
                environmentSchema.parse(environment[2]),
                await readBody(),
              ),
            );
            return true;
          }
        }
        const connection = /^connections\/([^/]+)(?:\/(publish|test|details))?$/.exec(rest);
        if (connection) {
          const [, id, action] = connection;
          if (!action && method === 'PUT') {
            send(200, connections.save(projectId, userId, await readBody(), id));
            return true;
          }
          if (!action && method === 'PATCH') {
            send(200, connections.configure(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'publish' && method === 'POST') {
            send(200, connections.publish(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'test' && method === 'POST') {
            send(200, await connections.test(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'details' && method === 'GET') {
            send(200, connections.details(projectId, id));
            return true;
          }
        }
        fail(404, 'Endpoint no encontrado');
      }
      if (rest === 'operations' || rest.startsWith('operations/')) {
        const execute = /^operations\/([^/]+)\/(execute|access|options\/([^/]+))$/.exec(rest);
        if (execute) {
          if (execute[2] === 'execute' && method === 'POST') {
            const result = operations.execute(projectId, userId, execute[1], await readBody());
            send(result.replayed ? 200 : 201, result);
            return true;
          }
          const version = z.coerce.number().int().positive().parse(url.searchParams.get('version'));
          if (execute[2] === 'access' && method === 'GET') {
            send(200, operations.access(projectId, userId, execute[1], version));
            return true;
          }
          if (execute[3] && method === 'GET') {
            send(
              200,
              operations.options(
                projectId,
                userId,
                execute[1],
                version,
                execute[3],
                url.searchParams.get('q') ?? '',
              ),
            );
            return true;
          }
          fail(404, 'Endpoint no encontrado');
        }
        store.access(projectId, userId, !['GET', 'HEAD'].includes(method));
        if (rest === 'operations') {
          if (method === 'GET') {
            send(200, operations.list(projectId));
            return true;
          }
          if (method === 'POST') {
            send(201, operations.save(projectId, userId, await readBody()));
            return true;
          }
        }
        const draftOptions = /^operations\/([^/]+)\/draft-options\/([^/]+)$/.exec(rest);
        if (draftOptions && method === 'GET') {
          send(
            200,
            operations.draftOptions(
              projectId,
              userId,
              draftOptions[1],
              draftOptions[2],
              url.searchParams.get('q') ?? '',
            ),
          );
          return true;
        }
        const operation = /^operations\/([^/]+)(?:\/(publish|simulate|impact|runs))?$/.exec(rest);
        if (operation) {
          const [, id, action] = operation;
          if (!action && method === 'PUT') {
            send(200, operations.save(projectId, userId, await readBody(), id));
            return true;
          }
          if (!action && method === 'PATCH') {
            send(200, operations.configure(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'publish' && method === 'POST') {
            send(200, operations.publish(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'simulate' && method === 'POST') {
            send(200, operations.simulate(projectId, userId, id, await readBody()));
            return true;
          }
          if (action === 'impact' && method === 'GET') {
            send(200, operations.impact(projectId, id));
            return true;
          }
          if (action === 'runs' && method === 'GET') {
            send(200, operations.runs(projectId, id));
            return true;
          }
        }
        fail(404, 'Endpoint no encontrado');
      }
      if (rest.startsWith('application/')) {
        store.access(projectId, userId, false, true);
        if (rest === 'application/members' && method === 'GET') {
          send(200, inventory.members(projectId, userId));
          return true;
        }
        const member = /^application\/members\/([^/]+)$/.exec(rest);
        if (member && method === 'PUT') {
          send(200, inventory.setRole(projectId, userId, member[1], await readBody()));
          return true;
        }
        if (rest === 'application/invitations' && method === 'POST') {
          send(201, inventory.invite(projectId, userId, await readBody()));
          return true;
        }
        const invitation = /^application\/invitations\/([^/]+)$/.exec(rest);
        if (invitation && method === 'DELETE') {
          store.db
            .prepare('DELETE FROM application_invitations WHERE id=? AND project_id=?')
            .run(invitation[1], projectId);
          store.audit(projectId, userId, 'application.invite.cancel', invitation[1]);
          send(204);
          return true;
        }
        fail(404, 'Endpoint no encontrado');
      }
      if (rest.startsWith('inventory/')) {
        if (rest === 'inventory/config') {
          store.access(projectId, userId);
          if (method === 'GET') {
            send(200, inventory.config(projectId));
            return true;
          }
          if (method === 'POST') {
            send(201, inventory.configure(projectId, userId, await readBody()));
            return true;
          }
        }
        if (rest === 'inventory/operations' && method === 'GET') {
          if (store.projects(userId).some((p) => p.id === projectId))
            store.access(projectId, userId);
          else inventory.access(projectId, userId);
          send(200, inventory.operations(projectId));
          return true;
        }
        inventory.access(projectId, userId);
        if (rest === 'inventory/access' && method === 'GET') {
          send(200, { role: inventory.access(projectId, userId), userId });
          return true;
        }
        if (rest === 'inventory/stock' && method === 'GET') {
          send(200, inventory.stock(projectId, url.searchParams));
          return true;
        }
        if (rest === 'inventory/movements') {
          if (method === 'GET') {
            send(200, inventory.history(projectId, url.searchParams));
            return true;
          }
          if (method === 'POST') {
            const result = inventory.move(projectId, userId, await readBody());
            send(result.replayed ? 200 : 201, result);
            return true;
          }
        }
        const product = /^inventory\/products\/([^/]+)\/(minimum|status)$/.exec(rest);
        if (product && method === 'PUT') {
          send(
            200,
            product[2] === 'minimum'
              ? inventory.minimum(projectId, userId, product[1], await readBody())
              : inventory.setActive(projectId, userId, product[1], await readBody()),
          );
          return true;
        }
        if (rest === 'inventory/actors' && method === 'GET') {
          send(
            200,
            store.db
              .prepare(
                'SELECT DISTINCT u.id,u.name FROM inventory_movements m JOIN users u ON u.id=m.actor_id WHERE m.project_id=? ORDER BY u.name',
              )
              .all(projectId),
          );
          return true;
        }
        fail(404, 'Endpoint no encontrado');
      }
      const restoring = rest === '' && method === 'PATCH';

      const project = restoring
        ? (store.projects(userId).find((p) => p.id === projectId) ??
          fail(404, 'Proyecto no encontrado'))
        : store.access(projectId, userId, !['GET', 'HEAD'].includes(method));

      if (rest === '' && method === 'PATCH') {
        if (project.role !== 'owner') fail(403, 'Solo el propietario puede realizar esta acción');

        const data = z
          .object({ name: z.string().trim().min(1).max(80), archived: z.boolean().optional() })
          .parse(await readBody());

        store.db
          .prepare('UPDATE projects SET name=?,archived=? WHERE id=?')
          .run(data.name, (data.archived ?? project.archived) ? 1 : 0, projectId);

        store.audit(projectId, userId, 'project.update', projectId);
        send(200, auth.session(userId));
        return true;
      }

      if (rest === 'members' && method === 'GET') {
        const members = store.db
          .prepare(
            'SELECT u.id AS userId,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY m.role,u.name',
          )
          .all(projectId);

        const invitations =
          project.role === 'owner'
            ? store.db
                .prepare(
                  'SELECT id,email,role,expires_at AS expiresAt FROM invitations WHERE project_id=? AND expires_at>?',
                )
                .all(projectId, Date.now())
            : [];

        send(200, { members, invitations });
        return true;
      }

      if (rest === 'invitations' && method === 'POST') {
        send(201, auth.invite(projectId, userId, await readBody()));
        return true;
      }

      const member = /^(members|invitations)\/([^/]+)$/.exec(rest);

      if (member && method === 'DELETE') {
        store.access(projectId, userId, false, true);

        if (member[1] === 'members') {
          const m = store.db
            .prepare('SELECT role FROM members WHERE project_id=? AND user_id=?')
            .get(projectId, member[2]) as { role: string } | undefined;

          if (!m) fail(404, 'Miembro no encontrado');
          if (m.role === 'owner') fail(400, 'No se puede retirar al propietario');

          store.db
            .prepare('DELETE FROM members WHERE project_id=? AND user_id=?')
            .run(projectId, member[2]);
        } else
          store.db
            .prepare('DELETE FROM invitations WHERE project_id=? AND id=?')
            .run(projectId, member[2]);

        store.audit(projectId, userId, 'member.remove', member[2]);
        send(204);
        return true;
      }

      if (rest === 'templates/inventory' && method === 'POST') {
        send(201, store.installInventory(projectId, userId));
        return true;
      }
      if (rest === 'entities') {
        if (method === 'GET') {
          send(200, store.entities(projectId));
          return true;
        }

        if (method === 'POST') {
          send(201, store.saveEntity(projectId, await readBody(), userId));
          return true;
        }
      }

      const entity = /^entities\/([^/]+)$/.exec(rest);

      if (entity && method === 'PUT') {
        send(200, store.saveEntity(projectId, await readBody(), userId, entity[1]));
        return true;
      }

      if (rest === 'services' && method === 'GET') {
        send(
          200,
          store.entities(projectId).map((e) => ({
            entity: e,
            operations: ['list', 'get', 'create', 'update', 'deactivate'].map((operation) => ({
              id: e.id + ':' + operation,
              operation,
              method:
                operation === 'create'
                  ? 'POST'
                  : operation === 'update'
                    ? 'PUT'
                    : operation === 'deactivate'
                      ? 'DELETE'
                      : 'GET',
              path: `/api/v1/projects/${projectId}/services/${e.id}/records${['get', 'update', 'deactivate'].includes(operation) ? '/:id' : ''}`,
            })),
          })),
        );
        return true;
      }

      const records = /^services\/([^/]+)\/records(?:\/([^/]+))?$/.exec(rest);

      if (records) {
        const [, entityId, id] = records;

        if (method === 'GET') {
          send(
            200,
            id
              ? store.getRecord(projectId, entityId, id)
              : store.listRecords(projectId, entityId, url.searchParams),
          );
          return true;
        }

        if (method === 'POST' && !id) {
          send(201, store.saveRecord(projectId, entityId, await readBody(), userId));
          return true;
        }

        if (method === 'PUT' && id) {
          send(200, store.saveRecord(projectId, entityId, await readBody(), userId, id));
          return true;
        }

        if (method === 'DELETE' && id) {
          const config = store.db
            .prepare('SELECT entity_id FROM inventory_config WHERE project_id=?')
            .get(projectId) as { entity_id: string } | undefined;
          if (config?.entity_id === entityId) inventory.access(projectId, userId, 'admin');
          const revision = z.coerce.number().int().min(1).parse(url.searchParams.get('revision'));
          store.deactivateRecord(projectId, entityId, id, revision, userId);
          send(204);
          return true;
        }
      }

      if (rest === 'blocks') {
        if (method === 'GET') {
          send(
            200,
            (
              store.db
                .prepare('SELECT data FROM blocks WHERE project_id=? ORDER BY rowid')
                .all(projectId) as { data: string }[]
            ).map((r) => JSON.parse(r.data)),
          );
          return true;
        }

        if (method === 'POST') {
          const data = blockInputSchema.parse(await readBody()),
            block = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
          store.db
            .prepare('INSERT INTO blocks VALUES (?,?,?)')
            .run(block.id, projectId, JSON.stringify(block));
          send(201, block);
          return true;
        }
      }

      const block = /^blocks\/([^/]+)$/.exec(rest);

      if (block && method === 'DELETE') {
        const result = store.db
          .prepare('DELETE FROM blocks WHERE id=? AND project_id=?')
          .run(block[1], projectId);
        if (!result.changes) fail(404, 'Bloque no encontrado');
        send(204);
        return true;
      }

      if (rest === 'pages' && method === 'GET') {
        send(200, store.pages(projectId));
        return true;
      }

      const page = /^pages\/([^/]+)$/.exec(rest);

      if (page && method === 'GET') {
        send(200, store.page(projectId, page[1]));
        return true;
      }

      if ((rest === 'pages' && method === 'POST') || (page && method === 'PUT')) {
        const input = await readBody();

        if ((input as { status?: string })?.status === 'published')
          store.access(projectId, userId, false, true);

        send(page ? 200 : 201, store.savePage(projectId, input, userId, page?.[1]));
        return true;
      }

      if (page && method === 'DELETE') {
        const old = store.page(projectId, page[1]);
        if (old.publicationVersion) store.access(projectId, userId, false, true);

        const revision = z.coerce.number().int().min(1).parse(url.searchParams.get('revision'));

        if (old.revision !== revision) fail(409, 'La página cambió. Recarga antes de eliminarla.');

        store.db.prepare('DELETE FROM pages WHERE id=? AND project_id=?').run(page[1], projectId);
        store.audit(projectId, userId, 'page.delete', page[1]);
        send(204);
        return true;
      }

      fail(404, 'Endpoint no encontrado');
    } catch (error) {
      if (error instanceof z.ZodError)
        send(400, { message: error.issues.map((i) => i.message).join('; ') });
      else if (error instanceof PlatformError)
        send(error.status, { message: error.message, fields: error.fields });
      else if (
        error instanceof Error &&
        'status' in error &&
        [400, 413].includes(Number(error.status))
      )
        send(Number(error.status), { message: error.message });
      else {
        console.error(error);
        send(500, {
          message: 'No se pudo completar la operación. Los cambios no se han confirmado.',
        });
      }
    }

    return true;
  };
}
