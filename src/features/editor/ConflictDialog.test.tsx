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

  it('tabs from Keep mine to Use remote and wraps forward within the modal', () => {
    const onResolve = vi.fn();
    render(
      <>
        <button type="button">Background action</button>
        <ConflictDialog
          localMarkdown="# Local draft"
          remoteMarkdown="# Remote draft"
          onResolve={onResolve}
        />
      </>
    );

    const keepMine = screen.getByRole('button', { name: 'Keep mine' });
    const useRemote = screen.getByRole('button', { name: 'Use remote' });
    const backgroundAction = screen.getByRole('button', { name: 'Background action' });
    expect(keepMine).toHaveFocus();

    fireEvent.keyDown(keepMine, { key: 'Tab' });
    expect(useRemote).toHaveFocus();

    fireEvent.keyDown(useRemote, { key: 'Tab' });
    expect(keepMine).toHaveFocus();
    expect(backgroundAction).not.toHaveFocus();
  });

  it('reverse-tabs from Keep mine to Use remote and never resolves on Escape', () => {
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
    const useRemote = screen.getByRole('button', { name: 'Use remote' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(keepMine).toHaveFocus();

    fireEvent.keyDown(keepMine, { key: 'Tab', shiftKey: true });
    expect(useRemote).toHaveFocus();

    fireEvent.keyDown(useRemote, { key: 'Tab', shiftKey: true });
    expect(keepMine).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onResolve).not.toHaveBeenCalled();
  });
});
