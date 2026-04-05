"""
- apply_neural_weights usa extract_full_features (13 features),
  mantendo consistência exata com o que foi usado no treino
"""

import osmnx as ox
import networkx as nx
import torch
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork


def get_city_graph(city_name: str):
    print(f"  Carregando mapa de {city_name}...")
    return ox.graph_from_place(city_name, network_type="drive")


def apply_neural_weights(
    graph,
    model: PathNetwork,
    X_mean: torch.Tensor,
    X_std: torch.Tensor,
    y_mean: torch.Tensor,
    y_std: torch.Tensor,
) -> None:
    """
    Aplica os custos neurais em cada aresta do grafo.
    Usa as 13 features (base + vizinhança) para manter consistência
    com o treino — a rede nunca viu menos do que isso.
    """
    print("  Aplicando pesos da rede neural nas arestas do grafo...")

    for u, v, key, data in graph.edges(keys=True, data=True):
        # 13 features: mesmas do treino
        features = PathNetwork.extract_full_features(graph, v, data)
        x = torch.tensor(features, dtype=torch.float32)
        x_norm = (x - X_mean) / X_std

        with torch.no_grad():
            y_norm_val = model(x_norm.unsqueeze(0)).item()

        neural_cost = float(y_norm_val * y_std.item() + y_mean.item())
        neural_cost = max(neural_cost, 0.1)

        graph[u][v][key]["neural_cost"] = neural_cost


def find_best_path(graph, origin_coords: tuple, dest_coords: tuple) -> dict:
    origin_node = ox.nearest_nodes(graph, origin_coords[1], origin_coords[0])
    dest_node   = ox.nearest_nodes(graph, dest_coords[1],   dest_coords[0])

    path = nx.shortest_path(graph, origin_node, dest_node, weight="neural_cost")

    total_distance_m = 0.0
    total_time_s     = 0.0

    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = min(
            graph[u][v].values(),
            key=lambda d: d.get("neural_cost", float("inf")),
        )
        total_distance_m += edge_data.get("length", 0)
        total_time_s     += edge_data.get("neural_cost", 0)

    return {
        "path":        path,
        "distance_m":  total_distance_m,
        "distance_km": total_distance_m / 1000,
        "time_s":      total_time_s,
        "time_min":    total_time_s / 60,
    }