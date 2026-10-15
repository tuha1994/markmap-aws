import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MarkdownEditor } from './MarkdownEditor';

describe('MarkdownEditor', () => {
  it('emits text changes without interpreting Markdown as HTML', () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: '<img onerror=alert(1)>' } });

    expect(onChange).toHaveBeenCalledWith('<img onerror=alert(1)>');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
