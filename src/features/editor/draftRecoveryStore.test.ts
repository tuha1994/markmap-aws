import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserDraftRecoveryStore,
  createDraftRecoveryStore,
  type DraftRecoveryRecord,
  type DraftRecoveryIdentity,
  type RecoveryStorageAdapter,
  type RecoveryStorageTransaction
} from './draftRecoveryStore';

type StoredEntry = DraftRecoveryRecord | (DraftRecoveryIdentity & { deleted: true });

class InMemoryRecoveryAdapter implements RecoveryStorageAdapter {
  private readonly records = new Map<string, StoredEntry>();

  async runTransaction<T>(operation: (transaction: RecoveryStorageTransaction) => Promise<T>): Promise<T> {
    return operation({
      get: async (identity) => this.records.get(keyFor(identity)),
      list: async (uid, mapId) => [...this.records.values()]
        .filter((entry): entry is DraftRecoveryRecord => !('deleted' in entry) && entry.uid === uid && entry.mapId === mapId),
      put: async (record) => {
        this.records.set(keyFor(record), record);
      },
      delete: async (identity) => {
        this.records.set(keyFor(identity), { ...identity, deleted: true });
      }
    });
  }
}

function keyFor(record: Pick<DraftRecoveryRecord, 'uid' | 'mapId' | 'writerId'>): string {
  return `${record.uid}\u0000${record.mapId}\u0000${record.writerId}`;
}

function record(overrides: Partial<DraftRecoveryRecord> = {}): DraftRecoveryRecord {
  return {
    uid: 'user-a',
    mapId: 'map-1',
    writerId: 'writer-a',
    baseContentVersion: 4,
    markdown: '# Draft',
    generation: 1,
    recordVersion: 1,
    updatedAtMs: 100,
    ...overrides
  };
}

describe('DraftRecoveryStore', () => {
  it('lists only records for the requested UID and map', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const expected = record();
    await store.put(expected);
    await store.put(record({ uid: 'user-b', writerId: 'writer-b' }));
    await store.put(record({ mapId: 'map-2', writerId: 'writer-c' }));

    await expect(store.list('user-a', 'map-1')).resolves.toEqual([expected]);
  });

  it('keeps separate writer records for the same map', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const first = record({ writerId: 'writer-a', markdown: '# First' });
    const second = record({ writerId: 'writer-b', markdown: '# Second' });

    await store.put(first);
    await store.put(second);

    await expect(store.list('user-a', 'map-1')).resolves.toEqual([first, second]);
  });

  it('allocates the next record version inside the writer transaction', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const first = record({ generation: 1, recordVersion: 0 });
    const next = record({ generation: 2, recordVersion: 0 });

    await expect(store.put(first)).resolves.toBe(true);
    await expect(store.put(next)).resolves.toBe(true);

    expect(first.recordVersion).toBe(1);
    expect(next.recordVersion).toBe(2);
    await expect(store.list('user-a', 'map-1')).resolves.toEqual([next]);
  });

  it('rejects a delayed lower-generation put after a newer record exists', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const newer = record({ generation: 2, recordVersion: 2, markdown: '# Newer' });
    const stale = record({ generation: 1, recordVersion: 1, markdown: '# Stale' });

    await store.put(newer);
    await expect(store.put(stale)).resolves.toBe(false);
    await expect(store.list('user-a', 'map-1')).resolves.toEqual([newer]);
  });

  it('rejects a delayed lower record version within the current generation', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const current = record({ generation: 2, recordVersion: 2, markdown: '# Current' });
    const stale = record({ generation: 2, recordVersion: 1, markdown: '# Stale' });

    await store.put(current);

    await expect(store.put(stale)).resolves.toBe(false);
    await expect(store.list('user-a', 'map-1')).resolves.toEqual([current]);
  });

  it('rejects a delayed delete whose generation and record version are stale', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const stale = record({ generation: 1, recordVersion: 1 });
    const current = record({ generation: 2, recordVersion: 2, markdown: '# Current' });

    await store.put(stale);
    await store.put(current);

    await expect(store.deleteIfCurrent(stale)).resolves.toBe(false);
    await expect(store.list('user-a', 'map-1')).resolves.toEqual([current]);
  });

  it('rejects a delayed put after a newer record was confirmed and deleted', async () => {
    const store = createDraftRecoveryStore(new InMemoryRecoveryAdapter());
    const stale = record({ generation: 1, recordVersion: 1, markdown: '# Stale' });
    const confirmed = record({ generation: 2, recordVersion: 2, markdown: '# Confirmed' });

    await store.put(confirmed);
    await expect(store.deleteIfCurrent(confirmed)).resolves.toBe(true);

    await expect(store.put(stale)).resolves.toBe(false);
    await expect(store.list('user-a', 'map-1')).resolves.toEqual([]);
  });

  it('resolves safely and retries after blocked and rejected IndexedDB opens', async () => {
    const open = vi.fn(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (open.mock.calls.length === 1) request.onblocked?.call(request, {} as IDBVersionChangeEvent);
        else request.onerror?.call(request, new Event('error'));
      });
      return request;
    });
    vi.stubGlobal('indexedDB', { open });
    const store = createBrowserDraftRecoveryStore();

    try {
      await expect(store.list('user-a', 'map-1')).resolves.toEqual([]);
      await expect(store.put(record())).resolves.toBe(false);
      await expect(store.deleteIfCurrent(record())).resolves.toBe(false);
      expect(open).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
