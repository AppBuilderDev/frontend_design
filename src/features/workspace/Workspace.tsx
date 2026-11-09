import { WorkspaceInventory } from './WorkspaceInventory';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  Database,
  FileText,
  Users,
  Workflow,
  Layers,
  LogOut,
  Package,
  ShieldCheck,
  CircleHelp,
} from 'lucide-react';
import { WorkspaceGate, useWorkspace } from './WorkspaceContext';
import { WorkspaceData } from './WorkspaceData';
import { WorkspaceTeam } from './WorkspaceTeam';
import { WorkspacePages } from './WorkspacePages';
import { WorkspaceServices } from './WorkspaceServices';
import { Editor } from '../editor/Editor';
import { platformRequest } from '../../services/platformHttp';

export function Workspace() {
  return (
    <WorkspaceGate>
      <Routes>
        <Route path="editor/:id" element={<Editor />} />
        <Route path="*" element={<WorkspaceShell />} />
      </Routes>
    </WorkspaceGate>
  );
}
function WorkspaceShell() {
  const { session, project } = useWorkspace();
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        Ir al contenido
      </a>
      <aside className="workspace-nav">
        <NavLink to="/workspace" className="workspace-brand">
          <Layers size={22} />
          AppBuilder<span className="brand-dot">.</span>
        </NavLink>
        <span className="workspace-org">{project.organization}</span>
        <label className="project-switch">
          Proyecto
          <select
            aria-label="Proyecto activo"
            value={project.id}
            onChange={(e) =>
              window.location.assign('/workspace?project=' + encodeURIComponent(e.target.value))
            }
          >
            {session.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.organization} / {p.name}
                {p.archived ? ' · Archivado' : ''}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Construcción del proyecto">
          {[
            { to: 'pages', label: 'Mis páginas', Icon: FileText },
            { to: 'data', label: 'Mis datos', Icon: Database },
            { to: 'services', label: 'Acciones y conexiones', Icon: Workflow },
            { to: 'inventory', label: 'Inventario', Icon: Package },
            { to: 'team', label: 'Equipo y proyecto', Icon: Users },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} end={to === ''} to={'/workspace/' + to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <Link className="nav-guide" to="/workspace/pages">
          <CircleHelp size={20} />
          <span>
            Tu espacio de trabajo<small>Diseña y administra tus páginas</small>
          </span>
        </Link>
        <div className="workspace-account">
          <strong>{session.user.name}</strong>
          <small>
            {project.role === 'owner'
              ? 'Propietario'
              : project.role === 'editor'
                ? 'Editor'
                : 'Solo lectura'}
          </small>
          <button
            onClick={() =>
              void platformRequest('/auth/logout', { method: 'POST' }).then(() =>
                window.location.assign('/workspace'),
              )
            }
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace-main" id="workspace-content" tabIndex={-1}>
        <header className="workspace-header">
          <span>{project.name}</span>
          <small className="privacy-pill">
            <ShieldCheck size={14} /> Espacio privado
          </small>
        </header>
        {project.archived ? (
          <main className="workspace-content">
            <h1>Proyecto archivado</h1>
            <p>Sus páginas, servicios y datos se conservan. El acceso está suspendido.</p>
          </main>
        ) : (
          <Routes>
            <Route index element={<Navigate to="pages" replace />} />
            <Route path="pages" element={<WorkspacePages />} />
            <Route path="data" element={<WorkspaceData />} />
            <Route path="inventory" element={<WorkspaceInventory />} />
            <Route path="services" element={<WorkspaceServices />} />
            <Route path="team" element={<WorkspaceTeam />} />
            <Route path="*" element={<Navigate to="/workspace/pages" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
