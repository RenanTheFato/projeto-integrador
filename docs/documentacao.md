# Documentação do Zeno — Central de Despacho

> **Para quem é este documento.** Para quem vai escrever, revisar ou apresentar a
> documentação do projeto sem ter escrito o código. Ele explica *o que existe*,
> *para que serve* e *por que foi feito assim*, em ordem, sem supor que você já
> conhece o sistema.
>
> O `README.md` da raiz continua sendo o manual de instalação e execução: como
> instalar o Python 3.12, compilar o módulo C++, subir o Postgres, treinar a
> rede. **Este documento não repete aquilo.** Aqui está o retrato do sistema.

---

## Índice

1. [O sistema em uma página](#1-o-sistema-em-uma-página)
2. [O que mudou desde a primeira versão](#2-o-que-mudou-desde-a-primeira-versão)
3. [As quatro peças e como elas conversam](#3-as-quatro-peças-e-como-elas-conversam)
4. [A rede neural](#4-a-rede-neural)
5. [O backend](#5-o-backend)
6. [O frontend, tela por tela](#6-o-frontend-tela-por-tela)
7. [O banco de dados](#7-o-banco-de-dados)
8. [Como subir tudo, versão curta](#8-como-subir-tudo-versão-curta)
9. [Decisões que valem ser explicadas](#9-decisões-que-valem-ser-explicadas)
10. [Limitações conhecidas](#10-limitações-conhecidas)
11. [Glossário](#11-glossário)

---

## 1. O sistema em uma página

**O Zeno é uma central de despacho para o Corpo de Bombeiros de Taubaté.** Um
operador registra a ocorrência, escolhe a viatura, despacha — e o sistema
calcula por qual caminho a viatura deve ir.

O que diferencia o projeto de um sistema de despacho comum é *como* esse caminho
é escolhido. A maioria dos sistemas usa o caminho mais curto em metros. O Zeno
usa uma **rede neural treinada sobre o mapa real de Taubaté**, que estima quanto
tempo uma viatura levaria para percorrer cada rua da cidade levando em conta o
tipo de via, a velocidade permitida, o número de faixas e o contexto do entorno.

O sistema mostra **as duas rotas lado a lado** — a da rede neural e a mais curta
em metros — com distância e tempo estimado de cada uma. Essa comparação é o
argumento do projeto: uma rota 46 metros mais longa por uma avenida chega antes
que uma rota mais curta por ruas estreitas.

Além do despacho, o sistema mantém o cadastro da corporação (efetivo, viaturas,
guarnições, escalas, unidades), acompanha as ocorrências em tempo real e
apresenta **estatísticas do histórico**: onde as ocorrências se concentram, a
que horas chegam, quanto tempo a primeira viatura leva para chegar e quais
endereços não param de voltar.

---

## 2. O que mudou desde a primeira versão

Esta seção existe porque a documentação anterior foi escrita quando o projeto
tinha **apenas quatro coisas prontas**: a rede neural, o mapa 3D, o design e a
tela de login. Tudo o mais veio depois. Se você está atualizando um texto
antigo, é esta tabela que diz o tamanho do trabalho.

| Área | Primeira versão | Hoje |
|---|---|---|
| **Rede neural** | Script de terminal (`main.py`) que pedia coordenadas e gerava um `rota.html` | Serviço HTTP FastAPI na porta 8000, com grafo e modelo carregados em memória, treinamento disparado pela interface e progresso reportado época a época |
| **Mapa 3D** | Página estática com uma rota fixa embutida no código | Componente React que recebe a geometria da API, mostra quartéis, área de cobertura da malha, modo teatro e tela cheia |
| **Backend** | Não existia | API Fastify completa: autenticação JWT com três papéis, nove recursos CRUD, ciclo de despacho, WebSocket de eventos, ponte com a IA, testes unitários e de ponta a ponta |
| **Banco de dados** | Não existia | PostgreSQL com Prisma: unidades hierárquicas, efetivo, viaturas, guarnições, escalas, ocorrências, despachos, rotas e execuções de treinamento |
| **Frontend** | Login e design | Treze telas: painel operacional, ocorrências, detalhe, despachos, rotas, estatísticas, rede neural e seis telas de cadastro |
| **Tempo real** | Não existia | WebSocket que empurra criação e mudança de ocorrência, despacho e viatura para todas as telas abertas |
| **Estatísticas** | Não existia | Tela dedicada com mapa de quatro modos, série temporal, grade dia × hora, rankings, recorrências e tempo de resposta |
| **Dados** | Nenhum | Seed determinístico com um ano de ocorrências plausíveis |

---

## 3. As quatro peças e como elas conversam

O sistema são **quatro processos separados**, que precisam estar todos no ar
para funcionar por completo.

```
   ┌──────────────┐   HTTP    ┌──────────────┐   HTTP   ┌──────────────┐
   │   Frontend   │ ────────► │   Backend    │ ───────► │  Serviço de  │
   │    React     │ ◄──────── │   Fastify    │ ◄─────── │  IA (Python) │
   │  porta 5173  │  WebSocket│  porta 3333  │          │  porta 8000  │
   └──────────────┘           └──────┬───────┘          └──────────────┘
                                     │                          │
                                     │ Prisma                   │ carrega
                                     ▼                          ▼
                              ┌──────────────┐          ┌──────────────┐
                              │  PostgreSQL  │          │  Grafo OSM + │
                              │  porta 5432  │          │  modelo .pth │
                              └──────────────┘          └──────────────┘
```

**Quem fala com quem, e por quê:**

- **O frontend só fala com o backend.** Ele nunca chama o serviço de IA
  diretamente. Isso mantém a autenticação num lugar só e permite que o backend
  registre no banco tudo o que a IA responde.
- **O backend é o dono das regras.** Ele decide se um despacho pode acontecer,
  qual viatura fica empenhada, quando uma ocorrência muda de estado. O serviço
  de IA não sabe nada disso.
- **O serviço de IA responde duas perguntas** e mais nada: "qual a melhor rota
  entre estes dois pontos" e "qual o estado do modelo". Ele não tem banco, não
  tem autenticação, e é o único que carrega PyTorch.
- **O backend sobrevive à IA fora do ar.** Se a porta 8000 não responde, o
  despacho ainda acontece — a viatura é enviada, e a resposta traz um aviso
  dizendo que a rota não pôde ser calculada. Uma indisponibilidade da IA nunca
  pode impedir o envio de uma viatura.

---

## 4. A rede neural

> O `README.md` explica a arquitetura em detalhe. Esta seção é o resumo que
> cabe num slide, mais o que foi construído em volta dela depois.

### O que ela faz

O mapa de Taubaté vem do OpenStreetMap como um **grafo**: **8.610 cruzamentos**
ligados por **20.070 trechos de rua**. Para cada trecho, a rede estima **quanto
tempo uma viatura levaria para percorrê-lo**.

Com esse tempo estimado em cada rua, achar a melhor rota vira um problema
clássico: o algoritmo de Dijkstra encontra o caminho de menor custo total. A
diferença é que o custo não é distância, é tempo estimado pela rede.

### Por que uma rede de grafos (GNN)

Uma rua de 500 metros numa rodovia não é a mesma coisa que 500 metros num beco.
Uma rede comum olharia só para as características do trecho. Uma **GNN** olha
também para a vizinhança: em duas rodadas de propagação, cada cruzamento
incorpora informação dos cruzamentos até duas ruas de distância.

Na prática: ao estimar o custo da rua A→B, a rede sabe se logo depois de B há
uma avenida larga ou um labirinto de ruas estreitas.

A arquitetura é **GAT + MLP** — o GAT (Graph Attention Network) gera a
representação de contexto de cada cruzamento; o MLP recebe
`[contexto_da_origem + contexto_do_destino + features_da_rua]` e devolve um
número em segundos.

### Como saber se um treino foi bom

A métrica é a **loss de validação**: o erro do modelo em ruas que ele *não* viu
durante o treino. **A meta do projeto é 0,0600.** Abaixo disso o modelo é
considerado bom o bastante para substituir o anterior.

O treinador imprime uma linha a cada 50 épocas, e essas linhas agora são
guardadas: cada execução de treinamento registra a série inteira no banco, o que
permite desenhar a curva em vez de mostrar só o número final.

### O que o serviço de IA expõe

| Rota | O que faz |
|---|---|
| `GET /health` | Sinal de vida |
| `GET /model` | Se o modelo está carregado, a versão, o tamanho do grafo e **os limites da malha** |
| `POST /routes` | Calcula as duas rotas entre dois pontos |
| `POST /training` | Dispara um treinamento em segundo plano |
| `GET /training/{id}` | Progresso da execução, incluindo a série época a época |

**Os limites da malha** (`bounds`) merecem explicação. O polígono do município e
a malha viária mapeada não são a mesma coisa: o norte rural de Taubaté quase não
tem ruas no OpenStreetMap. Um ponto pode estar dentro da cidade e ainda assim
ser recusado por estar a mais de **2 km** da rua mapeada mais próxima. O serviço
informa o retângulo real que a malha ocupa, e a interface desenha esse retângulo
tracejado no mapa — assim o operador sabe onde pode clicar *antes* de tentar.

---

## 5. O backend

**Fastify + Prisma + PostgreSQL, em TypeScript.** Sobe em
`http://localhost:3333/api/v1`.

### Autenticação e papéis

Login devolve um **JWT**, aceito no header `Authorization: Bearer` ou num cookie
`httpOnly`. Existem três papéis:

| Papel | Pode |
|---|---|
| `OPERADOR` | Registrar ocorrências, despachar viaturas, ver tudo o que é operacional |
| `COMANDANTE` | Tudo do operador, mais o cadastro de unidades |
| `ADMIN` | Tudo, mais criar contas e **treinar a rede neural** |

Treinar é uma ação de administrador porque **substitui o modelo do qual todo
despacho depende, sem volta**.

### Recursos

`/units`, `/firefighters`, `/vehicles`, `/crews`, `/shifts`, `/occurrences`,
`/dispatches`, `/ai/*` e o WebSocket `/realtime`.

### O ciclo de um despacho

Criar um despacho faz três coisas numa transação só: registra o despacho, marca
a viatura como `EMPENHADA` e move a ocorrência para `DESPACHADA`. Em seguida a
rota é pedida à IA e **as duas variantes são gravadas lado a lado** — é essa
comparação que o projeto existe para demonstrar.

```
DESPACHADO ──► A_CAMINHO ──► NO_LOCAL ──► RETORNANDO ──► FINALIZADO
     │              │
     └──────────────┴──► CANCELADO   (só antes de chegar ao local)
```

Pular etapa é recusado com erro 400. `NO_LOCAL` move a ocorrência para
`EM_ATENDIMENTO`; `FINALIZADO` e `CANCELADO` liberam a viatura.

### Tempo real

O WebSocket transmite `occurrence.created`, `occurrence.updated`,
`dispatch.created`, `dispatch.updated` e `vehicle.moved`. Como o navegador não
consegue enviar header no handshake, o token vai na query string.

É por isso que uma ocorrência registrada num computador aparece sozinha na tela
de outro, sem ninguém apertar atualizar.

---

## 6. O frontend, tela por tela

**React 19 + Vite + Tailwind + MapLibre GL.** Sobe em `http://localhost:5173`.

A regra de leitura: as telas **operacionais** ficam sempre a um clique na barra;
as de **cadastro** ficam num menu suspenso, porque durante um plantão ninguém
mexe nelas.

### Painel (`/`)

A tela de parede. Ocorrências em aberto separadas por gravidade, viaturas
disponíveis e empenhadas, despachos em andamento, efetivo ativo, as últimas
ocorrências e o estado do modelo. Um feed ao vivo mostra os eventos chegando
pelo WebSocket, o que prova que o tempo real funciona.

> As contagens de gravidade somam **aguardando + despachadas + em atendimento**.
> Contar só as `ABERTA` fazia todo número aparecer como "Leves", porque uma
> ocorrência grave é despachada em segundos e sai daquela caixa imediatamente.

### Ocorrências (`/ocorrencias`)

Lista com filtros de situação, natureza, prioridade e busca por protocolo,
endereço ou descrição. Cada cartão tem a cor da prioridade.

**Registrar uma ocorrência** abre um formulário com **mapa embutido**: em vez de
digitar coordenadas às cegas, o operador clica no mapa. Os quartéis aparecem no
mapa desde o início, e ao marcar o local o sistema **sugere a unidade
responsável mais próxima**, com a distância.

### Detalhe da ocorrência (`/ocorrencias/:id`)

Todos os dados do chamado, o mapa com a rota calculada (ou, se ainda não houve
despacho, o local e os quartéis em volta), a comparação entre as duas rotas, os
despachos e os botões que avançam o estado.

### Despachos (`/despachos`)

O quadro de viaturas empenhadas, com o botão que avança cada despacho pelo ciclo
de estados.

### Rotas (`/rotas`)

O laboratório da rede neural — a tela para **demonstrar o modelo fora de uma
ocorrência real**. Escolhe-se a origem (um quartel ou coordenadas), marca-se o
destino clicando no mapa, e as duas rotas aparecem lado a lado com tempo,
distância e número de cruzamentos, mais um veredito em texto do quanto a rede
economizou.

Nada aqui é gravado no banco.

### Estatísticas (`/estatisticas`)

A tela do comandante, não do operador. Todos os números respondem aos filtros no
topo (período, natureza, situação, prioridade) e são comparados com o **período
anterior de mesma duração**.

O mapa tem **quatro modos**, porque "onde acontecem as ocorrências" são quatro
perguntas diferentes:

| Modo | Responde |
|---|---|
| **Calor** | Onde os chamados se concentram |
| **Pontos** | Qual chamado foi aquele — clicável até o registro |
| **Cobertura** | O território real de cada quartel, cada ponto na cor de quem atendeu |
| **Recorrências** | Os endereços que voltam, com o círculo crescendo com a contagem |

Abaixo do mapa: série temporal contra o período anterior, grade **dia da semana ×
hora do dia**, rankings de onde mais e onde menos acontece, por natureza e por
quartel, endereços recorrentes e **tempo médio de resposta** por natureza.

### Rede neural (`/rede-neural`)

Estado do modelo carregado, disparo de treinamento (só para administradores) e
**quatro gráficos**:

1. **Curva de perda** — treino e validação ao longo das épocas, com a distância
   entre as duas sombreada (esse vão *é* o overfitting), a época do melhor
   checkpoint marcada e a região que o *early stopping* dispensou.
2. **Comparação entre treinos** — a melhor loss de cada execução contra a meta.
3. **Épocas × qualidade** — uma bolha por treino, tamanho pelo tempo gasto.
   Responde se treinar mais tempo compensa.
4. **Épocas até a meta** — dois treinos podem terminar iguais com um deles tendo
   chegado lá em um terço do tempo.

### Cadastros

`/efetivo`, `/viaturas`, `/guarnicoes`, `/turnos`, `/unidades` (comandante ou
admin) e `/usuarios` (só admin).

---

## 7. O banco de dados

PostgreSQL, modelado com Prisma em `backend/prisma/schema.prisma`.

| Entidade | O que guarda |
|---|---|
| `Unit` | Unidades da corporação, em hierarquia (comando → grupamento → posto) |
| `Firefighter` | Efetivo, com posto/graduação e situação |
| `Vehicle` | Viaturas, com tipo, capacidade e situação |
| `Crew` / `CrewMember` | Guarnições e seus integrantes |
| `Shift` | Escalas de plantão |
| `Occurrence` | Ocorrências, com protocolo sequencial por ano |
| `Dispatch` | O empenho: liga ocorrência, viatura e guarnição |
| `Route` | As rotas calculadas, uma linha por variante (neural e Dijkstra) |
| `TrainingRun` | Execuções de treinamento, com progresso e série de métricas |

### O seed de ocorrências

`backend/scripts/seed-occurrences.ts`, rodável com `npm run seed:occurrences`.

As telas que leem o passado foram construídas contra **catorze linhas digitadas à
mão durante testes**, todas em duas ruas e dois dias. Nada nesse formato mostra
se um mapa de calor funciona ou se um ranking ordena. O seed escreve **um ano com
a estrutura que um registro real tem**:

- 18 bairros reais de Taubaté com pesos muito diferentes (o Centro pesa 100, São
  Gonçalo pesa 6), em ruas reais, para os pontos caírem na malha viária;
- sazonalidade — incêndio em vegetação triplica de junho a setembro, a seca do
  vale; afogamento se concentra no verão;
- perfis de horário por natureza — atendimento pré-hospitalar puxa para a noite,
  vistoria para o horário comercial;
- **cinco endereços recorrentes** plantados de propósito, porque um registro sem
  recorrências é um registro que nenhuma análise consegue ler;
- auxílio mútuo: 85% dos chamados vão para o posto mais próximo, o resto não.

São **370 ocorrências** e 368 despachos, distribuídos por **quatro postos**.

> **Dois avisos.** O seed **apaga as ocorrências existentes** — e apagar uma
> ocorrência arrasta seus despachos e as rotas calculadas para eles. Ele grava
> tudo em `backend/.backups/` antes. E ele **cria três postos** além do que
> existia, porque o cadastro tinha um único quartel dentro de Taubaté, o que
> torna "quartel mais próximo" uma pergunta de resposta única.

---

## 8. Como subir tudo, versão curta

> Instalação completa: `README.md`. Isto aqui é a sequência do dia a dia,
> **nesta ordem**.

```bash
# 1. Banco (Windows: o cluster fica em C:\pgsql-data, fora do OneDrive)
#    Confirme que a porta 5432 responde.

# 2. Serviço de IA — leva cerca de um minuto carregando o grafo
cd machine/
poetry run uvicorn api.main:app --host 127.0.0.1 --port 8000

# 3. Backend
cd backend/
npm run dev            # http://localhost:3333/api/v1

# 4. Frontend
cd frontend/
npm run dev            # http://localhost:5173
```

**Login de demonstração:** `admin@bombeiros.local` / `admin12345`
(criados pelo `backend/prisma/seed.ts`, configuráveis por variável de ambiente).

**Se der errado:**

| Sintoma | Causa provável |
|---|---|
| Tela de rede neural diz "serviço indisponível" | A porta 8000 não está no ar |
| Rota não calcula, mas o resto funciona | Idem — o backend responde 503 de propósito |
| `EADDRINUSE` ao subir o backend | Já existe um processo na 3333 |
| O backend reinicia em loop com `npm run dev` | O `--watch` reage à sincronização do OneDrive; rode `npx tsx ./src/server.ts` |
| Mapa em branco | Sem internet: o mapa base vem do OpenFreeMap |

---

## 9. Decisões que valem ser explicadas

Estas são as perguntas que uma banca faz. Cada uma tem uma resposta curta.

**Por que a rota neural às vezes é mais longa em metros?**
Porque ela otimiza *tempo*, não distância. Aceitar 46 metros a mais por uma
avenida para economizar 14 segundos é exatamente o comportamento desejado.

**Por que o backend não chama a IA de dentro do frontend?**
Autenticação num lugar só, e o backend precisa gravar no banco o que a IA
respondeu. O frontend nunca vê a porta 8000.

**Por que o despacho acontece mesmo com a IA fora do ar?**
Porque a viatura precisa sair. A rota é um auxílio, não um pré-requisito. O
sistema responde 201 com um aviso em vez de erro.

**Por que as estatísticas são calculadas no navegador?**
Para não encher o backend de endpoints em formato de relatório, cada um com
filtros, paginação e testes próprios. Aguenta os milhares de ocorrências que um
corpo de bombeiros municipal registra por ano — e a tela **avisa em laranja**
quando passa do teto de mil, em vez de silenciosamente relatar menos.

**Por que a série de métricas do treino é uma coluna JSON?**
Porque ela só é lida inteira, para desenhar a curva. Uma tabela separada com uma
linha por época teria índice, chave estrangeira e migração para nada.

**Por que o bairro é adivinhado do texto do endereço?**
Porque não existe coluna de bairro — o endereço é um campo livre. A heurística
descarta número e cidade e fica com o que sobrou no fim. Quando não dá para ler,
o endereço é contado como "Não informado" em vez de ser arquivado com o nome da
rua.

**As cores dos gráficos foram escolhidas por quê?**
São o vermelho e o azul da própria aplicação, verificados num validador de
paleta: pior par adjacente com ΔE 18,9 em protanopia e 32,0 em visão normal.
Mesmo assim nenhuma identidade depende só da cor — todo gráfico tem legenda e
todo valor está também em texto ou tabela.

---

## 10. Limitações conhecidas

Vale ter esta lista à mão: uma limitação assumida soa muito melhor que uma
limitação descoberta pela banca.

- **A malha viária é só de Taubaté.** Um ponto a mais de 2 km de rua mapeada é
  recusado. O norte rural do município cai nessa condição.
- **O tempo estimado é uma estimativa do modelo**, não uma medição de trânsito
  real. Não há dado de tráfego em tempo real.
- **As estatísticas carregam até mil ocorrências** no navegador. Acima disso o
  certo é agregar em SQL.
- **A curva de treinamento só existe para execuções novas.** Os treinos
  anteriores à coluna de histórico não têm a série gravada.
- **Os despachos do seed não têm rota traçada**, porque o seed escreve direto no
  banco sem chamar a IA.
- **Os três postos extras são dados de demonstração**, criados pelo seed para
  que a cobertura por quartel tenha mais de uma região.
- **A ordenação da lista de ocorrências é por prioridade**, então paginar sobre
  ela não devolve ordem cronológica.

---

## 11. Glossário

| Termo | O que é |
|---|---|
| **Grafo** | Pontos ligados por linhas. Aqui: cruzamentos ligados por ruas |
| **Nó / aresta** | O ponto e a linha. 8.610 nós, 20.070 arestas em Taubaté |
| **GNN** | Rede neural que trabalha sobre um grafo, propagando informação entre vizinhos |
| **GAT** | *Graph Attention Network*. A GNN usada aqui; aprende quanto peso dar a cada vizinho |
| **MLP** | Rede densa comum. Aqui é a parte que devolve o número final em segundos |
| **Feature** | Uma informação de entrada. Cada rua fornece nove |
| **One-hot** | Representar categoria como colunas de 0 e 1, para a rede não achar que "tipo 4 > tipo 1" |
| **Época** | Uma passagem completa pelos dados de treino |
| **Loss** | O quanto a estimativa erra. Menor é melhor |
| **Loss de validação** | O erro em ruas que o modelo não viu treinando. É a métrica que vale |
| **Overfitting** | O modelo decorar o treino em vez de aprender. Aparece como a loss de validação parando de cair enquanto a de treino continua |
| **Early stopping** | Parar o treino quando a validação para de melhorar |
| **Learning rate** | O tamanho do passo a cada ajuste dos pesos |
| **Checkpoint** | O arquivo com os pesos salvos (`models/path_network.pth`) |
| **Dijkstra** | Algoritmo clássico de menor caminho. Usado aqui sobre o custo que a rede estimou |
| **Snap** | Encaixar uma coordenada no cruzamento mapeado mais próximo |
| **JWT** | O crachá assinado que o login devolve e o navegador reenvia |
| **WebSocket** | Conexão que fica aberta e permite ao servidor empurrar eventos |
| **Prisma** | A camada que traduz TypeScript em SQL e versiona o banco por migrações |
| **Seed** | Script que popula o banco com dados iniciais |
| **MapLibre GL** | A biblioteca que desenha os mapas, inclusive o 3D |
