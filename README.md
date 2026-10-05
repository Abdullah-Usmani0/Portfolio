# Zero Valley

The portfolio of **Muhammad Abdullah Usmani**, Founding AI Engineer — told as one day in a
storybook valley under K2. Each system I built is a place: humanoid NPCs are villagers, the
curriculum councils are a town, scenario generation is a farm, simulated learners walk the
proving grounds, and the career climbs the mountain.

**Status: M0 — look-dev slice.** Blender style frames, a live WebGL day over the valley,
the firefly-bust spike and the first design canvas.

## Run it

```bash
npm install
npm run dev          # Vite dev server
npm run typecheck    # tsc -b (app, pure sim layer, node tools, e2e)
npm run lint
npm test             # Vitest — sims, director, haze, bust targets
npm run build
npm run e2e          # Playwright: real WebGL (SwiftShader), reduced motion, no-WebGL, mobile, axe
```

Useful URLs: `?tier=high|mid|low|static` forces a quality tier, `?debug` shows FPS and draw
calls, and the **A/B · Cycles** button lays the Blender render over the live view.

## How it is built

- **Blender as code** (`blender/`, headless `bpy` 5.0.1): `lookdev_m0.py` builds the diorama
  and renders Cycles style frames; `mountain.py` builds K2 from real elevation data;
  `export_web_m0.py` exports web models with jointed villagers and **baked sun visibility and
  sky occlusion for all five looks**; `parallax_m0.py` renders the 2D fallback plates.
  `npm run assets` regenerates everything deterministically; Vercel never runs Blender.
- **The stage** (`src/stage/`): one persistent React Three Fiber canvas. A pure director
  (`director.ts`) maps scroll to a camera shot and a time of day; the light, haze (with
  altitude, so K2 stands clear of the valley's haze), water, grass, trees, villagers and the
  firefly bust all read the same dial.
- **The pure layer** (`src/sim/`): clean-room TypeScript with no DOM, React or three —
  time of day, quality tiers, character poses, bust targets. Lint forbids rendering imports.

## Credits

- K2 terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen; sources
  include SRTM and ETOPO1), used under the dataset's attribution terms.
- Firefly bust surface: the [MakeHuman](http://www.makehumancommunity.org) base mesh, CC0.
- Fonts: Bricolage Grotesque, Fraunces, Inter and JetBrains Mono (SIL Open Font License).
- Everything else is made in Blender and in code.
