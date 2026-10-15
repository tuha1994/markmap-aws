import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MarkmapPreview } from './MarkmapPreview';

describe('MarkmapPreview', () => {
  it('renders an SVG host and reports transform errors without exposing source HTML', async () => {
    const renderMarkdown = vi.fn().mockRejectedValue(new Error('bad markdown'));
    render(<MarkmapPreview markdown={'<script>secret()</script>'} createAdapter={() => ({ render: renderMarkdown, destroy: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() })} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to render preview');
    expect(screen.queryByText('secret()')).not.toBeInTheDocument();
  });

  it('ignores stale render completion after a newer request succeeds', async () => {
    vi.useFakeTimers();
    let rejectFirst: (reason?: unknown) => void = () => undefined;
    const first = new Promise<never>((_resolve, reject) => { rejectFirst = reject; });
    const second = Promise.resolve({ markdown: '# second' });
    const renderMarkdown = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const createAdapter = () => ({ render: renderMarkdown, destroy: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() });
    const view = render(<MarkmapPreview markdown="# first" createAdapter={createAdapter} />);

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(renderMarkdown).toHaveBeenLastCalledWith('# first');
    view.rerender(<MarkmapPreview markdown="# second" createAdapter={createAdapter} />);
    await act(async () => { vi.advanceTimersByTime(300); await second; });
    expect(renderMarkdown).toHaveBeenLastCalledWith('# second');
    await act(async () => { rejectFirst(new Error('stale failure')); await first.catch(() => undefined); });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not update error state when an inflight render completes after unmount', async () => {
    vi.useFakeTimers();
    let rejectRender: (reason?: unknown) => void = () => undefined;
    const pending = new Promise<never>((_resolve, reject) => { rejectRender = reject; });
    const renderMarkdown = vi.fn().mockReturnValue(pending);
    const destroy = vi.fn();
    const view = render(<MarkmapPreview markdown="# first" createAdapter={() => ({ render: renderMarkdown, destroy, fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() })} />);

    await act(async () => { vi.advanceTimersByTime(300); });
    view.unmount();
    await act(async () => { rejectRender(new Error('late failure')); await pending.catch(() => undefined); });

    expect(destroy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
