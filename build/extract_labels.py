#!/usr/bin/env python3
"""Extract compact zoom-LOD labels from Natural Earth -> ../alphaclimate/labels.json
   Entry: [name, lat, lon, kind, ms]   kind: 0 ocean 1 country 2 state 3 city
   4 town 5 village 6 river 7 landmark.   ms = camera distance at/below which it shows."""
import json, math

def load(f): return json.load(open(f"ne/{f}.geojson"))["features"]
out = []
def add(name, lat, lon, kind, ms):
    if not name: return
    if lat is None or lon is None: return
    out.append([name, round(lat,2), round(lon,2), kind, round(ms,1)])

def ring_centroid(geom):
    pts = []
    g = geom["coordinates"]
    if geom["type"] == "Polygon": rings = [g[0]]
    else: rings = [poly[0] for poly in g]            # MultiPolygon outer rings
    rings.sort(key=len, reverse=True)
    for p in rings[0]: pts.append(p)
    if not pts: return None, None
    return (sum(p[1] for p in pts)/len(pts), sum(p[0] for p in pts)/len(pts))

# --- countries ---
for ft in load("ne_110m_admin_0_countries"):
    p = ft["properties"]; pop = p.get("POP_EST") or 0
    ms = 9 if pop>1e8 else 7.5 if pop>2e7 else 6 if pop>5e6 else 5
    add(p.get("NAME"), p.get("LABEL_Y"), p.get("LABEL_X"), 1, ms)

# --- states / provinces (50m = major only) ---
for ft in load("ne_50m_admin_1_states_provinces"):
    p = ft["properties"]; sr = p.get("scalerank") or 4
    add(p.get("name"), p.get("latitude"), p.get("longitude"), 2, max(2.4, 3.7 - sr*0.15))

# --- populated places ---
for ft in load("ne_10m_populated_places_simple"):
    p = ft["properties"]; pop = p.get("pop_max") or 0
    cap = "capital" in (p.get("featurecla") or "").lower()
    lat,lon = p.get("latitude"), p.get("longitude")
    if cap or pop>=2e5:
        ms = 7 if pop>5e6 else 5.5 if pop>1e6 else 4.2
        if cap: ms += 0.8
        add(p.get("name"), lat, lon, 3, ms)
    elif pop>=2e4:
        add(p.get("name"), lat, lon, 4, 2.8 if pop>=6e4 else 2.4)
    else:
        add(p.get("name"), lat, lon, 5, 1.95)

# --- rivers (named) ---
for ft in load("ne_10m_rivers_lake_centerlines"):
    p = ft["properties"]; nm = p.get("name")
    if not nm: continue
    g = ft["geometry"]
    lines = g["coordinates"] if g["type"]=="MultiLineString" else [g["coordinates"]]
    lines = [l for l in lines if l]
    if not lines: continue
    lines.sort(key=len, reverse=True)
    mid = lines[0][len(lines[0])//2]
    sr = p.get("scalerank") or 6
    add(nm, mid[1], mid[0], 6, max(2.6, 4.7 - sr*0.25))

# --- oceans / seas ---
for ft in load("ne_10m_geography_marine_polys"):
    p = ft["properties"]; fc = (p.get("featurecla") or "").lower()
    lat,lon = ring_centroid(ft["geometry"])
    ms = 9 if fc=="ocean" else 6.5 if fc=="sea" else 4 if any(k in fc for k in ("gulf","bay","strait","sound","channel")) else 3.5
    add(p.get("name"), lat, lon, 0, ms)

# --- landmarks: physical regions (capes, deserts, ranges, plains, etc.) ---
for ft in load("ne_10m_geography_regions_points"):
    p = ft["properties"]; c = ft["geometry"]["coordinates"]
    add(p.get("name"), c[1], c[0], 7, 3.3)

# --- landmarks: named peaks ---
for ft in load("ne_10m_geography_regions_elevation_points"):
    p = ft["properties"]; c = ft["geometry"]["coordinates"]; el = p.get("elevation") or 0
    nm = p.get("name") or p.get("name_en")
    add(nm, c[1], c[0], 7, 3.6 if el>4000 else 3.0 if el>2000 else 2.6)

json.dump(out, open("../alphaclimate/labels.json","w"), ensure_ascii=False, separators=(",",":"))
import os
kinds={}
for e in out: kinds[e[3]]=kinds.get(e[3],0)+1
print(f"wrote labels.json: {len(out)} labels, {os.path.getsize('../alphaclimate/labels.json')/1024:.0f} KB")
print("by kind (0ocean 1country 2state 3city 4town 5village 6river 7landmark):", dict(sorted(kinds.items())))
