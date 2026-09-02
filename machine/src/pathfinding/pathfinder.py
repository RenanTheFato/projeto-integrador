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

def edge_between(graph, u, v, weight: str) -> dict:
    """
    A aresta que o roteador realmente usa entre dois nos.

    O OSM liga o mesmo par de cruzamentos por mais de uma via com frequencia —
    uma marginal ao lado da avenida, uma alca de acesso, um viaduto e a rua por
    baixo dele. `shortest_path` devolve nos, nao arestas, entao a aresta precisa
    ser escolhida de novo aqui, e pelo mesmo peso com que o caminho foi achado:
    escolher por outro criterio faria a distancia relatada e a linha desenhada
    pertencerem a uma rua diferente da que a rota percorre.
    """
    return min(
        graph[u][v].values(),
        key=lambda d: d.get(weight, float("inf")),
    )

def edge_shape(graph, u, v, edge: dict) -> list[list[float]]:
    """
    O traçado real de uma rua, de `u` para `v`, como pares [latitude, longitude].

    E o que separa uma rota que segue a rua de uma que corta o quarteirao. O
    OSMnx simplifica o grafo antes de entrega-lo: uma rua curva sem nenhum
    entroncamento ao longo dela vira uma *unica* aresta entre os dois
    cruzamentos das pontas, e cada curva no meio sai do conjunto de nos e fica
    guardada no atributo `geometry` da aresta. Ligar os nos do caminho com
    segmentos retos desenha, portanto, a corda de cada curva — visivelmente fora
    da rua em qualquer zoom util para despachar. So as arestas que realmente sao
    retas nao tem o atributo, e para essas as duas pontas ja sao o traçado
    inteiro.
    """
    line = edge.get("geometry")

    if line is None:
        return [
            [graph.nodes[u]["y"], graph.nodes[u]["x"]],
            [graph.nodes[v]["y"], graph.nodes[v]["x"]],
        ]

    # O shapely guarda (x, y); o consumidor quer [latitude, longitude].
    shape = [[latitude, longitude] for longitude, latitude in line.coords]

    # A linha guardada segue o sentido em que a via foi digitalizada no OSM, que
    # nao e necessariamente o sentido em que esta aresta e percorrida. Comparar
    # a primeira ponta com `u` nao custa nada e evita que uma mao unica invertida
    # desenhe a rota de tras para frente por cima de si mesma.
    start = [graph.nodes[u]["y"], graph.nodes[u]["x"]]
    near_first = (start[0] - shape[0][0]) ** 2 + (start[1] - shape[0][1]) ** 2
    near_last = (start[0] - shape[-1][0]) ** 2 + (start[1] - shape[-1][1]) ** 2

    if near_first > near_last:
        shape.reverse()

    return shape

def path_geometry(graph, path: list, weight: str) -> list[list[float]]:
    """Costura o traçado de cada rua do caminho numa polilinha so."""
    if not path:
        return []

    geometry = [[graph.nodes[path[0]]["y"], graph.nodes[path[0]]["x"]]]

    for u, v in zip(path, path[1:]):
        edge = edge_between(graph, u, v, weight)
        # O primeiro ponto de cada rua e o ultimo da anterior, entao ele sai
        # para a linha nao ficar com pontos repetidos.
        geometry.extend(edge_shape(graph, u, v, edge)[1:])

    return geometry

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