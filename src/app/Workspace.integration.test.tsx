import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../test/factories';
import { subscribeFolders } from '../features/folders/folderRepository';
import { createRevisionAndSaveMap, listRevisions, restoreRevision } from '../features/history/revisionRepository';
import { createMindMap, updateMindMapVersioned } from '../features/mindmaps/mindMapRepository';
import { downloadMarkdown } from '../features/editor/exportMarkdown';
import { PrivateWorkspace } from './App';

const auth = vi.hoisted(() => ({ current: null as unknown }));
const mapList = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => auth.current
}));
vi.mock('../features/mindmaps/useMindMapList', () => ({
  useMindMapList: () => mapList.current
}));
vi.mock('../lib/firebase/client', () => ({
  getFirebaseClient: () => ({ firestore: {} })
}));
vi.mock('../features/folders/folderRepository', async (importOriginal) => ({
  ...await importOriginal<typeof import('../features/folders/folderRepository')>(),
  subscribeFolders: vi.fn()
}));
vi.mock('../features/mindmaps/mindMapRepository', async (importOriginal) => ({
  ...await importOriginal<typeof import('../features/mindmaps/mindMapRepository')>(),
  createMindMap: vi.fn(),
  updateMindMapVersioned: vi.fn()
}));
vi.mock('../features/history/revisionRepository', async (importOriginal) => ({
  ...await importOriginal<typeof import('../features/history/revisionRepository')>(),
  createRevisionAndSaveMap: vi.fn(),
  listRevisions: vi.fn(),
  restoreRevision: vi.fn()
}));
vi.mock('../features/editor/exportMarkdown', () => ({
  downloadMarkdown: vi.fn()
}));
vi.mock('../features/preview/MarkmapPreview', () => ({
  MarkmapPreview: () => <section aria-label="Mind map preview"><button type="button">Fit preview</button></section>
}));

const mockedCreateMindMap = vi.mocked(createMindMap);
const mockedUpdateMindMapVersioned = vi.mocked(updateMindMapVersioned);
const mockedCreateRevisionAndSaveMap = vi.mocked(createRevisionAndSaveMap);
const mockedListRevisions = vi.mocked(listRevisions);
const mockedRestoreRevision = vi.mocked(restoreRevision);
const mockedSubscribeFolders = vi.mocked(subscribeFolders);
const mockedDownloadMarkdown = vi.mocked(downloadMarkdown);

function signedIn() {
  return { phase: 'signedIn' as const, user: { uid: 'approved-uid' }, signIn: vi.fn(), signOut: vi.fn() };
}

function configuredMaps() {
  return [
    { ...makeMindMap({ ownerUid: 'approved-uid', title: 'Architecture', markdown: '# Architecture' }), id: 'map-1' },
    { ...makeMindMap({ ownerUid: 'approved-uid', title: 'Product roadmap', markdown: '# Product roadmap' }), id: 'map-2' }
  ];
}

describe('PrivateWorkspace cross-feature integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.current = signedIn();
    mapList.current = { maps: configuredMaps(), loading: false, error: null };
    mockedSubscribeFolders.mockImplementation(() => vi.fn());
    mockedCreateMindMap.mockResolvedValue({ ...makeMindMap({ title: 'Created map' }), id: 'map-3' } as never);
    mockedUpdateMindMapVersioned.mockResolvedValue({ status: 'updated', contentVersion: 2 });
    mockedCreateRevisionAndSaveMap.mockResolvedValue({ status: 'saved', revisionId: 'revision-2', prunePending: false });
    mockedListRevisions.mockResolvedValue([{
      id: 'revision-1', ownerUid: 'approved-uid', mapId: 'map-1', sourceContentVersion: 1,
      title: 'Architecture version', folderId: null, markdown: '# Restored architecture',
      reason: 'manual', createdAt: new Date(), createdByUid: 'approved-uid'
    }] as never);
    mockedRestoreRevision.mockResolvedValue({ status: 'restored', contentVersion: 3, revisionId: 'revision-3' } as never);
  });

  it('allows an approved UID to create, edit, save, search, version, restore, export, and reopen a private map', async () => {
    const view = render(<PrivateWorkspace />);
    let navigation = screen.getByRole('complementary', { name: 'Workspace navigation' });

    fireEvent.click(within(navigation).getByRole('button', { name: 'Create map' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Map title' }), { target: { value: 'Created map' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockedCreateMindMap).toHaveBeenCalledWith({}, expect.objectContaining({
      ownerUid: 'approved-uid', title: 'Created map', markdown: '# Created map\n'
    })));

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Architecture\n## Decision' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save version' })[0]);
    await waitFor(() => expect(mockedCreateRevisionAndSaveMap).toHaveBeenCalledWith({}, expect.objectContaining({
      ownerUid: 'approved-uid', mapId: 'map-1', markdown: '# Architecture\n## Decision', reason: 'manual'
    })));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Save status' })).toHaveTextContent('Saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown' }));
    expect(mockedDownloadMarkdown).toHaveBeenCalledWith('Architecture', '# Architecture\n## Decision');

    navigation = screen.getByRole('complementary', { name: 'Workspace navigation' });
    const search = navigation.querySelector('[aria-label="Private map search"]');
    if (!search) throw new Error('Private map search is unavailable');
    const searchInput = search.querySelector('input');
    if (!searchInput) throw new Error('Private map search input is unavailable');
    fireEvent.change(searchInput, { target: { value: 'roadmap' } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Product roadmap' })).toHaveLength(3));
    fireEvent.click(screen.getAllByRole('button', { name: 'Product roadmap' })[0]);
    expect(screen.getByRole('heading', { name: 'Product roadmap' })).toBeInTheDocument();
    navigation = screen.getByRole('complementary', { name: 'Workspace navigation' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Architecture' }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Restore Architecture version' })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore Architecture version' })[0]);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Restore Architecture version?' })).getByRole('button', { name: 'Restore revision' }));
    await waitFor(() => expect(mockedRestoreRevision).toHaveBeenCalledWith({}, expect.objectContaining({ id: 'map-1' }), expect.objectContaining({ id: 'revision-1' })));

    view.unmount();
    render(<PrivateWorkspace />);
    expect(await screen.findByRole('textbox', { name: 'Markdown' })).toHaveValue('# Architecture');
  });

  it('shows conflict resolution after competing device writes', async () => {
    mockedCreateRevisionAndSaveMap.mockResolvedValueOnce({
      status: 'conflict',
      remote: { ...configuredMaps()[0], markdown: '# Remote device draft', contentVersion: 2 }
    } as never);
    render(<PrivateWorkspace />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Local device draft' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save version' })[0]);

    const conflict = await screen.findByRole('dialog', { name: 'Remote change detected' });
    expect(within(conflict).getByText('# Local device draft')).toBeInTheDocument();
    expect(within(conflict).getByText('# Remote device draft')).toBeInTheDocument();
    fireEvent.click(within(conflict).getByRole('button', { name: 'Use remote' }));
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Remote device draft');
  });
});
