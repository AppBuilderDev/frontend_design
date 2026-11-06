import { Workspace } from './features/workspace/Workspace';
import { Route, Routes, Navigate } from 'react-router-dom';
import { PagesPage } from './features/pages/pages/PagesPage';
import { Editor } from './features/editor/Editor';
import { NotFoundPage } from './pages/NotFoundPage';
export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          import.meta.env.VITE_LEGACY_UI === '1' ? (
            <PagesPage />
          ) : (
            <Navigate to="/workspace" replace />
          )
        }
      />
      <Route path="/workspace/*" element={<Workspace />} />
      <Route path="/legacy" element={<PagesPage />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
