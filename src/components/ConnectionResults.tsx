import type { ConnectionContract, ConnectionResult } from '../models/connections';
import { formatMoney } from '../models/data';
export function ConnectionResults({
  fields,
  result,
}: {
  fields: ConnectionContract['fields'];
  result: ConnectionResult;
}) {
  return (
    <div className="connection-results">
      {!result.items.length ? (
        <p className="data-empty">La consulta no devolvió resultados.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Resultados de la conexión">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((row, index) => (
                <tr key={index}>
                  {fields.map((field) => {
                    const value = row[field.key];
                    return (
                      <td key={field.key}>
                        {value === null
                          ? '—'
                          : field.type === 'money'
                            ? formatMoney(Number(value))
                            : field.type === 'boolean'
                              ? value
                                ? 'Sí'
                                : 'No'
                              : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <small>{result.items.length} resultados · Consulta completada</small>
    </div>
  );
}
