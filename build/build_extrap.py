#!/usr/bin/env python3
"""Forward extension of the Köppen-Geiger maps beyond the published 2099 horizon.

   Models two effects of sustained warming so that climate GROUPS visibly
   *shift and expand* (not just recolour in place):

   1. Poleward migration — climate bands move toward the poles. Each land cell
      adopts the class found a few degrees equatorward along its meridian, so
      warm zones expand polewards and cold/polar zones retreat. The land/ocean
      mask is preserved; coastal cells with no equatorward land neighbour fall
      back to in-place warming.
   2. In-place intensification — a Köppen 'warming ladder' nudges remaining
      cells toward their warmer analogue.

   Shift distance and ladder steps are scaled to each scenario's post-2100
   warming (SSP1 stabilises; SSP3/SSP5 keep warming).
"""
import os, gzip, struct, numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # repo root (alphaclimate/)
def P(name): return os.path.join(BASE, name)

# class value -> warmer-analogue value (one ladder step)
LADDER = {
 1:1, 2:2, 3:3, 4:4, 5:4, 6:6, 7:6,
 8:6, 9:8, 10:9, 11:3, 12:11, 13:12, 14:11, 15:14, 16:15,
 17:8, 18:17, 19:18, 20:19, 21:11, 22:21, 23:22, 24:23,
 25:14, 26:25, 27:26, 28:27, 29:27, 30:29,
}
succ = np.arange(256, dtype=np.uint8)
for a, b in LADDER.items(): succ[a] = b
succ[0] = 0
def compose(n):
    lut = np.arange(256, dtype=np.uint8)
    for _ in range(n): lut = succ[lut]
    return lut
LAD1 = compose(1)

# per scenario, for [2101-2130, 2131-2160, 2161-2190]:
#   SHIFT = poleward migration in degrees latitude ; STEPS = extra ladder steps
SHIFT = {
 "ssp119": [0.0, 0.0, 0.0],   "ssp126": [0.0, 0.0, 0.0],
 "ssp245": [1.0, 2.0, 3.0],   "ssp370": [2.0, 4.0, 6.0],   "ssp585": [3.0, 5.0, 7.0],
}
STEPS = {
 "ssp119": [0, 0, 0],   "ssp126": [0, 0, 0],
 "ssp245": [0, 0, 1],   "ssp370": [1, 1, 2],   "ssp585": [1, 2, 2],
}
PERIODS = ["2101_2130", "2131_2160", "2161_2190"]

def read_kgz(path):
    with gzip.open(path, "rb") as f: raw = f.read()
    W, H = struct.unpack("<ii", raw[:8])
    return W, H, np.frombuffer(raw[8:], dtype=np.uint8).reshape(H, W)

def write_kgz(path, W, H, arr):
    raw = struct.pack("<ii", W, H) + np.ascontiguousarray(arr, np.uint8).tobytes()
    with gzip.open(path, "wb", compresslevel=9) as f: f.write(raw)

def extrapolate(base, shift_deg, nsteps):
    H, W = base.shape
    res = base
    drows = int(round(shift_deg * H / 180.0))        # degrees -> rows (0.1° grid)
    if drows > 0:
        mid = H // 2
        rows = np.arange(H)
        srcr = np.where(rows < mid, rows + drows, rows - drows)   # toward the equator
        srcr = np.clip(srcr, 0, H - 1)
        shifted = base[srcr, :]                       # poleward-migrated classes
        land = base > 0
        fb = LAD1[base]                               # in-place warming fallback
        res = np.where(land & (shifted > 0), shifted, np.where(land, fb, 0)).astype(np.uint8)
    if nsteps > 0:
        res = compose(nsteps)[res]
    res = res.copy(); res[base == 0] = 0              # keep ocean as ocean
    return res

def grp_share(a, lo, hi):
    land = a > 0
    return 100.0 * np.count_nonzero((a >= lo) & (a <= hi) & land) / max(1, np.count_nonzero(land))

for ssp in SHIFT:
    W, H, base = read_kgz(P(f"kg_2071_2099_{ssp}.kgz"))
    for i, per in enumerate(PERIODS):
        out = extrapolate(base, SHIFT[ssp][i], STEPS[ssp][i])
        write_kgz(P(f"kg_{per}_{ssp}.kgz"), W, H, out)
        print(f"kg_{per}_{ssp}.kgz  shift={SHIFT[ssp][i]}°/steps={STEPS[ssp][i]}  "
              f"arid(B) {grp_share(base,4,7):.1f}->{grp_share(out,4,7):.1f}%  "
              f"cold+polar(D-late+E) {grp_share(base,21,30):.1f}->{grp_share(out,21,30):.1f}%")
print("done")
