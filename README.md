# Köppen Earth — alphaclimate.xyz

Interactive 3D globe of Köppen–Geiger climate classification, with selectable
climate periods (1901–2190) and SSP scenarios.

**Live:** https://alphaclimate.xyz

## Data
- **1901–2099** — Köppen–Geiger maps from Beck et al. (2023), *High-resolution
  (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections*
  (0.1° tier), via https://www.gloh2o.org/koppen/.
- **2101–2190** — a forward extension of each scenario's warming trajectory beyond
  the published 2099 horizon (see `build/build_extrap.py`). Not a published dataset.

Each period is stored as a gzip-compressed uint8 class grid (`kg_*.kgz`,
3600×1800, 0.1°), decompressed in the browser via `DecompressionStream`.

## Stack
Single static `index.html` — Three.js globe (CDN), OpenStreetMap Nominatim for
click-to-inspect place names. No build step.

## Build scripts (`build/`)
- `build_kg.py` — convert Beck-2023 GeoTIFFs → `kg_<period>[_<ssp>].kgz`
- `build_extrap.py` — generate the 2101–2190 extension maps

Imagery: NASA via three-globe. Deployed on Vercel.
