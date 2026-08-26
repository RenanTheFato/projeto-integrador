# Guia de apresentação — Zeno, Central de Despacho

> **Para quem é este documento.** Para quem vai montar os slides e apresentar,
> mesmo sem ter escrito o código. Ele traz a ordem dos slides, **o que dizer em
> cada um**, o roteiro da demonstração ao vivo clique a clique, o plano B se
> alguma coisa cair, e as perguntas prováveis já respondidas.
>
> O conteúdo técnico de apoio está em [`documentacao.md`](documentacao.md).
> Se uma frase daqui gerar dúvida, a resposta longa está lá.

---

## A ideia que a apresentação precisa entregar

Se a banca sair da sala lembrando de **uma** frase, que seja esta:

> **A rota mais curta não é a mais rápida — e nós treinamos uma rede neural
> sobre o mapa real de Taubaté para saber a diferença.**

Todo o resto da apresentação é sustentação disso: o mapa é real, a rede é
treinada de verdade, e existe um sistema completo em volta para provar que
funciona numa operação, não só num notebook.

**O erro a evitar:** gastar dez minutos explicando o que é uma rede neural e
dois minutos mostrando o sistema. Inverta. A banca quer ver funcionando.

---

## Roteiro — 15 minutos

| # | Slide | Tempo |
|---|---|---|
| 1 | Capa | 20 s |
| 2 | O problema | 1 min |
| 3 | A ideia | 1 min |
| 4 | Como a rede aprende | 2 min |
| 5 | A arquitetura do sistema | 1 min 30 |
| 6 | **Demonstração ao vivo** | 5 min |
| 7 | O que os números mostram | 1 min 30 |
| 8 | Como sabemos que o modelo é bom | 1 min |
| 9 | O que foi construído | 1 min |
| 10 | Limitações e próximos passos | 1 min |
| 11 | Encerramento | 20 s |

---

### Slide 1 — Capa

**No slide:** logo do Zeno, "Central de Despacho — Corpo de Bombeiros de
Taubaté", nomes do grupo, disciplina, data.

**Falar:** só o nome do projeto e o que ele é em uma frase. Não leia a capa.

---

### Slide 2 — O problema

**No slide:** um mapa com dois trajetos entre os mesmos dois pontos, um curto e
um longo. Sem números ainda.

**Falar:**

> "Quando uma viatura sai para uma ocorrência, alguém decide por onde ela vai.
> Os sistemas de navegação comuns respondem com o caminho mais curto em metros.
> Só que quinhentos metros de avenida não são a mesma coisa que quinhentos
> metros de rua estreita de bairro. Para uma ambulância, essa diferença é
> medida em minutos — e em emergência, minuto é resultado."

**Não diga** "o Google Maps está errado". Diga que ele resolve outro problema.

---

### Slide 3 — A ideia

**No slide:** o grafo de Taubaté (uma imagem da malha viária) com os dois
números grandes: **8.610 cruzamentos** e **20.070 ruas**.

**Falar:**

> "Nós baixamos o mapa real de Taubaté do OpenStreetMap. Ele vira um grafo:
> 8.610 cruzamentos ligados por 20.070 trechos de rua. Para cada trecho,
> treinamos uma rede neural para estimar **quanto tempo uma viatura levaria para
> percorrê-lo** — não o comprimento, o tempo. Com esse tempo em cada rua, achar
> a melhor rota vira um problema clássico que o algoritmo de Dijkstra resolve."

---

### Slide 4 — Como a rede aprende

**No slide:** um cruzamento no centro, vizinhos em volta, setas apontando para
dentro. Ao lado, a lista das nove informações de entrada.

**Falar:**

> "Usamos uma rede neural de grafos. A diferença dela para uma rede comum é que
> cada cruzamento **olha para os vizinhos**. Em duas rodadas, cada ponto do mapa
> carrega informação dos pontos até duas ruas de distância.
>
> Na prática: quando a rede estima o custo de ir de A para B, ela sabe o que
> tem **depois** de B. Se logo adiante há uma avenida, aquele trecho vale mais
> do que o comprimento dele sugere. Se depois vem um labirinto de ruas
> estreitas, vale menos.
>
> Cada rua entrega nove informações: comprimento, velocidade permitida, número
> de faixas, se é mão única, e o tipo de via."

**Se perguntarem o nome:** GAT — *Graph Attention Network* — como codificador de
contexto, e uma MLP como regressor final. Diga o nome só se perguntarem; o
conceito importa mais que a sigla.

---

### Slide 5 — A arquitetura do sistema

**No slide:** o diagrama das quatro peças (frontend → backend → serviço de IA, e
o banco).

**Falar:**

> "O sistema são quatro processos. A interface em React fala só com o backend. O
> backend, em Node, é o dono das regras: quem pode despachar, qual viatura fica
> empenhada, quando a ocorrência muda de estado — e é ele que grava tudo no
> Postgres. O serviço em Python responde duas perguntas e mais nada: qual a
> melhor rota entre dois pontos, e qual o estado do modelo.
>
> Uma decisão de projeto que vale citar: **se o serviço de IA cair, o despacho
> ainda acontece.** A viatura sai, e o sistema avisa que a rota não pôde ser
> calculada. A rota é um auxílio, nunca um pré-requisito para socorrer alguém."

Essa última frase costuma render pontos com a banca. Não corte.

---

### Slide 6 — Demonstração ao vivo

**No slide:** só o título "Demonstração". Ninguém deve estar lendo slide
enquanto você mostra o sistema.

Roteiro detalhado na seção seguinte.

---

### Slide 7 — O que os números mostram

**No slide:** captura da tela de Estatísticas em modo **Calor**, e ao lado a
grade dia × hora.

**Falar:**

> "O sistema também acumula histórico. Esta tela responde onde as ocorrências se
> concentram, a que horas chegam, quanto tempo a primeira viatura leva para
> chegar, e quais endereços não param de voltar. É a tela do comandante, não a
> do operador: serve para decidir onde um quartel deveria estar e como uma
> escala deveria ser montada."

---

### Slide 8 — Como sabemos que o modelo é bom

**No slide:** captura da **curva de perda**, com o vão entre treino e validação
sombreado.

**Falar:**

> "Treinar é fácil; saber se treinou bem é o difícil. Nós separamos parte das
> ruas e **não** mostramos elas para a rede durante o treino. O erro nessas ruas
> reservadas é a métrica que vale. A meta do projeto é 0,0600.
>
> A área sombreada entre as duas linhas é a distância entre o erro no treino e o
> erro na validação. Enquanto ela é fina, o modelo está aprendendo a cidade.
> Quando ela abre, o modelo está decorando o treino — é overfitting, e o
> treinamento para sozinho quando isso acontece."

---

### Slide 9 — O que foi construído

**No slide:** uma lista curta, com números.

- Serviço de IA em FastAPI, com treinamento disparado pela interface
- API completa: autenticação com três papéis, nove recursos, WebSocket de eventos
- Treze telas, do painel de parede ao cadastro de escalas
- Banco PostgreSQL com migrações versionadas
- Testes unitários e um teste de ponta a ponta com 57 verificações

**Falar:** passe rápido. É o slide que prova volume de trabalho, não o que
convence.

---

### Slide 10 — Limitações e próximos passos

**No slide:** duas colunas.

**Limitações:**
- A malha é só de Taubaté; pontos a mais de 2 km de rua mapeada são recusados
- O tempo é estimado pelo modelo, sem dado de trânsito em tempo real
- As estatísticas carregam até mil ocorrências no navegador

**Próximos passos:**
- Trânsito em tempo real como entrada do modelo
- Posição das viaturas por GPS
- Agregação das estatísticas no banco, para escalar

**Falar:** assumir limitação antes de ser perguntado é o que separa um trabalho
maduro de um trabalho defendido. Diga com naturalidade.

---

### Slide 11 — Encerramento

Volte à frase do início:

> "A rota mais curta não é a mais rápida. O sistema mostra as duas, lado a lado,
> e deixa o número decidir."

---

## A demonstração ao vivo, clique a clique

**Antes de começar, deixe as quatro abas/janelas prontas e o login já feito.**
Não digite senha na frente da banca.

### 1. Painel — 30 segundos

Abra em `/`.

> "Esta é a tela de parede da central: ocorrências em aberto por gravidade,
> viaturas disponíveis, despachos em andamento."

Aponte o **feed ao vivo** no canto: "isso é um WebSocket; o que acontece num
computador aparece aqui sem ninguém atualizar a página."

### 2. Rotas — 2 minutos (o coração da apresentação)

Abra `/rotas`. **É aqui que o projeto se prova.**

1. Em **Origem**, escolha um quartel na lista. Aponte que os quartéis já estão
   desenhados no mapa.
2. **Clique no mapa** para marcar o destino. Diga: "não preciso digitar
   coordenada, clico onde a ocorrência é."
3. Repare no aviso azul: **"Quartel mais próximo do destino"**. Comente que o
   sistema sugere de onde sair.
4. Clique em **Calcular rota**.
5. Espere as duas linhas aparecerem — a vermelha é a neural, a azul tracejada é
   a mais curta em metros.
6. **Aponte o painel de comparação à direita** e leia os números em voz alta.

Exemplo real (Centro → Parque Aeroporto). **Rode antes e anote os seus:**

| | Distância | Tempo estimado |
|---|---|---|
| Rede neural | 5.881 m | 19:39 min |
| Menor distância | 5.835 m | 19:53 min |

> "A rede aceitou 46 metros a mais de percurso e economizou 14 segundos. É
> pouco? Numa cidade de dez quilômetros, sim. Em uma ocorrência com vítima, 14
> segundos são 14 segundos."

7. **Ative o 3D** e deixe a órbita rodar. Depois **Seguir rota**, que faz a
   câmera percorrer o trajeto como um navegador de carro. Isso costuma arrancar
   reação — deixe rodar uns segundos em silêncio.
8. Se a tela estiver apertada, clique em **Teatro** para o mapa tomar a página.

### 3. Ocorrências — 1 minuto

Abra `/ocorrencias` e clique em **Nova ocorrência**.

> "Registrar um chamado: natureza, prioridade, e o local marcado clicando no
> mapa. O sistema sugere qual quartel é o mais próximo."

Não precisa salvar. Feche o formulário.

Abra uma ocorrência já existente da lista e mostre o mapa com a rota calculada e
a comparação.

### 4. Estatísticas — 1 minuto

Abra `/estatisticas` e passe pelos **quatro modos do mapa**, dizendo uma frase
em cada:

- **Calor** — "onde a cidade mais chama"
- **Pontos** — "cada chamado, clicável até o registro"
- **Cobertura** — "o território real de cada quartel"
- **Recorrências** — "os endereços que não param de voltar"

Desça até a **grade dia × hora** e diga: "isto é o que uma escala deveria
olhar — noite de sábado e noite de terça não são a mesma noite."

### 5. Rede neural — 30 segundos

Abra `/rede-neural` e mostre a **curva de perda** e a **comparação entre
treinos**.

> "Cada treinamento fica registrado, com a curva inteira. Dá para ver qual
> corrida chegou à meta e em quantas épocas."

**Não dispare um treinamento ao vivo** — leva minutos e trava o ritmo.

---

## Plano B

Ensaie isto. É o que salva a apresentação.

| Se… | Faça |
|---|---|
| **O serviço de IA não sobe** | Ele leva ~1 min carregando o grafo. Suba **antes** da apresentação e confirme que `http://127.0.0.1:8000/model` responde `"loaded": true` |
| **A internet cai** | O mapa base vem de um servidor de tiles online. Tenha **capturas de tela** de todas as telas do roteiro num slide oculto ao fim do deck |
| **A rota não calcula** | Verifique se o destino caiu dentro do retângulo tracejado. Fora dele, o modelo recusa — e isso é um comportamento correto que você pode explicar em vez de esconder |
| **O backend não sobe** (`EADDRINUSE`) | Já há um processo na porta 3333. Finalize-o e suba de novo |
| **Alguma tela demora** | Fale por cima: descreva o que vai aparecer. Silêncio esperando tela é o que deixa a banca desconfortável |

**Grave um vídeo curto da demonstração como último recurso.** Um vídeo de dois
minutos rodando é infinitamente melhor que cinco minutos de tela travada.

---

## Perguntas prováveis, com resposta

**"Por que não usaram o Google Maps / uma API pronta?"**
> Porque o objetivo não era achar uma rota, era **aprender o custo das ruas a
> partir dos dados da própria cidade**. Uma API pronta responde a rota e não
> ensina nada; além disso, o modelo pode ser retreinado com dados do próprio
> corpo de bombeiros.

**"A rota da rede foi mais longa. Não é pior?"**
> Mais longa em metros, mais rápida em tempo estimado. É exatamente o que
> queríamos: o sistema otimiza tempo, não distância.

**"Como vocês sabem que o tempo estimado está certo?"**
> Não medimos trânsito real — essa é uma limitação assumida. O que validamos é
> que o modelo generaliza: ele acerta o custo de ruas que **não** viu durante o
> treino, e é esse erro que reportamos.

**"Quantos dados foram usados para treinar?"**
> O grafo inteiro de Taubaté: 20.070 trechos de rua, separados entre treino e
> validação antes do treinamento começar.

**"O que acontece se a IA cair no meio de uma emergência?"**
> A viatura sai do mesmo jeito. O despacho é registrado, a viatura é empenhada e
> o sistema avisa que a rota não pôde ser calculada. Foi uma decisão consciente.

**"Esses dados de ocorrência são reais?"**
> Não. São dados sintéticos gerados para a demonstração, com a estrutura que um
> registro real tem — bairros de peso diferente, sazonalidade, picos de horário.
> O **mapa** é real; as ocorrências são fictícias.

**"Dá para usar em outra cidade?"**
> Sim, trocando o nome da cidade e retreinando. O grafo vem do OpenStreetMap.

**"Quanto tempo leva para treinar?"**
> Da ordem de minutos, em CPU. Uma corrida de 60 épocas levou 45 segundos na
> máquina de desenvolvimento, o que coloca as 800 épocas do padrão do projeto
> perto de dez minutos. **Meça na máquina da apresentação e cite o seu número**,
> a tela de Rede Neural mostra a duração de cada treino.

**"Quem pode treinar o modelo pelo sistema?"**
> Só administrador. Treinar substitui o modelo do qual todo despacho depende, e
> não há como voltar atrás.

---

## Checklist dos 10 minutos antes

- [ ] Postgres no ar (porta 5432)
- [ ] Serviço de IA no ar e **`/model` respondendo `"loaded": true`**
- [ ] Backend no ar (porta 3333)
- [ ] Frontend no ar (porta 5173)
- [ ] Login já feito no navegador, sessão aberta
- [ ] Abas prontas: Painel, Rotas, Estatísticas, Rede neural
- [ ] Uma rota já calculada uma vez, para o mapa estar em cache
- [ ] Zoom do navegador em 100%, notificações desligadas
- [ ] Slides com as capturas de tela de emergência ao fim
- [ ] Números da sua rota de exemplo anotados

---

## Colinha de números

| Número | O que é |
|---|---|
| **8.610** | Cruzamentos no grafo de Taubaté |
| **20.070** | Trechos de rua |
| **9** | Informações que cada rua entrega ao modelo |
| **2** | Rodadas de propagação da rede de grafos |
| **0,0600** | Meta de erro na validação |
| **2 km** | Distância máxima da malha para um ponto ser aceito |
| **3** | Papéis de usuário: operador, comandante, administrador |
| **4** | Processos: banco, IA, backend, interface |
| **13** | Telas do sistema |
| **370** | Ocorrências do histórico de demonstração |
| **57** | Verificações do teste de ponta a ponta |
