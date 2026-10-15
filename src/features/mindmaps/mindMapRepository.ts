import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';

import type { MindMap } from './mindMapTypes';

export type StoredMindMap = MindMap & { id: string };
export type RepositoryErrorListener = (error: Error) => void;
export type UpdateResult =
  | { status: 'updated'; contentVersion: number }
  | { status: 'conflict'; remote: StoredMindMap }
  | { status: 'error'; error: Error };

export type UpdateMindMapInput = {
  ownerUid: string;
  mapId: string;
  expectedContentVersion: number;
  title: string;
  folderId: string | null;
  markdown: string;
  contentSearchText: string;
};

export type CreateMindMapInput = Omit<UpdateMindMapInput, 'mapId' | 'expectedContentVersion'>;

function toMindMap(id: string, data: unknown): StoredMindMap {
  return { id, ...(data as MindMap) };
}

export function subscribeMindMaps(
  database: Firestore,
  ownerUid: string,
  listener: (maps: StoredMindMap[]) => void,
  onError: RepositoryErrorListener = () => undefined
): Unsubscribe {
  const activeMapsQuery = query(
    collection(database, 'mindMaps'),
    where('ownerUid', '==', ownerUid),
    where('deletedAt', '==', null),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    activeMapsQuery,
    (snapshot) => listener(snapshot.docs.map((map) => toMindMap(map.id, map.data()))),
    onError
  );
}

export function subscribeMindMap(
  database: Firestore,
  mapId: string,
  listener: (map: StoredMindMap | null) => void,
  onError: RepositoryErrorListener = () => undefined
): Unsubscribe {
  return onSnapshot(
    doc(database, 'mindMaps', mapId),
    (snapshot) => listener(snapshot.exists() ? toMindMap(snapshot.id, snapshot.data()) : null),
    onError
  );
}

export async function createMindMap(database: Firestore, input: CreateMindMapInput): Promise<StoredMindMap> {
  const timestamp = serverTimestamp();
  const reference = await addDoc(collection(database, 'mindMaps'), {
    ownerUid: input.ownerUid,
    folderId: input.folderId,
    title: input.title,
    titleLower: input.title.toLocaleLowerCase(),
    markdown: input.markdown,
    contentSearchText: input.contentSearchText,
    contentVersion: 1,
    currentRevisionId: null,
    currentRevisionAt: null,
    revisionPrunePending: false,
    deletedAt: null,
    deletedByUid: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const created = await getDoc(reference);
  if (!created.exists()) {
    throw new Error('The newly created mind map could not be read.');
  }
  return toMindMap(created.id, created.data());
}

export async function archiveMindMap(database: Firestore, ownerUid: string, mapId: string): Promise<UpdateResult> {
  const mapReference = doc(database, 'mindMaps', mapId);
  try {
    await runTransaction(database, async (transaction) => {
      const existing = await transaction.get(mapReference);
      if (!existing.exists() || existing.data().ownerUid !== ownerUid || existing.data().deletedAt !== null) {
        throw new Error('The mind map is unavailable.');
      }
      transaction.update(mapReference, {
        deletedAt: serverTimestamp(),
        deletedByUid: ownerUid,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    return { status: 'error', error: toError(error) };
  }
  return { status: 'updated', contentVersion: 0 };
}

export async function updateMindMapVersioned(
  database: Firestore,
  input: UpdateMindMapInput
): Promise<UpdateResult> {
  const mapReference = doc(database, 'mindMaps', input.mapId);

  try {
    await runTransaction(database, async (transaction) => {
      const existing = await transaction.get(mapReference);
      if (!existing.exists() || existing.data().ownerUid !== input.ownerUid) {
        throw new Error('The mind map is unavailable.');
      }
      if (existing.data().contentVersion !== input.expectedContentVersion) {
        throw new VersionConflictError(toMindMap(existing.id, existing.data()));
      }

      transaction.update(mapReference, {
        folderId: input.folderId,
        title: input.title,
        titleLower: input.title.toLocaleLowerCase(),
        markdown: input.markdown,
        contentSearchText: input.contentSearchText,
        contentVersion: input.expectedContentVersion + 1,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { status: 'conflict', remote: error.remote };
    }
    return { status: 'error', error: toError(error) };
  }

  return { status: 'updated', contentVersion: input.expectedContentVersion + 1 };
}

class VersionConflictError extends Error {
  constructor(readonly remote: StoredMindMap) {
    super();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The mind map operation failed.');
}
