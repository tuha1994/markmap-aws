import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
});
