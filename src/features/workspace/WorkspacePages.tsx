import { usePages } from '../pages/hooks/usePages';
import { PageTable } from '../pages/components/PageTable';
import { PageFormDialog } from '../pages/components/PageFormDialog';
import { DeletePageDialog } from '../pages/components/DeletePageDialog';
import { useWorkspace } from './WorkspaceContext';
export function WorkspacePages() {
  const { project } = useWorkspace();
  const state = usePages();
  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">DISEÑA Y COMPARTE</span>
          <h1>Mis páginas</h1>
          <p>
            Cada página es una pantalla de tu aplicación. Diseña, revisa y publica cuando esté
            lista.
          </p>
        </div>
        {project.role !== 'reader' && (
          <button
            className="primary"
            onClick={() => {
              state.setError('');
              state.setEditing(null);
            }}
          >
            Crear página
          </button>
        )}
      </div>
      {state.error && (
        <p role="alert" className="alert">
          {state.error}
          <button onClick={() => void state.load()}>Reintentar</button>
        </p>
      )}
      <div className="context-tip">
        <strong>Tu trabajo, a tu ritmo.</strong> Guardar conserva tus cambios como borrador.
        Publicar los hace visibles para tu equipo.
      </div>
      <PageTable
        pages={state.pages}
        loading={state.loading}
        query={state.query}
        onQuery={state.setQuery}
        onEdit={state.setEditing}
        onDelete={state.setDeleting}
        onCreate={() => state.setEditing(null)}
        readOnly={project.role === 'reader'}
      />
      {state.editing !== undefined && (
        <PageFormDialog
          editing={state.editing}
          busy={state.busy}
          error={state.error}
          onSubmit={state.save}
          onCancel={() => state.setEditing(undefined)}
        />
      )}
      {state.deleting && (
        <DeletePageDialog
          page={state.deleting}
          busy={state.busy}
          error={state.error}
          onConfirm={state.deletePage}
          onCancel={() => state.setDeleting(null)}
        />
      )}
      {state.notice && (
        <div role="status" className="notice">
          {state.notice}
        </div>
      )}
    </main>
  );
}
