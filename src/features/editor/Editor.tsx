import { useEditor } from './hooks/useEditor';
import { ComponentTree } from './components/ComponentTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { EditorCanvas } from './components/EditorCanvas';
import { EditorToolbar } from './components/EditorToolbar';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { runtimeUrl } from '../../services/api';
import { catalog } from '../../components/renderer';
export function Editor() {
  const {
    page,
    selected,
    setSelected,
    error,
    notice,
    busy,
    dirty,
    preview,
    setPreview,
    load,
    change,
    save,
    nodes,
    node,
    containers,
    prop,
    add,
  } = useEditor();
  if (!page)
    return (
      <main className="screen-message">
        {error ? (
          <>
            <p className="alert" role="alert">
              {error}
            </p>
            <button onClick={load}>Reintentar</button>
          </>
        ) : (
          <p role="status">Cargando editor?</p>
        )}
        <Link to="/">Volver a páginas</Link>
      </main>
    );
  return (
    <div className="editor-shell">
      <EditorToolbar
        page={page}
        dirty={dirty}
        preview={preview}
        busy={busy}
        onPreview={() => setPreview(!preview)}
        onSave={save}
      />
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="editor-body">
        {!preview && (
          <aside className="editor-left">
            <div className="panel-heading">INSERTAR COMPONENTES</div>
            <div className="catalog">
              {catalog.map((type) => (
                <button key={type} onClick={() => add(type)}>
                  <Plus size={16} />
                  {type}
                </button>
              ))}
            </div>
            <p className="panel-help">
              Se añade dentro del contenedor seleccionado o al nivel raíz.
            </p>
            <div className="panel-heading border-t">CAPAS DE LA PÁGINA</div>
            <button className="root-select" onClick={() => setSelected('')}>
              Página · nivel raíz
            </button>
            <ComponentTree
              nodes={nodes}
              selected={selected}
              onSelect={setSelected}
              onChange={change}
            />
          </aside>
        )}
        <EditorCanvas
          nodes={nodes}
          name={page.name}
          preview={preview}
          selected={selected}
          onSelect={setSelected}
          onAdd={add}
        />
        {!preview && (
          <PropertiesPanel
            key={selected}
            node={node}
            nodes={nodes}
            selected={selected}
            containers={containers}
            onProperty={prop}
            onChange={change}
            onSelect={setSelected}
          />
        )}
      </div>
      <footer className="editor-status">
        <span className="dev-dot" />
        {dirty ? 'Cambios pendientes' : 'Todos los cambios guardados'}
        <a href={runtimeUrl + '/' + page.code} target="_blank" rel="noreferrer">
          Abrir Runtime ↗
        </a>
      </footer>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
