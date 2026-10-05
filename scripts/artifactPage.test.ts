import { describe, expect, it } from 'vitest';
import { toArtifactPage } from './artifactPage.ts';

const build = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Muhammad Abdullah Usmani — Founding AI Engineer</title>
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">
  </head>
  <body><div id="root"></div></body>
</html>`;

const files: Record<string, string> = {
  'assets/index-abc.js': 'console.log("</script><!-- hi")',
  'assets/index-abc.css': '@font-face{src:url(data:font/woff2;base64,AAAA)}body{color:red}',
};

describe('toArtifactPage', () => {
  const page = toArtifactPage(build, (p) => files[p] ?? '');

  it('drops the document skeleton the artifact host adds itself', () => {
    expect(page).not.toMatch(/<!doctype|<html|<head|<body/i);
  });

  it('names the page after the person', () => {
    expect(page.startsWith('<title>Muhammad Abdullah Usmani</title>')).toBe(true);
  });

  it('inlines exactly one module script, safely escaped', () => {
    expect(page.match(/<script\b/g)).toHaveLength(1);
    expect(page).toContain('<script type="module">');
    expect(page).toContain('<\\/script>');
    expect(page).toContain('<\\!-- hi');
    expect(page).not.toMatch(/\bsrc=/);
  });

  it('inlines the stylesheet with its data: fonts and loads nothing external', () => {
    expect(page).toContain('<style>@font-face{src:url(data:font/woff2');
    expect(page).not.toMatch(/<link\b/);
    expect(page).not.toMatch(/url\((["']?)https?:/);
  });

  it('refuses a build that split the script', () => {
    const split = build.replace('</head>', '<script type="module" src="./assets/chunk.js"></script></head>');
    expect(() => toArtifactPage(split, () => '')).toThrow(/exactly one module script/);
  });
});
