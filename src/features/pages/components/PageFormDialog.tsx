import { useState, type FormEvent } from 'react';
import type { Page } from '../../../models/contracts';
interface Props {
  editing: Page | null;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}
export function PageFormDialog({ editing, busy, error, onSubmit, onCancel }: Props) {
  const [code, setCode] = useState(editing?.code ?? '');
  const [customCode, setCustomCode] = useState(!!editing);
  function suggestCode(name: string) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }
  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="page-dialog" className="modal">
        <h2 id="page-dialog">{editing ? 'Editar página' : 'Crear página'}</h2>
        <p className="muted">
          Dale un nombre a tu pantalla. Preparamos su dirección por ti; puedes personalizarla.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Nombre
            <input
              autoFocus
              name="name"
              required
              maxLength={100}
              placeholder="Por ejemplo, Mis productos"
              defaultValue={editing?.name}
              onChange={(event) => {
                if (!customCode) setCode(suggestCode(event.target.value));
              }}
            />
          </label>
          <label>
            Dirección de la página
            <input
              name="code"
              required
              value={code}
              onChange={(event) => {
                setCustomCode(true);
                setCode(event.target.value);
              }}
              aria-describedby="page-address-help"
              placeholder="reportes/ventas"
            />
          </label>
          <small id="page-address-help">
            Se abrirá en /{code || 'tu-pagina'}. Usa letras minúsculas, números y guiones. También
            puedes usar / para agrupar páginas.
          </small>
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
