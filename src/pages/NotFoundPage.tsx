import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return (
    <main className="screen-message">
      <h1>404</h1>
      <Link to="/">Volver a páginas</Link>
    </main>
  );
}
