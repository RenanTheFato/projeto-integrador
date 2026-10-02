"""
Response-time coverage over the street graph.

An isochrone answers "where can a vehicle leaving this station be in N
minutes", using the same predicted travel times the router uses. It is the
standard planning tool for fire services (NFPA 1710 sets 4 minutes of travel
for the first engine), and here it falls out of one Dijkstra run with a cutoff:
every edge the search reaches in time is part of the area, and the edge where
time runs out contributes only the fraction the vehicle can still cover.

The reached street lines are buffered into a polygon in metres. Drawing a
convex hull instead would paint the whole valley between two avenues as
covered, which is exactly the kind of confident lie a coverage map must avoid.
"""

import networkx as nx
import shapely
from shapely.geometry import LineString, MultiPolygon, Polygon, mapping
from shapely.ops import substring, transform

from api.geometry import LocalProjection
from src.pathfinding.pathfinder import edge_shape

# How far either side of a reached street still counts as covered. Roughly a
# hose lay plus the depth of a lot, so a house set back from the road is in.
STREET_BUFFER_M = 90.0
SIMPLIFY_M = 12.0

# The last metres from the snapped intersection to the actual point are not
# routed; they are priced at a slow urban speed so a far-off point is not
# counted as reached just because its nearest node is.
LAST_MILE_SPEED_MS = 25 / 3.6


def reach(graph, sources: list, weight: str, cutoff: float) -> dict:
    """Seconds from the nearest source to every node reachable within cutoff."""
    return nx.multi_source_dijkstra_path_length(graph, set(sources), cutoff=cutoff, weight=weight)


def _reached_lines(graph, times: dict, weight: str, limit: float, projection: LocalProjection):
    lines = []
    # A two-way street is two edges with the same drawing; fully reached
    # streets are kept once.
    whole: set[frozenset] = set()
    for u, start_time in times.items():
        if start_time > limit:
            continue
        for v, edges in graph[u].items():
            # Parallel edges: the router would take the cheapest one.
            edge = min(edges.values(), key=lambda data: data.get(weight, float("inf")))
            cost = float(edge.get(weight, 0.0))
            shape = edge_shape(graph, u, v, edge)
            line = LineString([projection.to_xy(lon, lat) for lat, lon in shape])
            if line.length == 0:
                continue

            if start_time + cost <= limit or cost <= 0:
                pair = frozenset((u, v))
                if pair not in whole:
                    whole.add(pair)
                    lines.append(line)
            else:
                fraction = (limit - start_time) / cost
                if fraction > 0.02:
                    lines.append(substring(line, 0, fraction, normalized=True))
    return lines


def isochrones(graph, sources: list, weight: str, minutes: list[int], projection: LocalProjection) -> list[dict]:
    """One GeoJSON (multi)polygon per threshold, smallest first."""
    thresholds = sorted(set(minutes))
    times = reach(graph, sources, weight, thresholds[-1] * 60.0)

    result = []
    for threshold in thresholds:
        lines = _reached_lines(graph, times, weight, threshold * 60.0, projection)
        if lines:
            # Buffering each line on its own and merging the results is about
            # thirty times faster than buffering one MultiLineString, which
            # makes GEOS union the pieces pairwise as it goes.
            simplified = shapely.simplify(lines, SIMPLIFY_M)
            area = shapely.union_all(shapely.buffer(simplified, STREET_BUFFER_M, quad_segs=2)).simplify(SIMPLIFY_M)
        else:
            area = Polygon()

        if isinstance(area, Polygon) and not area.is_empty:
            area = MultiPolygon([area])

        geographic = transform(lambda x, y, z=None: projection.to_lonlat(x, y), area) if not area.is_empty else area

        result.append({
            "minutes": threshold,
            "area_km2": round(area.area / 1_000_000, 2),
            "reached_nodes": sum(1 for value in times.values() if value <= threshold * 60.0),
            "geometry": mapping(geographic) if not geographic.is_empty else None,
        })

    return result


def point_times(times: dict, snapped: list[tuple]) -> list[float | None]:
    """
    Travel time to each point, given the snap of every point to the graph.

    `snapped` holds (node, distance_m) pairs, with node None for points outside
    the covered area.
    """
    output = []
    for node, distance in snapped:
        if node is None or node not in times:
            output.append(None)
        else:
            output.append(round(times[node] + distance / LAST_MILE_SPEED_MS, 1))
    return output
