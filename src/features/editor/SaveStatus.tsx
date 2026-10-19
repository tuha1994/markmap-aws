import type { SaveStatus as SaveStatusValue } from './useSaveQueue';

type Props = {
  status: SaveStatusValue;
  onRetry?: () => void;
};

const labels: Record<SaveStatusValue, string> = {
  saved: 'Saved',
  saving: 'Saving',
  unsaved: 'Unsaved',
  offlinePending: 'Error',
  error: 'Error',
  conflict: 'Error',
  prunePending: 'Saved'
};

export function SaveStatus({ status, onRetry }: Props) {
  return (
    <section aria-live="polite" aria-label="Save status">
      <p>{labels[status]}</p>
      {status === 'offlinePending' ? <p>Draft is kept locally when possible; recovery is pending.</p> : null}
      {['offlinePending', 'error', 'prunePending'].includes(status) && onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
    </section>
  );
}
