import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

import { subscribeMindMaps, updateMindMapVersioned } from './mindMapRepository';

describe('subscribeMindMaps', () => {
  it('queries active maps with ownerUid equality and updatedAt descending ordering', () => {
    const database = {} as never;
    const collectionReference = {};
    const activeMapsQuery = {};
    const unsubscribe = vi.fn();

    firestore.collection.mockReturnValue(collectionReference);
    firestore.where.mockReturnValueOnce('owner-filter').mockReturnValueOnce('active-filter');
    firestore.orderBy.mockReturnValue('updated-order');
    firestore.query.mockReturnValue(activeMapsQuery);
    firestore.onSnapshot.mockReturnValue(unsubscribe);

    expect(subscribeMindMaps(database, 'owner-uid', vi.fn())).toBe(unsubscribe);
    expect(firestore.collection).toHaveBeenCalledWith(database, 'mindMaps');
    expect(firestore.where).toHaveBeenNthCalledWith(1, 'ownerUid', '==', 'owner-uid');
    expect(firestore.where).toHaveBeenNthCalledWith(2, 'deletedAt', '==', null);
    expect(firestore.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    expect(firestore.query).toHaveBeenCalledWith(
      collectionReference,
      'owner-filter',
      'active-filter',
      'updated-order'
    );
    expect(firestore.onSnapshot).toHaveBeenCalledWith(activeMapsQuery, expect.any(Function), expect.any(Function));
  });
});

describe('updateMindMapVersioned', () => {
  it('uses a transaction version check for map updates', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-uid', contentVersion: 4 })
      }),
      update: vi.fn()
    };

    firestore.doc.mockReturnValue(mapReference);
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => {
      await action(transaction);
    });

    await expect(updateMindMapVersioned(database, {
      ownerUid: 'owner-uid',
      mapId: 'map-1',
      expectedContentVersion: 4,
      title: 'Updated',
      folderId: null,
      markdown: 'new',
      contentSearchText: 'new'
    })).resolves.toEqual({ status: 'updated', contentVersion: 5 });

    expect(firestore.runTransaction).toHaveBeenCalledWith(database, expect.any(Function));
    expect(transaction.update).toHaveBeenCalledWith(mapReference, expect.objectContaining({
      contentVersion: 5,
      markdown: 'new',
      updatedAt: 'server-time'
    }));
  });
});
