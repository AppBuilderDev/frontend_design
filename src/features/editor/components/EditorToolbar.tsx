import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Undo2, Redo2 } from 'lucide-react';
import type { Page } from '../../../models/contracts';
interface Props {
  page: Page;
  dirty: boolean;
  preview: boolean;
  busy: boolean;
  onPreview: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}
export function EditorToolbar({
  page,
  dirty,
  preview,
  busy,
  onPreview,
  onSave: save,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  return (
    <header className="editor-toolbar">
      <div className="actions">
        <Link
          aria-label="Volver a páginas"
          to="/"
          onClick={(e) => {
            if (dirty && !window.confirm('Hay cambios sin guardar. ¿Salir del editor?'))
              e.preventDefault();
          }}
        >
          <ArrowLeft size={19} />
        </Link>
        <span className="toolbar-divider" />
        <div>
          <strong>{page.name}</strong>
          <small className="block">/{page.code}</small>
        </div>
        <span className={'badge ' + page.status}>
          {dirty ? 'Sin guardar' : page.status === 'published' ? 'Publicado' : 'Borrador'}
        </span>
      </div>
      <div className="actions">
        {!preview && (
          <>
            <button
              aria-label="Deshacer"
              title="Deshacer (Ctrl/⌘ Z)"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 size={16} />
            </button>
            <button
              aria-label="Rehacer"
              title="Rehacer (Ctrl/⌘ Mayús Z)"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 size={16} />
            </button>
          </>
        )}
        <button onClick={onPreview}>
          <Eye size={15} />
          {preview ? 'Editar' : 'Vista previa'}
        </button>
        <button
          className="primary"
          disabled={busy}
          title="Guarda los cambios y los hace públicos en Runtime"
          onClick={() => void save()}
        >
          <Save size={15} />
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </header>
  );
}
