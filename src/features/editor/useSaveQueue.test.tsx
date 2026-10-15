import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../../test/factories';
import { useSaveQueue, type SaveRepository } from './useSaveQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function SaveQueueHarness({ repository, map = { id: 'map-1', ...makeMindMap() } }: {
  repository: SaveRepository;
  map?: ReturnType<typeof makeMindMap> & { id: string };
}) {
  const queue = useSaveQueue(map, repository);
  return (
    <>
      <output data-testid="draft">{queue.draft}</output>
      <output data-testid="status">{queue.status}</output>
      <output data-testid="conflict">{queue.conflict ? `${queue.conflict.localMarkdown}|${queue.conflict.remoteMarkdown}` : ''}</output>
      <output data-testid="conflict-version">{queue.conflict?.remoteContentVersion ?? ''}</output>
      <button onClick={() => queue.setDraft('first draft')}>First</button>
      <button onClick={() => queue.setDraft('second draft')}>Second</button>
      <button onClick={() => queue.retry()}>Retry</button>
      <button onClick={() => queue.saveVersion()}>Save version</button>
      <button onClick={() => queue.resolveConflict('keepMine')}>Keep mine</button>
    </>
  );
}

describe('useSaveQueue', () => {
  it('surfaces pending history cleanup from the current map state', () => {
    const repository: SaveRepository = { update: vi.fn() };
    render(<SaveQueueHarness repository={repository} map={{ id: 'map-1', ...makeMindMap({ revisionPrunePending: true }) }} />);

    expect(screen.getByTestId('status')).toHaveTextContent('prunePending');
  });

  it('retries pending history cleanup without saving another revision', async () => {
    const saveRevision = vi.fn();
    const retryRevisionPrune = vi.fn().mockResolvedValue(false);
    const repository = { update: vi.fn(), saveRevision, retryRevisionPrune } as SaveRepository & {
      saveRevision: typeof saveRevision;
      retryRevisionPrune: typeof retryRevisionPrune;
    };
    render(<SaveQueueHarness repository={repository} map={{ id: 'map-1', ...makeMindMap({ revisionPrunePending: true }) }} />);

    await act(async () => {
      screen.getByRole('button', { name: 'Retry' }).click();
      await Promise.resolve();
    });

    expect(retryRevisionPrune).toHaveBeenCalledWith('map-1');
    expect(saveRevision).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('uses a manual immutable revision when Save version is requested', async () => {
    const saveRevision = vi.fn().mockResolvedValue({ status: 'saved', revisionId: 'revision-1', prunePending: false });
    const repository = { update: vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 }), saveRevision } as SaveRepository & { saveRevision: typeof saveRevision };
    render(<SaveQueueHarness repository={repository} />);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      screen.getByRole('button', { name: 'Save version' }).click();
      await Promise.resolve();
    });

    expect(saveRevision).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft', reason: 'manual' }));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not mark draft generation N+1 saved when N resolves late', async () => {
    vi.useFakeTimers();
    const firstWrite = deferred<{ status: 'updated'; contentVersion: number }>();
    const secondWrite = deferred<{ status: 'updated'; contentVersion: number }>();
    const repository: SaveRepository = {
      update: vi.fn().mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise)
    };
    render(<SaveQueueHarness repository={repository} />);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('saving');

    await act(async () => {
      screen.getByRole('button', { name: 'Second' }).click();
      firstWrite.resolve({ status: 'updated', contentVersion: 2 });
      await Promise.resolve();
    });

    expect(screen.getByTestId('draft')).toHaveTextContent('second draft');
    expect(screen.getByTestId('status')).not.toHaveTextContent('saved');
    expect(repository.update).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondWrite.resolve({ status: 'updated', contentVersion: 3 });
      await Promise.resolve();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
    expect(repository.update).toHaveBeenLastCalledWith(expect.objectContaining({
      markdown: 'second draft', expectedContentVersion: 2
    }));
    vi.useRealTimers();
  });

  it('starts autosave after 1.5 seconds idle', async () => {
    vi.useFakeTimers();
    const repository: SaveRepository = {
      update: vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 })
    };
    render(<SaveQueueHarness repository={repository} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(repository.update).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft' }));
    vi.useRealTimers();
  });

  it('retries a returned repository error', async () => {
    vi.useFakeTimers();
    const repository: SaveRepository = {
      update: vi.fn()
        .mockResolvedValueOnce({ status: 'error', error: new Error('temporary failure') })
        .mockResolvedValueOnce({ status: 'updated', contentVersion: 2 })
    };
    render(<SaveQueueHarness repository={repository} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('error');

    await act(async () => {
      screen.getByRole('button', { name: 'Retry' }).click();
      await Promise.resolve();
    });
    expect(repository.update).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
    vi.useRealTimers();
  });

  it('retries an in-memory offline draft after connectivity returns', async () => {
    vi.useFakeTimers();
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const repository: SaveRepository = {
      update: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'updated', contentVersion: 2 })
    };
    render(<SaveQueueHarness repository={repository} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('offlinePending');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(repository.update).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status')).toHaveTextContent('saved');

    if (originalOnline) {
      Object.defineProperty(navigator, 'onLine', originalOnline);
    }
    vi.useRealTimers();
  });

  it('loads a newly selected map even when its version is lower than the previous map', () => {
    const repository: SaveRepository = { update: vi.fn() };
    const { rerender } = render(
      <SaveQueueHarness repository={repository} map={{ id: 'map-1', ...makeMindMap({ markdown: '# First', contentVersion: 4 }) }} />
    );

    rerender(
      <SaveQueueHarness repository={repository} map={{ id: 'map-2', ...makeMindMap({ markdown: '# Second', contentVersion: 1 }) }} />
    );

    expect(screen.getByTestId('draft')).toHaveTextContent('# Second');
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('retains local and remote Markdown when a dirty editor receives a new remote version', () => {
    const repository: SaveRepository = { update: vi.fn() };
    const initialMap = { id: 'map-1', ...makeMindMap({ markdown: '# Initial', contentVersion: 1 }) };
    const { rerender } = render(<SaveQueueHarness repository={repository} map={initialMap} />);

    screen.getByRole('button', { name: 'First' }).click();
    rerender(
      <SaveQueueHarness
        repository={repository}
        map={{ ...initialMap, markdown: '# Remote', contentVersion: 2 }}
      />
    );

    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('conflict')).toHaveTextContent('first draft|# Remote');
  });

  it('opens the conflict state from a competing revision-save transaction using its confirmed remote map', async () => {
    vi.useFakeTimers();
    const staleMap = { id: 'map-1', ...makeMindMap({ markdown: '# Stale listener', contentVersion: 1 }) };
    const confirmedRemote = { id: 'map-1', ...makeMindMap({ markdown: '# Confirmed remote', contentVersion: 8 }) };
    const saveRevision = vi.fn()
      .mockResolvedValueOnce({ status: 'conflict', remote: confirmedRemote })
      .mockResolvedValueOnce({ status: 'saved', revisionId: 'revision-2', prunePending: false });
    const repository: SaveRepository = { update: vi.fn(), saveRevision };
    render(<SaveQueueHarness repository={repository} map={staleMap} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('conflict')).toHaveTextContent('first draft|# Confirmed remote');
    expect(screen.getByTestId('conflict-version')).toHaveTextContent('8');

    await act(async () => {
      screen.getByRole('button', { name: 'Keep mine' }).click();
      await Promise.resolve();
    });
    expect(saveRevision).toHaveBeenLastCalledWith(expect.objectContaining({
      markdown: 'first draft',
      expectedContentVersion: 8
    }));
    vi.useRealTimers();
  });

  it('ignores an old map completion after the selected map changes', async () => {
    vi.useFakeTimers();
    const oldMapWrite = deferred<{ status: 'updated'; contentVersion: number }>();
    const newMapWrite = deferred<{ status: 'updated'; contentVersion: number }>();
    const repository: SaveRepository = {
      update: vi.fn().mockReturnValueOnce(oldMapWrite.promise).mockReturnValueOnce(newMapWrite.promise)
    };
    const oldMap = { id: 'map-1', ...makeMindMap({ markdown: '# Old', contentVersion: 4 }) };
    const newMap = { id: 'map-2', ...makeMindMap({ markdown: '# New', contentVersion: 1 }) };
    const { rerender } = render(<SaveQueueHarness repository={repository} map={oldMap} />);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(repository.update).toHaveBeenLastCalledWith(expect.objectContaining({ mapId: 'map-1', expectedContentVersion: 4 }));

    rerender(<SaveQueueHarness repository={repository} map={newMap} />);
    await act(async () => {
      oldMapWrite.resolve({ status: 'updated', contentVersion: 5 });
      await Promise.resolve();
    });

    expect(screen.getByTestId('draft')).toHaveTextContent('# New');
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
    expect(repository.update).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(repository.update).toHaveBeenLastCalledWith(expect.objectContaining({ mapId: 'map-2', expectedContentVersion: 1 }));
    newMapWrite.resolve({ status: 'updated', contentVersion: 2 });
    vi.useRealTimers();
  });
});
