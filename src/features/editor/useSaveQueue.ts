import { useCallback, useEffect, useRef, useState } from 'react';

import type { StoredMindMap, UpdateMindMapInput, UpdateResult } from '../mindmaps/mindMapRepository';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offlinePending' | 'error' | 'conflict';

export type SaveRepository = {
  update(input: UpdateMindMapInput): Promise<UpdateResult>;
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
  const [status, setStatus] = useState<SaveStatus>('saved');
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

  const save = useCallback((requestedMapSession = mapSession.current) => {
    clearTimer();
    if (requestedMapSession !== mapSession.current || inFlight.current || conflictRef.current !== null) {
      return;
    }
    if (draftRef.current === confirmedMarkdown.current) {
      setStatus('saved');
      return;
    }

    const savedGeneration = generation.current;
    const savedMarkdown = draftRef.current;
    const currentMap = mapRef.current;
    const savedMapSession = mapSession.current;
    inFlight.current = true;
    setStatus('saving');

    void repository.update({
      ownerUid: currentMap.ownerUid,
      mapId: currentMap.id,
      expectedContentVersion: confirmedVersion.current,
      title: currentMap.title,
      folderId: currentMap.folderId,
      markdown: savedMarkdown,
      contentSearchText: savedMarkdown.toLocaleLowerCase()
    }).then((result) => {
      if (savedMapSession !== mapSession.current || currentMap.id !== mapRef.current.id) {
        return;
      }
      inFlight.current = false;
      if (result.status === 'updated') {
        confirmedVersion.current = result.contentVersion;
        if (savedGeneration === generation.current) {
          confirmedMarkdown.current = savedMarkdown;
          setStatus('saved');
        } else {
          setStatus('saving');
          save(savedMapSession);
        }
        return;
      }
      if (result.status === 'conflict') {
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
    save();
  }, [save]);

  const saveVersion = useCallback(() => {
    save();
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
      setStatus('saved');
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
    setStatus('saved');
  }, [clearTimer, map.id, map.contentVersion, map.markdown]);

  useEffect(() => {
    const retryWhenOnline = () => save();
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [save]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { draft, setDraft, status, conflict, retry, saveVersion, resolveConflict };
}
