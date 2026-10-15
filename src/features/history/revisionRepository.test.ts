import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
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

describe('createRevisionAndSaveMap', () => {
  it('commits current map update and new revision atomically before attempting prune', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionsReference = { id: 'revisions' };
    const revisionReference = { id: 'revision-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          ownerUid: 'owner-uid',
          contentVersion: 3,
          title: 'Previous',
          folderId: null,
          markdown: 'old',
          revisionPrunePending: false
        })
      }),
      update: vi.fn(),
      set: vi.fn()
    };

    firestore.doc
      .mockReturnValueOnce(mapReference)
      .mockReturnValueOnce(revisionReference);
    firestore.collection.mockReturnValue(revisionsReference);
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDocs.mockResolvedValue({ docs: [] });
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => {
      await action(transaction);
    });

    const result = await createRevisionAndSaveMap(database, {
      ownerUid: 'owner-uid',
      mapId: 'map-1',
      expectedContentVersion: 3,
      title: 'Updated',
      folderId: null,
      markdown: 'new',
      contentSearchText: 'new',
      reason: 'manual'
    });

    expect(result).toEqual({ status: 'saved', revisionId: 'revision-1', prunePending: false });
    expect(transaction.update).toHaveBeenCalledWith(mapReference, expect.objectContaining({
      contentVersion: 4,
      currentRevisionId: 'revision-1'
    }));
    expect(transaction.set).toHaveBeenCalledWith(revisionReference, expect.objectContaining({
      ownerUid: 'owner-uid',
      mapId: 'map-1',
      sourceContentVersion: 4,
      reason: 'manual'
    }));
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('returns the transaction-confirmed remote map on a content-version conflict', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const remoteDocument = {
      ownerUid: 'owner-uid', contentVersion: 6, markdown: '# Competing remote', title: 'Remote title'
    };
    const transaction = {
      get: vi.fn().mockResolvedValue({ id: 'map-1', exists: () => true, data: () => remoteDocument }),
      update: vi.fn(),
      set: vi.fn()
    };

    firestore.doc.mockReturnValue(mapReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction));

    await expect(createRevisionAndSaveMap(database, {
      ownerUid: 'owner-uid', mapId: 'map-1', expectedContentVersion: 4, title: 'Local title', folderId: null,
      markdown: '# Local draft', contentSearchText: 'local draft', reason: 'manual'
    })).resolves.toEqual({ status: 'conflict', remote: { id: 'map-1', ...remoteDocument } });
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
