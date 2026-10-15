import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore
} from 'firebase/firestore';

import type { RevisionReason } from './revisionTypes';

export type SaveResult =
  | { status: 'saved'; revisionId: string; prunePending: boolean }
  | { status: 'prune-pending' }
  | { status: 'conflict' }
  | { status: 'error'; error: Error };

export type CreateRevisionAndSaveMapInput = {
  ownerUid: string;
  mapId: string;
  expectedContentVersion: number;
  title: string;
  folderId: string | null;
  markdown: string;
  contentSearchText: string;
  reason: RevisionReason;
};

export async function createRevisionAndSaveMap(
  database: Firestore,
  input: CreateRevisionAndSaveMapInput
): Promise<SaveResult> {
  const mapReference = doc(database, 'mindMaps', input.mapId);
  const revisionsReference = collection(mapReference, 'revisions');
  const revisionReference = doc(revisionsReference);

  let autosaveSuppressed = false;
  try {
    await runTransaction(database, async (transaction) => {
      const mapSnapshot = await transaction.get(mapReference);

      if (!mapSnapshot.exists() || mapSnapshot.data().ownerUid !== input.ownerUid) {
        throw new Error('The mind map is unavailable.');
      }

      const map = mapSnapshot.data();
      if (input.reason === 'autosave' && map.revisionPrunePending === true) {
        autosaveSuppressed = true;
        return;
      }
      if (map.contentVersion !== input.expectedContentVersion) {
        throw new RevisionConflictError();
      }

      const nextContentVersion = input.expectedContentVersion + 1;
      const timestamp = serverTimestamp();
      transaction.update(mapReference, {
        folderId: input.folderId,
        title: input.title,
        titleLower: input.title.toLocaleLowerCase(),
        markdown: input.markdown,
        contentSearchText: input.contentSearchText,
        contentVersion: nextContentVersion,
        currentRevisionId: revisionReference.id,
        currentRevisionAt: timestamp,
        revisionPrunePending: false,
        updatedAt: timestamp
      });
      transaction.set(revisionReference, {
        ownerUid: input.ownerUid,
        mapId: input.mapId,
        sourceContentVersion: nextContentVersion,
        title: input.title,
        folderId: input.folderId,
        markdown: input.markdown,
        reason: input.reason,
        createdAt: timestamp,
        createdByUid: input.ownerUid
      });
    });
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      return { status: 'conflict' };
    }

    return { status: 'error', error: toError(error) };
  }

  if (autosaveSuppressed) {
    return { status: 'prune-pending' };
  }

  const prunePending = await pruneOldestExcessRevision(database, mapReference, revisionsReference);
  return { status: 'saved', revisionId: revisionReference.id, prunePending };
}

async function pruneOldestExcessRevision(
  database: Firestore,
  mapReference: ReturnType<typeof doc>,
  revisionsReference: ReturnType<typeof collection>
): Promise<boolean> {
  try {
    const revisions = await getDocs(query(revisionsReference, orderBy('createdAt', 'asc'), limit(51)));
    if (revisions.docs.length <= 50) {
      return false;
    }

    await deleteDoc(revisions.docs[0].ref);
    await updateDoc(mapReference, { revisionPrunePending: false });
    return false;
  } catch {
    try {
      await updateDoc(mapReference, { revisionPrunePending: true });
    } catch {
      // The committed map/revision transaction remains durable even if status cannot be updated.
    }
    return true;
  }
}

class RevisionConflictError extends Error {}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The map could not be saved.');
}
