import { runtimeUrl } from '../../../services/api';
import { getProjectScope } from '../../../services/projectScope';
import { Link } from 'react-router-dom';
import { Files, Search, ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import type { Page } from '../../../models/contracts';
interface Props {
  readOnly?: boolean;
  pages: Page[];
  loading: boolean;
  query: string;
  onQuery: (query: string) => void;
  onEdit: (page: Page) => void;
  onDelete: (page: Page) => void;
  onCreate: () => void;
}
export function PageTable({
  pages,
  loading,
  query,
  onQuery: setQuery,
  onEdit,
  onDelete: setDeleting,
  onCreate,
  readOnly = false,
}: Props) {
  return (
    <section className="page-table">
      <div className="table-toolbar">
        <div>
          <strong>Todas las páginas</strong>
          <span className="count">{pages.length}</span>
        </div>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Buscar páginas"
            placeholder="Busca una página…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <div className="empty" role="status">
          Cargando páginas...
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre de página</th>
                  <th>Dirección de la página</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pages
                  .filter((p) =>
                    (p.name + ' ' + p.code).toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((page) => (
                    <tr key={page.id}>
                      <td>
                        <Link
                          className="page-name"
                          to={(getProjectScope() ? '/workspace/editor/' : '/editor/') + page.id}
                        >
                          <span className="file-icon">
                            <Files size={18} />
                          </span>
                          {page.name}
                        </Link>
                      </td>
                      <td>
                        <a
                          className="published-route"
                          href={
                            runtimeUrl +
                            (getProjectScope() ? '/p/' + getProjectScope()!.id : '') +
                            '/' +
                            page.code
                          }
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir la página publicada; si es nueva, publícala primero"
                        >
                          <code>/{page.code}</code>
                          <ArrowUpRight size={13} />
                        </a>
                      </td>
                      <td>
                        <span className={'badge ' + page.status}>
                          {page.status === 'published' ? '● Publicado' : '◌ Borrador'}
                        </span>
                      </td>
                      <td className="muted">
                        {new Date(page.updatedAt).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <div className="actions">
                          <Link
                            className="editor-link"
                            to={(getProjectScope() ? '/workspace/editor/' : '/editor/') + page.id}
                          >
                            Diseñar <ArrowUpRight size={14} />
                          </Link>
                          <button
                            disabled={readOnly}
                            aria-label={'Editar ' + page.name}
                            onClick={() => onEdit(page)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            disabled={readOnly}
                            aria-label={'Eliminar ' + page.name}
                            onClick={() => setDeleting(page)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!pages.some((p) =>
            (p.name + ' ' + p.code).toLowerCase().includes(query.toLowerCase()),
          ) && (
            <div className="empty">
              <Files size={36} className="mx-auto mb-4" />
              <h3>{query ? 'No hay resultados' : 'Tu próxima idea empieza aquí'}</h3>
              <p>
                {query
                  ? 'Prueba con otro nombre o dirección.'
                  : 'Crea tu primera página y dale forma en el editor visual.'}
              </p>
              {!query && !readOnly && (
                <button className="primary" onClick={onCreate}>
                  Crear primera página
                </button>
              )}
            </div>
          )}
        </>
      )}
      <footer className="table-footer">
        {pages.length} páginas en tu proyecto
        <span>
          {getProjectScope()
            ? 'Guardar conserva borradores. El propietario puede publicar para el equipo.'
            : 'Al guardar, los cambios se hacen públicos.'}
        </span>
      </footer>
    </section>
  );
}
