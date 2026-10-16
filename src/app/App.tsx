import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { WorkspaceFeedback } from '../components/feedback/WorkspaceFeedback';
import { AppShell } from '../components/layout/AppShell';
import { ResponsivePaneTabs } from '../components/layout/ResponsivePaneTabs';
import { useWorkspaceLayout, type WorkspaceLayout } from '../components/layout/useWorkspaceLayout';
import { AccessGate } from '../features/access/AccessGate';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { ImportDialog } from '../features/editor/ImportDialog';
import { ConflictDialog } from '../features/editor/ConflictDialog';
import { type ParsedMarkdownFile } from '../features/editor/importMarkdown';
import { MarkdownEditor } from '../features/editor/MarkdownEditor';
import { downloadMarkdown } from '../features/editor/exportMarkdown';
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
  layout: WorkspaceLayout;
  onStatus(status: SaveStatusValue): void;
  onRetryChange(retry: (() => void) | null): void;
};

function EmptyPane({ label, children }: { label: string; children: ReactNode }) {
  return <section aria-label={label}>{children}</section>;
}

function MapWorkspace({ sidebar, map, database, layout, onStatus, onRetryChange }: MapWorkspaceProps) {
  if (!map) {
    const editor = <EmptyPane label="Markdown editor"><p>Select or create a map to begin editing.</p></EmptyPane>;
    const preview = <EmptyPane label="Preview pane"><p>A preview appears after a map is selected.</p></EmptyPane>;
    return <><AppShell sidebar={sidebar} editor={editor} preview={preview} mode={layout.mode} sidebarCollapsed={layout.sidebarCollapsed} onModeChange={layout.setMode} onSidebarCollapsedChange={layout.setSidebarCollapsed} /><ResponsivePaneTabs maps={sidebar} editor={editor} preview={preview} focusMode={layout.mode === 'focus'} /></>;
  }

  return <SelectedMapWorkspace key={map.id} sidebar={sidebar} map={map} database={database} layout={layout} onStatus={onStatus} onRetryChange={onRetryChange} />;
}

function SelectedMapWorkspace({ sidebar, map, database, layout, onStatus, onRetryChange }: Omit<MapWorkspaceProps, 'map'> & { map: StoredMindMap }) {
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
  const editor = <><MarkdownEditor value={queue.draft} onChange={queue.setDraft} /><button type="button" onClick={() => downloadMarkdown(map.title, queue.draft)}>Export Markdown</button></>;
  const preview = <MarkmapPreview markdown={queue.draft} isFocusMode={layout.mode === 'focus'} onToggleFocus={() => layout.setMode(layout.mode === 'focus' ? 'edit' : 'focus')} />;
  return <>
    {restoreError ? <p role="alert">The revision could not be restored.</p> : null}
    <AppShell sidebar={<>{sidebar}{history}</>} editor={editor} preview={preview} mode={layout.mode} sidebarCollapsed={layout.sidebarCollapsed} onModeChange={layout.setMode} onSidebarCollapsedChange={layout.setSidebarCollapsed} />
    <ResponsivePaneTabs maps={<>{sidebar}{history}</>} editor={editor} preview={preview} focusMode={layout.mode === 'focus'} />
    {queue.conflict ? <ConflictDialog {...queue.conflict} onResolve={queue.resolveConflict} /> : null}
    {revisionToRestore ? <RestoreRevisionDialog revision={revisionToRestore} onRestore={() => void confirmRestore()} onCancel={() => setRevisionToRestore(null)} busy={restoreBusy} /> : null}
  </>;
}

export function PrivateWorkspace() {
  const { user, signOut } = useAuth();
  const layout = useWorkspaceLayout();
  const ownerUid = user?.uid ?? null;
  const { maps, loading, error } = useMindMapList(ownerUid);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [pendingMapId, setPendingMapId] = useState<string | null>(null);
  const [folders, setFolders] = useState<StoredFolder[]>([]);
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
  const [folderOperationBusy, setFolderOperationBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>('saved');
  const saveStatusRef = useRef<SaveStatusValue>('saved');
  const [importOpen, setImportOpen] = useState(false);
  const saveRetry = useRef<(() => void) | null>(null);
  const [operationError, setOperationError] = useState(false);
  const handleSaveStatus = useCallback((status: SaveStatusValue) => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);
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

  async function importMap({ title, markdown }: ParsedMarkdownFile) {
    const ensureCurrentDraftIsSaved = () => {
      if (saveStatusRef.current !== 'saved') {
        throw new Error('Save the current draft before importing.');
      }
    };
    ensureCurrentDraftIsSaved();
    if (!ownerUid || !client) {
      throw new Error('The workspace is unavailable.');
    }
    setOperationError(false);
    let created: Awaited<ReturnType<typeof createMindMap>>;
    try {
      created = await createMindMap(client.firestore, {
        ownerUid, folderId: null, title, markdown, contentSearchText: markdown.toLocaleLowerCase()
      });
    } catch (error) {
      setOperationError(true);
      throw error;
    }
    ensureCurrentDraftIsSaved();
    setSelectedMapId(created.id);
    setImportOpen(false);
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
    <main aria-label="Markmap AWS workspace" data-workspace-theme={layout.theme}>
      <header className="workspace-header" aria-label="Workspace header">
        <div className="workspace-brand" aria-label="Markmap AWS">
          <span className="workspace-brand-mark" aria-hidden="true">M</span>
          <span className="workspace-brand-name">Markmap AWS</span>
        </div>
        <div className="workspace-map-context" aria-label="Active map">
          <p className="workspace-breadcrumb">Private workspace</p>
          <h1>{selectedMap?.title ?? 'Private workspace'}</h1>
        </div>
        <div className="workspace-header-status" data-save-status={saveStatus}>
          <SaveStatus status={saveStatus} onRetry={['error', 'prunePending'].includes(saveStatus) ? retryActiveSave : undefined} />
        </div>
        {operationError ? <p className="workspace-operation-alert" role="alert">The map action could not be completed.</p> : null}
        <div className="workspace-header-actions" aria-label="Workspace actions">
          <button type="button" disabled={saveStatus !== 'saved'} onClick={() => setImportOpen(true)}>Import Markdown</button>
          <button type="button" aria-label={`Switch to ${layout.theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => layout.setTheme(layout.theme === 'light' ? 'dark' : 'light')}>Theme</button>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <MapWorkspace sidebar={sidebar} map={selectedMap} database={client.firestore} layout={layout} onStatus={handleSaveStatus} onRetryChange={handleSaveRetryChange} />
      {importOpen ? <ImportDialog onImport={importMap} onCancel={() => setImportOpen(false)} /> : null}
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