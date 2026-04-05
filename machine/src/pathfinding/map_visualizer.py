"""
Gera um mapa HTML interativo com duas rotas:
- Rota neural (azul): menor tempo estimado pela rede neural
- Rota por distância (vermelha): menor distância em metros, ignora velocidade
"""

import folium
import osmnx as ox
import networkx as nx

def _get_path_coords(graph, path: list) -> list[tuple]:
    coords = []
    for node in path:
        data = graph.nodes[node]
        coords.append((data["y"], data["x"]))
    return coords

def _calc_path_stats(graph, path: list) -> dict:
    total_distance_m = 0.0
    total_time_s = 0.0
    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = min(graph[u][v].values(), key=lambda d: d.get("neural_cost", 0))
        total_distance_m += edge_data.get("length", 0)
        total_time_s += edge_data.get("neural_cost", 0)
    return {
        "distance_m": total_distance_m,
        "distance_km": total_distance_m / 1000,
        "time_s": total_time_s,
        "time_min": total_time_s / 60,
    }

def _find_distance_path(graph, origin_node, dest_node) -> list:
    return nx.shortest_path(graph, origin_node, dest_node, weight="length")


def _inject_info_box(output_path: str, fast_stats: dict, dist_stats: dict) -> None:
    """
    Lê o HTML gerado pelo folium e injeta a box de informações
    antes do </body>. Contorna limitações do sistema de elementos do folium.
    """
    box_html = f"""
<div style="
    position: fixed;
    bottom: 30px;
    left: 30px;
    z-index: 9999;
    background: white;
    padding: 16px 20px;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    font-family: sans-serif;
    font-size: 13px;
    line-height: 1.7;
    min-width: 230px;
">
    <div style="font-size:14px; font-weight:bold; margin-bottom:10px;">
        Comparação de Rotas
    </div>
    <div style="border-left:4px solid #2980b9; padding-left:10px; margin-bottom:12px;">
        <span style="color:#2980b9; font-weight:bold;">&#9644; Rota Neural</span><br>
        Distância: <b>{fast_stats['distance_km']:.2f} km</b> ({fast_stats['distance_m']:.0f} m)<br>
        Tempo estimado: <b>{fast_stats['time_min']:.1f} min</b>
    </div>
    <div style="border-left:4px solid #e74c3c; padding-left:10px;">
        <span style="color:#e74c3c; font-weight:bold;">&#9644; Rota Mais Curta</span><br>
        Distância: <b>{dist_stats['distance_km']:.2f} km</b> ({dist_stats['distance_m']:.0f} m)<br>
        Tempo estimado: <b>{dist_stats['time_min']:.1f} min</b>
    </div>
</div>
"""

    with open(output_path, "r", encoding="utf-8") as f:
        html = f.read()

    html = html.replace("</body>", box_html + "\n</body>")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

def generate_map(
    graph,
    fast_path: list,
    origin_coords: tuple,
    dest_coords: tuple,
    output_path: str = "rota.html",
) -> None:
    origin_node = ox.nearest_nodes(graph, origin_coords[1], origin_coords[0])
    dest_node = ox.nearest_nodes(graph, dest_coords[1], dest_coords[0])

    distance_path = _find_distance_path(graph, origin_node, dest_node)

    fast_stats = _calc_path_stats(graph, fast_path)
    dist_stats = _calc_path_stats(graph, distance_path)

    center_lat = (origin_coords[0] + dest_coords[0]) / 2
    center_lon = (origin_coords[1] + dest_coords[1]) / 2

    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=14,
        tiles="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attr='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    )

    # Rota por distância — vermelha, embaixo
    distance_coords = _get_path_coords(graph, distance_path)
    folium.PolyLine(
        distance_coords,
        color="#e74c3c",
        weight=5,
        opacity=0.75,
        tooltip="Rota mais curta em metros (sem considerar velocidade)",
    ).add_to(m)

    # Rota neural — azul, em cima
    fast_coords = _get_path_coords(graph, fast_path)
    folium.PolyLine(
        fast_coords,
        color="#2980b9",
        weight=6,
        opacity=0.9,
        tooltip="Rota neural (menor tempo estimado)",
    ).add_to(m)

    folium.Marker(
        location=origin_coords,
        popup="Quartel (origem)",
        icon=folium.Icon(color="blue", icon="home", prefix="fa"),
    ).add_to(m)

    folium.Marker(
        location=dest_coords,
        popup="Ocorrência (destino)",
        icon=folium.Icon(color="red", icon="fire", prefix="fa"),
    ).add_to(m)

    m.save(output_path)

    # Injeta a box diretamente no HTML salvo
    _inject_info_box(output_path, fast_stats, dist_stats)

    print(f"  Mapa salvo em: {output_path}")