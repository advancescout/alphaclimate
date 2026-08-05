# Köppen Earth — alphaclimate.xyz

Interactive 3D globe of Köppen–Geiger climate classification, with selectable
climate periods (1901–2190) and SSP scenarios.

**Live:** https://alphaclimate.xyz

## Data
- **1901–2099** — Köppen–Geiger maps from Beck et al. (2023), *High-resolution
  (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections*
  (0.1° tier), via https://www.gloh2o.org/koppen/.
- **2101–2190** — computed in the browser from the 2071–2099 map so the A/B/C/D/E
  groups visibly **shift and expand**: a thermal "warming ladder" (each class steps
  toward its warmer analogue — tropical/arid expand, the continental warm-edge and
  tundra shrink, ice caps persist) plus a **poleward advection** that migrates the
  belts to higher latitudes. Scaled per scenario to expected post-2100 warming;
  advection moves climate only within land cells so the overlay stays aligned with
  the coastline. See `extrapolate()` in `index.html`. Not a published dataset.

The 1901–2099 periods are stored as gzip-compressed uint8 class grids (`kg_*.kgz`,
3600×1800, 0.1°), decompressed in the browser via `DecompressionStream`.

Clicking a location also shows **monthly climate averages** (temperature, max
temperature, rainfall, wind in mph/km·h⁻¹, sunshine, humidity) from WorldClim 2.1
1970–2000 normals — packed at 0.5° in `climate_monthly.kgz` (lazy-loaded on first
click; sunshine derived from solar radiation via FAO Angström, humidity from
vapour pressure). Tap a bar to read that month's value. Built by
`build/build_monthly.py`.

**Map layers** — switch between the real **Climate** map and a **GDP motion**
layer: a conceptual data-art piece that paints each country (and Spanish region) a
Köppen colour by GDP per capita (richer → hotter/drier), explicitly assigned for
named countries and driven by Natural-Earth GDP/capita for the rest, then animated
1960 (a frozen ET/EF world) → 2000. Grids built by `build/build_gdp.py`
(`gdp_1960.kgz`, `gdp_2000.kgz`); crossfaded in-browser. Not climate.

**Zoom labels** — countries, states, cities, towns, villages, rivers, landmarks
and oceans/seas appear with level-of-detail as you zoom in (`labels.json`, from
Natural Earth via `build/extract_labels.py`; rendered as a pooled DOM overlay with
near-hemisphere culling and declutter). Toggle with "Place & ocean names".

## Stack
Single static `index.html` — Three.js globe (CDN), OpenStreetMap Nominatim for
click-to-inspect place names. No build step.

---

# KBS Media Video Maker — kbsmediavideomaker.com

A second, unrelated static site lives in `kbsmediavideomaker/`: a browser-based
maker for Korean broadcast-style titles, dub captions and credit sequences.

**Live:** https://www.kbsmediavideomaker.com (also served at
`/kbsmediavideomaker/` on this deployment)

Pick a year from **1991 to 2026** and the whole look changes with it — typeface
stack, letter-spacing, palette, title geometry, entrance animation and the
default tape filter. Eight eras (analogue Myeongjo → gold-bevel gothic →
digital plates → soft gothic → HD → flat → kinetic → streaming modern), with
per-year motion tweaks so clicking 1991 and 1994 are visibly different moves.

- **Two layers** — layer 1 is titles, lower-thirds, credit rolls and dub
  captions; layer 2 takes the user's own video and image files (fit, scale,
  position, rotation, opacity, blend mode, trim). Layer order is switchable.
- **Programme types** — TV drama, animation, anime dub, children's, documentary,
  music, foreign drama — each with its own Korean credit vocabulary
  (`성우`, `한국어판 연출`, `극본`, `구성` …) and one-click opening/ending builders.
- **Picture filters** — worn VHS, n-th-generation VHS, S-VHS, Betacam SP, DV,
  early HD, digital, UHD, telecine, and **no filter at all**. Built from canvas
  composite ops (chroma bleed, scanlines, head-switching noise, dropouts,
  interlace comb, bloom, vignette, gate weave) — no per-pixel JS loops, so it
  holds 30fps at 720p while recording.
- **Audio** — separate music and dub tracks with volume, offset and fades, plus
  per-clip original audio for imported video. Nothing is generated: real
  recordings in, real recordings out.
- **Export** — `MediaRecorder` over `canvas.captureStream()` + a WebAudio
  destination → WebM (VP9/Opus) download.

Everything runs client-side; no file leaves the browser. Fonts are open-licence
(SIL OFL) Korean families from Google Fonts chosen to match each era's
skeleton. Fan-made and unaffiliated with KBS — no broadcaster logo, trademark,
proprietary font or signature music is included.

### Files
`kbsmediavideomaker/index.html` · `css/app.css` ·
`js/eras.js` (era + year style system, programme types, filters) ·
`js/render.js` (frame compositor, text presets, filter chain) ·
`js/templates.js` (opening/ending/caption builders) · `js/app.js` (editor).
No build step.

### Deploying
This site is deployed as its **own Vercel project** (`kbsmediavideomaker`), separate
from the Köppen one, with `kbsmediavideomaker.com` attached to it — so set that
project's **Root Directory** to `kbsmediavideomaker`. Vercel then treats this
folder as the project root and reads `kbsmediavideomaker/vercel.json` for
headers. Nothing in the repo root is involved.

Asset filenames aren't content-hashed, so `vercel.json` makes `css/` and `js/`
revalidate; without that a deploy leaves stale JS running against fresh HTML.

## Build scripts (`build/`)
- `build_kg.py` — convert Beck-2023 GeoTIFFs → `kg_<period>[_<ssp>].kgz`
  (the 2101–2190 extension is computed client-side, see `extrapolate()` in `index.html`)

Imagery: NASA via three-globe. Deployed on Vercel.
