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
| The village | AI coworkers | One manager on every surface, four voices, check-ins that respect you, faces and voices |
| The fireflies | Context engineering | A character's mind assembled block by block: cache line, memory, retrieval, isolation |
| The lake stage | Real-time voice | The race to the first word, the hidden verdict, speaking while thinking, the frame gate |
| K2 | Career | Camp by camp up the Abruzzi route, from university to founding engineer |

Two reading pages lie over the valley: **How it works** (`#systems`, or `/systems`) explains
each system in plain words and then step by step, with its animated boards, and a printable
**CV** (`#cv`, or `/cv`) says the same on paper. The valley stays built underneath them, so
Back returns to the same scene and hour.

The valley has a sound too: wind, the river, the gorge falls, the farm's windmill, birds by
day and crickets, an owl and the village bell by night, and under it all a few quiet notes of
piano, softer after dusk and fullest at the summit. It is on by default, starts with the
visitor's first click or tap (browsers allow nothing sooner), and the speaker in the corner
turns it off; the choice is remembered.

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
- **Sound, synthesized** (`src/audio`). No audio files: the Web Audio API shapes noise into
  wind and water and schedules small synthesized voices (bubbles, creaks, chirps, hoots, a
  bell), plus a felt piano on loops of different lengths, after Eno's *Music for Airports*,
  so the tune never repeats. A pure `mixAt` (`mix.ts`, unit-tested) says how loud each layer
  is at every point of the journey; the piano's level in each scene is measured so it sits
  under that scene's own sounds. `soundscape.ts` builds the graph, live or offline for
  listening tests.
- **Real terrain, rendered** (`blender/k2_render.py`, `gl/rendered.ts`). K2's skyline is
  ray-marched from real elevation data (`blender/k2_panorama.py` → `data/k2.json`), and each
  of the five mountain layers is rendered in Cycles from the same eye. The data's 31 m cells
  are carved with detail they cannot hold (`blender/terrain_detail.py`): gullies traced down
  the real fall line, crags, rock in layers, true displacement on the steepest walls; snow
  lies where the ground holds it, glaciers carry moraine stripes, and rock shows below the
  snow line. Each layer is lit three ways in one render (light groups): from the left, from
  the right and by the open sky alone, and the site mixes the three for the hour
  (`relight.ts`, unit-tested): the light follows the sun, warms on bare rock, lingers on the
  peaks as the sun sets and fades into the air with real distance. Fog drifts in the valleys
  at each layer's foot; the painted silhouettes show until the renders load. The
  context-engineering bust is a CC0 MakeHuman mesh sampled into fireflies
  (`blender/bust_mesh.py`).
- **The foreground, rendered** (`blender/foreground_render.py`, `gl/strip.ts`,
  `scenery/renderedStrip.ts`). The two forested ridges, the valley floor with the
  waterfall's cliff, and the near bank that climbs to the summit are built in 3D from the
  very shapes the site paints (`npm run scenery` exports them), so the words and set pieces
  sit where they did: spruces grown whorl by whorl (`blender/pines.py`), hair grass, bushes
  and split boulders, a granite cliff in stepped, stained bands, and up high the mountain's
  own carved rock and snow. Each layer is rendered side-on in tiles and relit by the hour
  like the mountains; tiles load as the camera nears them, their treetops sway, the nearest
  ground goes soft under the words, and the painted layer shows until a tile is in.
- **Light and weather** (`gl/rays.ts`, `scenery/weatherFx.ts`). Light shafts take their
  shape from whatever really stands in front of the sun: the scene is drawn small as
  coverage, and each pixel gathers the open sky between itself and the sun, so the rays
  stream past real ridges and peaks. A plume of spindrift streams off K2's summit, and snow
  falls on the night climb. `weather.ts` says how strong each is at every hour (unit-tested).
- **A diorama you can look into** (`tilt.ts`). The eye leans with the cursor, drifts slowly
  on a touch screen and dips while the page scrolls; every layer shifts against it by its
  own depth, so the painted valley opens up like a paper diorama. With reduced motion the
  tilt, the snow and the plume all hold still.

## Credits

- K2 terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen; sources
  include SRTM and ETOPO1), used under the dataset's attribution terms.
- Firefly bust surface: the [MakeHuman](http://www.makehumancommunity.org) base mesh, CC0.
- Fonts: Geist, Geist Mono and Instrument Serif (SIL Open Font License).
- Everything else is drawn in code.
