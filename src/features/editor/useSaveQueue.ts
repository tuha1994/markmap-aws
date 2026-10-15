import { useCallback, useEffect, useRef, useState } from 'react';

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
  resolveConflict(choice: ConflictChoice): void;
};

const AUTOSAVE_DELAY_MS = 1500;

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function useSaveQueue(map: StoredMindMap, repository: SaveRepository): SaveQueue {
  const [draft, setDraftState] = useState(map.markdown);
  const [status, setStatus] = useState<SaveStatus>(map.revisionPrunePending ? 'prunePending' : 'saved');
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const conflictRef = useRef<ConflictState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const draftRef = useRef(map.markdown);
  const generation = useRef(0);
  const confirmedMarkdown = useRef(map.markdown);
  const confirmedVersion = useRef(map.contentVersion);
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
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const save = useCallback((requestedMapSession = mapSession.current, reason: RevisionReason = 'autosave') => {
    clearTimer();
    if (requestedMapSession !== mapSession.current || inFlight.current || conflictRef.current !== null) {
      return;
    }
    if (draftRef.current === confirmedMarkdown.current && reason === 'autosave') {
      setStatus('saved');
      return;
    }

    const savedGeneration = generation.current;
    const savedMarkdown = draftRef.current;
    const currentMap = mapRef.current;
    const savedMapSession = mapSession.current;
    inFlight.current = true;
    setStatus('saving');

    const saveInput = {
      ownerUid: currentMap.ownerUid,
      mapId: currentMap.id,
      expectedContentVersion: confirmedVersion.current,
      title: currentMap.title,
      folderId: currentMap.folderId,
      markdown: savedMarkdown,
      contentSearchText: savedMarkdown.toLocaleLowerCase()
    };
    const saveRequest = repository.saveRevision
      ? repository.saveRevision({ ...saveInput, reason })
      : repository.update(saveInput);
    void saveRequest.then((result) => {
      if (savedMapSession !== mapSession.current || currentMap.id !== mapRef.current.id) {
        return;
      }
      inFlight.current = false;
      if (result.status === 'updated' || result.status === 'saved') {
        confirmedVersion.current = result.status === 'updated'
          ? result.contentVersion
          : saveInput.expectedContentVersion + 1;
        if (savedGeneration === generation.current) {
          confirmedMarkdown.current = savedMarkdown;
          setStatus(result.status === 'saved' && result.prunePending ? 'prunePending' : 'saved');
        } else {
          setStatus('saving');
          save(savedMapSession, 'autosave');
        }
        return;
      }
      if (result.status === 'prune-pending') {
        confirmedVersion.current = saveInput.expectedContentVersion + 1;
        confirmedMarkdown.current = savedMarkdown;
        setStatus('prunePending');
        return;
      }
      if (result.status === 'conflict' && 'remote' in result) {
        conflictRef.current = {
          localMarkdown: draftRef.current,
          remoteMarkdown: result.remote.markdown,
          remoteContentVersion: result.remote.contentVersion
        };
        setConflict(conflictRef.current);
        setStatus('conflict');
        return;
      }
      setStatus(isOffline() ? 'offlinePending' : 'error');
    }, () => {
      if (savedMapSession !== mapSession.current || currentMap.id !== mapRef.current.id) {
        return;
      }
      inFlight.current = false;
      setStatus(isOffline() ? 'offlinePending' : 'error');
    });
  }, [clearTimer, repository]);

  const setDraft = useCallback((markdown: string) => {
    clearTimer();
    draftRef.current = markdown;
    generation.current += 1;
    setDraftState(markdown);
    setStatus('unsaved');
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  }, [clearTimer, save]);

  const retry = useCallback(() => {
    if (status === 'prunePending' && repository.retryRevisionPrune) {
      const retryMapId = mapRef.current.id;
      const retryMapSession = mapSession.current;
      setStatus('saving');
      void repository.retryRevisionPrune(retryMapId).then((prunePending) => {
        if (retryMapSession !== mapSession.current || retryMapId !== mapRef.current.id) {
          return;
        }
        setStatus(prunePending ? 'prunePending' : 'saved');
      }, () => {
        if (retryMapSession !== mapSession.current || retryMapId !== mapRef.current.id) {
          return;
        }
        setStatus(isOffline() ? 'offlinePending' : 'error');
      });
      return;
    }
    save(mapSession.current, 'manual');
  }, [repository, save, status]);

  const saveVersion = useCallback(() => {
    save(mapSession.current, 'manual');
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
      generation.current = 0;
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
    setDraftState(map.markdown);
    setStatus(map.revisionPrunePending ? 'prunePending' : 'saved');
  }, [clearTimer, map.id, map.contentVersion, map.markdown, map.revisionPrunePending]);

  useEffect(() => {
    const retryWhenOnline = () => save();
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [save]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { draft, setDraft, status, conflict, retry, saveVersion, resolveConflict };
}
