import { Copy, ClipboardPaste, CopyPlus, BookmarkPlus, Trash2, ChevronRight } from 'lucide-react';
export function SelectionBar({
  path,
  onSelect,
  selected,
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
  onSaveBlock,
}: {
  path: { id: string; label: string }[];
  onSelect: (id: string) => void;
  selected: boolean;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSaveBlock: () => void;
}) {
  return (
    <div className="selection-bar">
      <nav aria-label="Ruta del componente" className="selection-path">
        {path.map((item, index) => (
          <span key={item.id}>
            {index > 0 && <ChevronRight size={12} />}
            <button
              aria-current={index === path.length - 1 ? 'location' : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </span>
        ))}
      </nav>
      <div className="actions selection-actions">
        <button
          aria-label="Duplicar componente"
          title="Duplicar (Ctrl/⌘ D)"
          disabled={!selected}
          onClick={onDuplicate}
        >
          <CopyPlus size={15} />
        </button>
        <button
          aria-label="Copiar componente"
          title="Copiar (Ctrl/⌘ C)"
          disabled={!selected}
          onClick={onCopy}
        >
          <Copy size={15} />
        </button>
        <button aria-label="Pegar componente" title="Pegar (Ctrl/⌘ V)" onClick={onPaste}>
          <ClipboardPaste size={15} />
        </button>
        <button
          aria-label="Guardar como bloque"
          title="Guardar la selección y sus hijos como bloque"
          disabled={!selected}
          onClick={onSaveBlock}
        >
          <BookmarkPlus size={15} />
        </button>
        <button
          aria-label="Borrar selección"
          title="Eliminar (Supr)"
          disabled={!selected}
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
