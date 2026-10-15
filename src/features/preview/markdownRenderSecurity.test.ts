import { describe, expect, it } from 'vitest';
import { sanitizeMarkdownForMarkmap } from './markdownRenderSecurity';

describe('sanitizeMarkdownForMarkmap', () => {
  it('escapes raw HTML and script-like payloads as inert text', () => {
    const result = sanitizeMarkdownForMarkmap('<img src=x onerror="alert(1)">\n<script>alert(1)</script>');

    expect(result).toContain('&lt;img');
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
});
