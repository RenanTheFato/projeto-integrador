"""
Holds the loaded street graph and the trained network in memory.

Loading the Taubate graph from OpenStreetMap and running the GAT over every
edge takes tens of seconds. Doing that per request would make the API useless,
so it happens once at startup and every route calculation reuses the result.
"""

import os
import sys
import threading

import networkx as nx
import osmnx as ox
import torch
from shapely.geometry import LineString

MACHINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, MACHINE_ROOT)

from src.neural.path_network import PathNetwork
from src.pathfinding.pathfinder import (
    apply_neural_weights,
    edge_between,
    get_city_graph,
    path_geometry,
)

CITY = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(MACHINE_ROOT, "models", "path_network.pth")

# A coordinate is snapped to the closest node of the street graph. Without a
# bound, a point anywhere in the country would still snap to some Taubate
# corner and produce a confident, meaningless route, so anything farther than
# this from the network is rejected as outside the covered area.
MAX_SNAP_DISTANCE_M = 2000

CRITICAL_COST_FACTOR: dict[str, float] = {
    "motorway": 0.94, "motorway_link": 0.96,
    "trunk": 0.93, "trunk_link": 0.95,
    "primary": 0.91, "primary_link": 0.94,
    "secondary": 0.92, "secondary_link": 0.95,
    "tertiary": 0.94, "tertiary_link": 0.96,
    "residential": 0.97, "living_street": 0.99,
    "service": 0.98, "unclassified": 0.96, "road": 0.96,
}
CRITICAL_SPEED_CAP_KMH: dict[str, float] = {
    "motorway": 130.0, "motorway_link": 80.0,
    "trunk": 110.0, "trunk_link": 75.0,
    "primary": 90.0, "primary_link": 70.0,
    "secondary": 80.0, "secondary_link": 65.0,
    "tertiary": 70.0, "tertiary_link": 60.0,
    "residential": 50.0, "living_street": 35.0,
    "service": 35.0, "unclassified": 55.0, "road": 55.0,
}
CRITICAL_REVERSE_TYPES = {
    "primary", "secondary", "tertiary",
    "residential", "unclassified", "service", "road",
}
RESTRICTED_ACCESS = {"no", "private"}
SHOULDER_VALUES = {"yes", "both", "left", "right", "paved", "designated"}


def _first(value, default=None):
    if isinstance(value, list):
        return value[0] if value else default
    return value if value is not None else default


def _number(value, default: float = 0.0) -> float:
    raw = _first(value, default)
    try:
        return float(str(raw).split(";")[0].split()[0])
    except (TypeError, ValueError, AttributeError):
        return default


class RouteEngine:
    """Graph plus model, guarded by a lock so a reload cannot race a request."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._graph = None
        self._critical_graph = None
        self._model_version: str | None = None
        self._loaded = False

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def model_version(self) -> str | None:
        return self._model_version

    @property
    def graph_size(self) -> tuple[int, int]:
        if not self._loaded:
            return (0, 0)
        return (self._graph.number_of_nodes(), self._graph.number_of_edges())

    @property
    def bounds(self) -> dict | None:
        """
        The rectangle the loaded street network actually spans.

        The place polygon and the drivable network are not the same thing: the
        rural north of the municipality has almost no mapped roads, so a point
        can be inside Taubate and still be far from anything routable. Exposing
        the real extent lets the interface say where a point may be dropped
        instead of leaving the dispatcher to discover it from a rejection.
        """
        if not self._loaded:
            return None

        latitudes = [data["y"] for _, data in self._graph.nodes(data=True)]
        longitudes = [data["x"] for _, data in self._graph.nodes(data=True)]

        return {
            "min_latitude": min(latitudes),
            "max_latitude": max(latitudes),
            "min_longitude": min(longitudes),
            "max_longitude": max(longitudes),
            "max_snap_distance_m": MAX_SNAP_DISTANCE_M,
        }

    @staticmethod
    def _highway(edge: dict) -> str:
        return str(_first(edge.get("highway"), "unclassified")).strip()

    @staticmethod
    def _has_shoulder(edge: dict) -> bool:
        values = [
            edge.get("shoulder"),
            edge.get("shoulder:both"),
            edge.get("shoulder:left"),
            edge.get("shoulder:right"),
        ]
        return any(str(_first(value, "")).lower() in SHOULDER_VALUES for value in values)

    def _critical_edge_cost(self, edge: dict) -> float:
        """
        Emergency-operational cost for a legal-direction edge.

        This never invents a lane or cuts across unmapped space. It only
        discounts an already drivable OSM edge, with hard speed floors so the
        route cannot imply physically absurd travel times.
        """
        highway = self._highway(edge)
        length = max(float(edge.get("length", 0.0)), 0.0)
        base = max(float(edge.get("neural_cost", 0.1)), 0.1)

        factor = CRITICAL_COST_FACTOR.get(highway, 0.96)

        lanes = max(1.0, _number(edge.get("lanes"), 1.0))
        if lanes >= 3:
            factor *= 0.93
        elif lanes >= 2:
            factor *= 0.96

        if self._has_shoulder(edge) and highway in {
            "motorway", "motorway_link", "trunk", "trunk_link",
            "primary", "primary_link", "secondary", "secondary_link",
        }:
            # A mapped usable shoulder can provide an escape corridor in a
            # critical response. The geometry remains the mapped roadway.
            factor *= 0.88
            edge["critical_uses_shoulder"] = True

        if str(_first(edge.get("emergency"), "")).lower() in {"yes", "designated"}:
            factor *= 0.92

        speed_cap = CRITICAL_SPEED_CAP_KMH.get(highway, 55.0)
        physical_floor = length / max(speed_cap / 3.6, 0.1)

        # The critical profile gets only a modest advantage on an ordinary
        # edge. The large savings should come from an actual operational
        # exception (counterflow/shoulder), otherwise every route would look
        # artificially superior even when it follows the same streets.
        return max(base * factor, physical_floor, 0.1)

    def _can_reverse_for_critical(self, edge: dict) -> bool:
        """
        Conservative counterflow eligibility.

        It is limited to lower-speed urban roads where the map describes enough
        paved width to make the maneuver representable. Highways, roundabouts,
        bridges and tunnels are deliberately excluded.
        """
        oneway = str(_first(edge.get("oneway"), False)).lower() in {"true", "yes", "1"}
        if not oneway:
            return False

        highway = self._highway(edge)
        if highway not in CRITICAL_REVERSE_TYPES:
            return False

        if str(_first(edge.get("junction"), "")).lower() == "roundabout":
            return False

        if str(_first(edge.get("bridge"), "")).lower() not in {"", "no", "false", "none"}:
            return False

        if str(_first(edge.get("tunnel"), "")).lower() not in {"", "no", "false", "none"}:
            return False

        access = str(_first(edge.get("access"), "")).lower()
        motor_vehicle = str(_first(edge.get("motor_vehicle"), "")).lower()
        vehicle = str(_first(edge.get("vehicle"), "")).lower()
        if access in RESTRICTED_ACCESS or motor_vehicle in RESTRICTED_ACCESS or vehicle in RESTRICTED_ACCESS:
            return False

        lanes = max(1.0, _number(edge.get("lanes"), 1.0))
        width = _number(edge.get("width"), _number(edge.get("est_width"), 0.0))
        mapped_speed = _number(edge.get("maxspeed"), 0.0)

        # Counterflow needs evidence of physical room. Treating every
        # one-way residential street as reversible made the critical graph
        # unrealistically permissive. A mapped multi-lane carriageway or an
        # explicit usable width is required; higher-class urban roads get a
        # slightly wider threshold.
        if highway in {"primary", "secondary"}:
            wide_enough = lanes >= 2 or width >= 6.0
        elif highway == "tertiary":
            wide_enough = lanes >= 2 or width >= 5.5
        else:
            wide_enough = lanes >= 2 or width >= 5.0

        speed_ok = mapped_speed <= 60.0 or mapped_speed == 0.0
        return wide_enough and speed_ok

    def _build_critical_graph(self, graph):
        critical = graph.copy()

        # First assign the operational weight to every normal-direction edge.
        for _, _, _, edge in critical.edges(keys=True, data=True):
            edge["critical_uses_shoulder"] = False
            edge["critical_reverse"] = False
            edge["critical_cost"] = self._critical_edge_cost(edge)

        # Then add a small, explicit set of synthetic reverse edges. These are
        # intentionally penalized so a lawful direction wins unless counterflow
        # materially shortens a critical response.
        additions = []
        for u, v, key, edge in graph.edges(keys=True, data=True):
            if not self._can_reverse_for_critical(edge):
                continue

            reversed_edge = dict(edge)
            geometry = edge.get("geometry")
            if geometry is not None:
                reversed_edge["geometry"] = LineString(list(geometry.coords)[::-1])

            reversed_edge["oneway"] = False
            reversed_edge["critical_reverse"] = True
            reversed_edge["critical_uses_shoulder"] = False
            # Counterflow cannot reuse the model's normal-direction traffic
            # estimate: that estimate contains congestion/intersection behaviour
            # for ordinary traffic and made the synthetic reverse edge too
            # expensive to ever matter. Price the maneuver from physical road
            # length and the emergency speed cap, then add a 12% caution margin.
            highway = self._highway(reversed_edge)
            reverse_length = max(float(reversed_edge.get("length", 0.0)), 0.0)
            reverse_speed = CRITICAL_SPEED_CAP_KMH.get(highway, 50.0)
            reverse_floor = reverse_length / max(reverse_speed / 3.6, 0.1)
            # Entering a road against its mapped direction is not a free
            # shortcut: slowing, checking visibility and clearing opposing
            # traffic costs time. A fixed manoeuvre penalty prevents the router
            # from chaining dozens of tiny one-way reversals just because each
            # individual edge is physically short.
            reversed_edge["critical_cost"] = max(reverse_floor * 1.12 + 8.0, 0.1)

            additions.append((v, u, f"critical-reverse-{key}", reversed_edge))

        for u, v, key, edge in additions:
            critical.add_edge(u, v, key=key, **edge)

        return critical

    def load(self) -> None:
        """Download the graph, load the checkpoint and weight every edge."""
        with self._lock:
            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(
                    f"Trained model not found at {MODEL_PATH}. "
                    "Run: poetry run python src/pathfinding/train.py"
                )

            graph = get_city_graph(CITY)
            checkpoint = torch.load(MODEL_PATH, weights_only=True)

            model = PathNetwork(
                edge_feat_size=checkpoint["edge_feat_size"],
                node_feat_size=checkpoint["node_feat_size"],
                gat_hidden=checkpoint["gat_hidden"],
                gat_heads=checkpoint["gat_heads"],
                gat_out_dim=checkpoint["gat_out_dim"],
                mlp_hidden=checkpoint["mlp_hidden"],
            )
            model.load_state_dict(checkpoint["model_state_dict"])
            model.eval()

            apply_neural_weights(
                graph, model,
                checkpoint["nf_mean"], checkpoint["nf_std"],
                checkpoint["ef_mean"], checkpoint["ef_std"],
                checkpoint["y_mean"], checkpoint["y_std"],
            )

            self._graph = graph
            self._critical_graph = self._build_critical_graph(graph)
            self._model_version = str(checkpoint.get("version", os.path.getmtime(MODEL_PATH)))
            self._loaded = True

    def reload(self) -> None:
        """Called after a training run replaces the .pth file."""
        self._loaded = False
        self.load()

    def _variant(self, graph, origin_node, dest_node, weight: str) -> dict:
        """
        One route, with its numbers and the line that draws it.

        Distance and geometry are accumulated in the same walk over the path so
        that they can never disagree: both read from the edge `edge_between`
        picked, and the drawn line now measures the same as the distance it
        reports, because it follows the same curves the length was measured
        along.
        """
        path = nx.shortest_path(graph, origin_node, dest_node, weight=weight)

        distance_m = 0.0
        time_s = 0.0
        reverse_segments = 0
        shoulder_segments = 0
        time_weight = "critical_cost" if weight == "critical_cost" else "neural_cost"

        for u, v in zip(path, path[1:]):
            edge = edge_between(graph, u, v, weight)
            distance_m += edge.get("length", 0.0)
            time_s += edge.get(time_weight, edge.get("neural_cost", 0.0))
            if edge.get("critical_reverse"):
                reverse_segments += 1
            if edge.get("critical_uses_shoulder"):
                shoulder_segments += 1

        result = {
            "distance_meters": round(distance_m),
            "estimated_time_seconds": round(time_s, 2),
            # The number of intersections, not of drawn points: it is what the
            # interface labels "cruzamentos".
            "node_count": len(path),
            "geometry": path_geometry(graph, path, weight),
        }

        if weight == "critical_cost":
            result["critical_maneuvers"] = {
                "counterflow_segments": reverse_segments,
                "shoulder_segments": shoulder_segments,
            }

        return result

    def _snap(self, point: tuple[float, float], label: str):
        """Map a coordinate onto the nearest graph node, refusing far-away ones."""
        node, distance_m = ox.nearest_nodes(
            self._graph, point[1], point[0], return_dist=True
        )

        if distance_m > MAX_SNAP_DISTANCE_M:
            raise ValueError(
                f"The {label} is {round(distance_m)} m away from the nearest mapped "
                f"street, outside the area covered by {CITY}"
            )

        return node

    def calculate(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        critical_mode: bool = False,
    ) -> dict:
        """
        Return both routes: the neural one (weighted by predicted travel time)
        and the shortest one in metres. Returning both is what lets the client
        show the comparison this project exists to demonstrate.
        """
        with self._lock:
            if not self._loaded:
                raise RuntimeError("The route engine is still loading")

            origin_node = self._snap(origin, "origin")
            dest_node = self._snap(destination, "destination")

            if not nx.has_path(self._graph, origin_node, dest_node):
                raise ValueError("No route exists between these two points")

            normal = self._variant(
                self._graph,
                origin_node,
                dest_node,
                "neural_cost",
            )
            critical = self._variant(
                self._critical_graph,
                origin_node,
                dest_node,
                "critical_cost",
            ) if critical_mode else None

            return {
                "neural": normal,
                "critical": critical,
                "shortest": self._variant(
                    self._graph,
                    origin_node,
                    dest_node,
                    "length",
                ),
                "critical_mode": critical_mode,
                "model_version": self._model_version,
            }


engine = RouteEngine()
