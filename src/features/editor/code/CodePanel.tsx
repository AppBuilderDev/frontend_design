import { useEffect, useRef, useState } from 'react';
import type { ComponentNode } from '../../../models/contracts';
import { generatePageCode, parsePageCode, type SyncMeasurement } from './pageCode';
interface Props {
  nodes: ComponentNode[];
  onApply: (nodes: ComponentNode[]) => void;
  readOnly?: boolean;
  onPending: (pending: boolean) => void;
}
export function CodePanel({ nodes, onApply, readOnly = false, onPending }: Props) {
  const current = JSON.stringify(nodes);
  const [source, setSource] = useState(() => {
    try {
      return generatePageCode(nodes);
    } catch {
      return '';
    }
  });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [measurements, setMeasurements] = useState<SyncMeasurement[]>([]);
  const last = useRef(current);
  useEffect(() => {
    if (pending) return;
    let active = true;
    const start = performance.now();
    try {
      const value = generatePageCode(JSON.parse(current) as ComponentNode[]);
      const durationMs = performance.now() - start;
      void Promise.resolve().then(() => {
        if (!active) return;
        setSource(value);
        setError('');
        setMeasurements((items) => [
          ...items.slice(-199),
          {
            direction: 'visual-to-code',
            success: true,
            durationMs,
            nodes: (JSON.parse(current) as ComponentNode[]).length,
          },
        ]);
      });
    } catch (e) {
      const message = (e as Error).message;
      void Promise.resolve().then(() => {
        if (active) setError(message);
      });
    }
    return () => {
      active = false;
    };
  }, [current, pending]);
  useEffect(() => {
    onPending(pending);
  }, [pending, onPending]);
  const apply = () => {
    const start = performance.now();
    try {
      if (last.current !== current && pending)
        throw new Error(
          'El diseno visual cambio mientras editabas codigo. Descarga tus cambios o usa Regenerar antes de continuar.',
        );
      const parsed = parsePageCode(source);
      onApply(parsed);
      last.current = JSON.stringify(parsed);
      setPending(false);
      setError('');
      setMeasurements((items) => [
        ...items.slice(-199),
        {
          direction: 'code-to-visual',
          success: true,
          durationMs: performance.now() - start,
          nodes: parsed.length,
        },
      ]);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setMeasurements((items) => [
        ...items.slice(-199),
        {
          direction: 'code-to-visual',
          success: false,
          durationMs: performance.now() - start,
          nodes: 0,
          error: message,
        },
      ]);
    }
  };
  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="code-panel" aria-label="Codigo de pagina">
      <header>
        <strong>TSX sincronizado</strong>
        <span>{pending ? 'Cambios de codigo pendientes' : 'Sincronizado con el diseno'}</span>
      </header>
      <p>
        Contrato TSX v1: componentes del registro, builderId y config JSON. Aplicar valida sin
        ejecutar codigo. Las rutas HTTP se conservan en config.
      </p>
      <div className="actions">
        <button disabled={readOnly || !pending} onClick={apply}>
          Aplicar codigo al diseno
        </button>
        <button
          onClick={() => {
            if (pending && !window.confirm('Descartar los cambios de codigo pendientes?')) return;
            setSource(generatePageCode(nodes));
            last.current = current;
            setPending(false);
            setError('');
          }}
        >
          Regenerar desde diseno
        </button>
        <button onClick={() => download(source, 'Page.tsx')}>Descargar TSX</button>
        <button
          onClick={() =>
            download(
              JSON.stringify({ schemaVersion: 1, measurements }, null, 2),
              'sync-measurements.json',
            )
          }
        >
          Exportar mediciones
        </button>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <label>
        Codigo TSX
        <textarea
          aria-label="Codigo TSX"
          spellCheck={false}
          readOnly={readOnly}
          value={source}
          onChange={(e) => {
            if (!pending) last.current = current;
            setSource(e.target.value);
            setPending(true);
          }}
        />
      </label>
      <small>
        {measurements.length} sincronizaciones medidas en esta sesion. Los tiempos usan
        performance.now; no miden productividad humana.
      </small>
    </section>
  );
}
