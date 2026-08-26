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

MACHINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, MACHINE_ROOT)

from src.neural.path_network import PathNetwork
from src.pathfinding.pathfinder import apply_neural_weights, get_city_graph

CITY = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(MACHINE_ROOT, "models", "path_network.pth")

# A coordinate is snapped to the closest node of the street graph. Without a
# bound, a point anywhere in the country would still snap to some Taubate
# corner and produce a confident, meaningless route, so anything farther than
# this from the network is rejected as outside the covered area.
MAX_SNAP_DISTANCE_M = 2000


class RouteEngine:
    """Graph plus model, guarded by a lock so a reload cannot race a request."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._graph = None
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
            self._model_version = str(checkpoint.get("version", os.path.getmtime(MODEL_PATH)))
            self._loaded = True

    def reload(self) -> None:
        """Called after a training run replaces the .pth file."""
        self._loaded = False
        self.load()

    def _traverse(self, path: list, weight: str) -> tuple[float, float]:
        """Sum length and neural cost along a path, edge by edge."""
        distance_m = 0.0
        time_s = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge = min(
                self._graph[u][v].values(),
                key=lambda d: d.get(weight, float("inf")),
            )
            distance_m += edge.get("length", 0.0)
            time_s += edge.get("neural_cost", 0.0)

        return distance_m, time_s

    def _variant(self, origin_node, dest_node, weight: str) -> dict:
        path = nx.shortest_path(self._graph, origin_node, dest_node, weight=weight)
        distance_m, time_s = self._traverse(path, weight)

        return {
            "distance_meters": round(distance_m),
            "estimated_time_seconds": round(time_s, 2),
            "node_count": len(path),
            "geometry": [
                [self._graph.nodes[n]["y"], self._graph.nodes[n]["x"]] for n in path
            ],
        }

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

            return {
                "neural": self._variant(origin_node, dest_node, "neural_cost"),
                "shortest": self._variant(origin_node, dest_node, "length"),
                "model_version": self._model_version,
            }


engine = RouteEngine()
