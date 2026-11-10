"""Extract Nariño from the pinned source described in docs/cartografia/README.md.

Usage: python3 scripts/prepare-narino-cartography.py municipalities.geo.json
No activity data is read or modified. Anchors are interior label positions,
not execution sites or municipal seats.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parent.parent
names = re.findall(r'"([^"]+)"', (root / 'src/lib/domain.ts').read_text().split('export const MUNICIPALITIES = [')[1].split(']')[0])

def normalize(name):
    return ''.join(c for c in unicodedata.normalize('NFD', name.upper()) if unicodedata.category(c) != 'Mn')

canonical = {normalize(n): n for n in names}
aliases = {'CUASPUD CARLOSAMA': 'Cuaspud', 'SAN ANDRÉS DE TUMACO': 'Tumaco'}

def inside_ring(point, ring):
    x, y = point
    result = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            result = not result
    return result

def inside(point, polygon):
    return inside_ring(point, polygon[0]) and not any(inside_ring(point, hole) for hole in polygon[1:])

def segment_distance_squared(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
    return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2

def anchor(polygons):
    # A deterministic interior grid search keeps labels within their own polygon.
    def area(polygon):
        return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon[0],polygon[0][1:])))
    polygon = max(polygons, key=area)
    ring = polygon[0]
    xmin, xmax = min(p[0] for p in ring), max(p[0] for p in ring)
    ymin, ymax = min(p[1] for p in ring), max(p[1] for p in ring)
    candidates = [(xmin+(x+.5)*(xmax-xmin)/60, ymin+(y+.5)*(ymax-ymin)/60) for x in range(60) for y in range(60)]
    candidates = [p for p in candidates if inside(p, polygon)]
    point = max(candidates, key=lambda p: min(segment_distance_squared(p,a,b) for r in polygon for a,b in zip(r,r[1:])))
    point = [round(c, 6) for c in point]
    assert inside(point, polygon)
    return point

features = []
for feature in json.loads(Path(sys.argv[1]).read_text())['features']:
    props = feature['properties']
    if props['DPTO_CCDGO'] != '52':
        continue
    name = aliases.get(props['MPIO_CNMBR']) or canonical[normalize(props['MPIO_CNMBR'])]
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    features.append({'type': 'Feature', 'properties': {'code': props['MPIO_CDPMP'], 'name': name, 'anchor': anchor(polygons)}, 'geometry': geometry})
features.sort(key=lambda f: f['properties']['code'])
assert len(features) == 64 and {f['properties']['name'] for f in features} == set(names)
target = root / 'src/lib/narino-municipalities.json'
target.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':'))+'\n')
print(f'{len(features)} municipalities, {target.stat().st_size} bytes')
