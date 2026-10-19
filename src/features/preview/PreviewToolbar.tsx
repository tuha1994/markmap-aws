import type { MarkmapAdapter } from './markmapAdapter';

type Props = {
  adapter: Pick<MarkmapAdapter, 'fit' | 'zoomIn' | 'zoomOut' | 'reset'> | null;
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
};

export function PreviewToolbar({ adapter, isFocusMode = false, onToggleFocus }: Props) {
  const focusLabel = isFocusMode ? 'Exit focus mode' : 'Enter focus mode';

  return (
    <div className="preview-toolbar" role="toolbar" aria-label="Preview controls">
      <button type="button" aria-label="Fit preview" title="Fit preview" onClick={() => adapter?.fit()} disabled={!adapter}><span aria-hidden="true">⤢</span></button>
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => adapter?.zoomIn()} disabled={!adapter}><span aria-hidden="true">＋</span></button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => adapter?.zoomOut()} disabled={!adapter}><span aria-hidden="true">−</span></button>
      <button type="button" aria-label="Reset preview" title="Reset preview" onClick={() => adapter?.reset()} disabled={!adapter}><span aria-hidden="true">↺</span></button>
      {onToggleFocus ? <button type="button" className="preview-focus-button" aria-label={focusLabel} title={focusLabel} onClick={onToggleFocus}><span aria-hidden="true">⛶</span></button> : null}
    </div>
  );
}
