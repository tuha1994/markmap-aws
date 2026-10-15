import { describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn()
}));

vi.mock('firebase/firestore', () => firestore);

import { listRevisions } from './revisionRepository';

describe('listRevisions', () => {
  it('returns newest owner-scoped revisions with their document IDs', async () => {
    const database = {} as never;
    const mapReference = { id: 'map-1' };
    const revisionsReference = { id: 'revisions' };
    firestore.doc.mockReturnValue(mapReference);
    firestore.collection.mockReturnValue(revisionsReference);
    firestore.query.mockReturnValue({ id: 'revision-query' });
    firestore.getDocs.mockResolvedValue({
      docs: [{ id: 'revision-2', data: () => ({ title: 'Newest' }) }, { id: 'revision-1', data: () => ({ title: 'Oldest' }) }]
    });

    await expect(listRevisions(database, 'map-1')).resolves.toEqual([
      { id: 'revision-2', title: 'Newest' },
      { id: 'revision-1', title: 'Oldest' }
    ]);
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });
});
