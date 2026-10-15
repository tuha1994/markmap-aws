import { useEffect, useRef, useState } from 'react';
import { createMarkmapAdapter, type MarkmapAdapter } from './markmapAdapter';

type Props = {
  markdown: string;
  createAdapter?: (svg: SVGSVGElement) => MarkmapAdapter;
};

export function MarkmapPreview({ markdown, createAdapter = createMarkmapAdapter }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const adapterRef = useRef<MarkmapAdapter | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const adapter = createAdapter(svgRef.current);
    adapterRef.current = adapter;
    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [createAdapter]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const timer = window.setTimeout(() => {
      void adapter.render(markdown).then(() => setError(false)).catch(() => setError(true));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [markdown]);

  return (
    <section aria-label="Mind map preview">
      {error ? <p role="alert">Unable to render preview</p> : null}
      <svg ref={svgRef} aria-label="Markmap preview" />
    </section>
  );
}
