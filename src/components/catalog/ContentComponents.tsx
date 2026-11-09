import { useState } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';
import { lines, number, safeLength, safeUrl, text, type CatalogProps } from './helpers';
function SafeImage({
  src,
  alt,
  className,
  style,
}: {
  src: unknown;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = safeUrl(src);
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={'bc-image-placeholder ' + (className ?? '')}
      role="img"
      aria-label={alt}
      style={style}
    >
      <ImageIcon size={32} aria-hidden="true" />
      <span>{alt || 'Selecciona una imagen'}</span>
    </div>
  );
}
export function ContentComponent({ node }: CatalogProps) {
  const p = node.props;
  switch (node.type) {
    case 'Image':
      return (
        <SafeImage
          key={text(p.src)}
          src={p.src}
          alt={text(p.alt)}
          className="bc-image"
          style={{
            height: safeLength(p.height, '240px'),
            objectFit: p.fit === 'contain' ? 'contain' : 'cover',
          }}
        />
      );
    case 'Video':
      return (
        <figure className="bc-video">
          {safeUrl(p.src) ? (
            <video
              controls
              preload="metadata"
              src={safeUrl(p.src)}
              poster={safeUrl(p.poster)}
              aria-label={text(p.caption)}
            />
          ) : (
            <div className="bc-image-placeholder">
              <Play size={32} aria-hidden="true" />
              <span>Agrega la URL de un archivo de video</span>
            </div>
          )}
          <figcaption>{text(p.caption)}</figcaption>
        </figure>
      );
    case 'Avatar': {
      const name = text(p.name, 'Usuario');
      const size = safeLength(p.size, '48px');
      return safeUrl(p.src) ? (
        <SafeImage
          key={text(p.src)}
          src={p.src}
          alt={name}
          className="bc-avatar"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="bc-avatar"
          role="img"
          aria-label={name}
          style={{ width: size, height: size }}
        >
          {name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()}
        </span>
      );
    }
    case 'List': {
      const entries = lines(p.items).map((item, index) => <li key={index}>{item}</li>);
      return p.ordered === 'true' ? (
        <ol className="bc-list">{entries}</ol>
      ) : (
        <ul className="bc-list">{entries}</ul>
      );
    }
    case 'Quote':
      return (
        <figure className="bc-quote">
          <blockquote>{text(p.text)}</blockquote>
          <figcaption>{text(p.author)}</figcaption>
        </figure>
      );
    case 'CodeBlock':
      return (
        <figure className="bc-code">
          <figcaption>{text(p.language)}</figcaption>
          <pre>
            <code>{text(p.code)}</code>
          </pre>
        </figure>
      );
    case 'Badge':
      return <span className={'bc-badge bc-tone-' + variant(p.variant)}>{text(p.text)}</span>;
    case 'Alert':
      return (
        <div className={'bc-alert bc-tone-' + variant(p.variant)} role="note">
          {text(p.text)}
        </div>
      );
    case 'Stat':
      return (
        <article className="bc-stat">
          <span>{text(p.label)}</span>
          <strong>{text(p.value, '0')}</strong>
          <p>{text(p.description)}</p>
        </article>
      );
    case 'Progress': {
      const max = Math.max(1, number(p.max, 100));
      const value = Math.max(0, Math.min(max, number(p.value, 0)));
      return (
        <label className="bc-progress">
          <span>
            {text(p.label)} <strong>{Math.round((value / max) * 100)}%</strong>
          </span>
          <progress value={value} max={max} />
        </label>
      );
    }
    case 'Divider':
      return <hr className="bc-divider" />;
    case 'Spacer':
      return (
        <div
          aria-hidden="true"
          className="bc-spacer"
          style={{ height: safeLength(p.height, '32px') }}
        />
      );
    default:
      return null;
  }
}
function variant(value: unknown) {
  return ['info', 'success', 'warning', 'danger', 'neutral'].includes(text(value))
    ? text(value)
    : 'info';
}
