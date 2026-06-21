#!/usr/bin/env python3
"""Best-estimate extrapolation of Köppen-Geiger maps beyond the published 2099
   horizon. NOT validated data — a transparent heuristic:

   * A monotonic 'warming ladder' maps each class to its warmer analog (cold/polar
     zones retreat toward temperate, temperate toward subtropical/tropical, cold
     drylands toward hot drylands). Ocean stays ocean.
   * The number of ladder steps applied to the 2071-2099 base map is scaled per
     scenario to the known post-2100 SSP temperature trajectories (SSP1 stabilises;
     SSP3/SSP5 keep warming strongly).
"""
import numpy as np, gzip, struct

# class value -> warmer-analog value (a 'one step of sustained warming' operator)
LADDER = {
 1:1, 2:2, 3:3,                       # tropical: already thermal max -> unchanged
 4:4, 5:4,                            # BWk -> BWh ; BWh stays
 6:6, 7:6,                            # BSk -> BSh ; BSh stays
 8:6, 9:8, 10:9,                      # Cs (Mediterranean) dries: Csa->BSh, Csb->Csa, Csc->Csb
 11:3, 12:11, 13:12,                  # Cw -> tropical savanna chain
 14:11, 15:14, 16:15,                 # Cf -> Cw -> ... (oceanic->humid subtropical->savanna)
 17:8, 18:17, 19:18, 20:19,           # Ds -> Cs chain
 21:11, 22:21, 23:22, 24:23,          # Dw -> Cw chain
 25:14, 26:25, 27:26, 28:27,          # Df -> Cf chain
 29:27, 30:29,                        # ET -> Dfc ; EF -> ET (polar retreat)
}
succ = np.arange(256, dtype=np.uint8)
for a, b in LADDER.items(): succ[a] = b
succ[0] = 0                            # ocean

# ladder steps beyond 2071-2099, per scenario, for [2101-2130, 2131-2160, 2161-2190]
STEPS = {
 "ssp119": [0, 0, 0],   # +1.5 °C world: peaks then stabilises/declines -> ~frozen at 2099
 "ssp126": [0, 0, 0],   # stabilises ~2 °C -> negligible further shift
 "ssp245": [1, 1, 2],   # slow continued warming
 "ssp370": [1, 2, 3],   # sustained warming
 "ssp585": [2, 3, 4],   # runaway fossil-fuelled warming
}
PERIODS = ["2101_2130", "2131_2160", "2161_2190"]

def read_kgz(path):
    with gzip.open(path, "rb") as f: raw = f.read()
    W, H = struct.unpack("<ii", raw[:8])
    return W, H, np.frombuffer(raw[8:], dtype=np.uint8)

def compose(n):
    lut = np.arange(256, dtype=np.uint8)
    for _ in range(n): lut = succ[lut]
    return lut

for ssp, steps in STEPS.items():
    W, H, base = read_kgz(f"../kg_2071_2099_{ssp}.kgz")
    for i, per in enumerate(PERIODS):
        out = compose(steps[i])[base]
        raw = struct.pack("<ii", W, H) + out.tobytes()
        with gzip.open(f"../kg_{per}_{ssp}.kgz", "wb", compresslevel=9) as f: f.write(raw)
        # report retreat of polar+continental (E+D) land share as a sanity signal
        landmask = base > 0
        share = lambda a: 100*np.count_nonzero((a>=21)&(a<=30)&landmask)/max(1,np.count_nonzero(landmask))
        print(f"kg_{per}_{ssp}.kgz  steps={steps[i]}  cold/polar(D-late+E) {share(base):.1f}%->{share(out):.1f}%")
print("done")
