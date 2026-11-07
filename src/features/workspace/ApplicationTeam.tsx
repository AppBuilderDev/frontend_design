import { useCallback, useEffect, useState } from 'react';
import type { Member } from '../../models/data';
import type { InventoryRole } from '../../models/inventory';
import { platformRequest } from '../../services/platformHttp';
interface AppTeam {
  members: { userId: string; name: string; email: string; role: InventoryRole }[];
  invitations: { id: string; email: string; role: InventoryRole }[];
}
const roles = [
  ['none', 'Sin acceso operativo'],
  ['viewer', 'Consulta'],
  ['operator', 'Operador'],
  ['admin', 'Administrador de aplicación'],
];
export function ApplicationTeam({
  projectId,
  ownerId,
  builders,
}: {
  projectId: string;
  ownerId: string;
  builders: Member[];
}) {
  const [team, setTeam] = useState<AppTeam>(),
    [error, setError] = useState(''),
    [link, setLink] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      platformRequest<AppTeam>('/projects/' + projectId + '/application/members')
        .then(setTeam)
        .catch((e: Error) => setError(e.message)),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const people = Array.from(
    new Map([...builders, ...(team?.members ?? [])].map((p) => [p.userId, p])).values(),
  );
  return (
    <section className="workspace-section">
      <h2>Acceso a la aplicación</h2>
      <p>
        Estos permisos son independientes del acceso para construir. El propietario administra el
        inventario; los demás necesitan un permiso explícito. Operador: entradas y salidas.
        Administrador de aplicación: también ajustes, mínimos y estado de productos. Consulta: solo
        lectura.
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table aria-label="Permisos operativos">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Correo</th>
              <th>Permiso en la aplicación</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.userId}>
                <td>{person.name}</td>
                <td>{person.email}</td>
                <td>
                  {person.userId === ownerId ? (
                    'Administrador de aplicación (propietario)'
                  ) : (
                    <select
                      aria-label={'Permiso operativo de ' + person.name}
                      disabled={busy}
                      value={team?.members.find((p) => p.userId === person.userId)?.role ?? 'none'}
                      onChange={async (e) => {
                        setBusy(true);
                        setError('');
                        try {
                          await platformRequest(
                            '/projects/' + projectId + '/application/members/' + person.userId,
                            { method: 'PUT', body: JSON.stringify({ role: e.target.value }) },
                          );
                          await load();
                        } catch (error) {
                          setError((error as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {roles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Invitar a usar la aplicación</h3>
      <p>
        Esta invitación permite usar la aplicación sin conceder acceso al diseño, entidades o
        publicación.
      </p>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError('');
          try {
            const result = await platformRequest<{ token: string }>(
              '/projects/' + projectId + '/application/invitations',
              { method: 'POST', body: JSON.stringify(data) },
            );
            setLink(
              window.location.origin + '/workspace?invite=' + encodeURIComponent(result.token),
            );
            await load();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Correo operativo
          <input name="email" type="email" required />
        </label>
        <label>
          Permiso operativo
          <select name="role">
            {roles
              .filter(([v]) => v !== 'none')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <button className="primary" disabled={busy}>
          Generar invitación operativa
        </button>
      </form>
      {link && (
        <label className="invitation-link">
          Enlace privado de aplicación
          <input
            aria-label="Enlace privado de aplicación"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      {team?.invitations.map((invite) => (
        <div className="invitation-row" key={invite.id}>
          <span>
            {invite.email} · {roles.find(([v]) => v === invite.role)?.[1]}
          </span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await platformRequest(
                  '/projects/' + projectId + '/application/invitations/' + invite.id,
                  { method: 'DELETE' },
                );
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancelar invitación operativa
          </button>
        </div>
      ))}
    </section>
  );
}
