import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImportDialog } from './ImportDialog';

function markdownFile(name: string, markdown: string): File {
  return new File([new TextEncoder().encode(markdown)], name, { type: 'text/markdown' });
}

describe('ImportDialog', () => {
  it('requires confirmation before proposing a parsed file as a new map', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportDialog onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Markdown file'), {
      target: { files: [markdownFile('Imported.md', '# Imported')] }
    });

    await screen.findByText('Imported');
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Import as new map' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ title: 'Imported', markdown: '# Imported' }));
  });

  it('rejects invalid input without proposing a map write', async () => {
    const onImport = vi.fn();
    render(<ImportDialog onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Markdown file'), {
      target: { files: [markdownFile('private.txt', '# Not Markdown')] }
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a Markdown file with a .md or .markdown extension.');
    expect(onImport).not.toHaveBeenCalled();
  });
});
