import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../test/factories';
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
vi.mock('../features/mindmaps/mindMapRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/mindmaps/mindMapRepository')>();
  return {
    ...actual,
    createMindMap: vi.fn(),
    archiveMindMap: vi.fn(),
    updateMindMapVersioned: vi.fn()
  };
});
vi.mock('../features/editor/useSaveQueue', () => ({
  useSaveQueue: (map: { markdown: string }) => ({
    draft: map.markdown,
    setDraft: vi.fn(),
    status: 'saved',
    conflict: null,
    retry: vi.fn(),
    saveVersion: vi.fn(),
    resolveConflict: vi.fn()
  })
}));
vi.mock('../features/preview/MarkmapPreview', () => ({
  MarkmapPreview: () => <section aria-label="Mind map preview" />
}));

const mockedCreateMindMap = vi.mocked(createMindMap);
const mockedArchiveMindMap = vi.mocked(archiveMindMap);
const mockedUpdateMindMapVersioned = vi.mocked(updateMindMapVersioned);

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

  it('shows loading and save error states without rendering private map payloads', () => {
    mapList.current = {
      maps: [{ ...makeMindMap({ title: 'Private title' }), id: 'map-1' }],
      loading: true,
      error: null
    };
    const view = render(<PrivateWorkspace />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading maps…');
    expect(screen.queryByText('Private title')).not.toBeInTheDocument();

    mapList.current = {
      maps: [{ ...makeMindMap({ title: 'Private title' }), id: 'map-1' }],
      loading: false,
      error: new Error('denied')
    };
    view.rerender(<PrivateWorkspace />);
    expect(screen.getByRole('alert')).toHaveTextContent('Maps could not be loaded.');
    expect(screen.queryByText('Private title')).not.toBeInTheDocument();
  });
});
