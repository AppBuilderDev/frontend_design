import { runtimeUrl } from '../../services/api';
import { Eye, EyeOff } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PlatformSession, ProjectAccess } from '../../models/data';
import { ApiError, platformRequest } from '../../services/platformHttp';
import { setProjectScope } from '../../services/projectScope';

interface WorkspaceState {
  session: PlatformSession;
  project: ProjectAccess;
  refresh: () => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('Proyecto no seleccionado');
  return value;
}
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlatformSession>();
  const [project, setProject] = useState<ProjectAccess>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  function install(next: PlatformSession) {
    const requested =
      new URLSearchParams(window.location.search).get('project') ??
      sessionStorage.getItem('ab.project');
    const active =
      next.projects.find((p) => p.id === requested) ??
      next.projects.find((p) => !p.archived) ??
      next.projects[0];
    setProjectScope(active);
    if (active) sessionStorage.setItem('ab.project', active.id);
    setProject(active);
    setSession(next);
    setReady(true);
  }
  async function refresh() {
    install(await platformRequest<PlatformSession>('/auth/session'));
  }
  useEffect(() => {
    let active = true;
    platformRequest<PlatformSession>('/auth/session')
      .then(async (value) => {
        const invite = new URLSearchParams(window.location.search).get('invite');
        if (invite) {
          value = await platformRequest<PlatformSession>('/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: invite }),
          });
          window.history.replaceState(null, '', window.location.pathname);
        }
        if (active) install(value);
      })
      .catch((e: Error) => {
        if (active) {
          if (!(e instanceof ApiError) || e.status !== 401) setError(e.message);
          setReady(true);
        }
      });
    return () => {
      active = false;
      setProjectScope(undefined);
    };
  }, []);
  if (!ready)
    return (
      <main className="screen-message" role="status">
        Cargando tu espacio de trabajo…
      </main>
    );
  if (!session) return <AuthScreen onAuthenticated={install} connectionError={error} />;
  if (!project)
    return (
      <main className="screen-message">
        <h1>{session.applications?.length ? 'Tus aplicaciones' : 'Sin proyectos disponibles'}</h1>
        {session.applications
          ?.filter((app) => !app.archived)
          .map((app) => (
            <p key={app.id}>
              <a
                className="workspace-text-link"
                href={runtimeUrl + '/' + (app.slug ?? 'p/' + app.id) + '/'}
              >
                Abrir {app.organization} · {app.name}
              </a>
            </p>
          ))}
        <p>
          {session.applications?.length
            ? 'Tienes acceso a estas aplicaciones. Para construir páginas necesitas una invitación de construcción.'
            : 'Pide una invitación al propietario.'}
        </p>
        <button
          onClick={() =>
            void platformRequest('/auth/logout', { method: 'POST' }).then(() => location.reload())
          }
        >
          Cerrar sesión
        </button>
      </main>
    );
  return (
    <WorkspaceContext.Provider value={{ session, project, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

function AuthScreen({
  onAuthenticated,
  connectionError,
}: {
  onAuthenticated: (s: PlatformSession) => void;
  connectionError: string;
}) {
  const invitation = new URLSearchParams(window.location.search).get('invite') ?? '';
  const [register, setRegister] = useState(!!invitation);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(connectionError);
  const [busy, setBusy] = useState(false);
  return (
    <main className="workspace-auth">
      <section className="auth-story">
        <span className="auth-brand">AppBuilder.</span>
        <h1>Tu próxima gran idea empieza aquí.</h1>
        <p>
          Crea herramientas para tu negocio sin saber programar. Organiza tu información, diseña tus
          páginas y trabaja con tu equipo.
        </p>
        <div className="auth-sample">
          <strong>Tu primera aplicación</strong>
          <span>01 Organiza tus datos · 02 Diseña · 03 Comparte</span>
          <small>Todo lo que necesitas, en un solo espacio. A tu ritmo.</small>
        </div>
      </section>
      <section className="auth-form">
        <h2>{register ? 'Crea tu espacio de trabajo' : 'Bienvenido de nuevo'}</h2>
        <p>
          {invitation
            ? 'Tienes una invitación. Usa el correo al que fue dirigida.'
            : 'Accede a tu organización y a los proyectos que comparten contigo.'}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            const data = Object.fromEntries(new FormData(event.currentTarget));
            try {
              let next = await platformRequest<PlatformSession>(
                register ? '/auth/register' : '/auth/login',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    ...data,
                    ...(invitation && register ? { invitation } : {}),
                  }),
                },
              );
              if (invitation && !register)
                next = await platformRequest<PlatformSession>('/invitations/accept', {
                  method: 'POST',
                  body: JSON.stringify({ token: invitation }),
                });
              window.history.replaceState(null, '', window.location.pathname);
              onAuthenticated(next);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Tu nombre
              <input name="name" required maxLength={80} autoComplete="name" />
            </label>
          )}
          {register && !invitation && (
            <label>
              Nombre de tu negocio o equipo
              <input
                name="organization"
                required
                maxLength={80}
                placeholder="Por ejemplo, Almacén Central"
              />
            </label>
          )}
          <label>
            Correo
            <input name="email" type="email" required autoComplete="email" maxLength={200} />
          </label>
          <div className="auth-password-field">
            <label htmlFor="auth-password">Contraseña</label>
            <div className="auth-password-input">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-controls="auth-password"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {register && <small>Usa al menos 12 caracteres para proteger tu cuenta.</small>}
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>
        <button
          className="auth-toggle"
          onClick={() => {
            setRegister(!register);
            setShowPassword(false);
            setError('');
          }}
        >
          {register ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
        </button>
      </section>
    </main>
  );
}
