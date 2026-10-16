import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResizableSplit } from './ResizableSplit';

function setDesktopViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })));
}

describe('ResizableSplit', () => {
  beforeEach(() => setDesktopViewport(true));
  afterEach(() => vi.unstubAllGlobals());

  it('exposes labelled separator values and bounded keyboard resizing', () => {
    const onValueChange = vi.fn();
    render(
      <ResizableSplit
        direction="horizontal"
        label="Sidebar width"
        min={224}
        max={420}
        defaultValue={300}
        value={300}
        step={8}
        onValueChange={onValueChange}
      />
    );

    const divider = screen.getByRole('separator', { name: 'Sidebar width' });
    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    expect(divider).toHaveAttribute('aria-valuemin', '224');
    expect(divider).toHaveAttribute('aria-valuemax', '420');
    expect(divider).toHaveAttribute('aria-valuenow', '300');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    fireEvent.keyDown(divider, { key: 'Home' });
    fireEvent.keyDown(divider, { key: 'End' });

    expect(onValueChange).toHaveBeenNthCalledWith(1, 308);
    expect(onValueChange).toHaveBeenNthCalledWith(2, 224);
    expect(onValueChange).toHaveBeenNthCalledWith(3, 420);
  });

  it('captures pointers and clamps drag updates to its bounds', () => {
    const onValueChange = vi.fn();
    render(
      <ResizableSplit
        direction="horizontal"
        label="Sidebar width"
        min={224}
        max={420}
        defaultValue={300}
        value={300}
        onValueChange={onValueChange}
      />
    );

    const divider = screen.getByRole('separator', { name: 'Sidebar width' });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(divider, {
      setPointerCapture: { value: setPointerCapture },
      releasePointerCapture: { value: releasePointerCapture }
    });

    fireEvent.pointerDown(divider, { pointerId: 7, clientX: 100 });
    fireEvent.pointerMove(divider, { pointerId: 7, clientX: 1_000 });
    fireEvent.pointerMove(divider, { pointerId: 7, clientX: -1_000 });
    fireEvent.pointerUp(divider, { pointerId: 7 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onValueChange).toHaveBeenNthCalledWith(1, 420);
    expect(onValueChange).toHaveBeenNthCalledWith(2, 224);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('does not render a focusable desktop divider outside desktop viewports', () => {
    setDesktopViewport(false);
    const { container } = render(
      <ResizableSplit
        direction="horizontal"
        label="Sidebar width"
        min={224}
        max={420}
        defaultValue={300}
        value={300}
        onValueChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
