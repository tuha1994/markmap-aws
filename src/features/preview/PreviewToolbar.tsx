import type { MarkmapAdapter } from './markmapAdapter';

type Props = {
  adapter: Pick<MarkmapAdapter, 'fit' | 'zoomIn' | 'zoomOut' | 'reset'> | null;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
};

export function PreviewToolbar({ adapter, isFocusMode = false, onToggleFocus }: Props) {
  return (
    <div className="preview-toolbar" role="toolbar" aria-label="Preview controls">
      <button type="button" title="Fit preview" onClick={() => adapter?.fit()} disabled={!adapter}>Fit preview</button>
      <button type="button" title="Zoom in" onClick={() => adapter?.zoomIn()} disabled={!adapter}>Zoom in</button>
      <button type="button" title="Zoom out" onClick={() => adapter?.zoomOut()} disabled={!adapter}>Zoom out</button>
      <button type="button" title="Reset preview" onClick={() => adapter?.reset()} disabled={!adapter}>Reset preview</button>
      {onToggleFocus ? <button type="button" className="preview-focus-button" onClick={onToggleFocus}>{isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}</button> : null}
    </div>
  );
}
