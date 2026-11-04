import type { Page } from '../../../models/contracts';
interface Props {
  page: Page;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}
export function DeletePageDialog({ page, busy, error, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="modal">
        <h2 id="delete-title">Eliminar {page.name}</h2>
        <p>Se eliminarán el borrador y su versión publicada. Esta acción no se puede deshacer.</p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="actions justify-end">
          <button disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button className="danger" disabled={busy} onClick={onConfirm}>
            Eliminar página
          </button>
        </div>
      </section>
    </div>
  );
}
