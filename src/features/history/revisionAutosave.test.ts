import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), query: vi.fn(),
  runTransaction: vi.fn(), serverTimestamp: vi.fn(), updateDoc: vi.fn()
}));
vi.mock('firebase/firestore', () => firestore);

import { createRevisionAndSaveMap } from './revisionRepository';

describe('autosave revision throttling', () => {
  it('creates no more than one autosave revision in 30 seconds while saving the current map', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionsReference = { id: 'revisions' };
    const revisionReference = { id: 'revision-new' };
    const recentAutosave = { data: () => ({ reason: 'autosave', createdAt: { toMillis: () => Date.now() - 29_999 } }) };
    const transaction = {
      get: vi.fn().mockImplementation((reference) => Promise.resolve(reference === mapReference
        ? { exists: () => true, data: () => ({ ownerUid: 'owner-uid', contentVersion: 3, revisionPrunePending: false, currentRevisionAt: { toMillis: () => Date.now() - 29_999 } }) }
        : { docs: [recentAutosave] })),
      update: vi.fn(), set: vi.fn()
    };
    firestore.doc.mockReturnValueOnce(mapReference).mockReturnValueOnce(revisionReference);
    firestore.collection.mockReturnValue(revisionsReference);
    firestore.query.mockReturnValue({ id: 'latest-autosave' });
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction));

    await expect(createRevisionAndSaveMap(database, {
      ownerUid: 'owner-uid', mapId: 'map-1', expectedContentVersion: 3, title: 'Updated', folderId: null,
      markdown: 'new', contentSearchText: 'new', reason: 'autosave'
    })).resolves.toEqual({ status: 'saved', revisionId: null, prunePending: false });

    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).toHaveBeenCalledWith(mapReference, expect.objectContaining({
      markdown: 'new', contentVersion: 4
    }));
  });
});
