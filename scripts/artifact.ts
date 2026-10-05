// Builds the artifact page from dist-artifact/ (run `vite build --mode artifact` first).
//   node scripts/artifact.ts [out.html]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toArtifactPage } from './artifactPage.ts';

const dist = 'dist-artifact';
const out = process.argv[2] ?? join(dist, 'page.html');
const page = toArtifactPage(readFileSync(join(dist, 'index.html'), 'utf8'), (p) => readFileSync(join(dist, p), 'utf8'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`artifact page: ${out} (${(page.length / 1024).toFixed(0)} KB)`);
