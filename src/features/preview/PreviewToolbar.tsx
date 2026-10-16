import type { MarkmapAdapter } from './markmapAdapter';

type Props = {
  adapter: Pick<MarkmapAdapter, 'fit' | 'zoomIn' | 'zoomOut' | 'reset'> | null;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
};

export function PreviewToolbar({ adapter, isFocusMode = false, onToggleFocus }: Props) {
  return (
    <div aria-label="Preview controls">
      <button type="button" onClick={() => adapter?.fit()} disabled={!adapter}>Fit preview</button>
      <button type="button" onClick={() => adapter?.zoomIn()} disabled={!adapter}>Zoom in</button>
      <button type="button" onClick={() => adapter?.zoomOut()} disabled={!adapter}>Zoom out</button>
      <button type="button" onClick={() => adapter?.reset()} disabled={!adapter}>Reset preview</button>
      {onToggleFocus ? <button type="button" onClick={onToggleFocus}>{isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}</button> : null}
    </div>
  );
}
