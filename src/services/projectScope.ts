import type { ProjectAccess } from '../models/data';
let active: ProjectAccess | undefined;
export function setProjectScope(project?: ProjectAccess) {
  active = project;
}
export function getProjectScope() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/workspace')
    ? active
    : undefined;
}
export function projectPath(path: string) {
  const p = getProjectScope();
  if (!p) throw new Error('Selecciona un proyecto');
  return '/projects/' + p.id + path;
}
