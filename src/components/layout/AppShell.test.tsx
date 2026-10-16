import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

function setDesktopViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })));
}

describe('AppShell', () => {
  beforeEach(() => setDesktopViewport(true));
  afterEach(() => vi.unstubAllGlobals());

  it('provides bounded sidebar and editor dividers in edit mode', () => {
    render(
      <AppShell
        sidebar={<p>Navigation</p>}
        editor={<p>Editor</p>}
        preview={<p>Preview</p>}
        mode="edit"
        sidebarCollapsed={false}
        onModeChange={vi.fn()}
        onSidebarCollapsedChange={vi.fn()}
      />
    );

    expect(screen.getByRole('separator', { name: 'Sidebar width' })).toHaveAttribute('aria-valuenow', '300');
    expect(screen.getByRole('separator', { name: 'Editor width' })).toHaveAttribute('aria-valuenow', '39');
    expect(screen.getByLabelText('Preview pane')).toHaveStyle({ minWidth: '320px' });
  });

  it('updates the desktop region sizes without replacing mounted panel children', () => {
    render(
      <AppShell
        sidebar={<p>Navigation</p>}
        editor={<input aria-label="Draft" defaultValue="Preserved draft" />}
        preview={<p>Preview</p>}
        mode="edit"
        sidebarCollapsed={false}
        onModeChange={vi.fn()}
        onSidebarCollapsedChange={vi.fn()}
      />
    );

    const draft = screen.getByRole('textbox', { name: 'Draft' });
    fireEvent.change(draft, { target: { value: 'Still here' } });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Sidebar width' }), { key: 'ArrowRight' });

    expect(draft).toHaveValue('Still here');
    expect(screen.getByLabelText('Workspace navigation')).toHaveStyle({ flexBasis: '308px' });
  });

  it('keeps panel children mounted while focus mode hides them', () => {
    const props = {
      sidebar: <p>Navigation</p>,
      editor: <input aria-label="Draft" defaultValue="Preserved draft" />,
      preview: <p>Preview</p>,
      sidebarCollapsed: false,
      onModeChange: vi.fn(),
      onSidebarCollapsedChange: vi.fn()
    };
    const { rerender } = render(<AppShell {...props} mode="edit" />);
    const draft = screen.getByRole('textbox', { name: 'Draft' });
    fireEvent.change(draft, { target: { value: 'Still here' } });

    rerender(<AppShell {...props} mode="focus" />);
    expect(screen.getByLabelText('Markdown editor')).toHaveAttribute('hidden');

    rerender(<AppShell {...props} mode="edit" />);
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
    expect(draft).toHaveValue('Still here');
  });

  it('removes dividers from the focus-mode tab order', () => {
    const { rerender } = render(
      <AppShell
        sidebar={<p>Navigation</p>}
        editor={<p>Editor</p>}
        preview={<p>Preview</p>}
        mode="edit"
        sidebarCollapsed={false}
        onModeChange={vi.fn()}
        onSidebarCollapsedChange={vi.fn()}
      />
    );

    rerender(
      <AppShell
        sidebar={<p>Navigation</p>}
        editor={<p>Editor</p>}
        preview={<p>Preview</p>}
        mode="focus"
        sidebarCollapsed={false}
        onModeChange={vi.fn()}
        onSidebarCollapsedChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});
