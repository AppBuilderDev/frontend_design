import { Route, Routes } from 'react-router-dom';
import { PagesPage } from './features/pages/pages/PagesPage';
import { Editor } from './features/editor/Editor';
import { NotFoundPage } from './pages/NotFoundPage';
export function App() {
  return (
    <Routes>
      <Route path="/" element={<PagesPage />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
