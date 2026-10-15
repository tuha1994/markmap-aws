import { describe, expect, it } from 'vitest';

import { isMarkdownWithinLimit, utf8ByteLength } from './byteLength';

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes rather than JavaScript code units', () => {
    expect(utf8ByteLength('é')).toBe(2);
  });

  it('counts exactly 256 KiB for multi-byte Markdown', () => {
    expect(utf8ByteLength('é'.repeat(131_072))).toBe(262_144);
  });
});

describe('isMarkdownWithinLimit', () => {
  it('rejects Markdown that exceeds 256 KiB by one ASCII byte', () => {
    expect(isMarkdownWithinLimit('a'.repeat(262_145))).toBe(false);
  });
});
