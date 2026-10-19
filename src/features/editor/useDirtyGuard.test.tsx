import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDirtyGuard } from './useDirtyGuard';
import type { SaveStatus } from './useSaveQueue';

function DirtyGuardHarness({ status }: { status: SaveStatus }) {
  useDirtyGuard(status);
  return null;
}

describe('useDirtyGuard', () => {
  it.each<SaveStatus>(['unsaved', 'saving', 'offlinePending', 'error', 'conflict'])('adds beforeunload protection while content is %s', (status) => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = render(<DirtyGuardHarness status="saved" />);

    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender(<DirtyGuardHarness status={status} />);
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender(<DirtyGuardHarness status="saved" />);
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    unmount();
  });
});
