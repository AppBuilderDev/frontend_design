import { usePages } from '../hooks/usePages';
import { Layers, Files, Plus } from 'lucide-react';
import { PageTable } from '../components/PageTable';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { PageFormDialog } from '../components/PageFormDialog';
import { DeletePageDialog } from '../components/DeletePageDialog';
export function PagesPage() {
  const {
    pages,
    loading,
    error,
    query,
    setQuery,
    editing,
    setEditing,
    deleting,
    setDeleting,
    busy,
    notice,
    setError,
    load,
    save,
    deletePage,
  } = usePages();
  return (
    <AdminLayout count={pages.length}>
      <main className="page-content">
        <div className="eyebrow">TU SITIO, A TU MANERA</div>
        <div className="page-heading">
          <div>
            <h1>Páginas</h1>
            <p className="muted">Crea, diseña y publica las experiencias de tu proyecto.</p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setError('');
              setEditing(null);
            }}
          >
            <Plus size={17} /> Crear página
          </button>
        </div>
        <div className="stats">
          <div>
            <span>Total de páginas</span>
            <strong>{pages.length.toString().padStart(2, '0')}</strong>
            <Files size={20} />
          </div>
          <div>
            <span>Publicadas</span>
            <strong>
              {pages
                .filter((p) => p.status === 'published')
                .length.toString()
                .padStart(2, '0')}
            </strong>
            <span className="stat-dot green" />
          </div>
          <div>
            <span>En borrador</span>
            <strong>
              {pages
                .filter((p) => p.status === 'draft')
                .length.toString()
                .padStart(2, '0')}
            </strong>
            <span className="stat-dot purple" />
          </div>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error} <button onClick={() => void load()}>Reintentar</button>
          </div>
        )}
        <PageTable
          pages={pages}
          loading={loading}
          query={query}
          onQuery={setQuery}
          onEdit={(page) => {
            setError('');
            setEditing(page);
          }}
          onDelete={setDeleting}
          onCreate={() => setEditing(null)}
        />

        <div className="tip">
          <Layers size={22} />
          <div>
            <strong>De una idea a una experiencia.</strong>
            <p>Diseña con componentes, ajusta cada detalle y publica cuando estás listo.</p>
          </div>
        </div>
      </main>
      {editing !== undefined && (
        <PageFormDialog
          editing={editing}
          busy={busy}
          error={error}
          onSubmit={save}
          onCancel={() => setEditing(undefined)}
        />
      )}
      {deleting && (
        <DeletePageDialog
          page={deleting}
          busy={busy}
          error={error}
          onCancel={() => setDeleting(null)}
          onConfirm={deletePage}
        />
      )}
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
    </AdminLayout>
  );
}
