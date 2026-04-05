import sys
import os

sys.path.append(os.path.dirname(__file__))

import torch
from src.neural.path_network import PathNetwork
from src.pathfinding.pathfinder import get_city_graph, apply_neural_weights, find_best_path
from src.pathfinding.map_visualizer import generate_map

# Importa o módulo C++ compilado
sys.path.append(os.path.join(os.path.dirname(__file__), "src", "cpp", "build"))
from memory_manager import NodeMemoryManager

CITY = "Taubaté, São Paulo, Brasil"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "path_network.pth")
MAP_OUTPUT = os.path.join(os.path.dirname(__file__), "rota.html")
SEPARATOR = "-" * 50

def load_model() -> tuple:
    if not os.path.exists(MODEL_PATH):
        print(f"\nERRO: Modelo nao encontrado em '{MODEL_PATH}'.")
        print("Execute: python src/pathfinding/train.py")
        sys.exit(1)

    checkpoint = torch.load(MODEL_PATH, weights_only=True)
    model = PathNetwork(
        edge_feat_size = checkpoint["edge_feat_size"],
        node_feat_size = checkpoint["node_feat_size"],
        gat_hidden     = checkpoint["gat_hidden"],
        gat_heads      = checkpoint["gat_heads"],
        gat_out_dim    = checkpoint["gat_out_dim"],
        mlp_hidden     = checkpoint["mlp_hidden"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    return (
        model,
        checkpoint["nf_mean"], checkpoint["nf_std"],
        checkpoint["ef_mean"], checkpoint["ef_std"],
        checkpoint["y_mean"],  checkpoint["y_std"],
    )

def prompt_coordinates(label: str) -> tuple[float, float]:
    print(f"\n{label}")
    while True:
        try:
            lat = float(input("  Latitude  (ex: -23.026): ").strip())
            lon = float(input("  Longitude (ex: -45.555): ").strip())
            if not (-90 <= lat <= 90):
                print("  Latitude invalida.")
                continue
            if not (-180 <= lon <= 180):
                print("  Longitude invalida.")
                continue
            return (lat, lon)
        except ValueError:
            print("  Valor invalido. Digite apenas numeros.")

def print_result(result: dict) -> None:
    print(f"\n{SEPARATOR}")
    print("MELHOR ROTA CALCULADA")
    print(SEPARATOR)
    print(f"  Distancia total : {result['distance_km']:.2f} km  ({result['distance_m']:.0f} m)")
    print(f"  Tempo estimado  : {result['time_min']:.1f} minutos")
    print(f"  Nos no caminho  : {len(result['path'])} pontos")
    print(SEPARATOR)

def cache_neural_costs(graph, mem: NodeMemoryManager) -> dict:
    """
    Usa o NodeMemoryManager (C++) para armazenar o neural_cost
    de cada aresta em buffers alocados fora do heap do Python.
    Retorna um índice {(u, v, key): buffer_idx} para consulta posterior.
    """
    index = {}
    for u, v, key, data in graph.edges(keys=True, data=True):
        cost = data.get("neural_cost", 0.1)
        buf_idx = mem.allocate_buffer()
        mem.set_value(buf_idx, 0, cost)
        index[(u, v, key)] = buf_idx
    return index

def main():
    print(SEPARATOR)
    print("Sistema de Rota para Bombeiros")
    print(SEPARATOR)

    origin = prompt_coordinates("Coordenadas do Ponto de Bombeiros (origem)")
    destination = prompt_coordinates("Coordenadas da Ocorrencia (destino)")

    print(f"\n{SEPARATOR}")
    print("Processando...")

    graph = get_city_graph(CITY)

    print("  Carregando modelo treinado...")

    model, nf_mean, nf_std, ef_mean, ef_std, y_mean, y_std = load_model()
    apply_neural_weights(graph, model, nf_mean, nf_std, ef_mean, ef_std, y_mean, y_std)

    # Cacheia os custos neurais no gerenciador C++
    # buffer_size=1 porque cada aresta armazena apenas um float (o custo)
    print("  Cacheando custos neurais no gerenciador C++...")
    mem = NodeMemoryManager(1)
    edge_cache = cache_neural_costs(graph, mem)
    print(f"  {mem.total_allocated()} bytes alocados pelo modulo C++")

    print("  Calculando melhor rota...")
    result = find_best_path(graph, origin, destination)

    print_result(result)

    print("  Gerando mapa...")
    generate_map(graph, result["path"], origin, destination, output_path=MAP_OUTPUT)

    # Libera os buffers C++ explicitamente
    for buf_idx in edge_cache.values():
        mem.free_buffer(buf_idx)

if __name__ == "__main__":
    main()