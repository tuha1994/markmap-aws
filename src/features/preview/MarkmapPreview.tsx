import { useEffect, useRef, useState } from 'react';
import { createMarkmapAdapter, type MarkmapAdapter } from './markmapAdapter';
import { PreviewToolbar } from './PreviewToolbar';

type Props = {
  markdown: string;
  createAdapter?: (svg: SVGSVGElement) => MarkmapAdapter;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
};

export function MarkmapPreview({ markdown, createAdapter = createMarkmapAdapter, isFocusMode = false, onToggleFocus }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const adapterRef = useRef<MarkmapAdapter | null>(null);
  const mountedRef = useRef(false);
  const renderTokenRef = useRef(0);
  const [adapter, setAdapter] = useState<MarkmapAdapter | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const nextAdapter = createAdapter(svgRef.current);
    mountedRef.current = true;
    adapterRef.current = nextAdapter;
    setAdapter(nextAdapter);
    return () => {
      mountedRef.current = false;
      renderTokenRef.current += 1;
      nextAdapter.destroy();
      if (adapterRef.current === nextAdapter) adapterRef.current = null;
    };
  }, [createAdapter]);

  useEffect(() => {
    const activeAdapter = adapterRef.current;
    if (!activeAdapter) return;
    const renderToken = ++renderTokenRef.current;

    const timer = window.setTimeout(() => {
      void activeAdapter.render(markdown).then(
        () => {
          if (mountedRef.current && adapterRef.current === activeAdapter && renderTokenRef.current === renderToken) setError(false);
        },
        () => {
          if (mountedRef.current && adapterRef.current === activeAdapter && renderTokenRef.current === renderToken) setError(true);
        },
      );
    }, 300);
    return () => {
      window.clearTimeout(timer);
      renderTokenRef.current += 1;
    };
  }, [markdown, adapter]);

  return (
    <section className="markmap-preview" aria-label="Mind map preview">
      <div className="workspace-panel-heading markmap-preview-heading">
        <div>
          <p className="workspace-panel-eyebrow">Explore</p>
          <h2>Mind map</h2>
        </div>
        <PreviewToolbar adapter={adapter} isFocusMode={isFocusMode} onToggleFocus={onToggleFocus} />
      </div>
      {error ? <p role="alert">Unable to render preview</p> : null}
      <svg ref={svgRef} aria-label="Markmap preview" />
    </section>
  );
}