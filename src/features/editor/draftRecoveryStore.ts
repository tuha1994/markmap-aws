export interface DraftRecoveryRecord {
  uid: string;
  mapId: string;
  writerId: string;
  baseContentVersion: number;
  markdown: string;
  generation: number;
  recordVersion: number;
  updatedAtMs: number;
}

export type DraftRecoveryIdentity = Pick<DraftRecoveryRecord, 'uid' | 'mapId' | 'writerId' | 'generation' | 'recordVersion'>;

type DraftRecoveryKey = Pick<DraftRecoveryRecord, 'uid' | 'mapId' | 'writerId'>;

type DraftRecoveryTombstone = DraftRecoveryIdentity & { deleted: true };

type DraftRecoveryStorageEntry = DraftRecoveryRecord | DraftRecoveryTombstone;

export interface RecoveryStorageTransaction {
  get(identity: DraftRecoveryKey): Promise<DraftRecoveryStorageEntry | undefined>;
  list(uid: string, mapId: string): Promise<DraftRecoveryRecord[]>;
  put(record: DraftRecoveryRecord): Promise<void>;
  delete(identity: DraftRecoveryIdentity): Promise<void>;
}

/**
 * A transaction boundary is injected so unit tests can use a small in-memory
 * adapter while production uses a real IndexedDB read/write transaction.
 */
export interface RecoveryStorageAdapter {
  runTransaction<T>(operation: (transaction: RecoveryStorageTransaction) => Promise<T>): Promise<T>;
}

export interface DraftRecoveryStore {
  list(uid: string, mapId: string): Promise<DraftRecoveryRecord[]>;
  put(record: DraftRecoveryRecord): Promise<boolean>;
  deleteIfCurrent(identity: DraftRecoveryIdentity): Promise<boolean>;
}

export function createDraftRecoveryStore(adapter: RecoveryStorageAdapter): DraftRecoveryStore {
  return {
    async list(uid, mapId) {
      return adapter.runTransaction((transaction) => transaction.list(uid, mapId));
    },

    async put(record) {
      return adapter.runTransaction(async (transaction) => {
        const current = await transaction.get(record);
        const storedRecord = record.recordVersion === 0
          ? { ...record, recordVersion: (current?.recordVersion ?? 0) + 1 }
          : record;
        if (current && compareRecordFreshness(storedRecord, current) <= 0) return false;

        await transaction.put(storedRecord);
        if (record.recordVersion === 0) record.recordVersion = storedRecord.recordVersion;
        return true;
      });
    },

    async deleteIfCurrent(identity) {
      return adapter.runTransaction(async (transaction) => {
        const current = await transaction.get(identity);
        if (!current || isTombstone(current) || current.generation !== identity.generation || current.recordVersion !== identity.recordVersion) {
          return false;
        }

        await transaction.delete(identity);
        return true;
      });
    }
  };
}

function compareRecordFreshness(left: Pick<DraftRecoveryRecord, 'generation' | 'recordVersion'>, right: Pick<DraftRecoveryRecord, 'generation' | 'recordVersion'>): number {
  if (left.generation !== right.generation) return left.generation - right.generation;
  return left.recordVersion - right.recordVersion;
}

const DATABASE_NAME = 'markmap-aws-draft-recovery';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const UID_MAP_INDEX = 'uid-map';

/**
 * Browser adapter for writer-scoped recovery records. IndexedDB is browser
 * profile storage, not a credential vault; records intentionally contain no
 * Firebase credentials and callers must always query by authenticated UID.
 */
export class IndexedDbRecoveryStorageAdapter implements RecoveryStorageAdapter {
  private databasePromise: Promise<IDBDatabase> | undefined;

  async runTransaction<T>(operation: (transaction: RecoveryStorageTransaction) => Promise<T>): Promise<T> {
    const database = await this.openDatabase();
    const nativeTransaction = database.transaction(STORE_NAME, 'readwrite');
    const store = nativeTransaction.objectStore(STORE_NAME);
    const transaction: RecoveryStorageTransaction = {
      get: async (identity) => requestResult<DraftRecoveryStorageEntry | undefined>(store.get(keyFor(identity))).then((record) => record ? cloneEntry(record) : undefined),
      list: async (uid, mapId) => requestResult<DraftRecoveryStorageEntry[]>(store.index(UID_MAP_INDEX).getAll([uid, mapId])).then((records) => records.filter(isDraftRecord).map(cloneRecord)),
      put: async (record) => {
        await requestResult(store.put(cloneRecord(record)));
      },
      delete: async (identity) => {
        // Keep the latest known version at the key so a delayed older put
        // cannot resurrect a record after its newer generation is confirmed.
        await requestResult(store.put({ ...identity, deleted: true } satisfies DraftRecoveryTombstone));
      }
    };

    try {
      const result = await operation(transaction);
      await transactionCompleted(nativeTransaction);
      return result;
    } catch (error) {
      try {
        nativeTransaction.abort();
      } catch {
        // The transaction may already have completed while an operation failed.
      }
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      if (typeof indexedDB === 'undefined') {
        this.databasePromise = Promise.reject(new Error('IndexedDB is unavailable in this browser'));
      } else {
        this.databasePromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
          request.onupgradeneeded = () => {
            const database = request.result;
            const drafts = database.objectStoreNames.contains(STORE_NAME)
              ? request.transaction!.objectStore(STORE_NAME)
              : database.createObjectStore(STORE_NAME, { keyPath: ['uid', 'mapId', 'writerId'] });
            if (!drafts.indexNames.contains(UID_MAP_INDEX)) drafts.createIndex(UID_MAP_INDEX, ['uid', 'mapId']);
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB recovery store'));
          request.onblocked = () => reject(new Error('IndexedDB recovery store upgrade is blocked'));
        });
      }
    }
    return this.databasePromise;
  }
}

export function createBrowserDraftRecoveryStore(): DraftRecoveryStore {
  return createDraftRecoveryStore(new IndexedDbRecoveryStorageAdapter());
}

function keyFor(record: DraftRecoveryKey): [string, string, string] {
  return [record.uid, record.mapId, record.writerId];
}

function cloneRecord(record: DraftRecoveryRecord): DraftRecoveryRecord {
  return { ...record };
}

function cloneEntry(entry: DraftRecoveryStorageEntry): DraftRecoveryStorageEntry {
  return { ...entry };
}

function isTombstone(entry: DraftRecoveryStorageEntry): entry is DraftRecoveryTombstone {
  return 'deleted' in entry && entry.deleted === true;
}

function isDraftRecord(entry: DraftRecoveryStorageEntry): entry is DraftRecoveryRecord {
  return !isTombstone(entry);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}
