import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { WorkspaceFeedback } from '../components/feedback/WorkspaceFeedback';
import { AppShell } from '../components/layout/AppShell';
import { ResponsivePaneTabs } from '../components/layout/ResponsivePaneTabs';
import { AccessGate } from '../features/access/AccessGate';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { MarkdownEditor } from '../features/editor/MarkdownEditor';
import { SaveStatus } from '../features/editor/SaveStatus';
import { useDirtyGuard } from '../features/editor/useDirtyGuard';
import { useSaveQueue, type SaveStatus as SaveStatusValue } from '../features/editor/useSaveQueue';
import { DeleteFolderDialog } from '../features/folders/DeleteFolderDialog';
import { FolderSidebar } from '../features/folders/FolderSidebar';
import { RestoreRevisionDialog } from '../features/history/RestoreRevisionDialog';
import { VersionHistoryPanel } from '../features/history/VersionHistoryPanel';
import { createRevisionAndSaveMap, listRevisions, restoreRevision, retryRevisionPrune, type StoredRevision } from '../features/history/revisionRepository';
import { moveMapsAndArchiveFolder, subscribeFolders, type StoredFolder } from '../features/folders/folderRepository';
import { getFirebaseClient } from '../lib/firebase/client';
import { archiveMindMap, createMindMap, updateMindMapVersioned, type StoredMindMap } from '../features/mindmaps/mindMapRepository';
import { MapActions } from '../features/mindmaps/MapActions';
import { MapList } from '../features/mindmaps/MapList';
import { MapSearch } from '../features/mindmaps/MapSearch';
import { useMindMapList } from '../features/mindmaps/useMindMapList';
import { MarkmapPreview } from '../features/preview/MarkmapPreview';
import '../styles/workspace.css';

function clearPrivateState() {
  // AccessGate unmounts the workspace before this boundary is reached; all hooks then clean up subscriptions and timers.
}

type MapWorkspaceProps = {
  sidebar: ReactNode;
  map: StoredMindMap | null;
  database: NonNullable<ReturnType<typeof getFirebaseClient>>['firestore'];
  onStatus(status: SaveStatusValue): void;
  onRetryChange(retry: (() => void) | null): void;
};

function EmptyPane({ label, children }: { label: string; children: ReactNode }) {
  return <section aria-label={label}>{children}</section>;
}

function MapWorkspace({ sidebar, map, database, onStatus, onRetryChange }: MapWorkspaceProps) {
  if (!map) {
    const editor = <EmptyPane label="Markdown editor"><p>Select or create a map to begin editing.</p></EmptyPane>;
    const preview = <EmptyPane label="Preview pane"><p>A preview appears after a map is selected.</p></EmptyPane>;
    return <><AppShell sidebar={sidebar} editor={editor} preview={preview} /><ResponsivePaneTabs maps={sidebar} editor={editor} preview={preview} /></>;
  }

  return <SelectedMapWorkspace key={map.id} sidebar={sidebar} map={map} database={database} onStatus={onStatus} onRetryChange={onRetryChange} />;
}

function SelectedMapWorkspace({ sidebar, map, database, onStatus, onRetryChange }: Omit<MapWorkspaceProps, 'map'> & { map: StoredMindMap }) {
  const repository = useMemo(() => ({
    update: (input: Parameters<typeof updateMindMapVersioned>[1]) => updateMindMapVersioned(database, input),
    saveRevision: (input: Parameters<typeof createRevisionAndSaveMap>[1]) => createRevisionAndSaveMap(database, input),
    retryRevisionPrune: (mapId: string) => retryRevisionPrune(database, mapId)
  }), [database]);
  const queue = useSaveQueue(map, repository);
  const [revisions, setRevisions] = useState<StoredRevision[]>([]);
  const [revisionToRestore, setRevisionToRestore] = useState<StoredRevision | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  useDirtyGuard(queue.status === 'unsaved' || queue.status === 'offlinePending' || queue.status === 'error');

  useEffect(() => {
    let cancelled = false;
    void listRevisions(database, map.id).then(
      (nextRevisions) => { if (!cancelled) setRevisions(nextRevisions); },
      () => { if (!cancelled) setRestoreError(true); }
    );
    return () => { cancelled = true; };
  }, [database, map.id, map.currentRevisionId]);

  useEffect(() => onStatus(queue.status), [onStatus, queue.status]);
  useEffect(() => {
    onRetryChange(() => queue.retry());
    return () => onRetryChange(null);
  }, [onRetryChange, queue.retry]);

  async function confirmRestore() {
    if (!revisionToRestore) return;
    setRestoreBusy(true);
    setRestoreError(false);
    try {
      await restoreRevision(database, map, revisionToRestore);
      setRevisionToRestore(null);
      setRevisions(await listRevisions(database, map.id));
    } catch {
      setRestoreError(true);
    } finally {
      setRestoreBusy(false);
    }
  }

  const history = <VersionHistoryPanel revisions={revisions} onRestore={setRevisionToRestore} onSaveVersion={queue.saveVersion} />;
  const editor = <MarkdownEditor value={queue.draft} onChange={queue.setDraft} />;
  const preview = <MarkmapPreview markdown={queue.draft} />;
  return <>
    {restoreError ? <p role="alert">The revision could not be restored.</p> : null}
    <AppShell sidebar={<>{sidebar}{history}</>} editor={editor} preview={preview} />
    <ResponsivePaneTabs maps={<>{sidebar}{history}</>} editor={editor} preview={preview} />
    {revisionToRestore ? <RestoreRevisionDialog revision={revisionToRestore} onRestore={() => void confirmRestore()} onCancel={() => setRevisionToRestore(null)} busy={restoreBusy} /> : null}
  </>;
}

export function PrivateWorkspace() {
  const { user, signOut } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { maps, loading, error } = useMindMapList(ownerUid);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [pendingMapId, setPendingMapId] = useState<string | null>(null);
  const [folders, setFolders] = useState<StoredFolder[]>([]);
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
  const [folderOperationBusy, setFolderOperationBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>('saved');
  const saveRetry = useRef<(() => void) | null>(null);
  const [operationError, setOperationError] = useState(false);
  const handleSaveRetryChange = useCallback((retry: (() => void) | null) => {
    saveRetry.current = retry;
  }, []);
  const retryActiveSave = useCallback(() => saveRetry.current?.(), []);
  const client = getFirebaseClient();
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;
  const pendingFolder = folders.find((folder) => folder.id === pendingFolderId) ?? null;

  useEffect(() => {
    setFolders([]);
    setPendingFolderId(null);
    if (!ownerUid || !client) return;
    return subscribeFolders(client.firestore, ownerUid, setFolders, () => setOperationError(true));
  }, [ownerUid]);

  useEffect(() => {
    if (selectedMapId && maps.some((map) => map.id === selectedMapId)) return;
    setSelectedMapId(maps[0]?.id ?? null);
  }, [maps, selectedMapId]);

  function selectMap(mapId: string) {
    if (mapId === selectedMapId) return;
    if (saveStatus !== 'saved') {
      setPendingMapId(mapId);
      return;
    }
    setSelectedMapId(mapId);
  }

  function discardAndSelectMap() {
    if (!pendingMapId) return;
    setSelectedMapId(pendingMapId);
    setPendingMapId(null);
  }

  async function createMap(title: string) {
    if (!ownerUid || !client) return;
    setOperationError(false);
    try {
      const created = await createMindMap(client.firestore, {
        ownerUid, folderId: null, title, markdown: `# ${title}\n`, contentSearchText: title.toLocaleLowerCase()
      });
      setSelectedMapId(created.id);
    } catch {
      setOperationError(true);
    }
  }

  async function renameMap(title: string) {
    if (!selectedMap || !client) return;
    setOperationError(false);
    const result = await updateMindMapVersioned(client.firestore, {
      ownerUid: selectedMap.ownerUid, mapId: selectedMap.id, expectedContentVersion: selectedMap.contentVersion,
      title, folderId: selectedMap.folderId, markdown: selectedMap.markdown, contentSearchText: selectedMap.markdown.toLocaleLowerCase()
    });
    if (result.status !== 'updated') setOperationError(true);
  }

  async function archiveMap() {
    if (!selectedMap || !ownerUid || !client) return;
    setOperationError(false);
    const result = await archiveMindMap(client.firestore, ownerUid, selectedMap.id);
    if (result.status === 'updated') setSelectedMapId(null);
    else setOperationError(true);
  }

  async function archiveFolder(destinationFolderId: string | null) {
    if (!pendingFolder || !ownerUid || !client) return;
    setOperationError(false);
    setFolderOperationBusy(true);
    const result = await moveMapsAndArchiveFolder(client.firestore, {
      ownerUid,
      folderId: pendingFolder.id,
      destinationFolderId
    });
    setFolderOperationBusy(false);
    if (result.status === 'archived') setPendingFolderId(null);
    else setOperationError(true);
  }

  if (loading) return <main aria-label="Markmap AWS workspace"><WorkspaceFeedback kind="loading" /></main>;
  if (error || !client) return <main aria-label="Markmap AWS workspace"><WorkspaceFeedback kind="error" /></main>;

  const sidebar = <><FolderSidebar folders={folders} maps={maps} onArchive={setPendingFolderId} archiveDisabled={saveStatus !== 'saved'} /><MapActions mapTitle={selectedMap?.title} onCreate={createMap} onRename={renameMap} onArchive={archiveMap} disabled={saveStatus !== 'saved'} /><MapSearch maps={maps} onSelect={selectMap} /><MapList maps={maps} selectedMapId={selectedMapId} onSelect={selectMap} /></>;

  return (
    <main aria-label="Markmap AWS workspace">
      <header className="workspace-header">
        <h1>{selectedMap?.title ?? 'Private workspace'}</h1>
        <SaveStatus status={saveStatus} onRetry={['error', 'prunePending'].includes(saveStatus) ? retryActiveSave : undefined} />
        {operationError ? <p role="alert">The map action could not be completed.</p> : null}
        <button type="button" onClick={() => void signOut()}>Sign out</button>
      </header>
      <MapWorkspace sidebar={sidebar} map={selectedMap} database={client.firestore} onStatus={setSaveStatus} onRetryChange={handleSaveRetryChange} />
      {pendingFolder ? (
        <DeleteFolderDialog
          folder={pendingFolder}
          folders={folders}
          mapCount={maps.filter((map) => map.folderId === pendingFolder.id).length}
          onArchive={archiveFolder}
          onCancel={() => setPendingFolderId(null)}
          busy={folderOperationBusy}
        />
      ) : null}
      {pendingMapId ? (
        <section role="dialog" aria-modal="true" aria-label="Discard unsaved changes?">
          <p>Your unsaved draft will be discarded if you switch maps.</p>
          <button
            autoFocus
            type="button"
            onClick={() => setPendingMapId(null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Enter') {
                event.preventDefault();
                setPendingMapId(null);
              }
            }}
          >
            Keep editing
          </button>
          <button type="button" onClick={discardAndSelectMap}>Discard and switch</button>
        </section>
      ) : null}
    </main>
  );
}

export function App() {
  return <AuthProvider><AuthGate onPrivateStateClear={clearPrivateState}><AccessGate onPrivateStateClear={clearPrivateState}><PrivateWorkspace /></AccessGate></AuthGate></AuthProvider>;
}