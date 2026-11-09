import { extraDefinitions } from '../../../components/catalog/definitions';
import type { ComponentNode } from '../../../models/contracts';
export function CatalogProperties({
  node,
  onChange,
}: {
  node: ComponentNode;
  onChange: (key: string, value: string) => void;
}) {
  const definition = extraDefinitions[node.type];
  if (!definition) return null;
  return (
    <>
      <div className="panel-heading">Configurar {definition.label}</div>
      {definition.fields.map((field) => {
        const value = String(node.props[field.key] ?? definition.defaults[field.key] ?? '');
        return (
          <label key={field.key}>
            {field.label}
            {field.kind === 'textarea' ? (
              <textarea
                rows={5}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : field.kind === 'select' ? (
              <select value={value} onChange={(event) => onChange(field.key, event.target.value)}>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option === 'true' ? 'Si' : option === 'false' ? 'No' : option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.kind === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </label>
        );
      })}
      {definition.container && (
        <small>Admite elementos dentro. Arrastra componentes o usa Mover a.</small>
      )}
      {definition.group === 'Formularios' && (
        <small>
          Campo independiente. No guarda datos ni filtra tablas por si solo; usa un Formulario o
          Tabla HTTP para conectar un servicio.
        </small>
      )}
    </>
  );
}
