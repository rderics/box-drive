"""
build_limits.py — turns riga_roads.graphml (saved with the OSMnx library from OpenStreetMap) into a compact speed-limit map for the app.

  python tools/build_limits.py            ->  riga-limits.json   (+ prints coverage)

No third-party packages needed: the .graphml is plain XML. To refresh the graph itself (needs `pip install osmnx`):
  import osmnx as ox; G = ox.graph_from_place("Riga, Latvia", network_type="drive"); ox.save_graphml(G, "riga_roads.graphml")

Output (riga-limits.json):
  { "bbox": [minLat, minLon, maxLat, maxLon], "default": 50,
    "segs": [ [limit, srcFlag, "highway", [lat, lon, lat, lon, ...]], ... ] }
  srcFlag: 1 = the OSM `maxspeed` tag, 0 = assumed from the road type (no tag in OSM). Lists like "['50','30']" take the LOWER value (safer).
Assumed limits when OSM has no maxspeed (Latvian traffic rules: 50 km/h in built-up areas; living streets walking pace):
  living_street 20 · everything else 50.   (assumption, flagged srcFlag = 0)
"""
import json
import os
import re
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "riga_roads.graphml")
OUT = os.path.join(HERE, "..", "riga-limits.json")
NS = "{http://graphml.graphdrawing.org/xmlns}"


def parse_speed(v):
    nums = [int(n) for n in re.findall(r"\d+", v or "")]
    return min(nums) if nums else None


def main():
    root = ET.parse(SRC).getroot()
    keys = {k.get("id"): (k.get("for"), k.get("attr.name")) for k in root.iter(NS + "key")}
    g = root.find(NS + "graph")
    nodes = {}
    for n in g.iter(NS + "node"):
        d = {keys[x.get("key")][1]: x.text for x in n.iter(NS + "data")}
        nodes[n.get("id")] = (float(d["y"]), float(d["x"]))
    segs, seen = [], set()
    flags = {"tag": 0, "assumed": 0}
    for e in g.iter(NS + "edge"):
        d = {keys[x.get("key")][1]: x.text for x in e.iter(NS + "data")}
        a, b = e.get("source"), e.get("target")
        pair = (min(a, b), max(a, b), d.get("osmid"))
        if pair in seen:                       # two-way roads are stored twice
            continue
        seen.add(pair)
        hw = (d.get("highway") or "").strip("[]' ").split("'")[0] or "road"
        lim = parse_speed(d.get("maxspeed"))
        tagged = lim is not None
        if lim is None:
            lim = 20 if hw == "living_street" else 50
        flags["tag" if tagged else "assumed"] += 1
        if d.get("geometry"):
            pts = [tuple(map(float, p.split())) for p in re.findall(r"(-?\d+\.?\d*\s+-?\d+\.?\d*)", d["geometry"])]
            line = [(y, x) for x, y in pts]
        else:
            line = [nodes[a], nodes[b]]
        flat = [round(c, 5) for p in line for c in p]
        segs.append([lim, 1 if tagged else 0, hw, flat])
    lats = [c for s in segs for c in s[3][0::2]]
    lons = [c for s in segs for c in s[3][1::2]]
    out = {"bbox": [min(lats), min(lons), max(lats), max(lons)], "default": 50, "segs": segs}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"segments {len(segs)} (OSM maxspeed tag {flags['tag']}, assumed {flags['assumed']}), bbox {out['bbox']}, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
