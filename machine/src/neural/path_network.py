import torch
import torch.nn as nn
import numpy as np


class PathNetwork(nn.Module):
    """
    Rede neural que aprende a estimar o custo real de travessia
    de uma aresta do grafo de ruas, considerando:
    - Comprimento da aresta (metros)
    - Velocidade máxima permitida (km/h)
    - Tipo de via (primária, secundária, residencial, etc.)
    """

    # Mapeamento de tipos de via para índice numérico
    ROAD_TYPES = {
        "motorway": 0,
        "trunk": 1,
        "primary": 2,
        "secondary": 3,
        "tertiary": 4,
        "residential": 5,
        "service": 6,
        "unclassified": 7,
        "living_street": 8,
        "other": 9,
    }

    def __init__(self, input_size: int = 3, hidden_size: int = 64):
        super(PathNetwork, self).__init__()

        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, 1),
            nn.Softplus(),  # garante saída positiva (custo nunca negativo)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)

    @staticmethod
    def extract_edge_features(edge_data: dict) -> list[float]:
        """Extrai features de uma aresta do grafo OSMnx."""
        length = float(edge_data.get("length", 100.0))

        # Velocidade máxima (padrão 40 km/h para vias urbanas)
        speed = edge_data.get("maxspeed", "40")
        if isinstance(speed, list):
            speed = speed[0]
        try:
            speed = float(str(speed).split()[0])
        except (ValueError, AttributeError):
            speed = 40.0

        # Tipo de via
        highway = edge_data.get("highway", "other")
        if isinstance(highway, list):
            highway = highway[0]
        road_type = PathNetwork.ROAD_TYPES.get(highway, 9)

        return [length, speed, float(road_type)]

    def predict_travel_time(self, edge_data: dict) -> float:
        """
        Retorna o tempo de travessia estimado pela rede neural (em segundos).
        Usado como peso para o algoritmo de menor caminho.
        """
        features = self.extract_edge_features(edge_data)
        x = torch.tensor(features, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            cost = self.forward(x)
        return float(cost.item())