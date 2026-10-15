import { afterEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

afterEach(() => vi.resetAllMocks());

import { createRevisionAndSaveMap, retryRevisionPrune } from './revisionRepository';

describe('revision prune failure', () => {
  it('does not clear pending while an interleaved save leaves more than 50 revisions', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const firstVersion = { isEqual: (other: unknown) => other === firstVersion };
    const secondVersion = { isEqual: (other: unknown) => other === secondVersion };
    const state = { revisionCount: 50, revisionPrunePending: true, version: firstVersion };
    let releaseFirstRevisionRead: (() => void) | undefined;
    const firstRevisionReadStarted = new Promise<void>((resolve) => {
      firestore.getDocs.mockImplementationOnce(() => new Promise((resume) => {
        releaseFirstRevisionRead = () => resume({
          docs: Array.from({ length: 50 }, (_, index) => ({ ref: { id: `revision-${index + 1}` } }))
        });
        resolve();
      }));
    });

    firestore.doc.mockReturnValue(mapReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDoc.mockImplementation(async () => {
      const version = state.version;
      return { exists: () => true, data: () => ({ updatedAt: version }) };
    });
    firestore.getDocs.mockImplementation(async () => ({
      docs: Array.from({ length: state.revisionCount }, (_, index) => ({ ref: { id: `revision-${index + 1}` } }))
    }));
    firestore.deleteDoc.mockImplementation(async () => {
      state.revisionCount -= 1;
    });
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (transaction: { get: () => Promise<unknown>; update: (reference: unknown, patch: { revisionPrunePending: boolean }) => void }) => Promise<boolean>) => action({
      get: async () => ({ exists: () => true, data: () => ({ updatedAt: state.version }) }),
      update: (_reference, patch) => {
        if (patch.revisionPrunePending === false && state.revisionCount > 50) {
          throw new Error('cleared pending while over cap');
        }
        state.revisionPrunePending = patch.revisionPrunePending;
      }
    }));

    const retry = retryRevisionPrune(database, 'map-1');
    await firstRevisionReadStarted;
    releaseFirstRevisionRead?.();
    state.revisionCount = 51;
    state.revisionPrunePending = true;
    state.version = secondVersion;

    await expect(retry).resolves.toBe(false);
    expect(state).toEqual({ revisionCount: 50, revisionPrunePending: false, version: secondVersion });
  });

  it('retries pending cleanup without creating a revision and restores the hard cap of 50', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const oldestRevision = { id: 'revision-1' };
    const version = { isEqual: (other: unknown) => other === version };
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ updatedAt: version }) }),
      update: vi.fn()
    };

    firestore.doc.mockReturnValue(mapReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ updatedAt: version }) });
    firestore.getDocs
      .mockResolvedValueOnce({ docs: Array.from({ length: 51 }, (_, index) => ({ ref: index === 0 ? oldestRevision : { id: `revision-${index + 1}` } })) })
      .mockResolvedValueOnce({ docs: Array.from({ length: 50 }, (_, index) => ({ ref: { id: `revision-${index + 2}` } })) });
    firestore.deleteDoc.mockResolvedValue(undefined);
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<boolean>) => action(transaction));

    await expect(retryRevisionPrune(database, 'map-1')).resolves.toBe(false);

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
    expect(firestore.deleteDoc).toHaveBeenCalledWith(oldestRevision);
    expect(transaction.update).toHaveBeenCalledWith(mapReference, expect.objectContaining({ revisionPrunePending: false }));
  });

  it('retains pending cleanup when retry deletion fails without creating a revision', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const oldestRevision = { id: 'revision-1' };

    firestore.doc.mockReturnValue(mapReference);
    firestore.collection.mockReturnValue({ id: 'revisions' });
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ updatedAt: 'before-delete' }) });
    firestore.getDocs.mockResolvedValue({ docs: Array.from({ length: 51 }, (_, index) => ({ ref: index === 0 ? oldestRevision : { id: `revision-${index + 1}` } })) });
    firestore.deleteDoc.mockRejectedValue(new Error('delete denied'));
    firestore.updateDoc.mockResolvedValue(undefined);

    await expect(retryRevisionPrune(database, 'map-1')).resolves.toBe(true);

    expect(firestore.runTransaction).not.toHaveBeenCalled();
    expect(firestore.deleteDoc).toHaveBeenCalledWith(oldestRevision);
    expect(firestore.updateDoc).toHaveBeenCalledWith(mapReference, expect.objectContaining({ revisionPrunePending: true }));
  });

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
    expect(firestore.updateDoc).toHaveBeenCalledWith(mapReference, expect.objectContaining({ revisionPrunePending: true }));
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
    expect(firestore.updateDoc).toHaveBeenCalledWith(mapReference, expect.objectContaining({ revisionPrunePending: true }));
  });
});
