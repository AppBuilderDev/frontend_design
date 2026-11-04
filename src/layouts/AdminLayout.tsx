import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Files, LayoutDashboard } from 'lucide-react';
export function AdminLayout({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Layers size={22} />
          </span>{' '}
          builder<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="workspace">
          <span className="workspace-avatar">FB</span>
          <div>
            Mi proyecto<small>Workspace de desarrollo</small>
          </div>
        </div>
        <div className="nav-label">CONSTRUIR</div>
        <Link className="nav-active" to="/">
          <Files size={18} /> Páginas <span>{count}</span>
        </Link>
        <div className="sidebar-bottom">
          <span className="dev-dot" /> Entorno de desarrollo
          <small>Frontend Builder · v0.1</small>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <span>
            <LayoutDashboard size={16} /> Workspace <span className="slash">/</span> Páginas
          </span>
          <span className="avatar">D</span>
        </header>
        {children}
      </div>
    </div>
  );
}
