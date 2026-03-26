"""
Treinamento da rede neural PathNetwork.

Como funciona:
- Cada aresta do grafo OSMnx representa um trecho de rua com atributos
  como comprimento, velocidade máxima e tipo de via.
- O tempo real de travessia de uma aresta é calculado pela fórmula física:
  tempo = distância / velocidade
- A rede neural aprende a estimar esse tempo a partir das features da aresta.
- Os dados são normalizados antes do treinamento para estabilizar o aprendizado.
- Após o treinamento, os pesos são salvos em models/path_network.pth e
  reutilizados no main.py sem precisar treinar novamente.
"""

import os
import sys
import torch
import torch.nn as nn
import osmnx as ox

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork

CITY = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "path_network.pth")
EPOCHS = 300
LEARNING_RATE = 5e-4


def build_training_data(graph) -> tuple:
    """
    Extrai features e labels reais de todas as arestas do grafo.

    Features (X):
        - Comprimento da aresta em metros
        - Velocidade máxima em km/h
        - Tipo de via codificado como número inteiro

    Label (y):
        - Tempo real de travessia em segundos: length / (speed * 1000/3600)
    """
    X, y = [], []

    for _, _, data in graph.edges(data=True):
        features = PathNetwork.extract_edge_features(data)
        length = features[0]
        speed_kmh = features[1]
        speed_ms = speed_kmh * 1000 / 3600
        real_time = length / speed_ms if speed_ms > 0 else length / 11.11

        X.append(features)
        y.append([real_time])

    X_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.float32)
    return X_tensor, y_tensor


def normalize(X: torch.Tensor, y: torch.Tensor) -> tuple:
    """
    Normaliza os dados para média 0 e desvio padrão 1.
    Isso estabiliza o treinamento e evita que features com valores
    muito grandes (ex: comprimento em metros) dominem o aprendizado.
    Retorna os tensores normalizados e os parâmetros para desnormalizar depois.
    """
    X_mean = X.mean(dim=0)
    X_std = X.std(dim=0) + 1e-8  # evita divisão por zero
    y_mean = y.mean()
    y_std = y.std() + 1e-8

    X_norm = (X - X_mean) / X_std
    y_norm = (y - y_mean) / y_std

    return X_norm, y_norm, X_mean, X_std, y_mean, y_std


def train():
    print("-" * 50)
    print("Treinamento da Rede Neural")
    print("-" * 50)

    print(f"Carregando mapa de {CITY}...")
    graph = ox.graph_from_place(CITY, network_type="drive")
    print(f"Grafo carregado: {len(graph.edges())} arestas encontradas.")

    print("Extraindo dados de treinamento das arestas...")
    X, y = build_training_data(graph)
    print(f"Total de amostras: {len(X)}")

    print("Normalizando dados...")
    X_norm, y_norm, X_mean, X_std, y_mean, y_std = normalize(X, y)

    model = PathNetwork(input_size=3, hidden_size=64)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    # ReduceLROnPlateau reduz o learning rate automaticamente quando
    # a loss para de melhorar, evitando a instabilidade vista no treino anterior
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=20
    )

    loss_fn = nn.MSELoss()

    print(f"\nIniciando treinamento por {EPOCHS} epocas...")
    print("-" * 50)

    best_loss = float("inf")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        optimizer.zero_grad()
        predictions = model(X_norm)
        loss = loss_fn(predictions, y_norm)
        loss.backward()
        optimizer.step()
        scheduler.step(loss.detach())

        if loss.item() < best_loss:
            best_loss = loss.item()

        if epoch % 30 == 0:
            lr = optimizer.param_groups[0]["lr"]
            print(f"  Epoca {epoch:>4}/{EPOCHS}  |  Loss: {loss.item():.4f}  |  LR: {lr:.6f}")

    print("-" * 50)
    print(f"Treinamento concluido. Melhor loss: {best_loss:.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    # Salvar pesos do modelo e parâmetros de normalização juntos
    torch.save({
        "model_state_dict": model.state_dict(),
        "X_mean": X_mean,
        "X_std": X_std,
        "y_mean": y_mean,
        "y_std": y_std,
    }, MODEL_PATH)

    print(f"Modelo salvo em: {MODEL_PATH}")


if __name__ == "__main__":
    train()