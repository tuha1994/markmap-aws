export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isMarkdownWithinLimit(markdown: string): boolean {
  return utf8ByteLength(markdown) <= 256 * 1024;
}
