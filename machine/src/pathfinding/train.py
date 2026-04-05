"""
- Usa extract_full_features (13 features) em vez de extract_edge_features (9)
- Filtra arestas com custo calculado abaixo de 0.1s antes do treino
- Log mostra quantas arestas foram filtradas
"""

import os
import sys

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import osmnx as ox

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork

CITY = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "path_network.pth"
)

EPOCHS                     = 500
LEARNING_RATE              = 5e-4
BATCH_SIZE                 = 256
EARLY_STOPPING_PATIENCE    = 60
INTERSECTION_PENALTY_PER_DEGREE = 0.5

EMERGENCY_SPEED_FACTOR: dict[str, float] = {
    "motorway":         1.3,
    "motorway_link":    1.2,
    "trunk":            1.25,
    "trunk_link":       1.15,
    "primary":          1.2,
    "primary_link":     1.1,
    "secondary":        1.15,
    "secondary_link":   1.1,
    "tertiary":         1.05,
    "tertiary_link":    1.05,
    "residential":      1.0,
    "living_street":    0.95,
    "service":          1.0,
    "unclassified":     1.0,
    "road":             1.0,
}
EMERGENCY_FACTOR_FALLBACK = 1.0

# Custo mínimo aceitável para uma aresta entrar no treino.
# Abaixo disso é aresta com length ~0 (erro de mapeamento no OSM).
MIN_VALID_COST = 0.1


def build_training_data(graph) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Extrai 13 features e o label de custo de cada aresta válida do grafo.

    Filtra arestas com custo calculado abaixo de MIN_VALID_COST para
    evitar que erros de mapeamento do OSM contaminem o treino.
    """
    X, y = [], []
    filtered = 0

    for u, v, data in graph.edges(data=True):
        # --- features completas (base + vizinhança) ---
        features = PathNetwork.extract_full_features(graph, v, data)

        length    = features[0]
        speed_kmh = features[1]
        oneway    = features[3]

        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]
        highway = str(highway).strip()

        factor = EMERGENCY_SPEED_FACTOR.get(highway, EMERGENCY_FACTOR_FALLBACK)
        effective_speed_ms = (speed_kmh * factor) / 3.6
        travel_time = (
            length / effective_speed_ms if effective_speed_ms > 0 else length / 8.33
        )

        # Penalidade de interseção — apenas vias de mão dupla
        if oneway == 0.0:
            dest_degree = graph.degree(v)
            intersection_penalty = (
                max(0.0, dest_degree - 2) * INTERSECTION_PENALTY_PER_DEGREE
            )
        else:
            intersection_penalty = 0.0

        real_cost = travel_time + intersection_penalty

        # Filtro: descarta arestas com custo fisicamente impossível
        if real_cost < MIN_VALID_COST:
            filtered += 1
            continue

        X.append(features)
        y.append([real_cost])

    if filtered > 0:
        print(f"  Arestas filtradas (custo < {MIN_VALID_COST}s): {filtered}")

    X_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.float32)
    return X_tensor, y_tensor


def normalize(
    X: torch.Tensor, y: torch.Tensor
) -> tuple[
    torch.Tensor, torch.Tensor,
    torch.Tensor, torch.Tensor,
    torch.Tensor, torch.Tensor,
]:
    X_mean = X.mean(dim=0)
    X_std  = X.std(dim=0) + 1e-8
    y_mean = y.mean()
    y_std  = y.std() + 1e-8

    X_norm = (X - X_mean) / X_std
    y_norm = (y - y_mean) / y_std

    return X_norm, y_norm, X_mean, X_std, y_mean, y_std


def train() -> None:
    print("-" * 50)
    print("Treinamento")
    print("-" * 50)

    print(f"Carregando mapa de {CITY}...")
    graph = ox.graph_from_place(CITY, network_type="drive")
    print(f"Grafo carregado: {graph.number_of_edges()} arestas, {graph.number_of_nodes()} nos.")

    print("Extraindo features e labels das arestas...")
    X, y = build_training_data(graph)
    print(f"  Total de amostras validas : {len(X)}")
    print(f"  Custo medio               : {y.mean().item():.1f}s")
    print(f"  Custo mediano             : {y.median().item():.1f}s")
    print(f"  Custo maximo              : {y.max().item():.1f}s")
    print(f"  Custo minimo              : {y.min().item():.2f}s")

    print("Normalizando dados...")
    X_norm, y_norm, X_mean, X_std, y_mean, y_std = normalize(X, y)

    dataset = TensorDataset(X_norm, y_norm)
    loader  = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = PathNetwork(input_size=PathNetwork.INPUT_SIZE, hidden_size=128)

    optimizer = torch.optim.Adam(
        model.parameters(), lr=LEARNING_RATE, weight_decay=1e-5
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=15, min_lr=1e-6
    )
    loss_fn = nn.HuberLoss()

    print(f"\nIniciando treinamento ({EPOCHS} epocas, batch={BATCH_SIZE}, patience={EARLY_STOPPING_PATIENCE})...")
    print("-" * 50)

    best_loss              = float("inf")
    epochs_without_improve = 0
    best_state             = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        epoch_loss = 0.0

        for X_batch, y_batch in loader:
            optimizer.zero_grad()
            predictions = model(X_batch)
            loss = loss_fn(predictions, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            epoch_loss += loss.item()

        avg_loss = epoch_loss / len(loader)
        scheduler.step(avg_loss)

        if avg_loss < best_loss:
            best_loss              = avg_loss
            best_state             = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_without_improve = 0
        else:
            epochs_without_improve += 1

        if epoch % 50 == 0:
            lr = optimizer.param_groups[0]["lr"]
            print(f"  Epoca {epoch:>4}/{EPOCHS}  |  Loss: {avg_loss:.4f}  |  Melhor: {best_loss:.4f}  |  LR: {lr:.6f}")

        if epochs_without_improve >= EARLY_STOPPING_PATIENCE:
            print(f"\n  Early stopping na epoca {epoch} (sem melhora por {EARLY_STOPPING_PATIENCE} epocas).")
            break

    print("-" * 50)
    print(f"Treinamento concluido. Melhor loss: {best_loss:.4f}")

    if best_state is not None:
        model.load_state_dict(best_state)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "X_mean":           X_mean,
            "X_std":            X_std,
            "y_mean":           y_mean,
            "y_std":            y_std,
            "input_size":       PathNetwork.INPUT_SIZE,
        },
        MODEL_PATH,
    )

    print(f"Modelo salvo em: {MODEL_PATH}")


if __name__ == "__main__":
    train()