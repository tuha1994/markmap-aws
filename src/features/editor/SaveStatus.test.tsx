import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SaveStatus } from './SaveStatus';

describe('SaveStatus', () => {
  it.each([
    ['saved', 'Saved'],
    ['saving', 'Saving'],
    ['unsaved', 'Unsaved'],
    ['offlinePending', 'Error'],
    ['error', 'Error'],
    ['conflict', 'Error'],
    ['prunePending', 'Saved']
  ] as const)('maps detailed %s state to compact %s status', (status, label) => {
    render(<SaveStatus status={status} />);

    expect(screen.getByRole('region', { name: 'Save status' })).toHaveTextContent(label);
  });

  it('explains pending local recovery and offers retry while offline', () => {
    const onRetry = vi.fn();
    render(<SaveStatus status="offlinePending" onRetry={onRetry} />);

    const status = screen.getByRole('region', { name: 'Save status' });
    expect(status).toHaveTextContent('Error');
    expect(status).toHaveTextContent('Draft is kept locally when possible; recovery is pending.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
