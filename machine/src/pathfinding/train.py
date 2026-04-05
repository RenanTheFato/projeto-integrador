"""
Loop de treino para o modelo híbrido GAT + MLP.

Mudanças críticas em relação à tentativa anterior com GNN:
  1. Remapeamento de IDs OSMnx → índices contíguos 0..N-1 antes de qualquer
     operação tensorial. Esse era o principal motivo do NaN imediato.
  2. Normalização de features ANTES de construir os tensores PyG.
  3. Self-loops já são adicionados internamente pelo GATConv (padrão).
  4. Gradient clipping em cada step (max_norm=1.0).
  5. Treino em modo full-graph (o grafo inteiro cabe em memória para Taubaté).
  6. Split treino/validação (85%/15%) — early stopping monitora a loss de
     validação, evitando que o modelo memorize as arestas vistas no treino.
"""

import os
import sys

import torch
import torch.nn as nn
import osmnx as ox

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from neural.path_network import PathNetwork

CITY       = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "path_network.pth"
)

EPOCHS                          = 800
LEARNING_RATE                   = 3e-4
EARLY_STOPPING_PATIENCE         = 60
INTERSECTION_PENALTY_PER_DEGREE = 0.5
MIN_VALID_COST                  = 0.1
VAL_SPLIT                       = 0.15   # 15% das arestas para validação

EMERGENCY_SPEED_FACTOR: dict[str, float] = {
    "motorway":      1.3,  "motorway_link": 1.2,
    "trunk":         1.25, "trunk_link":    1.15,
    "primary":       1.2,  "primary_link":  1.1,
    "secondary":     1.15, "secondary_link":1.1,
    "tertiary":      1.05, "tertiary_link": 1.05,
    "residential":   1.0,  "living_street": 0.95,
    "service":       1.0,  "unclassified":  1.0,
    "road":          1.0,
}
EMERGENCY_FACTOR_FALLBACK = 1.0

def build_graph_tensors(graph):
    """
    Converte o grafo OSMnx em tensores prontos para PyTorch Geometric.

    Retorna
    -------
    edge_index   : [2, E]       índices de aresta (0-based, remapeados)
    edge_feats   : [E, 9]       features base de cada aresta
    node_feats   : [N, 9]       features de nó (média das arestas incidentes)
    labels       : [E, 1]       custo real calculado por fórmula
    valid_mask   : [E]  bool    máscara de arestas com custo >= MIN_VALID_COST
    node_list    : list         lista de nós na ordem usada para remapeamento
    """
    node_list    = list(graph.nodes())
    node_to_idx  = {node: idx for idx, node in enumerate(node_list)}
    N            = len(node_list)

    src_list, dst_list = [], []
    edge_feats_list    = []
    labels_list        = []
    valid_flags        = []

    for u, v, data in graph.edges(data=True):
        features  = PathNetwork.extract_edge_features(data)
        length    = features[0]
        speed_kmh = features[1]
        oneway    = features[3]

        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]
        highway = str(highway).strip()

        factor             = EMERGENCY_SPEED_FACTOR.get(highway, EMERGENCY_FACTOR_FALLBACK)
        effective_speed_ms = (speed_kmh * factor) / 3.6
        travel_time        = (
            length / effective_speed_ms if effective_speed_ms > 0 else length / 8.33
        )

        if oneway == 0.0:
            dest_degree          = graph.degree(v)
            intersection_penalty = max(0.0, dest_degree - 2) * INTERSECTION_PENALTY_PER_DEGREE
        else:
            intersection_penalty = 0.0

        real_cost = travel_time + intersection_penalty
        is_valid  = real_cost >= MIN_VALID_COST

        src_list.append(node_to_idx[u])
        dst_list.append(node_to_idx[v])
        edge_feats_list.append(features)
        labels_list.append([real_cost])
        valid_flags.append(is_valid)

    edge_index = torch.tensor([src_list, dst_list], dtype=torch.long)
    edge_feats = torch.tensor(edge_feats_list, dtype=torch.float32)
    labels     = torch.tensor(labels_list, dtype=torch.float32)
    valid_mask = torch.tensor(valid_flags, dtype=torch.bool)

    filtered = (~valid_mask).sum().item()
    if filtered > 0:
        print(f"  Arestas filtradas (custo < {MIN_VALID_COST}s): {filtered}")

    # Features de nó: média das features das arestas de saída de cada nó
    node_feat_acc   = torch.zeros(N, PathNetwork.EDGE_FEAT_SIZE)
    node_edge_count = torch.zeros(N, 1)
    for e_idx, (u_idx, _) in enumerate(zip(src_list, dst_list)):
        node_feat_acc[u_idx]   += edge_feats[e_idx]
        node_edge_count[u_idx] += 1.0
    node_edge_count = node_edge_count.clamp(min=1.0)
    node_feats = node_feat_acc / node_edge_count

    return edge_index, edge_feats, node_feats, labels, valid_mask, node_list

def normalize_tensors(node_feats, edge_feats, labels):
    """
    Normaliza features e labels. Retorna tensores normalizados + estatísticas.

    A normalização ocorre ANTES de entrar no GAT para evitar overflow
    no softmax de atenção.
    """
    nf_mean = node_feats.mean(dim=0)
    nf_std  = node_feats.std(dim=0)  + 1e-8

    ef_mean = edge_feats.mean(dim=0)
    ef_std  = edge_feats.std(dim=0)  + 1e-8

    y_mean  = labels.mean()
    y_std   = labels.std()           + 1e-8

    node_feats_n = (node_feats - nf_mean) / nf_std
    edge_feats_n = (edge_feats - ef_mean) / ef_std
    labels_n     = (labels     - y_mean)  / y_std

    return (
        node_feats_n, edge_feats_n, labels_n,
        nf_mean, nf_std, ef_mean, ef_std, y_mean, y_std,
    )

def split_valid_indices(valid_mask: torch.Tensor, val_split: float, seed: int = 42):
    """
    Divide os índices das arestas válidas em treino e validação.

    O split é feito sobre os índices das arestas válidas (não sobre
    todas as arestas) para garantir que as proporções sejam exatas.
    O edge_index completo é sempre passado ao GAT — apenas a loss
    é calculada sobre subconjuntos diferentes.

    Parâmetros
    ----------
    valid_mask : máscara booleana [E] das arestas com custo válido
    val_split  : fração destinada à validação (ex: 0.15)
    seed       : semente para reprodutibilidade

    Retorna
    -------
    train_idx : índices (no tensor original) das arestas de treino
    val_idx   : índices (no tensor original) das arestas de validação
    """
    all_valid_idx = valid_mask.nonzero(as_tuple=True)[0]
    n_valid       = len(all_valid_idx)
    n_val         = int(n_valid * val_split)

    generator = torch.Generator()
    generator.manual_seed(seed)
    perm = torch.randperm(n_valid, generator=generator)

    val_idx   = all_valid_idx[perm[:n_val]]
    train_idx = all_valid_idx[perm[n_val:]]
    return train_idx, val_idx

def train() -> None:
    print("-" * 50)
    print("Treinamento — GAT + MLP")
    print("-" * 50)

    print(f"Carregando mapa de {CITY}...")
    graph = ox.graph_from_place(CITY, network_type="drive")
    print(f"Grafo: {graph.number_of_edges()} arestas, {graph.number_of_nodes()} nos.")

    print("Construindo tensores do grafo...")
    edge_index, edge_feats, node_feats, labels, valid_mask, _ = build_graph_tensors(graph)

    print("Normalizando features...")
    (
        node_feats_n, edge_feats_n, labels_n,
        nf_mean, nf_std, ef_mean, ef_std, y_mean, y_std,
    ) = normalize_tensors(node_feats, edge_feats, labels)

    # --- Split treino / validação ---
    train_idx, val_idx = split_valid_indices(valid_mask, VAL_SPLIT)

    labels_train = labels_n[train_idx]       # [E_train, 1]
    labels_val   = labels_n[val_idx]         # [E_val,   1]
    ef_train     = edge_feats_n[train_idx]   # [E_train, 9]
    ef_val       = edge_feats_n[val_idx]     # [E_val,   9]

    y_vals = labels[valid_mask]
    print(f"  Arestas validas        : {valid_mask.sum().item()}")
    print(f"  Arestas de treino      : {len(train_idx)}")
    print(f"  Arestas de validacao   : {len(val_idx)}")
    print(f"  Custo medio            : {y_vals.mean().item():.1f}s")
    print(f"  Custo mediano          : {y_vals.median().item():.1f}s")
    print(f"  Custo maximo           : {y_vals.max().item():.1f}s")
    print(f"  Custo minimo           : {y_vals.min().item():.2f}s")

    model = PathNetwork(
        edge_feat_size = PathNetwork.EDGE_FEAT_SIZE,
        node_feat_size = PathNetwork.NODE_FEAT_SIZE,
        gat_hidden     = 32,
        gat_heads      = 4,
        gat_out_dim    = 32,
        mlp_hidden     = 128,
    )

    optimizer = torch.optim.Adam(
        model.parameters(), lr=LEARNING_RATE, weight_decay=1e-5
    )
    # Early stopping agora monitora a loss de VALIDAÇÃO
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=15, min_lr=1e-6
    )
    loss_fn = nn.HuberLoss()

    print(f"\nIniciando treino ({EPOCHS} epocas, patience={EARLY_STOPPING_PATIENCE})...")
    print("-" * 50)
    print(f"  {'Epoca':>6}  {'Loss Treino':>12}  {'Loss Val':>10}  {'Melhor Val':>10}  {'LR':>10}")
    print("-" * 50)

    best_val_loss          = float("inf")
    epochs_without_improve = 0
    best_state             = None

    for epoch in range(1, EPOCHS + 1):
        # --- Treino ---
        model.train()
        optimizer.zero_grad()

        all_preds    = model(node_feats_n, edge_index, edge_feats_n)  # [E, 1]
        loss_train   = loss_fn(all_preds[train_idx], labels_train)
        loss_train.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        # --- Validação ---
        model.eval()
        with torch.no_grad():
            all_preds_val = model(node_feats_n, edge_index, edge_feats_n)
            loss_val      = loss_fn(all_preds_val[val_idx], labels_val)

        val_loss = loss_val.item()
        scheduler.step(val_loss)   # scheduler guiado pela validação

        if val_loss < best_val_loss:
            best_val_loss          = val_loss
            best_state             = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_without_improve = 0
        else:
            epochs_without_improve += 1

        if epoch % 50 == 0:
            lr = optimizer.param_groups[0]["lr"]
            print(
                f"  {epoch:>6}/{EPOCHS}"
                f"  {loss_train.item():>12.4f}"
                f"  {val_loss:>10.4f}"
                f"  {best_val_loss:>10.4f}"
                f"  {lr:>10.6f}"
            )

        if epochs_without_improve >= EARLY_STOPPING_PATIENCE:
            print(f"\n  Early stopping na epoca {epoch}.")
            break

    print("-" * 50)
    print(f"Treinamento concluido. Melhor loss de validacao: {best_val_loss:.4f}")

    if best_state:
        model.load_state_dict(best_state)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "nf_mean": nf_mean, "nf_std": nf_std,
            "ef_mean": ef_mean, "ef_std": ef_std,
            "y_mean":  y_mean,  "y_std":  y_std,
            "edge_feat_size": PathNetwork.EDGE_FEAT_SIZE,
            "node_feat_size": PathNetwork.NODE_FEAT_SIZE,
            "gat_hidden":     32,
            "gat_heads":      4,
            "gat_out_dim":    32,
            "mlp_hidden":     128,
        },
        MODEL_PATH,
    )
    print(f"Modelo salvo em: {MODEL_PATH}")

if __name__ == "__main__":
    train()