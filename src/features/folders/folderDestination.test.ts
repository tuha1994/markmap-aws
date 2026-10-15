import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), query: vi.fn(),
  serverTimestamp: vi.fn(), where: vi.fn(), writeBatch: vi.fn()
}));
vi.mock('firebase/firestore', () => firestore);

import { moveMapsAndArchiveFolder } from './folderRepository';

describe('moveMapsAndArchiveFolder destination validation', () => {
  it('rejects the source folder as its own destination before any write or archive', async () => {
    firestore.doc.mockReturnValue({ id: 'source' });

    await expect(moveMapsAndArchiveFolder({} as never, {
      ownerUid: 'owner-uid', folderId: 'source', destinationFolderId: 'source'
    })).resolves.toMatchObject({ status: 'error' });

    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(firestore.writeBatch).not.toHaveBeenCalled();
  });

  it('rejects an archived or other-owner destination folder before any write', async () => {
    const source = { id: 'source' };
    const destination = { id: 'destination' };
    firestore.doc.mockReturnValueOnce(source).mockReturnValueOnce(destination);
    firestore.collection.mockReturnValue({ id: 'maps' });
    firestore.query.mockReturnValue({});
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ ownerUid: 'owner-uid', archivedAt: null }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ ownerUid: 'other-owner', archivedAt: null }) });
    firestore.getDocs.mockResolvedValue({ docs: [] });
    firestore.serverTimestamp.mockReturnValue('server-time');
    firestore.writeBatch.mockReturnValue({ update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) });

    await expect(moveMapsAndArchiveFolder({} as never, {
      ownerUid: 'owner-uid', folderId: 'source', destinationFolderId: 'destination'
    })).resolves.toMatchObject({ status: 'error' });
  });
});
