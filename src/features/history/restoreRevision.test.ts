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

import { restoreRevision } from './revisionRepository';
import { makeMindMap, makeRevision } from '../../test/factories';

describe('restoreRevision', () => {
  it('writes a restore-protection snapshot before atomically replacing the current map', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionsReference = { id: 'revisions' };
    const protectionReference = { id: 'restore-protection-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-uid', contentVersion: 5, revisionPrunePending: false })
      }),
      set: vi.fn(),
      update: vi.fn()
    };
    firestore.doc.mockReturnValueOnce(mapReference).mockReturnValueOnce(protectionReference);
    firestore.collection.mockReturnValue(revisionsReference);
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.query.mockReturnValue({ id: 'prune-query' });
    firestore.getDocs.mockResolvedValue({ docs: [] });
    firestore.runTransaction.mockImplementation(async (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction));

    await restoreRevision(database, { id: 'map-1', ...makeMindMap({ contentVersion: 5, markdown: '# Current' }) }, makeRevision({
      title: 'Recovered', folderId: 'folder-1', markdown: '# Recovered'
    }));

    expect(transaction.set).toHaveBeenCalledWith(protectionReference, expect.objectContaining({
      reason: 'restore-protection', markdown: '# Current', sourceContentVersion: 6
    }));
    expect(transaction.update).toHaveBeenCalledWith(mapReference, expect.objectContaining({
      title: 'Recovered', folderId: 'folder-1', markdown: '# Recovered', contentVersion: 6,
      currentRevisionId: 'restore-protection-1'
    }));
    expect(transaction.set.mock.invocationCallOrder[0]).toBeLessThan(transaction.update.mock.invocationCallOrder[0]);
    expect(firestore.getDocs).toHaveBeenCalledWith({ id: 'prune-query' });
  });
});
