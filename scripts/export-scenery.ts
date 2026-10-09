// Writes the painted layers' shapes (src/world/scenery/profiles.ts) to blender/out/scenery.json,
// for the Blender renders of the foreground (blender/foreground_render.py), and the valley's
// buildings (src/world/scenery/structures.ts) to blender/out/structures.json, for
// blender/structures_render.py.
//
//   npm run scenery
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

// The runner reads no config file, so it is given the app's one alias.
const src = fileURLToPath(new URL('../src', import.meta.url));
const { module } = await runnerImport<typeof import('../src/world/scenery/profiles.ts')>('/src/world/scenery/profiles.ts', { resolve: { alias: { '@': src } } });
mkdirSync('blender/out', { recursive: true });
const data = module.sceneryProfiles();
writeFileSync('blender/out/scenery.json', JSON.stringify(data));
console.log(`scenery: bank ${data.bank.xs.length} points, ${data.bank.trees.length} pines; ridges ${data.ridges.map((r) => r.trees.length).join(' + ')} pines; cliff ${data.valley.cliff.trees.length} pines`);
const built = await runnerImport<typeof import('../src/world/scenery/structures.ts')>('/src/world/scenery/structures.ts', { resolve: { alias: { '@': src } } });
const all = built.module.structures();
writeFileSync('blender/out/structures.json', JSON.stringify(all));
console.log(`structures: ${all.length} (${[...new Set(all.map((s) => s.kind))].join(', ')})`);
