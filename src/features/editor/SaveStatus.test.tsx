import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SaveStatus } from './SaveStatus';

describe('SaveStatus', () => {
  it('labels offline drafts as in-memory-only and not recoverable after refresh or browser crash', () => {
    render(<SaveStatus status="offlinePending" />);

    expect(screen.getByText('Offline — changes pending')).toBeInTheDocument();
    expect(screen.getByText(/only in this browser session/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh, closing this tab, or a browser crash can lose them/i)).toBeInTheDocument();
  });
});
