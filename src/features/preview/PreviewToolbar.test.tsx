import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewToolbar } from './PreviewToolbar';

describe('PreviewToolbar', () => {
  it('delegates fit, zoom, and reset controls to the Markmap adapter', () => {
    const adapter = { fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() };
    render(<PreviewToolbar adapter={adapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fit preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset preview' }));

    expect(adapter.fit).toHaveBeenCalledOnce();
    expect(adapter.zoomIn).toHaveBeenCalledOnce();
    expect(adapter.zoomOut).toHaveBeenCalledOnce();
    expect(adapter.reset).toHaveBeenCalledOnce();
  });

  it('offers a reversible focus control when the workspace provides a layout callback', () => {
    const onToggleFocus = vi.fn();
    const adapter = { fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn() };
    render(<PreviewToolbar adapter={adapter} isFocusMode onToggleFocus={onToggleFocus} />);

    fireEvent.click(screen.getByRole('button', { name: 'Exit focus mode' }));

    expect(onToggleFocus).toHaveBeenCalledOnce();
  });
});