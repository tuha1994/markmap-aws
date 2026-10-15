import { useState } from 'react';

import type { StoredFolder } from './folderRepository';

type Props = {
  folder: StoredFolder;
  folders: StoredFolder[];
  mapCount: number;
  onArchive(destinationFolderId: string | null): void;
  onCancel(): void;
  busy?: boolean;
};

const UNCATEGORIZED = '__uncategorized__';

export function DeleteFolderDialog({ folder, folders, mapCount, onArchive, onCancel, busy = false }: Props) {
  const [destination, setDestination] = useState<string | undefined>();
  const requiresDestination = mapCount > 0;
  const destinations = folders.filter((candidate) => candidate.id !== folder.id
    && candidate.ownerUid === folder.ownerUid
    && candidate.archivedAt === null);
  const canArchive = !busy && (!requiresDestination || destination !== undefined);

  function archive() {
    if (!canArchive) return;
    onArchive(destination === UNCATEGORIZED ? null : destination ?? null);
  }

  return (
    <section role="dialog" aria-modal="true" aria-label={`Archive ${folder.name}?`}>
      <h2>Archive {folder.name}?</h2>
      {requiresDestination ? (
        <>
          <p>Move {mapCount} map{mapCount === 1 ? '' : 's'} before this folder is archived.</p>
          <label>
            Move maps to
            <select value={destination ?? ''} onChange={(event) => setDestination(event.target.value || undefined)} disabled={busy}>
              <option value="" disabled>Select a destination</option>
              <option value={UNCATEGORIZED}>Uncategorized</option>
              {destinations.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
        </>
      ) : <p>This empty folder will be logically archived.</p>}
      <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" onClick={archive} disabled={!canArchive}>Archive folder</button>
    </section>
  );
}
