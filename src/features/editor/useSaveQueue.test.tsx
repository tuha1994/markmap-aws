import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeMindMap } from '../../test/factories';
import type { DraftRecoveryRecord, DraftRecoveryStore } from './draftRecoveryStore';
import { useSaveQueue, type SaveQueue, type SaveQueueTiming, type SaveRepository } from './useSaveQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

type QueueOptions = {
  recoveryStore?: DraftRecoveryStore;
  timing?: SaveQueueTiming;
  recoveryCoordinator?: {
    writerId: string;
    announceActive(uid: string, mapId: string): void;
    clearActive(uid: string, mapId: string): void;
    subscribeToLiveWriters(uid: string, mapId: string, listener: (writerIds: string[]) => void): () => void;
  };
};

function controlledTiming(initialNow = 0) {
  let now = initialNow;
  let nextHandle = 1;
  const timers = new Map<number, { callback: () => void; dueAt: number }>();
  const timing: SaveQueueTiming = {
    now: () => now,
    setTimeout: (callback, delay) => {
      const handle = nextHandle;
      nextHandle += 1;
      timers.set(handle, { callback, dueAt: now + delay });
      return handle as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (handle) => { timers.delete(handle as unknown as number); }
  };
  const advanceBy = async (milliseconds: number) => {
    now += milliseconds;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.dueAt <= now)
        .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
      if (!next) return;
      timers.delete(next[0]);
      await act(async () => { next[1].callback(); await Promise.resolve(); });
    }
  };
  return { timing, advanceBy };
}

type QueueWithFlush = SaveQueue & { flush(): Promise<'saved' | 'error' | 'conflict'> };
const useQueue = useSaveQueue as unknown as (map: ReturnType<typeof makeMindMap> & { id: string }, repository: SaveRepository, options?: QueueOptions) => QueueWithFlush;

function SaveQueueHarness({ repository, map = { id: 'map-1', ...makeMindMap() }, options }: {
  repository: SaveRepository;
  map?: ReturnType<typeof makeMindMap> & { id: string };
  options?: QueueOptions;
}) {
  const queue = useQueue(map, repository, options);
  return (
    <>
      <output data-testid="draft">{queue.draft}</output>
      <output data-testid="status">{queue.status}</output>
      <output data-testid="conflict">{queue.conflict ? `${queue.conflict.localMarkdown}|${queue.conflict.remoteMarkdown}` : ''}</output>
      <output data-testid="conflict-version">{queue.conflict?.remoteContentVersion ?? ''}</output>
      <output data-testid="flush" />
      <button onClick={() => queue.setDraft('first draft')}>First</button>
      <button onClick={() => queue.setDraft('second draft')}>Second</button>
      <button onClick={() => queue.retry()}>Retry</button>
      <button onClick={() => queue.saveVersion()}>Save version</button>
      <button onClick={() => queue.resolveConflict('keepMine')}>Keep mine</button>
      <button onClick={() => queue.resolveConflict('useRemote')}>Use competing</button>
      <button onClick={() => void queue.flush().then((outcome) => { document.querySelector('[data-testid="flush"]')!.textContent = outcome; })}>Flush</button>
    </>
  );
}

function recoveryRecord(overrides: Partial<DraftRecoveryRecord> = {}): DraftRecoveryRecord {
  return { uid: 'owner-uid', mapId: 'map-1', writerId: 'writer-1', baseContentVersion: 1, markdown: '# recovered', generation: 1, recordVersion: 1, updatedAtMs: 1, ...overrides };
}

function recoveryOptions(records: DraftRecoveryRecord[] = []) {
  const store: DraftRecoveryStore = {
    list: vi.fn().mockResolvedValue(records),
    put: vi.fn().mockImplementation(async (record: DraftRecoveryRecord) => { if (record.recordVersion === 0) record.recordVersion = record.generation; return true; }),
    deleteIfCurrent: vi.fn().mockResolvedValue(true),
    retireConfirmed: vi.fn().mockResolvedValue(true)
  };
  const coordinator = {
    writerId: 'writer-1', announceActive: vi.fn(), clearActive: vi.fn(),
    subscribeToLiveWriters: vi.fn((_uid: string, _mapId: string, listener: (writerIds: string[]) => void) => { listener([]); return () => undefined; })
  };
  return { options: { recoveryStore: store, recoveryCoordinator: coordinator }, store, coordinator };
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
      await vi.advanceTimersByTimeAsync(5000);
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

  it('coalesces a newer draft after a prune-pending revision commit and retains cleanup retry state', async () => {
    const { timing } = controlledTiming(0);
    const firstRevision = deferred<{ status: 'prune-pending' }>();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 3 });
    const saveRevision = vi.fn().mockReturnValue(firstRevision.promise);
    const retryRevisionPrune = vi.fn().mockResolvedValue(false);
    render(<SaveQueueHarness repository={{ update, saveRevision, retryRevisionPrune }} options={{ timing }} map={{ id: 'map-1', ...makeMindMap({ currentRevisionAt: new Date(-300_000) as never }) }} />);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      screen.getByRole('button', { name: 'Flush' }).click();
      await Promise.resolve();
    });
    expect(saveRevision).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft', reason: 'autosave' }));

    await act(async () => {
      screen.getByRole('button', { name: 'Second' }).click();
      firstRevision.resolve({ status: 'prune-pending' });
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'second draft', expectedContentVersion: 2 }));
    expect(screen.getByTestId('status')).toHaveTextContent('prunePending');
    await act(async () => { screen.getByRole('button', { name: 'Retry' }).click(); await Promise.resolve(); });
    expect(retryRevisionPrune).toHaveBeenCalledWith('map-1');
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('starts autosave after 5 seconds idle', async () => {
    vi.useFakeTimers();
    const repository: SaveRepository = {
      update: vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 })
    };
    render(<SaveQueueHarness repository={repository} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
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
      await vi.advanceTimersByTimeAsync(5000);
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

  it('retries an in-memory offline draft after connectivity returns without starting an offline transaction', async () => {
    vi.useFakeTimers();
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const repository: SaveRepository = {
      update: vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 })
    };
    render(<SaveQueueHarness repository={repository} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('offlinePending');
    expect(repository.update).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(repository.update).toHaveBeenCalledTimes(1);
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

  it('opens the conflict state from a competing normal map-save transaction using its confirmed remote map', async () => {
    vi.useFakeTimers();
    const staleMap = { id: 'map-1', ...makeMindMap({ markdown: '# Stale listener', contentVersion: 1 }) };
    const confirmedRemote = { id: 'map-1', ...makeMindMap({ markdown: '# Confirmed remote', contentVersion: 8 }) };
    const update = vi.fn()
      .mockResolvedValueOnce({ status: 'conflict', remote: confirmedRemote })
      .mockResolvedValueOnce({ status: 'updated', contentVersion: 9 });
    const repository: SaveRepository = { update };
    render(<SaveQueueHarness repository={repository} map={staleMap} />);

    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('conflict')).toHaveTextContent('first draft|# Confirmed remote');
    expect(screen.getByTestId('conflict-version')).toHaveTextContent('8');

    await act(async () => {
      screen.getByRole('button', { name: 'Keep mine' }).click();
      await Promise.resolve();
    });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
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
      await vi.advanceTimersByTimeAsync(5000);
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
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(repository.update).toHaveBeenLastCalledWith(expect.objectContaining({ mapId: 'map-2', expectedContentVersion: 1 }));
    newMapWrite.resolve({ status: 'updated', contentVersion: 2 });
    vi.useRealTimers();
  });

  it('does not autosave before 4,999 ms and saves at the 5,000 ms trailing boundary', async () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} />);
    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(update).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft' }));
    vi.useRealTimers();
  });

  it('uses injected timing for the 5-second trailing debounce and 30-second hard deadline', async () => {
    const { timing, advanceBy } = controlledTiming();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} options={{ timing }} />);

    screen.getByRole('button', { name: 'First' }).click();
    await advanceBy(4_999);
    expect(update).not.toHaveBeenCalled();
    await advanceBy(1);
    expect(update).toHaveBeenCalledTimes(1);

    for (let second = 0; second < 30; second += 1) {
      screen.getByRole('button', { name: second % 2 === 0 ? 'First' : 'Second' }).click();
      await advanceBy(1_000);
    }
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: 'second draft' }));
  });

  it('flushes continuous typing once at the 30-second max-wait deadline without waiting idle', async () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} />);
    for (let second = 0; second < 30; second += 1) {
      screen.getByRole('button', { name: second % 2 === 0 ? 'First' : 'Second' }).click();
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'second draft' }));
    vi.useRealTimers();
  });

  it('uses update for ordinary autosaves even when revision saving is available', async () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    const saveRevision = vi.fn().mockResolvedValue({ status: 'saved', revisionId: 'revision-1', prunePending: false });
    render(<SaveQueueHarness repository={{ update, saveRevision }} map={{ id: 'map-1', ...makeMindMap({ currentRevisionAt: new Date() as never }) }} />);
    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft' }));
    expect(saveRevision).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('routes the next dirty flush through one autosnapshot when five minutes have elapsed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T00:05:00.000Z'));
    const update = vi.fn();
    const saveRevision = vi.fn().mockResolvedValue({ status: 'saved', revisionId: 'revision-1', prunePending: false });
    render(<SaveQueueHarness repository={{ update, saveRevision }} map={{ id: 'map-1', ...makeMindMap({ currentRevisionAt: new Date('2026-10-15T00:00:00.000Z') as never }) }} />);
    screen.getByRole('button', { name: 'First' }).click();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(saveRevision).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft', reason: 'autosave' }));
    expect(update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('uses injected autosnapshot time at the exact five-minute boundary after a prune-pending commit', async () => {
    const { timing, advanceBy } = controlledTiming();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 3 });
    const saveRevision = vi.fn().mockResolvedValue({ status: 'prune-pending' });
    render(<SaveQueueHarness repository={{ update, saveRevision }} options={{ timing }} map={{ id: 'map-1', ...makeMindMap({ currentRevisionAt: new Date(-300_000) as never }) }} />);

    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(saveRevision).toHaveBeenCalledTimes(1);

    await act(async () => { screen.getByRole('button', { name: 'Second' }).click(); screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(saveRevision).toHaveBeenCalledTimes(1);

    await advanceBy(300_000);
    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(saveRevision).toHaveBeenCalledTimes(2);
  });

  it('hydrates one compatible recovery record for the current writer', async () => {
    const { options, coordinator } = recoveryOptions([recoveryRecord()]);
    render(<SaveQueueHarness repository={{ update: vi.fn() }} options={options} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('draft')).toHaveTextContent('# recovered');
    expect(screen.getByTestId('status')).toHaveTextContent('unsaved');
    expect(coordinator.announceActive).toHaveBeenCalledWith('owner-uid', 'map-1');
  });

  it('does not hydrate a delayed compatible recovery record over a newer typed draft', async () => {
    const { timing, advanceBy } = controlledTiming();
    const delayedRecords = deferred<DraftRecoveryRecord[]>();
    const { options, store } = recoveryOptions();
    store.list = vi.fn().mockReturnValue(delayedRecords.promise);
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} options={{ ...options, timing }} />);

    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); });
    await act(async () => { delayedRecords.resolve([recoveryRecord({ generation: 42, markdown: '# stale recovered' })]); await Promise.resolve(); });

    expect(screen.getByTestId('draft')).toHaveTextContent('first draft');
    expect(screen.getByTestId('status')).toHaveTextContent('unsaved');
    await advanceBy(5000);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'first draft' }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ markdown: '# stale recovered' }));
  });

  it('opens a recovery conflict if another live writer appears after compatible hydration', async () => {
    let notifyLiveWriters: ((writerIds: string[]) => void) | undefined;
    const { options, store } = recoveryOptions([recoveryRecord()]);
    options.recoveryCoordinator!.subscribeToLiveWriters = vi.fn((_uid, _mapId, listener) => {
      notifyLiveWriters = listener;
      listener([]);
      return () => undefined;
    });
    render(<SaveQueueHarness repository={{ update: vi.fn() }} options={options} />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('unsaved');

    await act(async () => { notifyLiveWriters!(['writer-2']); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('conflict')).toHaveTextContent('# recovered|# Cloud foundations');
    expect(store.deleteIfCurrent).not.toHaveBeenCalled();
  });

  it('keeps a recovered draft conflict when a live writer appears during its in-flight autosave', async () => {
    let notifyLiveWriters: ((writerIds: string[]) => void) | undefined;
    const { options, store } = recoveryOptions([recoveryRecord()]);
    const pendingUpdate = deferred<{ status: 'updated'; contentVersion: number }>();
    options.recoveryCoordinator!.subscribeToLiveWriters = vi.fn((_uid, _mapId, listener) => {
      notifyLiveWriters = listener;
      listener([]);
      return () => undefined;
    });
    render(<SaveQueueHarness repository={{ update: vi.fn().mockReturnValue(pendingUpdate.promise) }} options={options} />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('unsaved');

    await act(async () => {
      screen.getByRole('button', { name: 'Flush' }).click();
      await Promise.resolve();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('saving');

    await act(async () => { notifyLiveWriters!(['writer-2']); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');

    await act(async () => {
      pendingUpdate.resolve({ status: 'updated', contentVersion: 2 });
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(store.deleteIfCurrent).not.toHaveBeenCalled();
  });

  it('opens a conflict instead of overwriting remote content for a stale recovery base version', async () => {
    const { options } = recoveryOptions([recoveryRecord({ baseContentVersion: 2 })]);
    render(<SaveQueueHarness repository={{ update: vi.fn() }} options={options} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('conflict')).toHaveTextContent('# recovered|# Cloud foundations');
  });

  it('does not auto-hydrate divergent recovery drafts from multiple writers', async () => {
    const { options } = recoveryOptions([recoveryRecord(), recoveryRecord({ writerId: 'writer-2', markdown: '# other writer' })]);
    render(<SaveQueueHarness repository={{ update: vi.fn() }} options={options} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    expect(screen.getByTestId('draft')).toHaveTextContent('# Cloud foundations');
  });

  it('retires only this writer recovery record when competing recovery is chosen', async () => {
    const ownRecord = recoveryRecord({ markdown: '# local recovery' });
    const otherRecord = recoveryRecord({ writerId: 'writer-2', markdown: '# competing recovery' });
    const { options, store } = recoveryOptions([ownRecord, otherRecord]);
    render(<SaveQueueHarness repository={{ update: vi.fn() }} options={options} />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    await act(async () => { screen.getByRole('button', { name: 'Use competing' }).click(); });

    expect(store.deleteIfCurrent).toHaveBeenCalledTimes(1);
    expect(store.deleteIfCurrent).toHaveBeenCalledWith(ownRecord);
    expect(store.deleteIfCurrent).not.toHaveBeenCalledWith(otherRecord);
    expect(screen.getByTestId('draft')).toHaveTextContent('# Cloud foundations');
    expect(screen.getByTestId('status')).toHaveTextContent('saved');
  });

  it('replaces a stale-base recovery record with the current generation when keeping mine', async () => {
    const staleRecord = recoveryRecord({ generation: 7, baseContentVersion: 2, markdown: '# local recovery' });
    const pendingUpdate = deferred<{ status: 'updated'; contentVersion: number }>();
    const { options, store } = recoveryOptions([staleRecord]);
    const update = vi.fn().mockReturnValue(pendingUpdate.promise);
    render(<SaveQueueHarness repository={{ update }} options={options} />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('status')).toHaveTextContent('conflict');
    await act(async () => { screen.getByRole('button', { name: 'Keep mine' }).click(); await Promise.resolve(); });

    expect(store.put).toHaveBeenCalledWith(expect.objectContaining({
      writerId: 'writer-1', baseContentVersion: 1, markdown: '# local recovery', generation: 8
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ markdown: '# local recovery', expectedContentVersion: 1 }));
    expect(store.deleteIfCurrent).not.toHaveBeenCalled();
  });

  it('retires only this writer matching recovery record after confirming the latest generation', async () => {
    vi.useFakeTimers();
    const { options, store } = recoveryOptions();
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} options={options} />);
    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); await vi.advanceTimersByTimeAsync(5000); await Promise.resolve(); });
    expect(store.retireConfirmed).toHaveBeenCalledWith(expect.objectContaining({ uid: 'owner-uid', mapId: 'map-1', writerId: 'writer-1', generation: 1, recordVersion: 1 }));
    vi.useRealTimers();
  });

  it('retires a deferred recovery put after an immediate confirmed flush so it cannot recreate a draft', async () => {
    const delayedPut = deferred<void>();
    const persisted = new Map<string, DraftRecoveryRecord>();
    let retiredGeneration = -1;
    const store = {
      list: vi.fn().mockResolvedValue([]),
      put: vi.fn(async (record: DraftRecoveryRecord) => {
        await delayedPut.promise;
        if (record.generation <= retiredGeneration) return false;
        persisted.set(record.writerId, { ...record });
        return true;
      }),
      deleteIfCurrent: vi.fn().mockResolvedValue(false),
      retireConfirmed: vi.fn(async (record: DraftRecoveryRecord) => {
        retiredGeneration = Math.max(retiredGeneration, record.generation);
        persisted.delete(record.writerId);
        return true;
      })
    };
    const coordinator = {
      writerId: 'writer-1', announceActive: vi.fn(), clearActive: vi.fn(),
      subscribeToLiveWriters: vi.fn((_uid: string, _mapId: string, listener: (writerIds: string[]) => void) => { listener([]); return () => undefined; })
    };
    const update = vi.fn().mockResolvedValue({ status: 'updated', contentVersion: 2 });
    render(<SaveQueueHarness repository={{ update }} options={{ recoveryStore: store as DraftRecoveryStore, recoveryCoordinator: coordinator }} />);

    await act(async () => {
      screen.getByRole('button', { name: 'First' }).click();
      screen.getByRole('button', { name: 'Flush' }).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('flush')).toHaveTextContent('saved');
    expect(store.retireConfirmed).toHaveBeenCalledWith(expect.objectContaining({ generation: 1, markdown: 'first draft' }));

    await act(async () => {
      delayedPut.resolve();
      await Promise.resolve();
    });
    expect(persisted.size).toBe(0);
  });

  it('flush returns saved when clean, error after a failed immediate save, and conflict after a version conflict', async () => {
    const { rerender } = render(<SaveQueueHarness repository={{ update: vi.fn() }} />);
    await act(async () => { screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(screen.getByTestId('flush')).toHaveTextContent('saved');
    rerender(<SaveQueueHarness repository={{ update: vi.fn().mockResolvedValue({ status: 'error', error: new Error('offline') }) }} />);
    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(screen.getByTestId('flush')).toHaveTextContent('error');
    const remote = { id: 'map-1', ...makeMindMap({ markdown: '# Remote', contentVersion: 2 }) };
    rerender(<SaveQueueHarness repository={{ update: vi.fn().mockResolvedValue({ status: 'conflict', remote }) }} />);
    await act(async () => { screen.getByRole('button', { name: 'First' }).click(); screen.getByRole('button', { name: 'Flush' }).click(); await Promise.resolve(); });
    expect(screen.getByTestId('flush')).toHaveTextContent('conflict');
  });
});
