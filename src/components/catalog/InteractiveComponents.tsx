import { useId, useState } from 'react';
import { pairs, type CatalogProps } from './helpers';

export function InteractiveComponent({ node }: CatalogProps) {
  const items = pairs(node.props.items);
  const id = useId();
  const [active, setActive] = useState(0);
  if (node.type === 'Accordion')
    return (
      <div className="bc-accordion">
        {items.map(([title, body], index) => (
          <details key={index}>
            <summary>{title}</summary>
            <p>{body}</p>
          </details>
        ))}
      </div>
    );
  const selected = Math.min(active, Math.max(0, items.length - 1));
  return (
    <div className="bc-tabs">
      <div
        role="tablist"
        aria-label="Pestanas"
        onKeyDown={(event) => {
          const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (offset || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (selected + offset + items.length) % items.length;
            setActive(next);
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
          }
        }}
      >
        {items.map(([title], index) => (
          <button
            type="button"
            role="tab"
            key={index}
            id={id + '-tab-' + index}
            aria-selected={selected === index}
            aria-controls={id + '-panel-' + index}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setActive(index)}
          >
            {title}
          </button>
        ))}
      </div>
      {items.map(([, body], index) => (
        <div
          key={index}
          role="tabpanel"
          id={id + '-panel-' + index}
          aria-labelledby={id + '-tab-' + index}
          hidden={selected !== index}
          tabIndex={0}
        >
          {body}
        </div>
      ))}
    </div>
  );
}
