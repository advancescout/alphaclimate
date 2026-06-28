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

## Build scripts (`build/`)
- `build_kg.py` — convert Beck-2023 GeoTIFFs → `kg_<period>[_<ssp>].kgz`
  (the 2101–2190 extension is computed client-side, see `extrapolate()` in `index.html`)

Imagery: NASA via three-globe. Deployed on Vercel.
