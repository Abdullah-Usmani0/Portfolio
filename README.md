# Zero Valley

The portfolio of **Muhammad Abdullah Usmani**, Founding AI Engineer, told as one day and
night in an illustrated valley under K2. Each system he built is a place, and every place
opens a **deep dive**: the camera flies in, the set piece acts the system out, labels ride
on the world and animated boards explain the detail.

| Scene | System | The dive |
|---|---|---|
| The town | Curriculum Council | Six councils of tool-bound agents, the autonomy kernel, the loops that learn from every run |
| The farm | Scenario generation | A role becomes a focus map, cards become scenarios, reviewers and the exemplar set the bar |
| The proving grounds | Simulated learners | A cohort reads cold, asks the manager, hands in work, stumbles, and the fix is re-run |
| The village | Humanoid NPCs | One manager on every surface, four voices, check-ins that respect you, faces and voices |
| The fireflies | Context engineering | A character's mind assembled block by block: cache line, memory, retrieval, isolation |
| The lake stage | Real-time voice | The race to the first word, the hidden verdict, speaking while thinking, the frame gate |
| K2 | Career | Camp by camp up the Abruzzi route, from university to founding engineer |

A printable CV lives at **`#cv`** (or `/cv` on a host with paths): the same words, on paper.

## Run it

```bash
npm install
npm run dev              # Vite dev server
npm run check            # typecheck (tsc -b) + lint + unit tests + build
npm run e2e              # build, then Playwright: dives in real WebGL, reduced motion, no WebGL, phone, CV + axe
npm run build:artifact   # the whole site as one self-contained HTML page (dist-artifact/page.html)
node scripts/shoot.mjs --file dist-artifact/page.html --dive learners --size 390x844   # screenshots
```

Add `?test=1` (or `?debug`) to the URL for the read-only test hook, `window.__site`.

**Deploy.** Vercel builds `main` on every push with its Vite preset (`npm run build` → `dist`).
`vercel.json` hands every path that is not a file to the app, so `/cv` opens the CV.

## How it is built

- **One canvas, painted layers** (`src/world`). three.js with an orthographic camera; every
  layer is a flat plane that moves at its own parallax. `journey.ts` turns scroll into a
  place and a time of day; `engine.ts` draws the layers and dollies the camera into one of
  them for a dive, so nearer layers slide past as a real camera would.
- **Set pieces with pure layouts.** Each scene's numbers live in a pure module
  (`villageLayout.ts`, `lakeLayout.ts`, `provingLayout.ts`, …) that the scenery, its dive
  anchors and the unit tests all read. The scenery acts out the dive step it is shown
  (`f.dive.step`), so the world and the card tell the same story.
- **Dives** (`src/content/dives`, `src/sections/dives`). Each step names an anchor to fly
  to, labels to pin to the world, and an animated SVG board drawn on the GSAP ticker.
  `anchorIds.ts` lists every anchor; tests hold the copy to it and each set piece to
  registering it.
- **One source of words** (`src/content/site.ts`). The valley, the dives and the CV share
  it. The copy is conceptual by design: no internal names, hosts, IDs or costs, and no
  phone number. A unit test enforces both.
- **Real terrain.** K2's skyline is ray-marched from real elevation data
  (`blender/k2_panorama.py` → `src/world/data/k2.json`); the context-engineering bust is a
  CC0 MakeHuman mesh sampled into fireflies (`blender/bust_mesh.py`).

## Credits

- K2 terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen; sources
  include SRTM and ETOPO1), used under the dataset's attribution terms.
- Firefly bust surface: the [MakeHuman](http://www.makehumancommunity.org) base mesh, CC0.
- Fonts: Geist, Geist Mono and Instrument Serif (SIL Open Font License).
- Everything else is drawn in code.
