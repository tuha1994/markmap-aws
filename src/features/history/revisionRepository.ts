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

import type { StoredMindMap } from '../mindmaps/mindMapRepository';
import type { Revision, RevisionReason } from './revisionTypes';

export type SaveResult =
  | { status: 'saved'; revisionId: string | null; prunePending: boolean }
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

export type StoredRevision = Revision & { id: string };

export async function listRevisions(database: Firestore, mapId: string): Promise<StoredRevision[]> {
  const mapReference = doc(database, 'mindMaps', mapId);
  const revisions = await getDocs(query(
    collection(mapReference, 'revisions'),
    orderBy('createdAt', 'desc')
  ));
  return revisions.docs.map((revision) => ({ id: revision.id, ...(revision.data() as Revision) }));
}

export async function restoreRevision(
  database: Firestore,
  map: StoredMindMap,
  revision: Revision
): Promise<void> {
  if (revision.mapId !== map.id || revision.ownerUid !== map.ownerUid) {
    throw new Error('The revision does not belong to this mind map.');
  }

  const mapReference = doc(database, 'mindMaps', map.id);
  const revisionsReference = collection(mapReference, 'revisions');
  const protectionReference = doc(revisionsReference);
  await runTransaction(database, async (transaction) => {
    const mapSnapshot = await transaction.get(mapReference);
    if (!mapSnapshot.exists()
      || mapSnapshot.data().ownerUid !== map.ownerUid
      || mapSnapshot.data().contentVersion !== map.contentVersion) {
      throw new RevisionConflictError();
    }

    const nextContentVersion = map.contentVersion + 1;
    const timestamp = serverTimestamp();
    transaction.set(protectionReference, {
      ownerUid: map.ownerUid,
      mapId: map.id,
      sourceContentVersion: nextContentVersion,
      title: map.title,
      folderId: map.folderId,
      markdown: map.markdown,
      reason: 'restore-protection',
      createdAt: timestamp,
      createdByUid: map.ownerUid
    });
    transaction.update(mapReference, {
      folderId: revision.folderId,
      title: revision.title,
      titleLower: revision.title.toLocaleLowerCase(),
      markdown: revision.markdown,
      contentSearchText: revision.markdown.toLocaleLowerCase(),
      contentVersion: nextContentVersion,
      currentRevisionId: protectionReference.id,
      currentRevisionAt: timestamp,
      revisionPrunePending: false,
      updatedAt: timestamp
    });
  });
  await pruneOldestExcessRevision(database, mapReference, revisionsReference);
}

export async function createRevisionAndSaveMap(
  database: Firestore,
  input: CreateRevisionAndSaveMapInput
): Promise<SaveResult> {
  const mapReference = doc(database, 'mindMaps', input.mapId);
  const revisionsReference = collection(mapReference, 'revisions');
  const revisionReference = doc(revisionsReference);

  let autosavePrunePending = false;
  let autosaveThrottled = false;
  try {
    await runTransaction(database, async (transaction) => {
      const mapSnapshot = await transaction.get(mapReference);

      if (!mapSnapshot.exists() || mapSnapshot.data().ownerUid !== input.ownerUid) {
        throw new Error('The mind map is unavailable.');
      }

      const map = mapSnapshot.data();
      if (map.contentVersion !== input.expectedContentVersion) {
        throw new RevisionConflictError();
      }
      const nextContentVersion = input.expectedContentVersion + 1;
      const timestamp = serverTimestamp();
      const mapUpdate = {
        folderId: input.folderId,
        title: input.title,
        titleLower: input.title.toLocaleLowerCase(),
        markdown: input.markdown,
        contentSearchText: input.contentSearchText,
        contentVersion: nextContentVersion,
        updatedAt: timestamp
      };

      if (input.reason === 'autosave') {
        if (map.revisionPrunePending === true) {
          autosavePrunePending = true;
          transaction.update(mapReference, mapUpdate);
          return;
        }
        if (isRecentSnapshot(map.currentRevisionAt)) {
          autosaveThrottled = true;
          transaction.update(mapReference, mapUpdate);
          return;
        }
      }

      transaction.update(mapReference, {
        ...mapUpdate,
        currentRevisionId: revisionReference.id,
        currentRevisionAt: timestamp,
        revisionPrunePending: false
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

  if (autosavePrunePending) {
    return { status: 'prune-pending' };
  }
  if (autosaveThrottled) {
    return { status: 'saved', revisionId: null, prunePending: false };
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

function isRecentSnapshot(createdAt: unknown): boolean {
  return createdAt !== null
    && typeof createdAt === 'object'
    && typeof (createdAt as { toMillis?: unknown }).toMillis === 'function'
    && Date.now() - (createdAt as { toMillis: () => number }).toMillis() < 30_000;
}

class RevisionConflictError extends Error {}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The map could not be saved.');
}
