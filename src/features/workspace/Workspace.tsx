import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Database, FileText, Users, Workflow, Layers, LogOut } from 'lucide-react';
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
      <aside className="workspace-nav">
        <NavLink to="/workspace" className="workspace-brand">
          <Layers size={22} />
          AppBuilderDev
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
            { to: 'pages', label: 'Páginas', Icon: FileText },
            { to: 'data', label: 'Datos', Icon: Database },
            { to: 'services', label: 'Servicios', Icon: Workflow },
            { to: 'team', label: 'Equipo y proyecto', Icon: Users },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} to={'/workspace/' + to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
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
      <div className="workspace-main">
        <header className="workspace-header">
          <span>{project.name}</span>
          <small>Un proyecto por organización · Espacio privado</small>
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
            <Route path="services" element={<WorkspaceServices />} />
            <Route path="team" element={<WorkspaceTeam />} />
            <Route path="*" element={<Navigate to="/workspace/pages" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
