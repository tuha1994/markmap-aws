import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from './byteLength';

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes rather than JavaScript code units', () => {
    expect(utf8ByteLength('é')).toBe(2);
  });

  it('counts exactly 256 KiB for multi-byte Markdown', () => {
    expect(utf8ByteLength('é'.repeat(131_072))).toBe(262_144);
  });
});
