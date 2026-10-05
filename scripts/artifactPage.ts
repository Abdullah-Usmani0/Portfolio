/**
 * Turns the artifact build's index.html into the body of a claude.ai artifact page.
 *
 * The artifact host wraps the file in its own doctype, head and body and only allows
 * scripts from a few CDNs, so everything ships inline: the one module script, the one
 * stylesheet (fonts and data already inlined as data: URIs by the build), and the title.
 */
export function toArtifactPage(html: string, read: (relativePath: string) => string): string {
  const titleText = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
  // The artifact's name is the person's name; the role belongs to the page, not the tab.
  const title = titleText.split(/\s+[—|-]\s+/)[0] ?? titleText;

  const css = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)]
    .map((m) => m[0].match(/\bhref="\.\/([^"]+)"/)?.[1])
    .filter((href): href is string => Boolean(href))
    .map(read)
    .join('\n');

  const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc="\.\/([^"]+)"[^>]*><\/script>/g)];
  if (scripts.length !== 1 || !/\btype="module"/.test(scripts[0]![1] ?? '')) {
    throw new Error(`expected exactly one module script in the build, found ${scripts.length}`);
  }
  const js = read(scripts[0]![2]!)
    // Inline script text must not close its own tag or open an HTML comment.
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');

  return [`<title>${title}</title>`, `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`, '<div id="root"></div>', `<script type="module">${js}</script>`, ''].join('\n');
}
