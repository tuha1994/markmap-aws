import type { ConflictChoice } from './useSaveQueue';

type Props = {
  localMarkdown: string;
  remoteMarkdown: string;
  onResolve(choice: ConflictChoice): void;
};

export function ConflictDialog({ localMarkdown, remoteMarkdown, onResolve }: Props) {
  return (
    <section role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <h2 id="conflict-title">Remote change detected</h2>
      <p>Your local draft and the remote version are both preserved until you choose one.</p>
      <section aria-label="Your draft">
        <h3>Your draft</h3>
        <pre>{localMarkdown}</pre>
      </section>
      <section aria-label="Remote version">
        <h3>Remote version</h3>
        <pre>{remoteMarkdown}</pre>
      </section>
      <button type="button" onClick={() => onResolve('keepMine')}>Keep mine</button>
      <button type="button" onClick={() => onResolve('useRemote')}>Use remote</button>
    </section>
  );
}
