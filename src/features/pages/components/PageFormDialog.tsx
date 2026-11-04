import type { FormEvent } from 'react';
import type { Page } from '../../../models/contracts';
interface Props {
  editing: Page | null;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}
export function PageFormDialog({ editing, busy, error, onSubmit, onCancel }: Props) {
  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="page-dialog" className="modal">
        <h2 id="page-dialog">{editing ? 'Editar página' : 'Crear página'}</h2>
        <p className="muted">Define un nombre y la ruta pública de tu página.</p>
        <form onSubmit={onSubmit}>
          <label>
            Nombre
            <input autoFocus name="name" required maxLength={100} defaultValue={editing?.name} />
          </label>
          <label>
            Código
            <input
              name="code"
              required
              defaultValue={editing?.code}
              placeholder="reportes/ventas"
            />
          </label>
          <small>Minúsculas, números, guiones y / para rutas anidadas.</small>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="actions justify-end mt-6">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear página'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
