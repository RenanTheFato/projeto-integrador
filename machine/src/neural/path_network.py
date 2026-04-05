"""
- Input passa de 9 para 13 features
- 4 novas features de vizinhança do nó destino:
    [9]  velocidade média das arestas que chegam ao nó destino
    [10] fração de arestas de saída do nó destino que são vias rápidas
         (motorway, trunk, primary)
    [11] grau normalizado do nó destino (grau / 8.0)
    [12] fração de arestas de entrada que são da mesma categoria
         hierárquica da aresta atual — mede continuidade de via
"""

import torch
import torch.nn as nn


class PathNetwork(nn.Module):
    """
    Estima o custo de travessia de uma aresta do grafo OSMnx em segundos.

    Features de entrada (13 no total):
        [0]  length          — comprimento em metros
        [1]  speed_kmh       — velocidade inferida por tipo de via em km/h
        [2]  lanes           — número de faixas
        [3]  oneway          — 1.0 se mão única, 0.0 caso contrário
        [4-8]                — one-hot do grupo de tipo de via (5 grupos)
        [9]  avg_in_speed    — velocidade média das arestas que chegam ao nó destino
        [10] fast_out_ratio  — fração de saídas do nó destino que são vias rápidas
        [11] norm_degree     — grau do nó destino normalizado por 8
        [12] continuity      — fração de entradas do mesmo grupo hierárquico da aresta
    """

    DEFAULT_SPEED: dict[str, float] = {
        "motorway":         80.0,
        "motorway_link":    60.0,
        "trunk":            70.0,
        "trunk_link":       50.0,
        "primary":          60.0,
        "primary_link":     50.0,
        "secondary":        50.0,
        "secondary_link":   40.0,
        "tertiary":         40.0,
        "tertiary_link":    35.0,
        "residential":      30.0,
        "living_street":    20.0,
        "service":          25.0,
        "unclassified":     35.0,
        "road":             35.0,
    }
    DEFAULT_SPEED_FALLBACK = 30.0

    HIGHWAY_GROUP: dict[str, int] = {
        "motorway":      0,
        "motorway_link": 0,
        "trunk":         0,
        "trunk_link":    0,
        "primary":       1,
        "primary_link":  1,
        "secondary":     2,
        "secondary_link":2,
        "tertiary":      3,
        "tertiary_link": 3,
    }
    # grupo 4 = residencial, service, living_street, unclassified, road, outros

    # Vias consideradas "rápidas" para o fast_out_ratio
    FAST_HIGHWAY_TYPES = {
        "motorway", "motorway_link", "trunk", "trunk_link",
        "primary", "primary_link",
    }

    NUM_HIGHWAY_GROUPS = 5
    NUM_NEIGHBOR_FEATURES = 4
    INPUT_SIZE = 4 + NUM_HIGHWAY_GROUPS + NUM_NEIGHBOR_FEATURES  # 13

    def __init__(self, input_size: int = INPUT_SIZE, hidden_size: int = 128):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 1),
            nn.Softplus(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)

    @staticmethod
    def _parse_speed(speed_raw, highway_type: str) -> float:
        if speed_raw is not None:
            if isinstance(speed_raw, list):
                speed_raw = speed_raw[0]
            try:
                return float(str(speed_raw).split()[0])
            except (ValueError, AttributeError):
                pass
        return PathNetwork.DEFAULT_SPEED.get(
            highway_type, PathNetwork.DEFAULT_SPEED_FALLBACK
        )

    @staticmethod
    def _highway_onehot(highway_type: str) -> list[float]:
        group = PathNetwork.HIGHWAY_GROUP.get(highway_type, 4)
        onehot = [0.0] * PathNetwork.NUM_HIGHWAY_GROUPS
        onehot[group] = 1.0
        return onehot

    @staticmethod
    def _get_highway_str(data: dict) -> str:
        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]
        return str(highway).strip()

    @staticmethod
    def extract_edge_features(edge_data: dict) -> list[float]:
        """
        Extrai as 9 features base de uma aresta (sem vizinhança).
        As 4 features de vizinhança são adicionadas por
        extract_edge_features_with_context() durante treino e inferência.
        """
        length = float(edge_data.get("length", 100.0))
        highway = PathNetwork._get_highway_str(edge_data)
        speed_kmh = PathNetwork._parse_speed(edge_data.get("maxspeed"), highway)

        lanes_raw = edge_data.get("lanes", 1)
        if isinstance(lanes_raw, list):
            lanes_raw = lanes_raw[0]
        try:
            lanes = max(1.0, float(str(lanes_raw)))
        except (ValueError, AttributeError):
            lanes = 1.0

        oneway_raw = edge_data.get("oneway", False)
        oneway = 1.0 if oneway_raw is True or str(oneway_raw).lower() == "yes" else 0.0

        hw_onehot = PathNetwork._highway_onehot(highway)
        return [length, speed_kmh, lanes, oneway] + hw_onehot

    @staticmethod
    def extract_neighbor_features(graph, dest_node: int, current_highway: str) -> list[float]:
        """
        Extrai 4 features de vizinhança do nó destino da aresta.

        Estas features dão ao modelo consciência do contexto local —
        o que está ao redor do ponto de chegada da aresta, não apenas
        os atributos da aresta em si.

        Args:
            graph:            grafo OSMnx com dados de arestas
            dest_node:        nó de destino da aresta sendo avaliada
            current_highway:  tipo de via da aresta atual (para continuity)

        Returns:
            [avg_in_speed, fast_out_ratio, norm_degree, continuity]
        """
        current_group = PathNetwork.HIGHWAY_GROUP.get(current_highway, 4)

        # --- arestas que chegam ao nó destino ---
        in_edges = list(graph.in_edges(dest_node, data=True))
        if in_edges:
            in_speeds = []
            same_group_count = 0
            for _, _, d in in_edges:
                hw = PathNetwork._get_highway_str(d)
                in_speeds.append(
                    PathNetwork._parse_speed(d.get("maxspeed"), hw)
                )
                if PathNetwork.HIGHWAY_GROUP.get(hw, 4) == current_group:
                    same_group_count += 1
            avg_in_speed = sum(in_speeds) / len(in_speeds)
            continuity = same_group_count / len(in_edges)
        else:
            avg_in_speed = PathNetwork.DEFAULT_SPEED_FALLBACK
            continuity = 0.0

        # --- arestas que saem do nó destino ---
        out_edges = list(graph.out_edges(dest_node, data=True))
        if out_edges:
            fast_count = sum(
                1 for _, _, d in out_edges
                if PathNetwork._get_highway_str(d) in PathNetwork.FAST_HIGHWAY_TYPES
            )
            fast_out_ratio = fast_count / len(out_edges)
        else:
            fast_out_ratio = 0.0

        # --- grau do nó normalizado ---
        # divide por 8 porque cruzamentos urbanos raramente têm mais de 8 conexões
        norm_degree = min(graph.degree(dest_node) / 8.0, 1.0)

        return [avg_in_speed, fast_out_ratio, norm_degree, continuity]

    @staticmethod
    def extract_full_features(graph, dest_node: int, edge_data: dict) -> list[float]:
        """
        Combina features base (9) + vizinhança (4) = 13 features.
        Usado tanto no treino quanto na inferência do pathfinder.
        """
        base = PathNetwork.extract_edge_features(edge_data)
        highway = PathNetwork._get_highway_str(edge_data)
        neighbor = PathNetwork.extract_neighbor_features(graph, dest_node, highway)
        return base + neighbor