import { useDataContext } from '../dataComponents';
import { layout, pairs, safeUrl, text, type CatalogProps } from './helpers';

export function ApplicationLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useDataContext();
  const target = safeUrl(href);
  const destination =
    target?.startsWith('/') && context
      ? (context.applicationPath ?? '/p/' + context.projectId) + target
      : target;
  return destination ? (
    <a href={destination} className={className}>
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );
}
export function LayoutComponent({ node, children }: CatalogProps) {
  const props = node.props;
  const className = 'bc-layout bc-' + node.type.toLowerCase();
  const styles = layout(props);
  switch (node.type) {
    case 'Header':
      return (
        <header className={className} style={styles}>
          {children}
        </header>
      );
    case 'Footer':
      return (
        <footer className={className} style={styles}>
          {children}
        </footer>
      );
    case 'Section':
      return (
        <section className={className} style={styles}>
          {children}
        </section>
      );
    default:
      return (
        <div className={className} style={styles}>
          {children}
        </div>
      );
  }
}
export function NavigationComponent({ node, children }: CatalogProps) {
  const items = pairs(node.props.links);
  if (node.type === 'Breadcrumbs')
    return (
      <nav className="bc-breadcrumbs" aria-label="Ruta de navegacion">
        <ol>
          {items.map(([label, href], index) => (
            <li key={index}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === items.length - 1 ? (
                <span aria-current="page">{label}</span>
              ) : (
                <ApplicationLink href={href}>{label}</ApplicationLink>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  if (node.type === 'Link')
    return (
      <ApplicationLink href={text(node.props.href)} className="bc-link">
        {text(node.props.text, 'Enlace')}
      </ApplicationLink>
    );
  const sidebar = node.type === 'Sidebar';
  return (
    <nav
      className={sidebar ? 'bc-sidebar' : 'bc-navbar'}
      aria-label={text(node.props.brand, 'Navegacion')}
      style={layout(node.props)}
    >
      <strong className="bc-brand">{text(node.props.brand, 'Mi aplicacion')}</strong>
      <div className="bc-nav-links">
        {items.map(([label, href], index) => (
          <ApplicationLink key={index} href={href}>
            {label}
          </ApplicationLink>
        ))}
      </div>
      {children}
    </nav>
  );
}
