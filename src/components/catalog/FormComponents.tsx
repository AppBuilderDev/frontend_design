import { useId, useState } from 'react';
import { lines, number, text, type CatalogProps } from './helpers';

export function FormComponent({ node }: CatalogProps) {
  return (
    <BoundForm
      key={String(node.props.value) + ':' + String(node.props.min) + ':' + String(node.props.max)}
      node={node}
    />
  );
}
function BoundForm({ node }: CatalogProps) {
  const p = node.props;
  const id = useId();
  const [value, setValue] = useState(number(p.value, 50));
  const label = text(p.label, 'Campo');
  const options = lines(p.options);
  if (node.type === 'RadioGroup')
    return (
      <fieldset className="bc-fieldset">
        <legend>{label}</legend>
        {options.map((option, index) => (
          <label className="bc-choice" key={index}>
            <input type="radio" name={id} value={option} />
            {option}
          </label>
        ))}
      </fieldset>
    );
  if (node.type === 'Checkbox' || node.type === 'Switch')
    return (
      <label className={'bc-choice ' + (node.type === 'Switch' ? 'bc-switch' : '')}>
        <input
          key={String(p.checked)}
          type="checkbox"
          role={node.type === 'Switch' ? 'switch' : undefined}
          defaultChecked={p.checked === 'true' || p.checked === true}
        />
        <span>{label}</span>
      </label>
    );
  const common = { id, name: node.id };
  return (
    <div className="bc-field">
      <label htmlFor={id}>{label}</label>
      {node.type === 'Textarea' ? (
        <textarea
          {...common}
          rows={Math.max(2, Math.min(20, number(p.rows, 4)))}
          placeholder={text(p.placeholder)}
        />
      ) : node.type === 'Select' ? (
        <select {...common}>
          <option value="">Seleccionar...</option>
          {options.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : node.type === 'Range' ? (
        <div className="bc-range">
          <input
            {...common}
            type="range"
            min={number(p.min, 0)}
            max={Math.max(number(p.min, 0) + 1, number(p.max, 100))}
            step={Math.max(0.01, number(p.step, 1))}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
          <output htmlFor={id}>{value}</output>
        </div>
      ) : (
        <input
          {...common}
          type={
            node.type === 'DatePicker' ? 'date' : node.type === 'NumberInput' ? 'number' : 'search'
          }
          placeholder={text(p.placeholder)}
          min={node.type === 'NumberInput' ? number(p.min, 0) : undefined}
          max={node.type === 'NumberInput' ? number(p.max, 100) : undefined}
          step={node.type === 'NumberInput' ? Math.max(0.01, number(p.step, 1)) : undefined}
        />
      )}
    </div>
  );
}
