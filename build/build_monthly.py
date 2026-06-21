#!/usr/bin/env python3
"""Pack WorldClim 2.1 monthly normals (1970-2000) into one compact grid for the
   click inspector: temperature, max temp, rainfall, wind, sunshine, humidity.
   Output: ../climate_monthly.kgz  (gzip; header + int16 planes [var][month])."""
import tifffile, numpy as np, struct, gzip, os, zipfile, io

SRC_H, SRC_W = 1080, 2160
H, W = 360, 720          # 0.5°
BLK = 3
MONTH_J = [15,46,74,105,135,166,196,227,258,288,319,349]   # mid-month day-of-year

def read_var(v):
    """Return (12, SRC_H, SRC_W) float array, nodata -> NaN."""
    z = zipfile.ZipFile(f"clim2/{v}.zip")
    out = np.empty((12, SRC_H, SRC_W), np.float32)
    for m in range(12):
        name = [n for n in z.namelist() if n.endswith(f"_{m+1:02d}.tif")][0]
        a = tifffile.imread(io.BytesIO(z.read(name))).astype(np.float32)
        a[a < -1e30] = np.nan
        if v == "prec": a[a < 0] = np.nan
        out[m] = a
    return out

def block(a):
    with np.errstate(invalid='ignore'):
        return np.nanmean(a.reshape(H, BLK, W, BLK), axis=(1, 3))

print("reading variables…")
tavg = read_var("tavg"); tmax = read_var("tmax"); prec = read_var("prec")
wind = read_var("wind"); srad = read_var("srad"); vapr = read_var("vapr")

print("downsampling to 0.5°…")
with np.errstate(all='ignore'):
    T  = np.stack([block(tavg[m]) for m in range(12)])
    TX = np.stack([block(tmax[m]) for m in range(12)])
    P  = np.stack([block(prec[m]) for m in range(12)])
    Wd = np.stack([block(wind[m]) for m in range(12)])
    Sr = np.stack([block(srad[m]) for m in range(12)])   # kJ m-2 day-1
    Vp = np.stack([block(vapr[m]) for m in range(12)])   # kPa

land = ~np.isnan(T).all(axis=0)

# relative humidity from vapour pressure and mean temp
with np.errstate(all='ignore'):
    es = 0.6108 * np.exp(17.27 * T / (T + 237.3))        # saturation VP (kPa)
    RH = np.clip(100.0 * Vp / es, 0, 100)

# sunshine hours from solar radiation (FAO-56 Angström: Rs/Ra = a + b·n/N)
lat = np.radians(90 - (np.arange(H) + 0.5) / H * 180.0)  # (H,)
Sun = np.empty((12, H, W), np.float32)
Gsc = 0.0820
for m, J in enumerate(MONTH_J):
    dr  = 1 + 0.033 * np.cos(2*np.pi/365 * J)
    dec = 0.409 * np.sin(2*np.pi/365 * J - 1.39)
    x   = np.clip(-np.tan(lat) * np.tan(dec), -1, 1)
    ws  = np.arccos(x)                                    # sunset hour angle (H,)
    Ra  = (24*60/np.pi) * Gsc * dr * (ws*np.sin(lat)*np.sin(dec) + np.cos(lat)*np.cos(dec)*np.sin(ws))
    N   = (24/np.pi) * ws                                 # max daylight hours (H,)
    Rs  = Sr[m] / 1000.0                                  # kJ->MJ
    with np.errstate(all='ignore'):
        ratio = np.where(Ra[:,None] > 0.01, Rs / Ra[:,None], 0.0)
        n = np.clip(N[:,None] * (ratio - 0.25) / 0.50, 0, N[:,None])
    Sun[m] = n

# pack: vars order = temp, tmax, prec, wind, sunshine, humidity
VARS = [(T,10),(TX,10),(P,1),(Wd,10),(Sun,10),(RH,10)]
SENT = -32768
def plane(a, s):
    v = np.where(land, np.round(a*s), SENT)
    return np.clip(np.nan_to_num(v, nan=SENT), -32768, 32767).astype(np.int16)

buf = bytearray(struct.pack("<iiii", W, H, len(VARS), 12))
for arr, s in VARS:
    for m in range(12):
        buf += plane(arr[m], s).tobytes(order="C")

with gzip.open("../climate_monthly.kgz", "wb", compresslevel=9) as f:
    f.write(buf)
print(f"wrote ../climate_monthly.kgz  raw {len(buf)/1e6:.1f} MB -> "
      f"gz {os.path.getsize('../climate_monthly.kgz')/1e6:.2f} MB  ({int(land.sum())} land cells)")

# sanity: a few cities
def at(lon, lat_):
    x = int((lon+180)/360*W); y = int((90-lat_)/180*H)
    return x, y
for nm, lo, la in [("London",0,51.5),("Cairo",31,30),("Singapore",104,1.3),("Manaus",-60,-3)]:
    x,y = at(lo,la)
    print(f"  {nm:9s} Tjan={T[0,y,x]:.0f}/Tjul={T[6,y,x]:.0f}°C  "
          f"Pyr={np.nansum(P[:,y,x]):.0f}mm  RHjan={RH[0,y,x]:.0f}%  Sunjul={Sun[6,y,x]:.1f}h")
