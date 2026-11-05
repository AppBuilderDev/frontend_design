import { Component, type ReactNode, type CSSProperties, type ComponentType } from 'react';
import type { ComponentNode } from '../models/contracts';
type ViewProps = { node: ComponentNode; children?: ReactNode };
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
export const catalog = ['Container', 'Heading', 'Paragraph', 'Button', 'Input', 'Card'] as const;
export const registry: Record<string, ComponentType<ViewProps>> = {
  Container: ({ node, children }) => (
    <div className="builder-container" style={layoutStyle(node.props)}>
      {children}
    </div>
  ),
  Card: ({ node, children }) => (
    <section className="builder-card" style={layoutStyle(node.props)}>
      <h3>{str(node.props.title, 'Tarjeta')}</h3>
      {children}
    </section>
  ),
  Heading: ({ node }) => {
    const text = str(node.props.text, 'Un gran título');
    return node.props.level === 'h1' ? (
      <h1>{text}</h1>
    ) : node.props.level === 'h3' ? (
      <h3>{text}</h3>
    ) : (
      <h2>{text}</h2>
    );
  },
  Paragraph: ({ node }) => <p>{str(node.props.text, 'Escribe aquí tu contenido.')}</p>,
  Button: ({ node }) => {
    const href = str(node.props.href);
    const safe = /^(https?:\/\/|\/(?!\/)|#)/.test(href);
    return safe ? (
      <a className="builder-button" href={href}>
        {str(node.props.text, 'Continuar')}
      </a>
    ) : (
      <button type="button" className="builder-button">
        {str(node.props.text, 'Continuar')}
      </button>
    );
  },
  Input: ({ node }) => (
    <label className="builder-input">
      {str(node.props.label, 'Etiqueta')}
      <input
        type={
          ['text', 'email', 'number', 'password'].includes(str(node.props.inputType))
            ? str(node.props.inputType)
            : 'text'
        }
        placeholder={str(node.props.placeholder, 'Escribe aquí...')}
      />
    </label>
  ),
};
export function registerComponent(type: string, component: ComponentType<ViewProps>) {
  registry[type] = component;
}
function style(props: Record<string, unknown>): CSSProperties {
  const s: CSSProperties = {};
  for (const key of [
    'color',
    'backgroundColor',
    'padding',
    'margin',
    'borderRadius',
    'fontSize',
    'textAlign',
    'maxWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
  ] as const) {
    const value = props[key];
    if (typeof value === 'string' && !/url\s*\(|expression|[;{}]/i.test(value))
      Object.assign(s, { [key]: value });
  }
  // Emit only longhands when a side is overridden. React otherwise overwrites
  // unchanged sides when updating a conflicting padding/margin shorthand.
  for (const prefix of ['padding', 'margin'] as const) {
    const keys =
      prefix === 'padding'
        ? (['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const)
        : (['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const);
    if (!keys.some((key) => s[key])) continue;
    const [top, right = top, bottom = top, left = right] = spacingParts(String(s[prefix] || '0px'));
    delete s[prefix];
    const values = [top, right, bottom, left];
    keys.forEach((key, i) => Object.assign(s, { [key]: s[key] || values[i] }));
  }
  return s;
}
function spacingParts(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let token = '';
  for (const character of value.trim()) {
    if (/\s/.test(character) && depth === 0) {
      if (token) {
        parts.push(token);
        token = '';
      }
    } else {
      token += character;
      if (character === '(') depth++;
      if (character === ')') depth--;
    }
  }
  if (token) parts.push(token);
  return parts;
}
function layoutStyle(props: Record<string, unknown>): CSSProperties {
  const result: CSSProperties = {};
  for (const key of [
    'display',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'gap',
    'gridTemplateColumns',
  ] as const) {
    const value = props[key];
    if (typeof value === 'string' && !/url\s*\(|expression|[;{}]/i.test(value))
      Object.assign(result, { [key]: value });
  }
  if (props.display === 'grid' && !props.gridTemplateColumns)
    result.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  return result;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">No se pudo renderizar el componente.</div>
    ) : (
      this.props.children
    );
  }
}
export function ComponentView({ node, children }: ViewProps) {
  const View = Object.hasOwn(registry, node.type) ? registry[node.type] : undefined;
  return (
    <Boundary>
      <div style={style(node.props)}>
        {View ? (
          <View node={node}>{children}</View>
        ) : (
          <div className="unknown" role="status">
            Componente no disponible: {node.type}
          </div>
        )}
      </div>
    </Boundary>
  );
}
export function RenderTree({
  nodes,
  decorate,
}: {
  nodes: ComponentNode[];
  decorate?: (node: ComponentNode, view: ReactNode) => ReactNode;
}) {
  return (
    <>
      {nodes.map((node) => {
        const view = (
          <ComponentView node={node}>
            <RenderTree nodes={node.children ?? []} decorate={decorate} />
          </ComponentView>
        );
        return <div key={node.id}>{decorate ? decorate(node, view) : view}</div>;
      })}
    </>
  );
}
