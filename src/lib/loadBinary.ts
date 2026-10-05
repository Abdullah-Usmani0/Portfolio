/**
 * Load a binary asset by URL. The live preview inlines assets as `data:` URLs, which are
 * decoded here directly (its sandbox may refuse to fetch them); everything else is fetched.
 */
export async function loadBinary(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma);
    const body = url.slice(comma + 1);
    const bytes = meta.endsWith(';base64') ? atob(body) : decodeURIComponent(body);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
    return out.buffer;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}
