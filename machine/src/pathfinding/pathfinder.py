"""
Inferência com o modelo GAT + MLP.

apply_neural_weights reconstrói os tensores do grafo inteiro,
executa o forward pass uma única vez (eficiente) e grava o
neural_cost em cada aresta — exatamente como antes, mas agora
usando o novo modelo.
"""

import os
import sys

import torch
import osmnx as ox
import networkx as nx

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork

def get_city_graph(city_name: str):
    print(f"  Carregando mapa de {city_name}...")
    return ox.graph_from_place(city_name, network_type="drive")

def _build_inference_tensors(graph):
    """
    Mesma lógica de remapeamento do train.py, sem calcular labels.
    Retorna tensores prontos para o forward pass + estrutura de índices
    para gravar os custos de volta nas arestas.
    """
    node_list   = list(graph.nodes())
    node_to_idx = {node: idx for idx, node in enumerate(node_list)}
    N = len(node_list)

    src_list, dst_list, key_list = [], [], []
    edge_feats_list = []

    for u, v, key, data in graph.edges(keys=True, data=True):
        features = PathNetwork.extract_edge_features(data)
        src_list.append(node_to_idx[u])
        dst_list.append(node_to_idx[v])
        key_list.append((u, v, key))
        edge_feats_list.append(features)

    edge_index = torch.tensor([src_list, dst_list], dtype=torch.long)
    edge_feats = torch.tensor(edge_feats_list, dtype=torch.float32)

    # Features de nó: média das arestas de saída
    node_feat_acc   = torch.zeros(N, PathNetwork.EDGE_FEAT_SIZE)
    node_edge_count = torch.zeros(N, 1)
    for e_idx, (u_idx, _) in enumerate(zip(src_list, dst_list)):
        node_feat_acc[u_idx]   += edge_feats[e_idx]
        node_edge_count[u_idx] += 1.0
    node_edge_count = node_edge_count.clamp(min=1.0)
    node_feats = node_feat_acc / node_edge_count

    return edge_index, edge_feats, node_feats, key_list

def apply_neural_weights(
    graph,
    model: PathNetwork,
    nf_mean: torch.Tensor, nf_std: torch.Tensor,
    ef_mean: torch.Tensor, ef_std: torch.Tensor,
    y_mean:  torch.Tensor, y_std:  torch.Tensor,
) -> None:
    """
    Executa um único forward pass no grafo inteiro e grava neural_cost
    em cada aresta. Muito mais eficiente do que um loop aresta-por-aresta.
    """
    print("  Aplicando pesos da rede neural nas arestas do grafo...")

    edge_index, edge_feats, node_feats, key_list = _build_inference_tensors(graph)

    # Normaliza com as estatísticas salvas no treino
    node_feats_n = (node_feats - nf_mean) / nf_std
    edge_feats_n = (edge_feats - ef_mean) / ef_std

    model.eval()
    with torch.no_grad():
        preds_n = model(node_feats_n, edge_index, edge_feats_n)  # [E, 1]

    # Desnormaliza
    preds = preds_n * y_std + y_mean   # [E, 1]

    # Grava nas arestas
    for e_idx, (u, v, key) in enumerate(key_list):
        cost = max(float(preds[e_idx].item()), 0.1)
        graph[u][v][key]["neural_cost"] = cost

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