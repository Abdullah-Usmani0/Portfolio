import { describe, expect, it } from 'vitest';
import { loadBinary } from './loadBinary.ts';

describe('loadBinary', () => {
  it('decodes a base64 data URL without fetching', async () => {
    const buf = await loadBinary('data:application/octet-stream;base64,AAECA/8=');
    expect([...new Uint8Array(buf)]).toEqual([0, 1, 2, 3, 255]);
  });

  it('decodes a plain data URL', async () => {
    const buf = await loadBinary('data:text/plain,hi');
    expect(new TextDecoder().decode(buf)).toBe('hi');
  });
});
