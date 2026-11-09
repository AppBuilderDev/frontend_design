import { CalendarClock, FilePenLine, Files, Globe2 } from 'lucide-react';
import type { Page } from '../../models/contracts';

export function PageOverview({ pages }: { pages: Page[] }) {
  const published = pages.filter(
    (page) => page.status === 'published' || (page.publicationVersion ?? 0) > 0,
  ).length;
  const drafts = pages.filter((page) => page.status === 'draft').length;
  const dates = pages.map((page) => Date.parse(page.updatedAt)).filter(Number.isFinite);
  const latest = dates.length ? new Date(Math.max(...dates)) : undefined;
  const summaries = [
    {
      label: 'Total de páginas',
      value: String(pages.length).padStart(2, '0'),
      detail: 'Ideas que toman forma',
      Icon: Files,
      tone: 'blue',
    },
    {
      label: 'Con versión pública',
      value: String(published).padStart(2, '0'),
      detail: 'Disponibles en tu aplicación',
      Icon: Globe2,
      tone: 'green',
    },
    {
      label: 'En borrador',
      value: String(drafts).padStart(2, '0'),
      detail: 'Tu próximo lanzamiento',
      Icon: FilePenLine,
      tone: 'amber',
    },
    {
      label: 'Última edición',
      value: latest?.toLocaleDateString('es', { day: 'numeric', month: 'short' }) ?? '—',
      detail: 'El ritmo lo marcas tú',
      Icon: CalendarClock,
      tone: 'neutral',
    },
  ];
  return (
    <section className="page-overview" aria-label="Resumen de tus páginas">
      {summaries.map(({ label, value, detail, Icon, tone }) => (
        <article key={label} className="overview-card" data-tone={tone}>
          <div>
            <span className="overview-label">{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </div>
          <span className="overview-icon" aria-hidden="true">
            <Icon size={21} strokeWidth={1.7} />
          </span>
        </article>
      ))}
    </section>
  );
}
