# machine/src/pathfinding/map_handler.py
import osmnx as ox
import networkx as nx
import folium

def get_city_graph(city_name: str):
    """Baixa o grafo de ruas de uma cidade do OpenStreetMap."""
    graph = ox.graph_from_place(city_name, network_type="drive")
    return graph

def get_nearest_node(graph, latitude: float, longitude: float):
    """Retorna o nó do grafo mais próximo de uma coordenada."""
    node = ox.nearest_nodes(graph, longitude, latitude)
    return node

def find_shortest_path(graph, origin_coords: tuple, dest_coords: tuple):
    """
    Calcula o caminho mais curto entre dois pontos.
    origin_coords e dest_coords são tuplas (latitude, longitude).
    """
    origin_node = get_nearest_node(graph, *origin_coords)
    dest_node = get_nearest_node(graph, *dest_coords)

    path = nx.shortest_path(graph, origin_node, dest_node, weight="length")
    return path

def generate_map(graph, path: list, origin: tuple, destination: tuple, output_file="map.html"):
    """Gera um mapa HTML interativo com o caminho destacado."""
    # Centro do mapa
    center_lat = (origin[0] + destination[0]) / 2
    center_lon = (origin[1] + destination[1]) / 2
    m = folium.Map(location=[center_lat, center_lon], zoom_start=14)

    # Extrair coordenadas do caminho
    path_coords = [(graph.nodes[n]["y"], graph.nodes[n]["x"]) for n in path]

    # Desenhar rota
    folium.PolyLine(path_coords, color="red", weight=5, opacity=0.8).add_to(m)

    # Marcadores
    folium.Marker(origin, popup="Bombeiros", icon=folium.Icon(color="red", icon="fire")).add_to(m)
    folium.Marker(destination, popup="Ocorrência", icon=folium.Icon(color="blue", icon="info-sign")).add_to(m)

    m.save(output_file)
    print(f"Mapa salvo em {output_file}")
    return m