#!/usr/bin/env python3
"""Convert Beck et al. (2023) 0.1° Köppen-Geiger class GeoTIFFs into compact
   uint8 class bins (one per period / scenario) for the Köppen Earth globe."""
import tifffile, numpy as np, struct, os

SRC = "kg/tif"
HIST = ["1901_1930", "1931_1960", "1961_1990", "1991_2020"]
FUT  = ["2041_2070", "2071_2099"]
SSP  = ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"]

def convert(tif, out):
    a = tifffile.imread(tif)                     # (1800, 3600) uint8, 0=ocean, 1..30 class
    assert a.dtype == np.uint8, a.dtype
    H, W = a.shape
    with open(out, "wb") as f:
        f.write(struct.pack("<ii", W, H))
        f.write(np.ascontiguousarray(a, dtype=np.uint8).tobytes())
    return W, H, os.path.getsize(out)

total = 0
for p in HIST:
    W, H, sz = convert(f"{SRC}/{p}/koppen_geiger_0p1.tif", f"../kg_{p}.bin")
    total += sz; print(f"kg_{p}.bin  {W}x{H}  {sz/1e6:.2f} MB")
for p in FUT:
    for s in SSP:
        W, H, sz = convert(f"{SRC}/{p}/{s}/koppen_geiger_0p1.tif", f"../kg_{p}_{s}.bin")
        total += sz; print(f"kg_{p}_{s}.bin  {W}x{H}  {sz/1e6:.2f} MB")
print(f"--- {total/1e6:.1f} MB total ---")

# sanity: class histogram for present-day
a = tifffile.imread(f"{SRC}/1991_2020/koppen_geiger_0p1.tif")
land = a[a > 0]
print("present-day land cells:", land.size, " classes present:", sorted(np.unique(land).tolist()))
