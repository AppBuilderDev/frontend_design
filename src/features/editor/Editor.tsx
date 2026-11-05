import { Editor as CraftEditor } from '@craftjs/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, GripVertical, Component, Blocks } from 'lucide-react';
import { useEditor } from './hooks/useEditor';
import { ComponentTree } from './components/ComponentTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { EditorCanvas } from './components/EditorCanvas';
import { EditorToolbar } from './components/EditorToolbar';
import { runtimeUrl } from '../../services/api';
import { catalog } from '../../components/renderer';
import { CraftRoot, CraftBlock } from './craft/CraftComponents';
import { ROOT, fromCraft } from './craft/adapter';
import { useEditorCommands } from './hooks/useEditorCommands';
import { useBlocks } from './hooks/useBlocks';
import { BlockLibrary, SaveBlockDialog } from './components/BlockLibrary';
import { SelectionBar } from './components/SelectionBar';
import type { ComponentNode } from '../../models/contracts';
import { defaults } from './config/catalog';
import type { Page } from '../../models/contracts';

type Session = ReturnType<typeof useEditor>;

export function Editor() {
  const session = useEditor();
  if (!session.page)
    return (
      <main className="screen-message">
        {session.error ? (
          <>
            <p className="alert" role="alert">
              {session.error}
            </p>
            <button onClick={session.load}>Reintentar</button>
          </>
        ) : (
          <p role="status">Cargando editor…</p>
        )}
        <Link to="/">Volver a páginas</Link>
      </main>
    );
  return (
    <CraftEditor
      key={session.page.id}
      resolver={{ CraftRoot, CraftBlock }}
      enabled={!session.preview}
      indicator={{ success: '#635bdf', error: '#c34444', thickness: 3 }}
      onNodesChange={(query) => session.change(fromCraft(query.getSerializedNodes()))}
    >
      <Workspace session={session} page={session.page} />
    </CraftEditor>
  );
}

function Workspace({ session, page }: { session: Session; page: Page }) {
  const [initialNodes] = useState(page.components);
  const commands = useEditorCommands({
    preview: session.preview,
    onSave: (nodes) => void session.save(nodes),
  });
  const {
    actions,
    connectors,
    serialized,
    selected,
    canUndo,
    canRedo,
    nodes,
    ids,
    node,
    containers,
    element,
    add,
    reorder,
  } = commands;
  const library = useBlocks();
  const [tab, setTab] = useState<'components' | 'blocks'>('components');
  const [blockSelection, setBlockSelection] = useState<ComponentNode[]>();
  const { dirty, preview, busy, error, notice } = session;
  return (
    <div className="editor-shell">
      <EditorToolbar
        page={page}
        dirty={dirty}
        preview={preview}
        busy={busy}
        onPreview={() => session.setPreview(!preview)}
        onSave={() => void session.save(nodes)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => commands.history('undo')}
        onRedo={() => commands.history('redo')}
      />
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="editor-body">
        {!preview && (
          <aside className="editor-left">
            <div className="library-tabs" role="tablist" aria-label="Biblioteca de inserción">
              <button
                role="tab"
                id="components-tab"
                aria-selected={tab === 'components'}
                aria-controls="components-panel"
                onClick={() => setTab('components')}
              >
                <Component size={15} />
                Componentes
              </button>
              <button
                role="tab"
                id="blocks-tab"
                aria-selected={tab === 'blocks'}
                aria-controls="blocks-panel"
                onClick={() => setTab('blocks')}
              >
                <Blocks size={15} />
                Bloques
              </button>
            </div>
            <div
              role="tabpanel"
              id="components-panel"
              aria-labelledby="components-tab"
              hidden={tab !== 'components'}
            >
              <div className="catalog">
                {catalog.map((type) => (
                  <button
                    key={type}
                    ref={(el) => {
                      if (el)
                        connectors.create(
                          el,
                          element({ id: crypto.randomUUID(), type, props: { ...defaults[type] } }),
                        );
                    }}
                    title={'Arrastra ' + type + ' al lienzo o haz clic para añadirlo'}
                    onClick={() => add(type)}
                  >
                    <Plus size={16} />
                    {type}
                    <GripVertical className="catalog-grip" size={12} />
                  </button>
                ))}
              </div>
              <p className="panel-help">
                Arrastra al lienzo para elegir la posición. Haz clic para añadir dentro del
                contenedor seleccionado.
              </p>
            </div>
            <div
              role="tabpanel"
              id="blocks-panel"
              aria-labelledby="blocks-tab"
              hidden={tab !== 'blocks'}
            >
              <BlockLibrary library={library} onInsert={commands.insert} />
            </div>
            <div className="panel-heading border-t">Capas de la página</div>
            <ComponentTree nodes={nodes} selected={selected} ids={ids} />
          </aside>
        )}
        <EditorCanvas
          nodes={nodes}
          initialNodes={initialNodes}
          name={page.name}
          preview={preview}
          selectionBar={
            !preview && (
              <SelectionBar
                path={commands.path}
                onSelect={(id) => actions.selectNode(id)}
                selected={!!node}
                onDuplicate={commands.duplicate}
                onCopy={() => void commands.copy()}
                onPaste={() => void commands.paste()}
                onDelete={commands.remove}
                onSaveBlock={() => {
                  if (node) {
                    setTab('blocks');
                    setBlockSelection([structuredClone(node)]);
                  }
                }}
              />
            )
          }
        />
        {!preview && (
          <PropertiesPanel
            key={selected}
            node={node}
            containers={containers}
            onProperty={(key, value) =>
              actions.history.throttle(400).setProp(selected, (props) => {
                props.nodeProps[key] = value;
              })
            }
            onReorder={reorder}
            onMove={(id) => {
              const parent = id ? ids.get(id)! : ROOT;
              actions.move(selected, parent, serialized[parent].nodes.length);
            }}
            onDelete={commands.remove}
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
      {commands.message && (
        <div className="command-notice" role="status">
          {commands.message}
        </div>
      )}
      {blockSelection && (
        <SaveBlockDialog
          components={blockSelection}
          library={library}
          onClose={() => setBlockSelection(undefined)}
        />
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
