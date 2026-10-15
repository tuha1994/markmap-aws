import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

import { moveMapsAndArchiveFolder } from './folderRepository';

describe('moveMapsAndArchiveFolder', () => {
  it('moves contained owner maps before archiving a folder', async () => {
    const database = {} as never;
    const folderReference = { id: 'folder-1' };
    const mapReference = { id: 'map-1' };
    const mapsQuery = {};
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };

    firestore.doc.mockReturnValue(folderReference);
    firestore.collection.mockReturnValue({ id: 'maps' });
    firestore.query.mockReturnValue(mapsQuery);
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ownerUid: 'owner-uid', archivedAt: null }) });
    firestore.getDocs.mockResolvedValue({ docs: [{ ref: mapReference, data: () => ({ ownerUid: 'owner-uid', deletedAt: null }) }] });
    firestore.writeBatch.mockReturnValue(batch);
    firestore.serverTimestamp.mockReturnValue('server-time');

    await expect(moveMapsAndArchiveFolder(database, {
      ownerUid: 'owner-uid',
      folderId: 'folder-1',
      destinationFolderId: null
    })).resolves.toEqual({ status: 'archived' });

    expect(batch.update).toHaveBeenNthCalledWith(1, mapReference, expect.objectContaining({ folderId: null }));
    expect(batch.update).toHaveBeenNthCalledWith(2, folderReference, expect.objectContaining({
      archivedByUid: 'owner-uid',
      archivedAt: 'server-time'
    }));
    expect(batch.commit).toHaveBeenCalledOnce();
  });
});
