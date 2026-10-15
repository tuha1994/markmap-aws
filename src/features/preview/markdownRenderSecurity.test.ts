import { describe, expect, it } from 'vitest';
import { sanitizeMarkdownForMarkmap } from './markdownRenderSecurity';

describe('sanitizeMarkdownForMarkmap', () => {
  it('escapes raw HTML and script-like payloads as inert text', () => {
    const result = sanitizeMarkdownForMarkmap('<img src=x onerror="alert(1)">\n<script>alert(1)</script>');

    expect(result).not.toContain('src=x');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('removes unsafe URL schemes while preserving link labels', () => {
    const result = sanitizeMarkdownForMarkmap('[run](javascript:alert(1)) [data](data:text/html,boom) [safe](https://example.com)');

    expect(result).toContain('run');
    expect(result).toContain('data');
    expect(result).toContain('[safe](https://example.com)');
    expect(result).not.toMatch(/javascript:|data:text/i);
  });

  it('replaces external image syntax with inert alt text', () => {
    const result = sanitizeMarkdownForMarkmap('![AWS diagram](https://evil.example/exfiltrate.png)');

    expect(result).toBe('AWS diagram');
    expect(result).not.toContain('evil.example');
  });

  it('removes nested-alt, reference, and HTML image destinations without leaving their URLs', () => {
    const input = [
      '![alt [nested]](https://evil.example/inline.png)',
      '![reference image][evil-image]',
      '[evil-image]: https://evil.example/reference.png',
      '<img src="https://evil.example/html.png" alt="HTML image">',
    ].join('\n');

    const result = sanitizeMarkdownForMarkmap(input);

    expect(result).toContain('alt [nested]');
    expect(result).toContain('reference image');
    expect(result).toContain('HTML image');
    expect(result).not.toMatch(/evil\.example|<img/i);
  });
});
