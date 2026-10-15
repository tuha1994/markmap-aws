import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';

import type { Folder } from './folderTypes';

export type StoredFolder = Folder & { id: string };
export type RepositoryErrorListener = (error: Error) => void;

function toFolder(id: string, data: unknown): StoredFolder {
  return { id, ...(data as Folder) };
}

export function subscribeFolders(
  database: Firestore,
  ownerUid: string,
  listener: (folders: StoredFolder[]) => void,
  onError: RepositoryErrorListener = () => undefined
): Unsubscribe {
  const activeFoldersQuery = query(
    collection(database, 'folders'),
    where('ownerUid', '==', ownerUid),
    where('archivedAt', '==', null),
    orderBy('sortOrder', 'asc')
  );

  return onSnapshot(
    activeFoldersQuery,
    (snapshot) => listener(snapshot.docs.map((folder) => toFolder(folder.id, folder.data()))),
    onError
  );
}

export type CreateFolderInput = {
  ownerUid: string;
  name: string;
  color?: string | null;
  sortOrder: number;
};

export async function createFolder(database: Firestore, input: CreateFolderInput): Promise<string> {
  const timestamp = serverTimestamp();
  const reference = await addDoc(collection(database, 'folders'), {
    ownerUid: input.ownerUid,
    name: input.name,
    normalizedName: input.name.toLocaleLowerCase(),
    color: input.color ?? null,
    sortOrder: input.sortOrder,
    archivedAt: null,
    archivedByUid: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return reference.id;
}

export async function renameFolder(database: Firestore, ownerUid: string, folderId: string, name: string): Promise<FolderOperationResult> {
  const reference = doc(database, 'folders', folderId);
  try {
    const existing = await getDoc(reference);
    if (!existing.exists() || existing.data().ownerUid !== ownerUid || existing.data().archivedAt !== null) {
      throw new Error('The folder is unavailable.');
    }
    await updateDoc(reference, { name, normalizedName: name.toLocaleLowerCase(), updatedAt: serverTimestamp() });
  } catch (error) {
    return { status: 'error', error: toError(error) };
  }
  return { status: 'renamed' };
}

export type MoveMapsAndArchiveFolderInput = {
  ownerUid: string;
  folderId: string;
  destinationFolderId: string | null;
};

export type FolderOperationResult =
  | { status: 'archived' }
  | { status: 'renamed' }
  | { status: 'partial'; mapsMoved: number; retryable: true }
  | { status: 'error'; error: Error; retryable?: true };

const MAX_MAP_RELOCATION_WRITES = 400;

export async function moveMapsAndArchiveFolder(
  database: Firestore,
  input: MoveMapsAndArchiveFolderInput
): Promise<FolderOperationResult> {
  const sourceFolder = doc(database, 'folders', input.folderId);
  const destinationFolder = input.destinationFolderId === null
    ? null
    : doc(database, 'folders', input.destinationFolderId);
  const mapsToMove = query(
    collection(database, 'mindMaps'),
    where('ownerUid', '==', input.ownerUid),
    where('folderId', '==', input.folderId),
    where('deletedAt', '==', null)
  );

  try {
    const [folderSnapshot, mapSnapshots, destinationSnapshot] = await Promise.all([
      getDoc(sourceFolder),
      getDocs(mapsToMove),
      destinationFolder ? getDoc(destinationFolder) : Promise.resolve(null)
    ]);
    if (!folderSnapshot.exists() || folderSnapshot.data().ownerUid !== input.ownerUid || folderSnapshot.data().archivedAt !== null) {
      throw new Error('The folder is unavailable.');
    }
    if (destinationSnapshot && (!destinationSnapshot.exists()
      || destinationSnapshot.data().ownerUid !== input.ownerUid
      || destinationSnapshot.data().archivedAt !== null)) {
      throw new Error('The destination folder is unavailable.');
    }
    if (mapSnapshots.docs.some((map) => map.data().ownerUid !== input.ownerUid || map.data().deletedAt !== null)) {
      throw new Error('The folder contains an invalid map.');
    }

    let mapsMoved = 0;
    for (let start = 0; start < mapSnapshots.docs.length; start += MAX_MAP_RELOCATION_WRITES) {
      const mapChunk = mapSnapshots.docs.slice(start, start + MAX_MAP_RELOCATION_WRITES);
      const batch = writeBatch(database);
      const timestamp = serverTimestamp();
      for (const map of mapChunk) {
        const contentVersion = map.data().contentVersion;
        if (typeof contentVersion !== 'number') {
          throw new Error('The folder contains a map with an invalid content version.');
        }
        batch.update(map.ref, {
          folderId: input.destinationFolderId,
          contentVersion: contentVersion + 1,
          updatedAt: timestamp
        });
      }
      try {
        await batch.commit();
      } catch (error) {
        if (mapsMoved > 0) {
          return { status: 'partial', mapsMoved, retryable: true };
        }
        return { status: 'error', error: toError(error), retryable: true };
      }
      mapsMoved += mapChunk.length;
    }

    const archiveBatch = writeBatch(database);
    const timestamp = serverTimestamp();
    archiveBatch.update(sourceFolder, {
      archivedAt: timestamp,
      archivedByUid: input.ownerUid,
      updatedAt: timestamp
    });
    await archiveBatch.commit();
  } catch (error) {
    return { status: 'error', error: toError(error) };
  }

  return { status: 'archived' };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('The folder operation failed.');
}
