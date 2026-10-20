import { useCallback, useEffect, useRef, useState } from 'react';

import { DraftRecoveryCoordinator } from './draftRecoveryCoordinator';
import { createBrowserDraftRecoveryStore, type DraftRecoveryRecord, type DraftRecoveryStore } from './draftRecoveryStore';
import type { RevisionReason } from '../history/revisionTypes';
import type { SaveResult } from '../history/revisionRepository';
import type { StoredMindMap, UpdateMindMapInput, UpdateResult } from '../mindmaps/mindMapRepository';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offlinePending' | 'error' | 'conflict' | 'prunePending';

export type RevisionSaveInput = UpdateMindMapInput & { reason: RevisionReason };

export type SaveRepository = {
  update(input: UpdateMindMapInput): Promise<UpdateResult>;
  saveRevision?(input: RevisionSaveInput): Promise<SaveResult>;
  retryRevisionPrune?(mapId: string): Promise<boolean>;
};

export type ConflictChoice = 'keepMine' | 'useRemote';

export type ConflictState = {
  localMarkdown: string;
  remoteMarkdown: string;
  remoteContentVersion: number;
};

export type SaveQueue = {
  draft: string;
  setDraft(markdown: string): void;
  status: SaveStatus;
  conflict: ConflictState | null;
  retry(): void;
  saveVersion(): void;
  flush(): Promise<'saved' | 'error' | 'conflict'>;
  resolveConflict(choice: ConflictChoice): void;
};

export type SaveQueueOptions = {
  recoveryStore?: DraftRecoveryStore;
  recoveryCoordinator?: Pick<DraftRecoveryCoordinator, 'writerId' | 'announceActive' | 'clearActive' | 'subscribeToLiveWriters'>;
  timing?: SaveQueueTiming;
};

export type SaveQueueTiming = {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
};

type SaveOutcome = 'saved' | 'error' | 'conflict';
type SaveMode = 'normal' | 'manual';

const AUTOSAVE_DELAY_MS = 5000;
const AUTOSAVE_MAX_WAIT_MS = 30_000;
const AUTOSNAPSHOT_INTERVAL_MS = 5 * 60_000;
const browserTiming: SaveQueueTiming = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle)
};

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function useSaveQueue(map: StoredMindMap, repository: SaveRepository, options: SaveQueueOptions = {}): SaveQueue {
  const [draft, setDraftState] = useState(map.markdown);
  const [status, setStatus] = useState<SaveStatus>(map.revisionPrunePending ? 'prunePending' : 'saved');
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const conflictRef = useRef<ConflictState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyCycleStartedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const inFlightSave = useRef<Promise<SaveOutcome> | null>(null);
  const saveRef = useRef<((requestedMapSession?: number, mode?: SaveMode) => Promise<SaveOutcome>) | undefined>(undefined);
  const draftRef = useRef(map.markdown);
  const generation = useRef(0);
  const confirmedMarkdown = useRef(map.markdown);
  const confirmedVersion = useRef(map.contentVersion);
  const latestRevisionAt = useRef(revisionTime(map.currentRevisionAt));
  const revisionPrunePending = useRef(map.revisionPrunePending);
  const recoveryRecord = useRef<DraftRecoveryRecord | null>(null);
  const recoveryConflictEpoch = useRef(0);
  const recoveryStore = useRef<DraftRecoveryStore>(undefined!);
  const recoveryCoordinator = useRef<NonNullable<SaveQueueOptions['recoveryCoordinator']>>(undefined!);
  const timing = useRef<SaveQueueTiming>(undefined!);
  if (recoveryStore.current === undefined) recoveryStore.current = options.recoveryStore ?? createBrowserDraftRecoveryStore();
  if (recoveryCoordinator.current === undefined) recoveryCoordinator.current = options.recoveryCoordinator ?? new DraftRecoveryCoordinator();
  if (timing.current === undefined) timing.current = options.timing ?? browserTiming;
  const activeMapId = useRef(map.id);
  const mapSession = useRef(0);
  const renderedMapId = useRef(map.id);
  const mapRef = useRef(map);
  if (map.id !== renderedMapId.current) {
    renderedMapId.current = map.id;
    mapSession.current += 1;
  }
  mapRef.current = map;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      timing.current.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimer();
    if (dirtyCycleStartedAt.current === null) return;
    const now = timing.current.now();
    const deadline = dirtyCycleStartedAt.current + AUTOSAVE_MAX_WAIT_MS;
    const delay = Math.max(0, Math.min(AUTOSAVE_DELAY_MS, deadline - now));
    timer.current = timing.current.setTimeout(() => { void saveRef.current?.(); }, delay);
  }, [clearTimer]);

  const save = useCallback((requestedMapSession = mapSession.current, mode: SaveMode = 'normal'): Promise<SaveOutcome> => {
    clearTimer();
    if (requestedMapSession !== mapSession.current) return Promise.resolve('error');
    if (conflictRef.current !== null) return Promise.resolve('conflict');
    if (isOffline()) {
      setStatus('offlinePending');
      return Promise.resolve('error');
    }
    if (inFlight.current) {
      return (inFlightSave.current ?? Promise.resolve('error')).then(() => saveRef.current!(requestedMapSession, mode));
    }
    if (draftRef.current === confirmedMarkdown.current && mode === 'normal') {
      setStatus('saved');
      return Promise.resolve('saved');
    }

    const savedGeneration = generation.current;
    const savedRecoveryConflictEpoch = recoveryConflictEpoch.current;
    const savedMarkdown = draftRef.current;
    const currentMap = mapRef.current;
    const savedMapSession = mapSession.current;
    const saveInput = {
      ownerUid: currentMap.ownerUid,
      mapId: currentMap.id,
      expectedContentVersion: confirmedVersion.current,
      title: currentMap.title,
      folderId: currentMap.folderId,
      markdown: savedMarkdown,
      contentSearchText: savedMarkdown.toLocaleLowerCase()
    };
    const shouldSaveRevision = Boolean(repository.saveRevision) && (mode === 'manual' || isAutosnapshotDue(latestRevisionAt.current, timing.current.now()));
    inFlight.current = true;
    setStatus('saving');
    const request = shouldSaveRevision
      ? repository.saveRevision!({ ...saveInput, reason: mode === 'manual' ? 'manual' : 'autosave' })
      : repository.update(saveInput);
    const completion = Promise.resolve(request).then((result): SaveOutcome | Promise<SaveOutcome> => {
      if (savedMapSession !== mapSession.current || currentMap.id !== mapRef.current.id) return 'error';
      inFlight.current = false;
      if (savedRecoveryConflictEpoch !== recoveryConflictEpoch.current) return 'conflict';
      if (result.status === 'updated' || result.status === 'saved') {
        confirmedVersion.current = result.status === 'updated' ? result.contentVersion : saveInput.expectedContentVersion + 1;
        if (shouldSaveRevision) {
          latestRevisionAt.current = timing.current.now();
          revisionPrunePending.current = result.status === 'saved' && result.prunePending;
        }
        if (savedGeneration !== generation.current) {
          setStatus('saving');
          return saveRef.current!(savedMapSession);
        }
        confirmedMarkdown.current = savedMarkdown;
        dirtyCycleStartedAt.current = null;
        const record = recoveryRecord.current;
        if (record && record.generation === savedGeneration) {
          void recoveryStore.current.deleteIfCurrent(record);
          recoveryRecord.current = null;
        }
        setStatus(revisionPrunePending.current ? 'prunePending' : 'saved');
        return 'saved';
      }
      if (result.status === 'prune-pending') {
        confirmedVersion.current = saveInput.expectedContentVersion + 1;
        latestRevisionAt.current = timing.current.now();
        revisionPrunePending.current = true;
        if (savedGeneration !== generation.current) {
          setStatus('saving');
          return saveRef.current!(savedMapSession);
        }
        confirmedMarkdown.current = savedMarkdown;
        dirtyCycleStartedAt.current = null;
        const record = recoveryRecord.current;
        if (record && record.generation === savedGeneration) {
          void recoveryStore.current.deleteIfCurrent(record);
          recoveryRecord.current = null;
        }
        setStatus('prunePending');
        return 'saved';
      }
      if (result.status === 'conflict' && 'remote' in result) {
        conflictRef.current = {
          localMarkdown: draftRef.current,
          remoteMarkdown: result.remote.markdown,
          remoteContentVersion: result.remote.contentVersion
        };
        setConflict(conflictRef.current);
        setStatus('conflict');
        return 'conflict';
      }
      setStatus(isOffline() ? 'offlinePending' : 'error');
      return 'error';
    }, (): SaveOutcome => {
      if (savedMapSession !== mapSession.current || currentMap.id !== mapRef.current.id) return 'error';
      inFlight.current = false;
      setStatus(isOffline() ? 'offlinePending' : 'error');
      return 'error';
    });
    inFlightSave.current = completion;
    return completion;
  }, [clearTimer, repository]);
  saveRef.current = save;

  const setDraft = useCallback((markdown: string) => {
    draftRef.current = markdown;
    generation.current += 1;
    if (dirtyCycleStartedAt.current === null) dirtyCycleStartedAt.current = timing.current.now();
    setDraftState(markdown);
    setStatus('unsaved');
    const record: DraftRecoveryRecord = {
      uid: mapRef.current.ownerUid,
      mapId: mapRef.current.id,
      writerId: recoveryCoordinator.current.writerId,
      baseContentVersion: confirmedVersion.current,
      markdown,
      generation: generation.current,
      recordVersion: 0,
      updatedAtMs: timing.current.now()
    };
    recoveryRecord.current = record;
    void recoveryStore.current.put(record);
    scheduleSave();
  }, [scheduleSave]);

  const retry = useCallback(() => {
    if (status === 'prunePending' && repository.retryRevisionPrune) {
      const retryMapId = mapRef.current.id;
      const retryMapSession = mapSession.current;
      setStatus('saving');
      void repository.retryRevisionPrune(retryMapId).then((prunePending) => {
        if (retryMapSession !== mapSession.current || retryMapId !== mapRef.current.id) {
          return;
        }
        revisionPrunePending.current = prunePending;
        setStatus(prunePending ? 'prunePending' : 'saved');
      }, () => {
        if (retryMapSession !== mapSession.current || retryMapId !== mapRef.current.id) {
          return;
        }
        setStatus(isOffline() ? 'offlinePending' : 'error');
      });
      return;
    }
    void save(mapSession.current);
  }, [repository, save, status]);

  const saveVersion = useCallback(() => {
    void save(mapSession.current, 'manual');
  }, [save]);

  const resolveConflict = useCallback((choice: ConflictChoice) => {
    const currentConflict = conflictRef.current;
    if (currentConflict === null) {
      return;
    }
    conflictRef.current = null;
    setConflict(null);
    if (choice === 'useRemote') {
      clearTimer();
      draftRef.current = currentConflict.remoteMarkdown;
      confirmedMarkdown.current = currentConflict.remoteMarkdown;
      confirmedVersion.current = currentConflict.remoteContentVersion;
      generation.current += 1;
      setDraftState(currentConflict.remoteMarkdown);
      setStatus('saved');
      return;
    }
    confirmedVersion.current = currentConflict.remoteContentVersion;
    setStatus('unsaved');
    save();
  }, [clearTimer, save]);

  useEffect(() => {
    if (map.id !== activeMapId.current) {
      clearTimer();
      activeMapId.current = map.id;
      inFlight.current = false;
      conflictRef.current = null;
      setConflict(null);
      draftRef.current = map.markdown;
      confirmedMarkdown.current = map.markdown;
      confirmedVersion.current = map.contentVersion;
      latestRevisionAt.current = revisionTime(map.currentRevisionAt);
      revisionPrunePending.current = map.revisionPrunePending;
      generation.current = 0;
      dirtyCycleStartedAt.current = null;
      recoveryRecord.current = null;
      setDraftState(map.markdown);
      setStatus(map.revisionPrunePending ? 'prunePending' : 'saved');
      return;
    }
    if (map.contentVersion <= confirmedVersion.current) {
      return;
    }
    if (draftRef.current !== confirmedMarkdown.current || inFlight.current) {
      const nextConflict = {
        localMarkdown: draftRef.current,
        remoteMarkdown: map.markdown,
        remoteContentVersion: map.contentVersion
      };
      clearTimer();
      conflictRef.current = nextConflict;
      setConflict(nextConflict);
      setStatus('conflict');
      return;
    }
    draftRef.current = map.markdown;
    confirmedMarkdown.current = map.markdown;
    confirmedVersion.current = map.contentVersion;
    latestRevisionAt.current = revisionTime(map.currentRevisionAt);
    revisionPrunePending.current = map.revisionPrunePending;
    setDraftState(map.markdown);
    setStatus(map.revisionPrunePending ? 'prunePending' : 'saved');
  }, [clearTimer, map.id, map.contentVersion, map.markdown, map.revisionPrunePending]);

  useEffect(() => {
    const store = recoveryStore.current;
    const coordinator = recoveryCoordinator.current;
    const recoveryMap = mapRef.current;
    const recoverySession = mapSession.current;
    let active = true;

    const openRecoveryConflict = (record: DraftRecoveryRecord) => {
      if (!active || recoverySession !== mapSession.current) return;
      recoveryConflictEpoch.current += 1;
      const nextConflict = {
        localMarkdown: record.markdown,
        remoteMarkdown: recoveryMap.markdown,
        remoteContentVersion: recoveryMap.contentVersion
      };
      conflictRef.current = nextConflict;
      setConflict(nextConflict);
      setStatus('conflict');
    };
    let liveSecondWriter = false;
    let hydratedRecord: DraftRecoveryRecord | null = null;
    const unsubscribe = coordinator.subscribeToLiveWriters(recoveryMap.ownerUid, recoveryMap.id, (writerIds) => {
      liveSecondWriter = writerIds.some((writerId) => writerId !== coordinator.writerId);
      if (liveSecondWriter && hydratedRecord !== null) {
        clearTimer();
        openRecoveryConflict(hydratedRecord);
      }
    });
    coordinator.announceActive(recoveryMap.ownerUid, recoveryMap.id);
    void store.list(recoveryMap.ownerUid, recoveryMap.id).then((records) => {
      if (!active || recoverySession !== mapSession.current) return;
      const ownRecords = records.filter((record) => record.writerId === coordinator.writerId);
      const ownRecord = ownRecords.length === 1 ? ownRecords[0] : undefined;
      if (!ownRecord) return;
      if (ownRecord.markdown === recoveryMap.markdown) {
        void store.deleteIfCurrent(ownRecord);
        return;
      }
      if (liveSecondWriter || records.length !== 1 || ownRecord.baseContentVersion !== recoveryMap.contentVersion) {
        openRecoveryConflict(ownRecord);
        return;
      }
      recoveryRecord.current = ownRecord;
      hydratedRecord = ownRecord;
      draftRef.current = ownRecord.markdown;
      generation.current = ownRecord.generation;
      dirtyCycleStartedAt.current = timing.current.now();
      setDraftState(ownRecord.markdown);
      setStatus('unsaved');
      scheduleSave();
    });
    return () => {
      active = false;
      unsubscribe();
      coordinator.clearActive(recoveryMap.ownerUid, recoveryMap.id);
    };
  }, [clearTimer, map.id, map.contentVersion, map.markdown, scheduleSave]);

  useEffect(() => {
    const retryWhenOnline = () => { void save(); };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [save]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const flush = useCallback(() => save(mapSession.current), [save]);

  return { draft, setDraft, status, conflict, retry, saveVersion, flush, resolveConflict };
}

function revisionTime(value: StoredMindMap['currentRevisionAt']): number | null {
  if (value === null) return null;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

function isAutosnapshotDue(lastRevisionAt: number | null, now: number): boolean {
  return lastRevisionAt === null || now - lastRevisionAt >= AUTOSNAPSHOT_INTERVAL_MS;
}
