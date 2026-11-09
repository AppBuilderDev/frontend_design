import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from './WorkspaceContext';
const sectionNames: Record<string, string> = {
  pages: 'Mis páginas',
  data: 'Mis datos',
  routes: 'Rutas y endpoints',
  services: 'Acciones y conexiones',
  inventory: 'Inventario',
  team: 'Equipo y proyecto',
};
export function WorkspaceTopbar() {
  const { project, session } = useWorkspace();
  const { pathname } = useLocation();
  const section = sectionNames[pathname.split('/')[2]] ?? 'Mis páginas';
  const initials = session.user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <header className="workspace-header">
      <div className="workspace-breadcrumb">
        <span>{project.name}</span>
        <ChevronRight size={14} aria-hidden="true" />
        <strong>{section}</strong>
      </div>
      <div className="workspace-header-meta">
        <span className="privacy-pill">
          <ShieldCheck size={14} /> Espacio privado
        </span>
        <span
          className="workspace-user-avatar"
          title={session.user.name}
          aria-label={session.user.name}
        >
          {initials}
        </span>
      </div>
    </header>
  );
}
