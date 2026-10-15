import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDirtyGuard } from './useDirtyGuard';

function DirtyGuardHarness({ isDirty }: { isDirty: boolean }) {
  useDirtyGuard(isDirty);
  return null;
}

describe('useDirtyGuard', () => {
  it('adds beforeunload protection only while content is unsaved', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = render(<DirtyGuardHarness isDirty={false} />);

    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender(<DirtyGuardHarness isDirty />);
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender(<DirtyGuardHarness isDirty={false} />);
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    unmount();
  });
});
