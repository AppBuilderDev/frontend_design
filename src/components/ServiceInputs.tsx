import { useEffect, useId, useState } from 'react';
import type { DataField } from '../models/data';
import { moneyInput, parseMoney } from '../models/data';
import { ApiError, platformRequest } from '../services/platformHttp';
export const initialServiceValues = (fields: DataField[]) =>
  Object.fromEntries(fields.map((f) => [f.key, f.type === 'boolean' ? false : '']));
export function parseServiceValues(fields: DataField[], values: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (value === '' || value === undefined || value === null) {
      result[field.key] = null;
      continue;
    }
    try {
      if (field.type === 'integer') {
        if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
          throw new Error('Introduce un entero válido');
        result[field.key] = Number(value);
      } else if (field.type === 'money')
        result[field.key] = typeof value === 'number' ? value : parseMoney(String(value));
      else result[field.key] = value;
    } catch (error) {
      throw new ApiError('Revisa ' + field.label, 400, { [field.key]: (error as Error).message });
    }
  }
  return result;
}
export function ServiceInputs({
  projectId,
  operationId,
  version,
  fields,
  values,
  disabled,
  onChange,
}: {
  projectId: string;
  operationId: string;
  version: number;
  fields: DataField[];
  values: Record<string, unknown>;
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = useId();
  return (
    <>
      {fields.map((field) => (
        <label key={field.key} htmlFor={id + field.key}>
          {field.label}
          {field.required ? ' *' : ''}
          {field.type === 'relation' ? (
            <OperationRelation
              projectId={projectId}
              operationId={operationId}
              version={version}
              field={field}
              id={id + field.key}
              value={String(values[field.key] ?? '')}
              disabled={disabled}
              onChange={(v) => onChange(field.key, v)}
            />
          ) : field.type === 'boolean' ? (
            <input
              id={id + field.key}
              type="checkbox"
              checked={!!values[field.key]}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.checked)}
            />
          ) : field.type === 'select' ? (
            <select
              id={id + field.key}
              value={String(values[field.key] ?? '')}
              required={field.required}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {field.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              id={id + field.key}
              type={field.type === 'date' ? 'date' : 'text'}
              required={field.required}
              disabled={disabled}
              maxLength={1000}
              inputMode={
                field.type === 'integer'
                  ? 'numeric'
                  : field.type === 'money'
                    ? 'decimal'
                    : undefined
              }
              value={
                field.type === 'money' && typeof values[field.key] === 'number'
                  ? moneyInput(values[field.key] as number)
                  : String(values[field.key] ?? '')
              }
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </label>
      ))}
    </>
  );
}
function OperationRelation({
  projectId,
  operationId,
  version,
  field,
  id,
  value,
  disabled,
  onChange,
}: {
  projectId: string;
  operationId: string;
  version: number;
  field: DataField;
  id: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [items, setItems] = useState<{ id: string; label: string }[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const path =
      '/projects/' +
      projectId +
      '/operations/' +
      operationId +
      (version ? '/options/' : '/draft-options/') +
      field.key +
      '?version=' +
      version +
      '&q=' +
      encodeURIComponent(query);
    platformRequest<{ id: string; label: string }[]>(path, { signal: controller.signal })
      .then((items) => {
        setItems(items);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [projectId, operationId, version, field.key, query, disabled]);
  return (
    <>
      <input
        aria-label={'Buscar ' + field.label}
        placeholder="Buscar opciones…"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        id={id}
        required={field.required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleccionar…</option>
        {value && !items.some((i) => i.id === value) && (
          <option value={value}>Referencia seleccionada</option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {items.length === 100 && <small>Refina la búsqueda para encontrar más opciones.</small>}
      {error && <small role="alert">{error}</small>}
    </>
  );
}

export function serviceErrorMessage(error: unknown, fields: DataField[]) {
  if (error instanceof ApiError && Object.keys(error.fields).length)
    return (
      error.message +
      ' ' +
      Object.entries(error.fields)
        .map(
          ([key, message]) =>
            (fields.find((f) => f.key === key)?.label ?? 'Dato del servicio') + ': ' + message,
        )
        .join('; ')
    );
  return error instanceof Error ? error.message : 'No se pudo completar la operación';
}
