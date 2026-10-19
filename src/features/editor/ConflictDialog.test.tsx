import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConflictDialog } from './ConflictDialog';

describe('ConflictDialog', () => {
  it('identifies a competing draft and retains both drafts until the user explicitly chooses one', () => {
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
    expect(screen.getByRole('dialog', { name: 'Conflicting draft detected' })).toHaveTextContent('competing draft');
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(onResolve).toHaveBeenCalledWith('keepMine');
  });

  it('tabs from Keep mine to Use competing draft and wraps forward within the modal', () => {
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
    const useRemote = screen.getByRole('button', { name: 'Use competing draft' });
    const backgroundAction = screen.getByRole('button', { name: 'Background action' });
    expect(keepMine).toHaveFocus();

    fireEvent.keyDown(keepMine, { key: 'Tab' });
    expect(useRemote).toHaveFocus();

    fireEvent.keyDown(useRemote, { key: 'Tab' });
    expect(keepMine).toHaveFocus();
    expect(backgroundAction).not.toHaveFocus();
  });

  it('reverse-tabs from Keep mine to Use competing draft and never resolves on Escape', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        localMarkdown="# Local draft"
        remoteMarkdown="# Remote draft"
        onResolve={onResolve}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Conflicting draft detected' });
    const keepMine = screen.getByRole('button', { name: 'Keep mine' });
    const useRemote = screen.getByRole('button', { name: 'Use competing draft' });
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
