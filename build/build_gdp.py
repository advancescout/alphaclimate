#!/usr/bin/env python3
"""Artistic 'wealth-as-climate' layer: assign each country (and Spanish region) a
   Köppen code by GDP per capita, per the user's spec. Rasterise to the 0.1° grid.
   Outputs ../alphaclimate/gdp_2000.kgz and gdp_1960.kgz (kg format)."""
import json, struct, gzip
from PIL import Image, ImageDraw

W,H=3600,1800
C={"Af":1,"Am":2,"Aw":3,"BWh":4,"BWk":5,"BSh":6,"BSk":7,"Csa":8,"Csb":9,"Csc":10,
   "Cwa":11,"Cwb":12,"Cwc":13,"Cfa":14,"Cfb":15,"Cfc":16,"Dsa":17,"Dsb":18,"Dsc":19,"Dsd":20,
   "Dwa":21,"Dwb":22,"Dwc":23,"Dwd":24,"Dfa":25,"Dfb":26,"Dfc":27,"Dfd":28,"ET":29,"EF":30}

# --- explicit per-country assignments (user spec) ---
EX={ "United States of America":"BWh","Canada":"BWh","Mexico":"BSk",
 "United Kingdom":"BWh","Belgium":"BWh","Netherlands":"BWh","Germany":"BWh","France":"BWh",
 "Italy":"BWk","Portugal":"BWk","Greece":"BWk","Spain":"BSh",
 "Ireland":"BWk","Luxembourg":"BWh","Switzerland":"BWh","Austria":"BWk","Denmark":"BWh",
 "Norway":"BWh","Sweden":"BWk","Finland":"BWk","Iceland":"BWk",
 "Poland":"Dwa","Czechia":"Cwa","Slovakia":"Cwa","Hungary":"Cwa","Slovenia":"Cwa","Croatia":"Cwa",
 "Serbia":"Cwa","Bosnia and Herz.":"Cwb","Montenegro":"Cwb","Macedonia":"Cwb","North Macedonia":"Cwb",
 "Albania":"Cwb","Kosovo":"Cwb","Bulgaria":"Cwa","Romania":"Cwa","Moldova":"Cwc",
 "Ukraine":"Cwa","Belarus":"Cwb","Lithuania":"Cwa","Latvia":"Cwa","Estonia":"Cwa","Russia":"BSh",
 "China":"Cfb","Japan":"BWh","South Korea":"Csa","North Korea":"Dwc","Taiwan":"BSk",
 "India":"Cfc","Bangladesh":"Cfc","Nepal":"Cfc","Bhutan":"Cfc","Sri Lanka":"Csc",
 "Pakistan":"Dwc","Afghanistan":"Dwd","Mongolia":"Dwc",
 "Indonesia":"Cfb","Malaysia":"Csb","Singapore":"BWh","Thailand":"Cfb","Vietnam":"Cfc",
 "Philippines":"Cfc","Myanmar":"Csc","Cambodia":"Csc","Laos":"Csc",
 "Kazakhstan":"Cwb","Uzbekistan":"Cwc","Turkmenistan":"Cwb","Kyrgyzstan":"Cwc","Tajikistan":"Dwc",
 "Azerbaijan":"Cwb","Armenia":"Cwc","Georgia":"Cwb",
 "Turkey":"BSk","Iran":"BSh","Iraq":"BSk","Syria":"BSk","Yemen":"BSk","Jordan":"BSk","Lebanon":"BSk",
 "Israel":"BWh","Saudi Arabia":"BWh","United Arab Emirates":"BWh","Qatar":"BWh","Kuwait":"BWh",
 "Bahrain":"BWh","Oman":"BWh",
 "Argentina":"BSk","Brazil":"BSk","Chile":"BSk","Uruguay":"Csb","Paraguay":"Cfb","Bolivia":"Dwc",
 "Peru":"Cfb","Colombia":"Cfb","Venezuela":"Cfb","Ecuador":"Cfb",
 "Australia":"BWh","New Zealand":"BWk" }

def gdp_ladder(pc):
    if pc>=50000: return "BWh"
    if pc>=35000: return "BWk"
    if pc>=22000: return "BSh"
    if pc>=12000: return "BSk"
    if pc>=6000:  return "Cfb"
    if pc>=3000:  return "Cfc"
    if pc>=1500:  return "Dwc"
    return "Csc"

def classify(p):
    nm=p.get("NAME")
    if nm in EX: return C[EX[nm]]
    cont=p.get("CONTINENT"); sub=p.get("SUBREGION") or ""; inc=p.get("INCOME_GRP") or ""
    if cont=="Africa":
        if "Northern Africa" in sub: return C["BSk"]
        return C["Dsc"] if inc.startswith("5") else C["Csc"]   # poorest -> Dsc
    if sub=="Caribbean": return C["Dfc"]
    if nm=="Antarctica": return C["EF"]
    if nm=="Greenland": return C["EF"]
    pop=p.get("POP_EST") or 0; g=p.get("GDP_MD") or 0
    pc=(g*1e6/pop) if pop else 0
    return C[gdp_ladder(pc)]

def ll2xy(lon,lat): return ((lon+180)/360.0*W, (90-lat)/180.0*H)
def rings(geom):
    t=geom["type"]; g=geom["coordinates"]
    if t=="Polygon": return [g[0]]
    if t=="MultiPolygon": return [poly[0] for poly in g]
    return []
def draw_feature(d, geom, val):
    for ring in rings(geom):
        xs=[ll2xy(x,y) for x,y in ring]
        lons=[p[0] for p in xs]
        if max(lons)-min(lons) > W*0.6:   # antimeridian wrap -> split into both sides
            left =[(x if x<=W/2 else x-W, y) for x,y in xs]
            right=[(x if x> W/2 else x+W, y) for x,y in xs]
            if len(left) >=3: d.polygon(left, fill=val)
            if len(right)>=3: d.polygon(right, fill=val)
        elif len(xs)>=3:
            d.polygon(xs, fill=val)

print("rasterising countries…")
img=Image.new("L",(W,H),0); d=ImageDraw.Draw(img)
feats=json.load(open("ne/ne_50m_admin_0_countries.geojson"))["features"]
# big countries first so small ones land on top
def area(ft):
    xs=[]; ys=[]
    for r in rings(ft["geometry"]):
        for x,y in r: xs.append(x); ys.append(y)
    return (max(xs)-min(xs))*(max(ys)-min(ys)) if xs else 0
for ft in sorted(feats,key=area,reverse=True):
    draw_feature(d, ft["geometry"], classify(ft["properties"]))

# --- Spain sub-national (user spec) ---
SP_BWh={"madrid","navarr","catal"}            # richest
SP_BWk={"vasco","basque","balear","rioja","arag","galici","cantabr"}
def sp_class(name):
    n=name.lower()
    if any(k in n for k in SP_BWh): return C["BWh"]
    if any(k in n for k in SP_BWk): return C["BWk"]
    return C["BSh"]
a1=json.load(open("ne/sp10.geojson"))["features"]
ns=0
for ft in a1:
    pr=ft["properties"]
    if pr.get("admin")=="Spain":
        draw_feature(d, ft["geometry"], sp_class(pr.get("name") or pr.get("name_local") or "")); ns+=1
print(f"  Spain regions drawn: {ns}")

g2000=bytearray(img.tobytes())                # uint8 grid, row-major
# --- 1960 slide: a frozen world (ET, EF poleward) on the same land footprint ---
g1960=bytearray(len(g2000))
EFv,ETv=C["EF"],C["ET"]
for r in range(H):
    lat=90-(r+0.5)/H*180; base=EFv if abs(lat)>=60 else ETv
    row=r*W
    for c in range(W):
        if g2000[row+c]: g1960[row+c]=base

def write(path, data):
    with gzip.open(path,"wb",compresslevel=9) as f:
        f.write(struct.pack("<ii",W,H)); f.write(bytes(data))
    import os; print(f"  wrote {path} ({os.path.getsize(path)/1e6:.2f} MB)")
write("../alphaclimate/gdp_2000.kgz", g2000)
write("../alphaclimate/gdp_1960.kgz", g1960)
land=sum(1 for v in g2000 if v)
print(f"done. land cells: {land}")
