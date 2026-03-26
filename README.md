# Projeto Integrador

Sistema de identificação de rotas otimizadas para bombeiros usando redes neurais.

---

## AVISO IMPORTANTE: Python 3.12 (Leia antes de qualquer coisa)

O Fedora 43 vem com Python 3.14 por padrão, que é uma versão bleeding edge ainda incompatível com as principais bibliotecas de ML/IA usadas neste projeto (`torch`, `torchvision`, `networkx`, `triton`, etc.).

Isso não é um bug seu. É simplesmente o ciclo de suporte das bibliotecas — o Python 3.12 é a versão estável com suporte garantido para todo o ecossistema de ML hoje.

Trocar para o 3.12 não quebra nada no seu sistema. O Python 3.14 continua instalado. Você apenas adiciona o 3.12 como alternativa e usa ele dentro do ambiente virtual do projeto.

---

## Setup no Fedora Linux

### 1. Instalar dependências de sistema

```bash
sudo dnf install -y make gcc gcc-c++ cmake git python3.12 python3.12-devel
```

### 2. Configurar o Python 3.12 como alternativa no sistema

```bash
sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.14 2
sudo alternatives --config python3
# Selecione o Python 3.12 na lista interativa
```

### 3. Instalar o pip no Python 3.12

O pip do sistema está vinculado ao Python 3.14, então instale manualmente no 3.12:

```bash
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3.12 get-pip.py
python3.12 -m pip --version  # deve mostrar python 3.12
```

### 4. Instalar o Poetry

```bash
curl -sSL https://install.python-poetry.org | python3.12 -
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
poetry --version
```

Alias para ativar o ambiente virtual (Poetry 2.x removeu o `poetry shell`):

```bash
echo "alias pshell='eval \$(poetry env activate)'" >> ~/.bashrc
source ~/.bashrc
```

### 5. Configurar o projeto

```bash
cd machine/

# Apontar o Poetry para o Python 3.12
poetry env use python3.12

# Verificar o pyproject.toml — a linha requires-python deve ser:
# requires-python = ">=3.12,<3.13"

# Instalar as dependências
poetry add torch torchvision numpy pandas networkx osmnx folium geopy pybind11 scikit-learn
poetry add --group dev pytest black isort mypy
```

### 6. Ativar o ambiente virtual

```bash
# Poetry 2.x — use o alias configurado acima
pshell
```

---

## Setup no Windows

### 1. Instalar dependências

- Python 3.12: https://www.python.org/downloads/ (marcar "Add to PATH")
- Git: https://git-scm.com
- CMake: https://cmake.org
- Visual Studio Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Selecionar "Desenvolvimento para desktop com C++"

### 2. Instalar o Poetry

```powershell
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
```

### 3. Configurar o projeto

```powershell
cd machine/
poetry env use python
poetry add torch torchvision numpy pandas networkx osmnx folium geopy pybind11 scikit-learn
poetry add --group dev pytest black isort mypy
```

---

## Compilar o módulo C++

O módulo C++ gerencia memória para os nós do grafo. Deve ser compilado apontando explicitamente para o Python 3.12 do ambiente virtual do Poetry.

```bash
# Dentro de machine/src/cpp/
mkdir build && cd build

cmake ..
make
```

No Windows (Developer PowerShell for VS):

```powershell
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release `
  -DPython3_EXECUTABLE=$(poetry env info --executable) `
  -Dpybind11_DIR=$(poetry run python -c "import pybind11; print(pybind11.get_cmake_dir())")
cmake --build . --config Release
```

O arquivo gerado deve ser `memory_manager.cpython-312-x86_64-linux-gnu.so` no Linux
ou `memory_manager.cpython-312-*.pyd` no Windows. Se aparecer `cpython-314`, o CMake
pegou o Python errado — verifique se o `python3.12-devel` está instalado e repita.

---

## Treinar a rede neural

O treinamento deve ser feito antes de rodar o sistema pela primeira vez. Ele baixa o
mapa de Taubaté via OpenStreetMap, extrai as features de cada rua (comprimento,
velocidade máxima e tipo de via), calcula o tempo real de travessia por fórmula física
e treina a rede neural para aproximar esse valor.

```bash
cd machine/
pshell
python src/pathfinding/train.py
```

O modelo treinado é salvo em `machine/models/path_network.pth`. Este arquivo não deve
ser commitado no Git (já está no .gitignore).

### O que esperar do treinamento

Um bom treinamento mostra queda consistente da loss sem oscilações:

```
Epoca   30/300  |  Loss: 1.0925  |  LR: 0.000500
Epoca   60/300  |  Loss: 0.6055  |  LR: 0.000500
Epoca   90/300  |  Loss: 0.2345  |  LR: 0.000500
Epoca  120/300  |  Loss: 0.1583  |  LR: 0.000500
Epoca  300/300  |  Loss: 0.1002  |  LR: 0.000500
```

Loss final abaixo de 0.15 é considerada boa para este problema.

### Por que normalizar os dados

Sem normalização, features com escalas muito diferentes (comprimento em metros vs tipo
de via de 0 a 9) desestabilizam o treinamento — a loss pode subir entre épocas em vez
de cair. A normalização padroniza tudo para média 0 e desvio padrão 1. Os parâmetros
de normalização são salvos junto com o modelo no `.pth` e usados para desnormalizar
a saída da rede de volta para segundos reais.

### Por que o scikit-learn é uma dependência

O `osmnx` usa o scikit-learn internamente para busca de vizinho mais próximo (KD-Tree)
ao localizar o nó do grafo mais próximo de uma coordenada. Não é chamado diretamente
no código do projeto.

---

## Rodar o sistema

```bash
cd machine/
pshell
python main.py
```

O sistema vai pedir as coordenadas interativamente e exibir o resultado no terminal:

```
--------------------------------------------------
RESCUE PATH - Sistema de Rota para Bombeiros
--------------------------------------------------

Coordenadas do Ponto de Bombeiros (origem)
  Latitude  (ex: -23.026): -23.026
  Longitude (ex: -45.555): -45.555

Coordenadas da Ocorrencia (destino)
  Latitude  (ex: -23.026): -23.018
  Longitude (ex: -45.540): -45.540

--------------------------------------------------
Processando...
  Carregando mapa de Taubaté, São Paulo, Brasil...
  Carregando modelo treinado...
  Aplicando pesos da rede neural nas arestas do grafo...
  Calculando melhor rota...

--------------------------------------------------
MELHOR ROTA CALCULADA
--------------------------------------------------
  Distancia total : 7.48 km  (7476 m)
  Tempo estimado  : 10.4 minutos
--------------------------------------------------
```

A rota encontrada não é necessariamente a mais curta em metros — é a de menor tempo
estimado pela rede neural, que considera o tipo e a velocidade de cada via.

---

## Estrutura do Projeto

```
projeto-integrador/
├── machine/
│   ├── models/               # Modelo treinado (gerado localmente, no .gitignore)
│   ├── src/
│   │   ├── neural/
│   │   │   ├── __init__.py
│   │   │   └── path_network.py     # Arquitetura da rede neural
│   │   ├── pathfinding/
│   │   │   ├── __init__.py
│   │   │   ├── pathfinder.py       # Grafo, pesos neurais e rota
│   │   │   └── train.py            # Script de treinamento
│   │   └── cpp/
│   │       ├── build/              # Compilado localmente (no .gitignore)
│   │       ├── stubs/
│   │       │   └── memory_manager.pyi
│   │       ├── CMakeLists.txt
│   │       └── memory-manager.cpp
│   ├── tests/
│   ├── main.py
│   ├── pyproject.toml
│   ├── poetry.lock
│   └── pyrightconfig.json    # Na raiz do workspace se aberto em projeto-integrador/
├── frontend/
├── .gitignore
└── README.md
```

---

## Fluxo de Branches no Git

```
main        → codigo estavel, so recebe merge apos revisao
develop     → branch de integracao do time
machine     → modulo de IA e pathfinding
feature/xxx → cada integrante cria uma para sua tarefa
hotfix/xxx  → correcoes urgentes
```

### Fluxo diario

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nome-da-tarefa

# trabalhar e commitar
git add .
git commit -m "feat: descricao do que foi feito"
git push origin feature/nome-da-tarefa
# Abrir Pull Request para develop no GitHub
```

### Prefixos de commit

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correcao de bug |
| `docs:` | Documentacao |
| `refactor:` | Refatoracao sem mudanca de comportamento |
| `test:` | Testes |

---

## Dependencias Principais

| Biblioteca | Uso |
|---|---|
| `torch` / `torchvision` | Rede neural |
| `numpy` / `pandas` | Manipulacao de dados |
| `networkx` | Modelagem do grafo de ruas |
| `osmnx` | Importar mapa real do OpenStreetMap |
| `scikit-learn` | Dependencia interna do osmnx para busca KD-Tree |
| `geopy` | Geocodificacao (endereco para coordenada) |
| `pybind11` | Integracao Python com C++ |
| `folium` | Geracao de mapas HTML interativos (uso futuro) |