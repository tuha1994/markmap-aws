import type { StoredRevision } from './revisionRepository';

type Props = {
  revisions: StoredRevision[];
  onRestore(revision: StoredRevision): void;
  onSaveVersion?(): void;
};

export function VersionHistoryPanel({ revisions, onRestore, onSaveVersion }: Props) {
  return (
    <section aria-labelledby="version-history-title">
      <h2 id="version-history-title">Version history</h2>
      {onSaveVersion ? <button type="button" onClick={onSaveVersion}>Save version</button> : null}
      {revisions.length === 0 ? <p>No saved revisions yet.</p> : (
        <ol>
          {revisions.map((revision) => (
            <li key={revision.id}>
              <strong>{revision.title}</strong>
              <span> Version {revision.sourceContentVersion}</span>
              <button type="button" onClick={() => onRestore(revision)}>Restore {revision.title}</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
