import { useEffect, useMemo, useState, type ReactNode } from 'react';

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
import { FolderSidebar } from '../features/folders/FolderSidebar';
import { getFirebaseClient } from '../lib/firebase/client';
import { archiveMindMap, createMindMap, updateMindMapVersioned, type StoredMindMap } from '../features/mindmaps/mindMapRepository';
import { MapActions } from '../features/mindmaps/MapActions';
import { MapList } from '../features/mindmaps/MapList';
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
};

function EmptyPane({ label, children }: { label: string; children: ReactNode }) {
  return <section aria-label={label}>{children}</section>;
}

function MapWorkspace({ sidebar, map, database, onStatus }: MapWorkspaceProps) {
  if (!map) {
    const editor = <EmptyPane label="Markdown editor"><p>Select or create a map to begin editing.</p></EmptyPane>;
    const preview = <EmptyPane label="Preview pane"><p>A preview appears after a map is selected.</p></EmptyPane>;
    return <><AppShell sidebar={sidebar} editor={editor} preview={preview} /><ResponsivePaneTabs maps={sidebar} editor={editor} preview={preview} /></>;
  }

  return <SelectedMapWorkspace sidebar={sidebar} map={map} database={database} onStatus={onStatus} />;
}

function SelectedMapWorkspace({ sidebar, map, database, onStatus }: Omit<MapWorkspaceProps, 'map'> & { map: StoredMindMap }) {
  const repository = useMemo(() => ({ update: (input: Parameters<typeof updateMindMapVersioned>[1]) => updateMindMapVersioned(database, input) }), [database]);
  const queue = useSaveQueue(map, repository);
  useDirtyGuard(queue.status === 'unsaved' || queue.status === 'offlinePending' || queue.status === 'error');

  useEffect(() => onStatus(queue.status), [onStatus, queue.status]);

  const editor = <MarkdownEditor value={queue.draft} onChange={queue.setDraft} />;
  const preview = <MarkmapPreview markdown={queue.draft} />;
  return <><AppShell sidebar={sidebar} editor={editor} preview={preview} /><ResponsivePaneTabs maps={sidebar} editor={editor} preview={preview} /></>;
}

export function PrivateWorkspace() {
  const { user, signOut } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { maps, loading, error } = useMindMapList(ownerUid);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>('saved');
  const [operationError, setOperationError] = useState(false);
  const client = getFirebaseClient();
  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;

  useEffect(() => {
    if (selectedMapId && maps.some((map) => map.id === selectedMapId)) return;
    setSelectedMapId(maps[0]?.id ?? null);
  }, [maps, selectedMapId]);

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

  if (loading) return <main aria-label="Markmap AWS workspace"><WorkspaceFeedback kind="loading" /></main>;
  if (error || !client) return <main aria-label="Markmap AWS workspace"><WorkspaceFeedback kind="error" /></main>;

  const sidebar = <><FolderSidebar mapCount={maps.length} /><MapActions mapTitle={selectedMap?.title} onCreate={createMap} onRename={renameMap} onArchive={archiveMap} disabled={saveStatus !== 'saved'} /><MapList maps={maps} selectedMapId={selectedMapId} onSelect={setSelectedMapId} /></>;

  return (
    <main aria-label="Markmap AWS workspace">
      <header className="workspace-header">
        <h1>{selectedMap?.title ?? 'Private workspace'}</h1>
        <SaveStatus status={saveStatus} />
        {operationError ? <p role="alert">The map action could not be completed.</p> : null}
        <button type="button" onClick={() => void signOut()}>Sign out</button>
      </header>
      <MapWorkspace sidebar={sidebar} map={selectedMap} database={client.firestore} onStatus={setSaveStatus} />
    </main>
  );
}

export function App() {
  return <AuthProvider><AuthGate onPrivateStateClear={clearPrivateState}><AccessGate onPrivateStateClear={clearPrivateState}><PrivateWorkspace /></AccessGate></AuthGate></AuthProvider>;
}