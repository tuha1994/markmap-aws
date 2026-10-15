import type { MarkmapAdapter } from './markmapAdapter';

type Props = {
  adapter: Pick<MarkmapAdapter, 'fit' | 'zoomIn' | 'zoomOut' | 'reset'> | null;
};

export function PreviewToolbar({ adapter }: Props) {
  return (
    <div aria-label="Preview controls">
      <button type="button" onClick={() => adapter?.fit()} disabled={!adapter}>Fit preview</button>
      <button type="button" onClick={() => adapter?.zoomIn()} disabled={!adapter}>Zoom in</button>
      <button type="button" onClick={() => adapter?.zoomOut()} disabled={!adapter}>Zoom out</button>
      <button type="button" onClick={() => adapter?.reset()} disabled={!adapter}>Reset preview</button>
    </div>
  );
}
