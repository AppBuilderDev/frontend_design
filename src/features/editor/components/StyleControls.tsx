import { useState } from 'react';
import type { ComponentNode } from '../../../models/contracts';
import { isContainer } from '../craft/adapter';
type Change = (key: string, value: string) => void;
const length = /^(-?\d+(?:\.\d+)?)(px|rem|em|%|vh|vw)?$/;

function LengthControl({
  label,
  value,
  onChange,
  negative = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  negative?: boolean;
}) {
  const [manual, setManual] = useState(false);
  const parsed = value.match(length);
  const custom = manual || (!!value && !parsed);
  const unit = custom ? 'custom' : (parsed?.[2] ?? 'px');
  return (
    <div className="length-control field-control">
      <span className="control-label">{label}</span>
      <span className="unit-input">
        <input
          aria-label={label}
          type={custom ? 'text' : 'number'}
          min={negative ? undefined : 0}
          step="any"
          placeholder={custom ? 'auto o calc(…)' : '—'}
          value={custom ? value : (parsed?.[1] ?? '')}
          onChange={(event) =>
            onChange(custom || !event.target.value ? event.target.value : event.target.value + unit)
          }
        />
        <select
          aria-label={'Unidad de ' + label}
          value={unit}
          onChange={(event) => {
            setManual(event.target.value === 'custom');
            if (event.target.value !== 'custom')
              onChange((parsed?.[1] ?? '0') + event.target.value);
          }}
        >
          {['px', 'rem', 'em', '%', 'vh', 'vw'].map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
          <option value="custom">CSS</option>
        </select>
      </span>
    </div>
  );
}
function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-control">
      <span className="control-label">{label}</span>
      <span className="color-input">
        <input
          aria-label={'Elegir ' + label.toLowerCase()}
          type="color"
          value={/^#[a-f0-9]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          aria-label={label}
          value={value}
          placeholder="Sin definir"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={'Restablecer ' + label.toLowerCase()}
          onClick={() => onChange('')}
        >
          ×
        </button>
      </span>
    </div>
  );
}
function SpacingControl({
  prefix,
  label,
  props,
  onChange,
}: {
  prefix: 'padding' | 'margin';
  label: string;
  props: ComponentNode['props'];
  onChange: Change;
}) {
  return (
    <div className="spacing-control">
      <LengthControl
        label={label}
        value={String(props[prefix] ?? '')}
        onChange={(value) => onChange(prefix, value)}
        negative={prefix === 'margin'}
      />
      <details>
        <summary>Ajustar por lado</summary>
        <div className="inspector-grid">
          {[
            ['Top', 'Superior'],
            ['Right', 'Derecho'],
            ['Bottom', 'Inferior'],
            ['Left', 'Izquierdo'],
          ].map(([key, side]) => (
            <LengthControl
              key={key}
              label={label + ' · ' + side.toLowerCase()}
              value={String(props[prefix + key] ?? '')}
              onChange={(value) => onChange(prefix + key, value)}
              negative={prefix === 'margin'}
            />
          ))}
        </div>
      </details>
    </div>
  );
}
export function StyleControls({ node, onChange }: { node: ComponentNode; onChange: Change }) {
  const str = (key: string, fallback = '') => String(node.props[key] ?? fallback);
  const select = (key: string, label: string, options: [string, string][], fallback = '') => (
    <label>
      {label}
      <select
        aria-label={label}
        value={str(key, fallback)}
        onChange={(event) => onChange(key, event.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <details className="inspector-section" open>
        <summary>Apariencia</summary>
        <div className="inspector-fields">
          <ColorControl
            label="Color de texto"
            value={str('color')}
            onChange={(value) => onChange('color', value)}
          />
          <ColorControl
            label="Color de fondo"
            value={str('backgroundColor')}
            onChange={(value) => onChange('backgroundColor', value)}
          />
          <div className="inspector-grid">
            <LengthControl
              label="Tamaño de texto"
              value={str('fontSize')}
              onChange={(value) => onChange('fontSize', value)}
            />
            <LengthControl
              label="Radio de borde"
              value={str('borderRadius')}
              onChange={(value) => onChange('borderRadius', value)}
            />
          </div>
          {select(
            'textAlign',
            'Alineación',
            [
              ['left', 'Izquierda'],
              ['center', 'Centro'],
              ['right', 'Derecha'],
            ],
            'left',
          )}
        </div>
      </details>
      <details className="inspector-section" open>
        <summary>Espaciado y tamaño</summary>
        <div className="inspector-fields">
          <SpacingControl
            prefix="padding"
            label="Espaciado interior"
            props={node.props}
            onChange={onChange}
          />
          <SpacingControl prefix="margin" label="Margen" props={node.props} onChange={onChange} />
          <LengthControl
            label="Ancho máximo"
            value={str('maxWidth')}
            onChange={(value) => onChange('maxWidth', value)}
          />
        </div>
      </details>
      {isContainer(node.type) && (
        <details className="inspector-section" open>
          <summary>Distribución</summary>
          <div className="inspector-fields">
            {select('display', 'Diseño del contenedor', [
              ['', 'Predeterminado'],
              ['flex', 'Flexbox'],
              ['grid', 'Cuadrícula'],
              ['block', 'Bloques'],
            ])}
            {(str('display') === 'flex' || (!str('display') && node.type === 'Container')) && (
              <>
                {select(
                  'flexDirection',
                  'Dirección',
                  [
                    ['column', 'Vertical'],
                    ['row', 'Horizontal'],
                  ],
                  'column',
                )}
                {select(
                  'flexWrap',
                  'Salto de línea',
                  [
                    ['nowrap', 'Una línea'],
                    ['wrap', 'Varias líneas'],
                  ],
                  'nowrap',
                )}
              </>
            )}
            {str('display') === 'grid' && (
              <label>
                Columnas
                <select
                  aria-label="Columnas"
                  value={str('gridTemplateColumns', 'repeat(2, minmax(0, 1fr))')}
                  onChange={(event) => onChange('gridTemplateColumns', event.target.value)}
                >
                  {![1, 2, 3, 4].some(
                    (n) =>
                      str('gridTemplateColumns', 'repeat(2, minmax(0, 1fr))') ===
                      `repeat(${n}, minmax(0, 1fr))`,
                  ) && <option value={str('gridTemplateColumns')}>Personalizado</option>}
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={`repeat(${n}, minmax(0, 1fr))`}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {select('alignItems', 'Alinear elementos', [
              ['', 'Predeterminado'],
              ['stretch', 'Estirar'],
              ['flex-start', 'Inicio'],
              ['center', 'Centro'],
              ['flex-end', 'Final'],
            ])}
            {select('justifyContent', 'Distribuir elementos', [
              ['', 'Predeterminado'],
              ['flex-start', 'Inicio'],
              ['center', 'Centro'],
              ['flex-end', 'Final'],
              ['space-between', 'Espacio entre elementos'],
              ['space-around', 'Espacio alrededor'],
            ])}
            <LengthControl
              label="Separación"
              value={str('gap')}
              onChange={(value) => onChange('gap', value)}
            />
          </div>
        </details>
      )}
    </>
  );
}
