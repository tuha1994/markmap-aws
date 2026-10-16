import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeFolder, makeMindMap } from '../test/factories';
import { moveMapsAndArchiveFolder, subscribeFolders } from '../features/folders/folderRepository';
import { createRevisionAndSaveMap, listRevisions } from '../features/history/revisionRepository';
import { archiveMindMap, createMindMap, updateMindMapVersioned } from '../features/mindmaps/mindMapRepository';
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
vi.mock('../features/folders/folderRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/folders/folderRepository')>();
  return {
    ...actual,
    subscribeFolders: vi.fn(),
    moveMapsAndArchiveFolder: vi.fn()
  };
});
vi.mock('../features/mindmaps/mindMapRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/mindmaps/mindMapRepository')>();
  return {
    ...actual,
    createMindMap: vi.fn(),
    archiveMindMap: vi.fn(),
    updateMindMapVersioned: vi.fn()
  };
});
vi.mock('../features/history/revisionRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/history/revisionRepository')>();
  return { ...actual, createRevisionAndSaveMap: vi.fn(), listRevisions: vi.fn(), restoreRevision: vi.fn() };
});
vi.mock('../features/preview/MarkmapPreview', () => ({
  MarkmapPreview: () => <section aria-label="Mind map preview" />
}));

const mockedCreateMindMap = vi.mocked(createMindMap);
const mockedArchiveMindMap = vi.mocked(archiveMindMap);
const mockedUpdateMindMapVersioned = vi.mocked(updateMindMapVersioned);
const mockedCreateRevisionAndSaveMap = vi.mocked(createRevisionAndSaveMap);
const mockedListRevisions = vi.mocked(listRevisions);
const mockedSubscribeFolders = vi.mocked(subscribeFolders);
const mockedMoveMapsAndArchiveFolder = vi.mocked(moveMapsAndArchiveFolder);

function signedIn() {
  return { phase: 'signedIn' as const, user: { uid: 'owner-uid' }, signOut: vi.fn(), signIn: vi.fn() };
}

describe('PrivateWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.current = signedIn();
    const map = { ...makeMindMap({ title: 'Architecture' }), id: 'map-1' };
    mapList.current = { maps: [map], loading: false, error: null };
    mockedCreateMindMap.mockResolvedValue(map as never);
    mockedArchiveMindMap.mockResolvedValue({ status: 'updated', contentVersion: 0 });
    mockedUpdateMindMapVersioned.mockResolvedValue({ status: 'updated', contentVersion: 2 });
    mockedCreateRevisionAndSaveMap.mockResolvedValue({ status: 'saved', revisionId: 'revision-1', prunePending: false });
    mockedListRevisions.mockResolvedValue([]);
    mockedSubscribeFolders.mockImplementation((_database, _ownerUid, listener) => {
      listener([{ ...makeFolder({ name: 'Planning' }), id: 'folder-1' }]);
      return vi.fn();
    });
    mockedMoveMapsAndArchiveFolder.mockResolvedValue({ status: 'archived' });
  });

  it('lets an approved user create, select, rename, and archive an owned map', () => {
    render(<PrivateWorkspace />);

    const navigation = within(screen.getByRole('complementary', { name: 'Workspace navigation' }));
    fireEvent.click(navigation.getByRole('button', { name: 'Architecture' }));
    fireEvent.click(navigation.getByRole('button', { name: 'Create map' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Map title' }), { target: { value: 'New map' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(mockedCreateMindMap).toHaveBeenCalledWith({}, expect.objectContaining({ ownerUid: 'owner-uid', title: 'New map' }));

    fireEvent.click(navigation.getByRole('button', { name: 'Rename map' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Map title' }), { target: { value: 'Renamed architecture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(mockedUpdateMindMapVersioned).toHaveBeenCalledWith({}, expect.objectContaining({ mapId: 'map-1', title: 'Renamed architecture' }));

    fireEvent.click(navigation.getByRole('button', { name: 'Archive map' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(mockedArchiveMindMap).toHaveBeenCalledWith({}, 'owner-uid', 'map-1');
  });

  it('imports Markdown only as a new map after confirmation and blocks import while a draft is unsaved', async () => {
    render(<PrivateWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Import Markdown' }));
    fireEvent.change(screen.getByLabelText('Markdown file'), {
      target: { files: [new File(['# Imported map'], 'Imported map.md', { type: 'text/markdown' })] }
    });
    await screen.findByText('Imported map');
    fireEvent.click(screen.getByRole('button', { name: 'Import as new map' }));

    await waitFor(() => expect(mockedCreateMindMap).toHaveBeenCalledWith({}, expect.objectContaining({
      ownerUid: 'owner-uid', title: 'Imported map', markdown: '# Imported map', contentSearchText: '# imported map'
    })));
    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Unsaved draft' } });
    expect(screen.getByRole('button', { name: 'Import Markdown' })).toBeDisabled();
  });

  it('shows loading and save error states without rendering private map payloads', () => {
    mapList.current = {
      maps: [{ ...makeMindMap({ title: 'Private title', markdown: '# Private content' }), id: 'map-1' }],
      loading: true,
      error: null
    };
    const view = render(<PrivateWorkspace />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading maps…');
    expect(screen.queryByText('Private title')).not.toBeInTheDocument();
    expect(screen.queryByText('# Private content')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search private maps' })).not.toBeInTheDocument();

    mapList.current = {
      maps: [{ ...makeMindMap({ title: 'Private title', markdown: '# Private content' }), id: 'map-1' }],
      loading: false,
      error: new Error('denied')
    };
    view.rerender(<PrivateWorkspace />);
    expect(screen.getByRole('alert')).toHaveTextContent('Maps could not be loaded.');
    expect(screen.queryByText('Private title')).not.toBeInTheDocument();
    expect(screen.queryByText('# Private content')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search private maps' })).not.toBeInTheDocument();
  });

  it('keeps a draft when another map is selected before autosave unless discard is confirmed', async () => {
    vi.useFakeTimers();
    mapList.current = {
      maps: [
        { ...makeMindMap({ title: 'Architecture', markdown: '# Architecture' }), id: 'map-1' },
        { ...makeMindMap({ title: 'Product', markdown: '# Product' }), id: 'map-2' }
      ],
      loading: false,
      error: null
    };
    render(<PrivateWorkspace />);

    const navigation = within(screen.getByRole('complementary', { name: 'Workspace navigation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Active draft' } });
    expect(screen.getByRole('region', { name: 'Save status' })).toHaveTextContent('Unsaved changes');

    fireEvent.click(navigation.getByRole('button', { name: 'Product' }));
    const discardDialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    const keepEditing = within(discardDialog).getByRole('button', { name: 'Keep editing' });
    expect(keepEditing).toHaveFocus();

    fireEvent.keyDown(keepEditing, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Active draft');

    fireEvent.click(navigation.getByRole('button', { name: 'Product' }));
    const reopenedDiscardDialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    const reopenedKeepEditing = within(reopenedDiscardDialog).getByRole('button', { name: 'Keep editing' });
    expect(reopenedKeepEditing).toHaveFocus();
    fireEvent.keyDown(reopenedKeepEditing, { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Active draft');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Active draft');
    expect(mockedUpdateMindMapVersioned).not.toHaveBeenCalled();

    fireEvent.click(navigation.getByRole('button', { name: 'Product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and switch' }));
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Product');
    expect(mockedUpdateMindMapVersioned).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('offers private search in the workspace and applies the unsaved selection guard to a result', () => {
    mapList.current = {
      maps: [
        { ...makeMindMap({ title: 'Architecture', markdown: '# Architecture' }), id: 'map-1' },
        { ...makeMindMap({ title: 'Product roadmap', markdown: '# Product roadmap' }), id: 'map-2' }
      ],
      loading: false,
      error: null
    };
    render(<PrivateWorkspace />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Active draft' } });
    const navigation = screen.getByRole('complementary', { name: 'Workspace navigation' });
    const search = within(navigation).getByRole('region', { name: 'Private map search' });
    fireEvent.change(within(search).getByRole('textbox', { name: 'Search private maps' }), { target: { value: 'roadmap' } });
    fireEvent.click(within(search).getByRole('button', { name: 'Product roadmap' }));

    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Active draft');
  });

  it('opens safe folder archive from workspace navigation and requires an explicit destination', async () => {
    mapList.current = {
      maps: [{ ...makeMindMap({ folderId: 'folder-1' }), id: 'map-1' }],
      loading: false,
      error: null
    };
    render(<PrivateWorkspace />);

    const navigation = screen.getByRole('complementary', { name: 'Workspace navigation' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Archive Planning' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive Planning?' });
    expect(within(dialog).getByRole('button', { name: 'Archive folder' })).toBeDisabled();

    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Move maps to' }), { target: { value: '__uncategorized__' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive folder' }));

    await waitFor(() => expect(mockedMoveMapsAndArchiveFolder).toHaveBeenCalledWith({}, {
      ownerUid: 'owner-uid', folderId: 'folder-1', destinationFolderId: null
    }));
  });

  it('clears old revision actions immediately when switching maps while new history loads', async () => {
    mapList.current = {
      maps: [
        { ...makeMindMap({ title: 'Architecture' }), id: 'map-1' },
        { ...makeMindMap({ title: 'Product' }), id: 'map-2' }
      ],
      loading: false,
      error: null
    };
    mockedListRevisions
      .mockResolvedValueOnce([{ id: 'revision-1', ownerUid: 'owner-uid', mapId: 'map-1', sourceContentVersion: 1, title: 'Architecture revision', folderId: null, markdown: '# Old', reason: 'manual', createdAt: new Date(), createdByUid: 'owner-uid' }] as never)
      .mockReturnValueOnce(new Promise(() => {}));
    render(<PrivateWorkspace />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Restore Architecture revision' })).toHaveLength(2));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Workspace navigation' })).getByRole('button', { name: 'Product' }));

    expect(screen.queryAllByRole('button', { name: 'Restore Architecture revision' })).toHaveLength(0);
    expect(screen.getAllByText('No saved revisions yet.')).toHaveLength(2);
  });

  it('exposes Retry for a failed save and invokes the queue retry path', async () => {
    vi.useFakeTimers();
    mockedCreateRevisionAndSaveMap
      .mockResolvedValueOnce({ status: 'error', error: new Error('temporary failure') })
      .mockResolvedValueOnce({ status: 'saved', revisionId: 'revision-2', prunePending: false });
    render(<PrivateWorkspace />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), { target: { value: '# Retry draft' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole('region', { name: 'Save status' })).toHaveTextContent('Save failed');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await Promise.resolve();
    });
    expect(mockedCreateRevisionAndSaveMap).toHaveBeenCalledTimes(2);
    expect(mockedCreateRevisionAndSaveMap).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'manual' }));
    expect(screen.getByRole('region', { name: 'Save status' })).toHaveTextContent('Saved');
    vi.useRealTimers();
  });
});
