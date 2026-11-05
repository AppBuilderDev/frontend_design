import { useEffect, useRef, useState } from 'react';
import { Blocks, Plus, Trash2 } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
import type { SavedBlock } from '../../../models/blocks';
import { starterBlocks } from '../config/blocks';
import type { useBlocks } from '../hooks/useBlocks';
type Library = ReturnType<typeof useBlocks>;
export function BlockLibrary({
  library,
  onInsert,
}: {
  library: Library;
  onInsert: (nodes: ComponentNode[]) => void;
}) {
  const row = (
    block: { id: string; name: string; components: ComponentNode[]; description?: string },
    saved = false,
  ) => (
    <div className="block-row" key={block.id}>
      <button
        className="block-insert"
        onClick={() => onInsert(block.components)}
        aria-label={'Insertar bloque ' + block.name}
        title="Inserta una copia independiente"
      >
        <Blocks size={17} />
        <span>
          <strong>{block.name}</strong>
          <small>{block.description ?? 'Bloque guardado'}</small>
        </span>
        <Plus size={14} />
      </button>
      {saved && (
        <button
          className="block-remove"
          disabled={library.busy}
          aria-label={'Eliminar bloque ' + block.name}
          onClick={() => void library.remove(block.id)}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
  return (
    <div className="block-library">
      <p className="panel-help">
        Inserta una sección y adapta sus componentes. Cada copia es independiente.
      </p>
      <div className="panel-heading">Para empezar</div>
      {starterBlocks.map((block) => row(block))}
      <div className="panel-heading">Mis bloques</div>
      {library.loading && <p className="panel-help">Cargando bloques…</p>}
      {library.error && (
        <div className="library-error">
          <p role="alert">{library.error}</p>
          <button onClick={() => void library.load()}>Reintentar</button>
        </div>
      )}
      {!library.loading && !library.blocks.length && (
        <p className="panel-help">
          Selecciona una sección y pulsa «Guardar como bloque» para reutilizarla en otras páginas.
        </p>
      )}
      {library.blocks.map((block) => row(block, true))}
    </div>
  );
}
export function SaveBlockDialog({
  components,
  library,
  onClose,
}: {
  components: SavedBlock['components'];
  library: Library;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="modal block-dialog"
      aria-labelledby="block-dialog-title"
      onCancel={(event) => {
        if (library.busy) event.preventDefault();
        else onClose();
      }}
    >
      <h2 id="block-dialog-title">Guardar como bloque</h2>
      <p>Se guardará una copia de la selección y de todos sus componentes hijos.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await library.save(name.trim(), components)) onClose();
        }}
      >
        <label>
          Nombre del bloque
          <input
            name="block-name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {library.error && (
          <p className="alert" role="alert">
            {library.error}
          </p>
        )}
        <div className="actions">
          <button type="button" disabled={library.busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={library.busy || !name.trim()} type="submit">
            {library.busy ? 'Guardando…' : 'Guardar bloque'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
