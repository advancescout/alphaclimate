# Köppen Earth — alphaclimate.xyz

Interactive 3D globe of Köppen–Geiger climate classification, with selectable
climate periods (1901–2190) and SSP scenarios.

**Live:** https://alphaclimate.xyz

## Data
- **1901–2099** — Köppen–Geiger maps from Beck et al. (2023), *High-resolution
  (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections*
  (0.1° tier), via https://www.gloh2o.org/koppen/.
- **2101–2190** — computed in the browser from the 2071–2099 map with a thermal
  "warming ladder": each class steps toward its warmer analogue (so tropical/arid
  groups expand and cold/polar groups shrink), scaled per scenario to expected
  post-2100 warming. Applied in place, so the overlay stays aligned with the base
  map. See the `extrapolate()` function in `index.html`. Not a published dataset.

The 1901–2099 periods are stored as gzip-compressed uint8 class grids (`kg_*.kgz`,
3600×1800, 0.1°), decompressed in the browser via `DecompressionStream`.

## Stack
Single static `index.html` — Three.js globe (CDN), OpenStreetMap Nominatim for
click-to-inspect place names. No build step.

## Build scripts (`build/`)
- `build_kg.py` — convert Beck-2023 GeoTIFFs → `kg_<period>[_<ssp>].kgz`
  (the 2101–2190 extension is computed client-side, see `extrapolate()` in `index.html`)

Imagery: NASA via three-globe. Deployed on Vercel.
