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
      <button onClick={() => queue.setDraft('first draft')}>First</button>
      <button onClick={() => queue.setDraft('second draft')}>Second</button>
    </>
  );
}

describe('useSaveQueue', () => {
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
});
