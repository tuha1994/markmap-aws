import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConflictDialog } from './ConflictDialog';

describe('ConflictDialog', () => {
  it('retains local and remote Markdown until the user explicitly chooses Keep mine or Use remote', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        localMarkdown="# Local draft"
        remoteMarkdown="# Remote draft"
        onResolve={onResolve}
      />
    );

    expect(screen.getByText('# Local draft')).toBeInTheDocument();
    expect(screen.getByText('# Remote draft')).toBeInTheDocument();
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(onResolve).toHaveBeenCalledWith('keepMine');
  });

  it('moves focus into the modal and does not resolve on Escape', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        localMarkdown="# Local draft"
        remoteMarkdown="# Remote draft"
        onResolve={onResolve}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Remote change detected' });
    const keepMine = screen.getByRole('button', { name: 'Keep mine' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(keepMine).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onResolve).not.toHaveBeenCalled();
  });
});
