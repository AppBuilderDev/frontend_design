import { CodePanel } from './code/CodePanel';
import { toCraft } from './craft/adapter';
import { useEndpoints } from '../workspace/useEndpoints';
import { EditorLibrary } from './components/EditorLibrary';
import { useConnections } from '../workspace/useConnections';
import { useOperations } from '../workspace/useOperations';
import { DataProvider } from '../../components/dataComponents';
import { getProjectScope } from '../../services/projectScope';
import { useEntities } from '../workspace/useEntities';
import { Editor as CraftEditor } from '@craftjs/core';
import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Blocks, X } from 'lucide-react';
import { useEditor } from './hooks/useEditor';
import { ComponentTree } from './components/ComponentTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { EditorCanvas } from './components/EditorCanvas';
import { EditorToolbar } from './components/EditorToolbar';
import { runtimeUrl } from '../../services/api';
import { CraftRoot, CraftBlock } from './craft/CraftComponents';
import { ROOT, fromCraft } from './craft/adapter';
import { useEditorCommands } from './hooks/useEditorCommands';
import { useBlocks } from './hooks/useBlocks';
import { BlockLibrary, SaveBlockDialog } from './components/BlockLibrary';
import { SelectionBar } from './components/SelectionBar';
import type { ComponentNode } from '../../models/contracts';
import type { Page } from '../../models/contracts';

type Session = ReturnType<typeof useEditor>;

export function Editor() {
  const session = useEditor();
  const scope = getProjectScope();
  const { entities } = useEntities(scope?.id);
  const { operations } = useOperations(scope?.id);
  const { connections } = useConnections(scope?.id);
  const { endpoints } = useEndpoints(scope?.id);
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
          <p role="status">Cargando editor...</p>
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
      {scope ? (
        <DataProvider
          endpoints={endpoints}
          projectId={scope.id}
          entities={entities}
          operations={operations.flatMap((o) =>
            o.active ? o.versions.filter((v) => v.version === o.publishedVersion) : [],
          )}
          connections={connections.flatMap((c) =>
            c.active ? c.versions.filter((v) => v.version === c.publishedVersion) : [],
          )}
          canWrite={scope.role !== 'reader'}
          preview
        >
          <Workspace session={session} page={session.page} />
        </DataProvider>
      ) : (
        <Workspace session={session} page={session.page} />
      )}
    </CraftEditor>
  );
}

function Workspace({ session, page }: { session: Session; page: Page }) {
  const [initialNodes] = useState(page.components);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codePending, setCodePending] = useState(false);
  const commands = useEditorCommands({
    preview: session.preview,
    onSave: (nodes) => {
      if (codePending) {
        window.alert('Aplica o descarta el codigo antes de guardar.');
        return;
      }
      void session.save(nodes);
    },
  });
  const {
    actions,
    serialized,
    selected,
    canUndo,
    canRedo,
    nodes,
    ids,
    node,
    containers,
    add,
    reorder,
  } = commands;
  const library = useBlocks();
  const [tab, setTab] = useState<'components' | 'blocks' | 'layers' | null>('components');
  const [dismissedInspector, setDismissedInspector] = useState('');
  const onCodePending = useCallback((pending: boolean) => setCodePending(pending), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (codePending) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [codePending]);
  const applyCode = (items: ComponentNode[]) => {
    actions.deserialize(toCraft(items));
    actions.selectNode();
    session.change(items);
  };
  const savePage = (publish = false) => {
    if (codePending) {
      window.alert('Aplica o descarta los cambios de codigo antes de guardar.');
      return;
    }
    void session.save(nodes, publish);
  };

  const changeProperty = (key: string, value: string) =>
    actions.history.throttle(400).setProp(selected, (props) => {
      props.nodeProps[key] = value;
    });
  const [blockSelection, setBlockSelection] = useState<ComponentNode[]>();
  const { dirty, preview, busy, error, notice } = session;
  return (
    <div className={'editor-shell studio-editor classic-editor' + (preview ? ' is-preview' : '')}>
      <EditorToolbar
        page={page}
        dirty={dirty || codePending}
        preview={preview}
        busy={busy}
        codeOpen={codeOpen}
        onCode={() => setCodeOpen(!codeOpen)}
        onPreview={() => session.setPreview(!preview)}
        onSave={() => savePage()}
        onPublish={() => savePage(true)}
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
      <div hidden={!codeOpen}>
        <CodePanel
          nodes={nodes}
          onApply={applyCode}
          onPending={onCodePending}
          readOnly={getProjectScope()?.role === 'reader'}
        />
      </div>
      <div className="editor-body">
        {!preview && (
          <aside className="editor-left studio-library" aria-label="Biblioteca del editor">
            <nav className="classic-tabs" aria-label="Herramientas del editor">
              <button
                aria-label="Añadir elementos"
                aria-pressed={tab === 'components'}
                onClick={() => setTab('components')}
              >
                <Plus size={15} />
                Elementos
              </button>
              <button
                aria-label="Ver capas"
                aria-pressed={tab === 'layers'}
                onClick={() => setTab('layers')}
              >
                <Layers size={15} />
                Estructura
              </button>
              <button
                title="Secciones"
                aria-label="Ver secciones"
                aria-pressed={tab === 'blocks'}
                onClick={() => setTab('blocks')}
              >
                <Blocks size={15} />
                Secciones
              </button>
            </nav>
            {tab && (
              <div className="classic-library-content">
                <div className="classic-library-heading">
                  <h2 className="sr-only">
                    {tab === 'components'
                      ? 'Añadir elementos'
                      : tab === 'layers'
                        ? 'Estructura de la página'
                        : 'Secciones'}
                  </h2>
                  <button
                    className="mobile-panel-close"
                    aria-label="Cerrar biblioteca"
                    onClick={() => setTab(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
                {tab === 'components' && <EditorLibrary onAdd={add} />}
                {tab === 'blocks' && <BlockLibrary library={library} onInsert={commands.insert} />}
                {tab === 'layers' && <ComponentTree nodes={nodes} selected={selected} ids={ids} />}
              </div>
            )}
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
            mobileDismissed={!!node && dismissedInspector === selected}
            key={selected}
            node={node}
            containers={containers}
            onClose={() => setDismissedInspector(selected)}
            onProperty={changeProperty}
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
        <a
          href={
            runtimeUrl + (getProjectScope() ? '/p/' + getProjectScope()!.id : '') + '/' + page.code
          }
          target="_blank"
          rel="noreferrer"
        >
          Ver aplicación ↗
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
