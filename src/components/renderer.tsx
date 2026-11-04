import { Component, type ReactNode, type CSSProperties, type ComponentType } from 'react';
import type { ComponentNode } from '../models/contracts';
type ViewProps = { node: ComponentNode; children?: ReactNode };
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
export const catalog = ['Container', 'Heading', 'Paragraph', 'Button', 'Input', 'Card'] as const;
export const registry: Record<string, ComponentType<ViewProps>> = {
  Container: ({ children }) => <div className="builder-container">{children}</div>,
  Card: ({ node, children }) => (
    <section className="builder-card">
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
        placeholder={str(node.props.placeholder, 'Escribe aquí?')}
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
  ] as const) {
    const value = props[key];
    if (typeof value === 'string' && !/url\s*\(|expression|[;{}]/i.test(value))
      Object.assign(s, { [key]: value });
  }
  return s;
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
        const View = Object.hasOwn(registry, node.type) ? registry[node.type] : undefined;
        const view = (
          <Boundary key={node.id}>
            <div style={style(node.props)}>
              {View ? (
                <View node={node}>
                  <RenderTree nodes={node.children ?? []} decorate={decorate} />
                </View>
              ) : (
                <div className="unknown" role="status">
                  Componente no disponible: {node.type}
                </div>
              )}
            </div>
          </Boundary>
        );
        return <div key={node.id}>{decorate ? decorate(node, view) : view}</div>;
      })}
    </>
  );
}
