import osmnx as ox
import networkx as nx
import torch
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork


def get_city_graph(city_name: str):
    """Baixa o grafo de ruas da cidade via OpenStreetMap."""
    print(f"  Carregando mapa de {city_name}...")
    graph = ox.graph_from_place(city_name, network_type="drive")
    return graph


def apply_neural_weights(
    graph,
    model: PathNetwork,
    X_mean: torch.Tensor,
    X_std: torch.Tensor,
    y_mean: torch.Tensor,
    y_std: torch.Tensor,
) -> None:
    """
    Aplica os pesos da rede neural em cada aresta do grafo.
    Normaliza as features com os mesmos parâmetros usados no treinamento
    e desnormaliza a saída para obter o tempo real em segundos.
    """
    print("  Aplicando pesos da rede neural nas arestas do grafo...")
    for u, v, key, data in graph.edges(keys=True, data=True):
        features = PathNetwork.extract_edge_features(data)
        x = torch.tensor(features, dtype=torch.float32)
        x_norm = (x - X_mean) / X_std
        with torch.no_grad():
            y_norm = model(x_norm.unsqueeze(0)).item()

        # Desnormalizar: reverter para segundos reais
        neural_cost = float(y_norm * y_std.item() + y_mean.item())

        # Garantir que o custo nunca seja negativo
        neural_cost = max(neural_cost, 0.1)

        graph[u][v][key]["neural_cost"] = neural_cost


def find_best_path(graph, origin_coords: tuple, dest_coords: tuple) -> dict:
    """
    Calcula a melhor rota usando os pesos da rede neural.

    Args:
        graph: Grafo de ruas com pesos neurais aplicados
        origin_coords: (latitude, longitude) do ponto de bombeiros
        dest_coords: (latitude, longitude) da ocorrência

    Returns:
        dict com path, distância total e tempo estimado
    """
    origin_node = ox.nearest_nodes(graph, origin_coords[1], origin_coords[0])
    dest_node = ox.nearest_nodes(graph, dest_coords[1], dest_coords[0])

    path = nx.shortest_path(graph, origin_node, dest_node, weight="neural_cost")

    total_distance_m = 0.0
    total_time_s = 0.0

    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = min(graph[u][v].values(), key=lambda d: d.get("neural_cost", 0))
        total_distance_m += edge_data.get("length", 0)
        total_time_s += edge_data.get("neural_cost", 0)

    return {
        "path": path,
        "distance_m": total_distance_m,
        "distance_km": total_distance_m / 1000,
        "time_s": total_time_s,
        "time_min": total_time_s / 60,
    }