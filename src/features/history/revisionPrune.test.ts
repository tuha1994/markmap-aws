import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

import { createRevisionAndSaveMap } from './revisionRepository';

describe('revision prune failure', () => {
  it('keeps all revisions and marks prune pending if oldest-revision deletion fails', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionReference = { id: 'revision-51' };
    const oldestRevision = { id: 'revision-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-uid', contentVersion: 1, revisionPrunePending: false })
      }),
      update: vi.fn(),
      set: vi.fn()
    };

    firestore.doc.mockReturnValueOnce(mapReference).mockReturnValueOnce(revisionReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction));
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDocs.mockResolvedValue({ docs: Array.from({ length: 51 }, (_, index) => index === 0 ? { ref: oldestRevision } : { ref: { id: `revision-${index + 1}` } }) });
    firestore.deleteDoc.mockRejectedValue(new Error('delete denied'));
    firestore.updateDoc.mockResolvedValue(undefined);

    await expect(createRevisionAndSaveMap(database, {
      ownerUid: 'owner-uid',
      mapId: 'map-1',
      expectedContentVersion: 1,
      title: 'Map',
      folderId: null,
      markdown: 'content',
      contentSearchText: 'content',
      reason: 'manual'
    })).resolves.toEqual({ status: 'saved', revisionId: 'revision-51', prunePending: true });

    expect(firestore.deleteDoc).toHaveBeenCalledWith(oldestRevision);
    expect(firestore.updateDoc).toHaveBeenCalledWith(mapReference, { revisionPrunePending: true });
  });

  it('returns a saved prune-pending result when the post-commit prune query fails', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionReference = { id: 'revision-51' };
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ ownerUid: 'owner-uid', contentVersion: 1, revisionPrunePending: false }) }),
      update: vi.fn(),
      set: vi.fn()
    };

    firestore.doc.mockReturnValueOnce(mapReference).mockReturnValueOnce(revisionReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction));
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDocs.mockRejectedValue(new Error('prune read denied'));
    firestore.updateDoc.mockResolvedValue(undefined);

    await expect(createRevisionAndSaveMap(database, {
      ownerUid: 'owner-uid', mapId: 'map-1', expectedContentVersion: 1, title: 'Map', folderId: null,
      markdown: 'content', contentSearchText: 'content', reason: 'manual'
    })).resolves.toEqual({ status: 'saved', revisionId: 'revision-51', prunePending: true });

    expect(transaction.set).toHaveBeenCalledWith(revisionReference, expect.objectContaining({ sourceContentVersion: 2 }));
    expect(firestore.updateDoc).toHaveBeenCalledWith(mapReference, { revisionPrunePending: true });
  });
});
