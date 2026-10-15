import type { SaveStatus as SaveStatusValue } from './useSaveQueue';

type Props = {
  status: SaveStatusValue;
  onRetry?: () => void;
};

const labels: Record<SaveStatusValue, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  offlinePending: 'Offline — changes pending',
  error: 'Save failed',
  conflict: 'Remote change detected'
};

export function SaveStatus({ status, onRetry }: Props) {
  const isMemoryOnly = status === 'offlinePending' || status === 'unsaved';
  return (
    <section aria-live="polite" aria-label="Save status">
      <p>{labels[status]}</p>
      {status === 'error' && onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
      {isMemoryOnly ? (
        <p role="note">These changes exist only in this browser session. Refresh, closing this tab, or a browser crash can lose them.</p>
      ) : null}
    </section>
  );
}
