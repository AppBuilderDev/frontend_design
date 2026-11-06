import { useCallback, useEffect, useState } from 'react';
import type { Member } from '../../models/data';
import { platformRequest } from '../../services/platformHttp';
import { useWorkspace } from './WorkspaceContext';
interface Team {
  members: Member[];
  invitations: { id: string; email: string; role: string; expiresAt: number }[];
}
export function WorkspaceTeam() {
  const { project, refresh } = useWorkspace();
  const [team, setTeam] = useState<Team>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState('');
  const load = useCallback(
    () =>
      platformRequest<Team>('/projects/' + project.id + '/members')
        .then(setTeam)
        .catch((e: Error) => setError(e.message)),
    [project.id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const owner = project.role === 'owner';
  async function remove(path: string) {
    setError('');
    setBusy(true);
    try {
      await platformRequest('/projects/' + project.id + '/' + path, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <h1>Equipo y proyecto</h1>
          <p>
            {project.organization} tiene un único proyecto. Compartirlo no crea copias de sus datos.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <section className="workspace-section">
        <h2>Miembros</h2>
        <p>
          Solo el propietario publica, administra miembros y archiva. Los editores guardan
          borradores y configuran el proyecto. Los lectores solo consultan.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Acceso</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {team?.members.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    {m.role === 'owner' ? 'Propietario' : m.role === 'editor' ? 'Editor' : 'Lector'}
                  </td>
                  <td>
                    {owner && m.role !== 'owner' && (
                      <button disabled={busy} onClick={() => void remove('members/' + m.userId)}>
                        Retirar acceso
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {owner && (
        <section className="workspace-section">
          <h2>Invitar a una persona</h2>
          <p>
            Genera un enlace privado, válido por 72 horas. Compártelo con el destinatario; la
            invitación solo se acepta con su correo.
          </p>
          <form
            className="inline-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              setBusy(true);
              const data = Object.fromEntries(new FormData(event.currentTarget));
              try {
                const result = await platformRequest<{ token: string }>(
                  '/projects/' + project.id + '/invitations',
                  { method: 'POST', body: JSON.stringify(data) },
                );
                setInvitation(
                  window.location.origin + '/workspace?invite=' + encodeURIComponent(result.token),
                );
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Correo del invitado
              <input name="email" type="email" required />
            </label>
            <label>
              Acceso
              <select name="role">
                <option value="editor">Editor</option>
                <option value="reader">Lector</option>
              </select>
            </label>
            <button className="primary" disabled={busy}>
              Generar invitación
            </button>
          </form>
          {invitation && (
            <label className="invitation-link">
              Enlace privado de invitación
              <input
                aria-label="Enlace privado de invitación"
                value={invitation}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          {team?.invitations.map((i) => (
            <div className="invitation-row" key={i.id}>
              <span>
                {i.email} · {i.role === 'editor' ? 'Editor' : 'Lector'}
              </span>
              <button disabled={busy} onClick={() => void remove('invitations/' + i.id)}>
                Cancelar invitación
              </button>
            </div>
          ))}
        </section>
      )}
      {owner && (
        <section className="workspace-section">
          <h2>Proyecto</h2>
          <form
            className="inline-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              setBusy(true);
              const name = String(new FormData(event.currentTarget).get('name'));
              try {
                await platformRequest('/projects/' + project.id, {
                  method: 'PATCH',
                  body: JSON.stringify({ name }),
                });
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nombre del proyecto
              <input name="name" required maxLength={80} defaultValue={project.name} />
            </label>
            <button disabled={busy}>Guardar nombre</button>
          </form>
          <details className="archive-project">
            <summary>Archivar proyecto</summary>
            <p>
              Suspende las páginas y operaciones del proyecto. Los datos se conservan en la base de
              datos.
            </p>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('¿Archivar el proyecto y suspender sus páginas?')) return;
                setBusy(true);
                try {
                  await platformRequest('/projects/' + project.id, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: project.name, archived: true }),
                  });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Archivar proyecto
            </button>
          </details>
        </section>
      )}
    </main>
  );
}
