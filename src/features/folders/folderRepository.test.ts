import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

import { renameFolder, subscribeFolders } from './folderRepository';

describe('subscribeFolders', () => {
  it('queries active folders with ownerUid equality and sort ordering', () => {
    const database = {} as never;
    const collectionReference = {};
    const activeFoldersQuery = {};
    const unsubscribe = vi.fn();

    firestore.collection.mockReturnValue(collectionReference);
    firestore.where.mockReturnValueOnce('owner-filter').mockReturnValueOnce('active-filter');
    firestore.orderBy.mockReturnValue('sort-order');
    firestore.query.mockReturnValue(activeFoldersQuery);
    firestore.onSnapshot.mockReturnValue(unsubscribe);

    expect(subscribeFolders(database, 'owner-uid', vi.fn())).toBe(unsubscribe);
    expect(firestore.collection).toHaveBeenCalledWith(database, 'folders');
    expect(firestore.where).toHaveBeenNthCalledWith(1, 'ownerUid', '==', 'owner-uid');
    expect(firestore.where).toHaveBeenNthCalledWith(2, 'archivedAt', '==', null);
    expect(firestore.orderBy).toHaveBeenCalledWith('sortOrder', 'asc');
    expect(firestore.query).toHaveBeenCalledWith(
      collectionReference,
      'owner-filter',
      'active-filter',
      'sort-order'
    );
    expect(firestore.onSnapshot).toHaveBeenCalledWith(activeFoldersQuery, expect.any(Function), expect.any(Function));
  });
});

describe('renameFolder', () => {
  it('reports a distinct renamed status after a successful rename', async () => {
    const reference = { id: 'folder-1' };
    firestore.doc.mockReturnValue(reference);
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ownerUid: 'owner-uid', archivedAt: null }) });
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue('server-time');

    await expect(renameFolder({} as never, 'owner-uid', 'folder-1', 'Renamed')).resolves.toEqual({ status: 'renamed' });
    expect(firestore.updateDoc).toHaveBeenCalledWith(reference, expect.objectContaining({ name: 'Renamed', updatedAt: 'server-time' }));
  });
});
