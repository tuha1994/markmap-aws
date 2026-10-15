import type { Revision } from './revisionTypes';

type Props = {
  revision: Revision;
  onRestore(): void;
  onCancel(): void;
  busy?: boolean;
};

export function RestoreRevisionDialog({ revision, onRestore, onCancel, busy = false }: Props) {
  return (
    <section role="dialog" aria-modal="true" aria-label={`Restore ${revision.title}?`}>
      <h2>Restore {revision.title}?</h2>
      <p>A protected snapshot of the current map will be created first.</p>
      <p>This revision remains unchanged.</p>
      <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" onClick={onRestore} disabled={busy}>Restore revision</button>
    </section>
  );
}
