/**
 * Replaces the incident history with a year of plausible calls.
 *
 * The screens that read the past — the statistics page above all — were built
 * against fourteen rows typed by hand while testing, all in two streets and two
 * days. Nothing about that shape can show whether a heat map works, whether a
 * ranking ranks, or whether a recurrence is visible, so this writes a year of
 * incidents with the structure a real record has: neighbourhoods that call far
 * more than others, vegetation fires that arrive with the dry season, a rush
 * that peaks in the late afternoon and a lull at four in the morning, and a
 * handful of addresses that keep coming back.
 *
 * It is synthetic data for a demonstration, not a claim about Taubaté. The
 * streets and neighbourhoods are real so the points land on the street graph;
 * the calls, the callers and their phone numbers are invented.
 *
 * Two things it is careful about:
 *
 *  - Everything it is about to destroy is written to a JSON file first, named
 *    in the output. Deleting an occurrence cascades to its dispatches and to
 *    the routes the AI calculated for them, and none of that comes back.
 *  - It is deterministic. The same seed produces the same year, so a
 *    screenshot taken today still matches the screen tomorrow.
 *
 * Run with: npm run seed:occurrences
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { Prisma } from "../src/generated/prisma/client.js"
import type {
  DispatchStatus, OccurrenceNature, OccurrencePriority, OccurrenceStatus,
} from "../src/generated/prisma/client.js"
import { prisma } from "../src/config/prisma.js"

const TOTAL = 320
const DAYS = 365
const SEED = 20260826

// -- deterministic randomness ------------------------------------------------

/// Mulberry32: small, fast, and good enough to scatter incidents over a city.
function makeRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = makeRandom(SEED)

const between = (min: number, max: number) => min + random() * (max - min)
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1))
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]

/// Picks from a weighted list. Weights are relative, not probabilities.
function weightedPick<T>(entries: readonly { item: T, weight: number }[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * total

  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry.item
  }

  return entries[entries.length - 1].item
}

// -- the city ----------------------------------------------------------------

interface District {
  name: string
  latitude: number
  longitude: number
  /// Relative share of the city's calls. Dense central neighbourhoods call an
  /// order of magnitude more often than the rural edges, and a ranking with no
  /// spread between top and bottom would be a ranking of noise.
  weight: number
  streets: string[]
}

const DISTRICTS: District[] = [
  {
    name: "Centro", latitude: -23.0264, longitude: -45.5551, weight: 100,
    streets: [
      "Rua Jacques Félix", "Avenida Tiradentes", "Rua Duque de Caxias",
      "Rua Visconde do Rio Branco", "Praça Dom Epaminondas", "Rua Emílio Winther",
    ],
  },
  {
    name: "Jardim das Nações", latitude: -23.0186, longitude: -45.5487, weight: 62,
    streets: ["Avenida Charles Schneider", "Rua Nagib Chede", "Rua das Nações"],
  },
  {
    name: "Vila São Geraldo", latitude: -23.0348, longitude: -45.5486, weight: 58,
    streets: ["Avenida Bandeirantes", "Rua Coronel Marcondes de Mattos", "Rua São Geraldo"],
  },
  {
    name: "Independência", latitude: -23.0327, longitude: -45.5678, weight: 54,
    streets: ["Avenida Independência", "Rua Barão da Pedra Negra", "Rua Sete de Setembro"],
  },
  {
    name: "Parque Aeroporto", latitude: -23.0405, longitude: -45.5162, weight: 44,
    streets: ["Avenida Juscelino Kubitschek", "Rua do Aeroporto", "Avenida do Povo"],
  },
  {
    name: "Vila Costa", latitude: -23.0231, longitude: -45.5624, weight: 41,
    streets: ["Rua Coronel Gomes Nogueira", "Avenida Granadeiro Guimarães", "Rua Vigário Simões"],
  },
  {
    name: "Estiva", latitude: -23.0104, longitude: -45.5352, weight: 38,
    streets: ["Avenida Prefeito Luiz Gonzaga Cid Boaventura", "Rua da Estiva", "Rua Antônio Saad"],
  },
  {
    name: "Jardim Ana Emília", latitude: -23.0107, longitude: -45.5603, weight: 33,
    streets: ["Rua Ana Emília", "Avenida Itália", "Rua Portugal"],
  },
  {
    name: "Bosque da Saúde", latitude: -23.0452, longitude: -45.5746, weight: 31,
    streets: ["Avenida Bosque da Saúde", "Rua das Palmeiras", "Rua dos Ipês"],
  },
  {
    name: "Vila Edmundo", latitude: -23.0209, longitude: -45.5702, weight: 29,
    streets: ["Rua Edmundo Pereira", "Avenida Marechal Deodoro da Fonseca", "Rua Souza Alves"],
  },
  {
    name: "Jardim Continental", latitude: -23.0381, longitude: -45.5598, weight: 27,
    streets: ["Avenida Continental", "Rua Guaratinguetá", "Rua Pindamonhangaba"],
  },
  {
    name: "Cidade Jardim", latitude: -23.0343, longitude: -45.5357, weight: 24,
    streets: ["Avenida Cidade Jardim", "Rua das Acácias", "Rua dos Manacás"],
  },
  {
    name: "Jardim Maria Augusta", latitude: -23.0496, longitude: -45.5451, weight: 22,
    streets: ["Rua Maria Augusta", "Avenida Dom Pedro I", "Rua Santa Terezinha"],
  },
  {
    name: "Piracangaguá", latitude: -22.9915, longitude: -45.5031, weight: 20,
    streets: ["Rodovia Presidente Dutra", "Estrada de Piracangaguá", "Rua do Cruzeiro"],
  },
  {
    name: "Barranco Alto", latitude: -23.0081, longitude: -45.5259, weight: 16,
    streets: ["Rua Barranco Alto", "Estrada Municipal do Barranco Alto"],
  },
  {
    name: "Chácara Silvestre", latitude: -23.0177, longitude: -45.5748, weight: 13,
    streets: ["Rua Silvestre", "Estrada das Chácaras"],
  },
  {
    name: "Quiririm", latitude: -23.0470, longitude: -45.6338, weight: 11,
    streets: ["Avenida Domingos Sérgio Falcão", "Rua Emílio Belletti", "Praça Rio Branco"],
  },
  {
    name: "São Gonçalo", latitude: -23.0662, longitude: -45.5307, weight: 6,
    streets: ["Estrada Municipal de São Gonçalo", "Rua da Capela"],
  },
]

/**
 * Addresses the fire department keeps returning to.
 *
 * Every record has them — the bend on the highway that collects crashes, the
 * empty lot that burns every dry season, the building whose alarm panel is
 * broken. A record without them looks uniformly random, which no real record
 * is, and the recurrence panel would have nothing true to find.
 */
const HOTSPOTS = [
  {
    address: "Rodovia Presidente Dutra, km 118, Piracangaguá, Taubaté",
    latitude: -22.9942, longitude: -45.5074,
    nature: "INCENDIO_VEICULO" as OccurrenceNature,
    district: "Piracangaguá",
    times: 11,
  },
  {
    address: "Avenida Charles Schneider, 1500, Jardim das Nações, Taubaté",
    latitude: -23.0198, longitude: -45.5462,
    nature: "ATENDIMENTO_PRE_HOSPITALAR" as OccurrenceNature,
    district: "Jardim das Nações",
    times: 9,
  },
  {
    address: "Estrada Municipal do Barranco Alto, s/n, Barranco Alto, Taubaté",
    latitude: -23.0067, longitude: -45.5241,
    nature: "INCENDIO_VEGETACAO" as OccurrenceNature,
    district: "Barranco Alto",
    times: 8,
  },
  {
    address: "Avenida Tiradentes, 640, Centro, Taubaté",
    latitude: -23.0272, longitude: -45.5563,
    nature: "ATENDIMENTO_PRE_HOSPITALAR" as OccurrenceNature,
    district: "Centro",
    times: 7,
  },
  {
    address: "Rua Barão da Pedra Negra, 220, Independência, Taubaté",
    latitude: -23.0331, longitude: -45.5669,
    nature: "VISTORIA" as OccurrenceNature,
    district: "Independência",
    times: 6,
  },
]

// -- what gets called in ------------------------------------------------------

interface NatureProfile {
  nature: OccurrenceNature
  weight: number
  priorities: { item: OccurrencePriority, weight: number }[]
  /// Minutes from the call to closing the incident.
  minutes: [number, number]
  /// Multiplier per month index (0 = January), for what the seasons change.
  season?: number[]
  /// Multiplier for the hours of the day, 24 entries.
  hours?: number[]
  descriptions: string[]
}

const EVENING = [
  0.3, 0.2, 0.2, 0.15, 0.15, 0.3, 0.6, 1.0, 1.2, 1.2, 1.1, 1.2,
  1.3, 1.3, 1.4, 1.5, 1.6, 1.8, 1.7, 1.4, 1.1, 0.9, 0.7, 0.5,
]

const AFTERNOON = [
  0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.3, 1.6,
  1.9, 2.2, 2.4, 2.3, 1.9, 1.4, 0.9, 0.6, 0.4, 0.3, 0.2, 0.15,
]

const OFFICE = [
  0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.2, 0.6, 1.4, 1.8, 1.9, 1.6,
  0.8, 1.4, 1.8, 1.8, 1.5, 0.9, 0.3, 0.1, 0.05, 0.03, 0.02, 0.02,
]

/// Dry season in the Paraíba valley: vegetation burns from June to September.
const DRY_SEASON = [0.3, 0.3, 0.4, 0.6, 1.2, 2.2, 3.0, 3.4, 2.6, 1.0, 0.5, 0.3]
/// Rivers and reservoirs only take swimmers in the summer.
const SUMMER = [2.4, 2.0, 1.2, 0.6, 0.3, 0.2, 0.2, 0.2, 0.4, 0.8, 1.4, 2.2]

const NATURES: NatureProfile[] = [
  {
    nature: "ATENDIMENTO_PRE_HOSPITALAR",
    weight: 100,
    priorities: [
      { item: "ALTA", weight: 45 }, { item: "MEDIA", weight: 40 },
      { item: "CRITICA", weight: 10 }, { item: "BAIXA", weight: 5 },
    ],
    minutes: [25, 90],
    hours: EVENING,
    descriptions: [
      "Colisão entre dois veículos com uma vítima presa às ferragens.",
      "Motociclista caído na via, consciente, com suspeita de fratura exposta.",
      "Queda de idoso em residência, vítima consciente e sem conseguir se levantar.",
      "Mal súbito em via pública, vítima inconsciente e respirando.",
      "Atropelamento de pedestre na faixa, vítima consciente.",
      "Vítima de queda de altura em obra, cerca de quatro metros.",
      "Crise convulsiva em local público, vítima já sem convulsionar.",
    ],
  },
  {
    nature: "INCENDIO_VEGETACAO",
    weight: 58,
    priorities: [
      { item: "MEDIA", weight: 50 }, { item: "ALTA", weight: 38 },
      { item: "BAIXA", weight: 8 }, { item: "CRITICA", weight: 4 },
    ],
    minutes: [45, 240],
    season: DRY_SEASON,
    hours: AFTERNOON,
    descriptions: [
      "Incêndio em vegetação rasteira avançando na direção de residências.",
      "Foco de incêndio em terreno baldio com acúmulo de lixo.",
      "Queimada em área de pasto, com fumaça atingindo a rodovia.",
      "Incêndio em capoeira próximo a rede de distribuição de energia.",
      "Fogo em vegetação às margens da linha férrea.",
    ],
  },
  {
    nature: "INCENDIO_EDIFICACAO",
    weight: 26,
    priorities: [
      { item: "ALTA", weight: 48 }, { item: "CRITICA", weight: 40 },
      { item: "MEDIA", weight: 12 },
    ],
    minutes: [70, 320],
    hours: EVENING,
    descriptions: [
      "Fogo em residência de dois andares, com informação de vítimas no interior.",
      "Princípio de incêndio em cozinha de estabelecimento comercial.",
      "Incêndio em depósito de materiais recicláveis, muita fumaça.",
      "Curto-circuito em quadro de energia com fogo em apartamento.",
      "Incêndio em galpão industrial desativado.",
    ],
  },
  {
    nature: "INCENDIO_VEICULO",
    weight: 22,
    priorities: [
      { item: "ALTA", weight: 45 }, { item: "MEDIA", weight: 45 },
      { item: "CRITICA", weight: 10 },
    ],
    minutes: [30, 110],
    hours: EVENING,
    descriptions: [
      "Veículo de passeio em chamas no acostamento.",
      "Caminhão com princípio de incêndio no compartimento do motor.",
      "Motocicleta incendiada após colisão.",
      "Ônibus urbano com fumaça saindo do motor, passageiros já desembarcados.",
    ],
  },
  {
    nature: "SALVAMENTO",
    weight: 20,
    priorities: [
      { item: "ALTA", weight: 50 }, { item: "CRITICA", weight: 30 },
      { item: "MEDIA", weight: 20 },
    ],
    minutes: [40, 180],
    hours: EVENING,
    descriptions: [
      "Vítima presa em elevador entre andares.",
      "Pessoa em situação de risco no alto de uma laje.",
      "Trabalhador preso em vala de obra após desabamento parcial.",
      "Resgate de vítima em veículo capotado fora da pista.",
      "Criança com o braço preso em grade de portão.",
    ],
  },
  {
    nature: "CAPTURA_ANIMAL",
    weight: 30,
    priorities: [
      { item: "BAIXA", weight: 70 }, { item: "MEDIA", weight: 28 },
      { item: "ALTA", weight: 2 },
    ],
    minutes: [20, 75],
    hours: OFFICE,
    descriptions: [
      "Enxame de abelhas alojado em muro de escola.",
      "Serpente encontrada no quintal de residência.",
      "Cão preso em galeria de águas pluviais.",
      "Gato em telhado alto há dois dias, sem descer.",
      "Capivara ferida às margens do rio.",
    ],
  },
  {
    nature: "VISTORIA",
    weight: 26,
    priorities: [
      { item: "BAIXA", weight: 82 }, { item: "MEDIA", weight: 18 },
    ],
    minutes: [30, 90],
    hours: OFFICE,
    descriptions: [
      "Vistoria técnica para renovação do auto de vistoria do estabelecimento.",
      "Verificação de denúncia sobre saída de emergência obstruída.",
      "Vistoria em escola municipal a pedido da secretaria de educação.",
      "Conferência de extintores e hidrantes em edifício residencial.",
    ],
  },
  {
    nature: "PRODUTOS_PERIGOSOS",
    weight: 8,
    priorities: [
      { item: "ALTA", weight: 55 }, { item: "CRITICA", weight: 35 },
      { item: "MEDIA", weight: 10 },
    ],
    minutes: [90, 300],
    descriptions: [
      "Vazamento de combustível após tombamento de carreta na rodovia.",
      "Cilindro de gás com vazamento em estabelecimento comercial.",
      "Produto químico não identificado derramado em pátio de transportadora.",
    ],
  },
  {
    nature: "AFOGAMENTO",
    weight: 6,
    priorities: [
      { item: "CRITICA", weight: 70 }, { item: "ALTA", weight: 30 },
    ],
    minutes: [50, 200],
    season: SUMMER,
    hours: AFTERNOON,
    descriptions: [
      "Banhista desaparecido no rio, buscas em andamento.",
      "Criança resgatada de piscina residencial, consciente.",
      "Vítima levada pela correnteza após chuva forte.",
    ],
  },
  {
    nature: "OUTROS",
    weight: 14,
    priorities: [
      { item: "BAIXA", weight: 55 }, { item: "MEDIA", weight: 40 },
      { item: "ALTA", weight: 5 },
    ],
    minutes: [25, 100],
    hours: OFFICE,
    descriptions: [
      "Árvore de grande porte caída sobre a via após vendaval.",
      "Poste de energia inclinado com risco de queda.",
      "Alagamento em residência após chuva forte.",
      "Apoio a outro órgão em ocorrência de trânsito.",
      "Placa de sinalização solta e prestes a cair sobre a calçada.",
    ],
  },
]

const CALLER_NAMES = [
  "Marcos Antunes", "Rita de Cássia Moraes", "João Batista Silveira",
  "Fernanda Prado", "Sebastião Ribeiro", "Luciana Toledo", "Anderson Camargo",
  "Vera Lúcia Nogueira", "Paulo Henrique Vieira", "Cláudia Marins",
  "Edson Ferraz", "Tereza Aparecida Lopes", "Rogério Damasceno",
  "Silvana Queiroz", "Wagner Bastos", "Marlene Figueiredo",
]

// -- the year ----------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

interface Draft {
  openedAt: Date
  nature: OccurrenceNature
  priority: OccurrencePriority
  description: string
  address: string
  district: string
  latitude: number
  longitude: number
}

/**
 * A moment inside `day`, weighted by the hour profile of this kind of call.
 *
 * Rejection sampling: draw an hour, keep it with a probability proportional to
 * its weight. Twenty tries is far more than enough for profiles whose peak is
 * only a few times their floor, and falling through to a uniform hour is a
 * harmless outcome rather than a hang.
 */
function hourFor(profile: NatureProfile): number {
  const hours = profile.hours
  if (!hours) return intBetween(0, 23)

  const peak = Math.max(...hours)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const hour = intBetween(0, 23)
    if (random() < hours[hour] / peak) return hour
  }

  return intBetween(0, 23)
}

function makeDraft(now: number): Draft {
  const profile = weightedPick(NATURES.map((entry) => ({ item: entry, weight: entry.weight })))

  // The date is drawn first and then kept or rejected against the season, so a
  // vegetation fire lands in August far more often than in February.
  let day = 0
  for (let attempt = 0; attempt < 30; attempt += 1) {
    day = intBetween(0, DAYS - 1)
    if (!profile.season) break

    const month = new Date(now - day * DAY_MS).getMonth()
    if (random() < profile.season[month] / Math.max(...profile.season)) break
  }

  const date = new Date(now - day * DAY_MS)
  date.setHours(hourFor(profile), intBetween(0, 59), intBetween(0, 59), 0)

  const district = weightedPick(
    DISTRICTS.map((entry) => ({ item: entry, weight: entry.weight })),
  )

  return {
    openedAt: date,
    nature: profile.nature,
    priority: weightedPick(profile.priorities),
    description: pick(profile.descriptions),
    address: `${pick(district.streets)}, ${intBetween(20, 2400)}, ${district.name}, Taubaté`,
    district: district.name,
    // Roughly 350 metres of scatter around the centre, which keeps the point
    // inside the neighbourhood and near a mapped street.
    latitude: district.latitude + between(-0.0035, 0.0035),
    longitude: district.longitude + between(-0.0035, 0.0035),
  }
}

function makeHotspotDraft(now: number): Draft[] {
  const drafts: Draft[] = []

  for (const spot of HOTSPOTS) {
    const profile = NATURES.find((entry) => entry.nature === spot.nature)!

    for (let index = 0; index < spot.times; index += 1) {
      const date = new Date(now - intBetween(0, DAYS - 1) * DAY_MS)
      date.setHours(hourFor(profile), intBetween(0, 59), intBetween(0, 59), 0)

      drafts.push({
        openedAt: date,
        nature: spot.nature,
        priority: weightedPick(profile.priorities),
        description: pick(profile.descriptions),
        address: spot.address,
        district: spot.district,
        // Barely scattered: it is the *same* place coming back, and a
        // recurrence that drifts 300 metres each time is not a recurrence.
        latitude: spot.latitude + between(-0.0004, 0.0004),
        longitude: spot.longitude + between(-0.0004, 0.0004),
      })
    }
  }

  return drafts
}

/**
 * A handful of calls from the last few hours.
 *
 * One incident a day over a year leaves essentially zero chance that any of
 * them is still running when the seed finishes, so the dispatch board, the
 * operational panel and the live feed would all open empty — which says
 * nothing about whether they work. These are drawn inside the last ten hours
 * so the shift in progress has a shift in progress.
 */
function makeLiveDrafts(now: number, count: number): Draft[] {
  return Array.from({ length: count }, () => {
    const draft = makeDraft(now)
    draft.openedAt = new Date(now - between(4, 10 * 60) * 60 * 1000)
    return draft
  })
}

/** How an incident that old is likely to have ended. */
function statusFor(ageHours: number): OccurrenceStatus {
  if (ageHours < 2) {
    return weightedPick([
      { item: "ABERTA" as OccurrenceStatus, weight: 40 },
      { item: "DESPACHADA" as OccurrenceStatus, weight: 35 },
      { item: "EM_ATENDIMENTO" as OccurrenceStatus, weight: 25 },
    ])
  }

  if (ageHours < 12) {
    return weightedPick([
      { item: "EM_ATENDIMENTO" as OccurrenceStatus, weight: 35 },
      { item: "ENCERRADA" as OccurrenceStatus, weight: 60 },
      { item: "CANCELADA" as OccurrenceStatus, weight: 5 },
    ])
  }

  return weightedPick([
    { item: "ENCERRADA" as OccurrenceStatus, weight: 93 },
    { item: "CANCELADA" as OccurrenceStatus, weight: 7 },
  ])
}

const DISPATCH_STATUS: Record<OccurrenceStatus, DispatchStatus | null> = {
  ABERTA: null,
  DESPACHADA: "DESPACHADO",
  EM_ATENDIMENTO: "NO_LOCAL",
  ENCERRADA: "FINALIZADO",
  CANCELADA: "CANCELADO",
}

// -- the posts that answer -----------------------------------------------------

/**
 * The city had exactly one post in the registry, which makes three of this
 * project's features meaningless: "nearest station" always has one answer,
 * the coverage map has one region, and a ranking by responding unit is a
 * single bar. These three spread the coverage over the city so those features
 * have something to say. They are demonstration data, like everything else
 * here, and are only created if their acronym is missing.
 */
const EXTRA_POSTS = [
  {
    acronym: "PB-AEROPORTO",
    name: "Posto de Bombeiros do Parque Aeroporto",
    address: "Avenida Juscelino Kubitschek, 1200, Parque Aeroporto, Taubaté",
    latitude: -23.0412, longitude: -45.5170, phone: "1236220100",
  },
  {
    acronym: "PB-QUIRIRIM",
    name: "Posto de Bombeiros de Quiririm",
    address: "Avenida Domingos Sérgio Falcão, 340, Quiririm, Taubaté",
    latitude: -23.0472, longitude: -45.6330, phone: "1236220200",
  },
  {
    acronym: "PB-PIRACANGAGUA",
    name: "Posto de Bombeiros de Piracangaguá",
    address: "Estrada de Piracangaguá, 2100, Piracangaguá, Taubaté",
    latitude: -22.9925, longitude: -45.5060, phone: "1236220300",
  },
]

interface Responder {
  id: string
  acronym: string
  latitude: number
  longitude: number
}

async function ensureStations(): Promise<Responder[]> {
  const parent = await prisma.unit.findFirst({
    where: { type: "GRUPAMENTO" },
    select: { id: true },
  })

  for (const post of EXTRA_POSTS) {
    const already = await prisma.unit.findUnique({
      where: { acronym: post.acronym },
      select: { id: true },
    })

    if (already) continue

    await prisma.unit.create({
      data: {
        name: post.name,
        acronym: post.acronym,
        type: "POSTO",
        address: post.address,
        latitude: new Prisma.Decimal(post.latitude),
        longitude: new Prisma.Decimal(post.longitude),
        phone: post.phone,
        parent_id: parent?.id ?? null,
      },
    })

    console.log(`Created ${post.acronym}.`)
  }

  const posts = await prisma.unit.findMany({
    where: { active: true, type: { in: ["POSTO", "SUBGRUPAMENTO"] } },
    select: { id: true, acronym: true, latitude: true, longitude: true },
  })

  return posts.map((post) => ({
    id: post.id,
    acronym: post.acronym,
    latitude: Number(post.latitude),
    longitude: Number(post.longitude),
  }))
}

/**
 * Which post answers a call.
 *
 * Nearly always the closest one, because that is how a dispatch is decided and
 * because it is what makes the coverage map coherent. The rest of the time
 * another post takes it — the nearest was already committed, or the incident
 * needed a vehicle only one of them has. A record where the nearest post
 * always answers would be a record with no mutual aid in it.
 */
function responderFor(draft: Draft, responders: Responder[]): Responder {
  if (random() > 0.85) return pick(responders)

  return responders.reduce((best, candidate) => {
    const distance = (post: Responder) =>
      (post.latitude - draft.latitude) ** 2 + (post.longitude - draft.longitude) ** 2

    return distance(candidate) < distance(best) ? candidate : best
  })
}

// -- the run ------------------------------------------------------------------

async function main() {
  const responders = await ensureStations()

  if (responders.length === 0) {
    throw new Error("No active post to answer for: seed the units first.")
  }

  const vehicles = await prisma.vehicle.findMany({ select: { id: true } })

  // -- backup ---------------------------------------------------------------

  const existing = await prisma.occurrence.findMany({
    include: { dispatches: { include: { routes: true } } },
  })

  const backupDir = resolve(process.cwd(), ".backups")
  mkdirSync(backupDir, { recursive: true })

  const backupPath = resolve(
    backupDir,
    `occurrences-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  )

  writeFileSync(backupPath, JSON.stringify(existing, jsonSafe, 2), "utf8")
  console.log(`Backed up ${existing.length} occurrence(s) to ${backupPath}`)

  // -- replace --------------------------------------------------------------

  const removed = await prisma.occurrence.deleteMany({})
  console.log(`Deleted ${removed.count} occurrence(s) and everything hanging off them.`)

  const now = Date.now()

  const drafts = [
    ...Array.from({ length: TOTAL }, () => makeDraft(now)),
    ...makeHotspotDraft(now),
    ...makeLiveDrafts(now, 9),
  ].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())

  const perYear = new Map<number, number>()
  let dispatched = 0

  for (const draft of drafts) {
    const year = draft.openedAt.getFullYear()
    const sequence = (perYear.get(year) ?? 0) + 1
    perYear.set(year, sequence)

    const ageHours = (now - draft.openedAt.getTime()) / (60 * 60 * 1000)
    const status = statusFor(ageHours)
    const profile = NATURES.find((entry) => entry.nature === draft.nature)!

    const durationMinutes = intBetween(profile.minutes[0], profile.minutes[1])
    const closedAt = status === "ENCERRADA" || status === "CANCELADA"
      ? new Date(draft.openedAt.getTime() + durationMinutes * 60 * 1000)
      : null

    // Two calls in three name the caller; the rest are anonymous or came in
    // from another agency, which is how the field actually fills in.
    const named = random() < 0.66

    const occurrence = await prisma.occurrence.create({
      data: {
        protocol: `${year}-${String(sequence).padStart(6, "0")}`,
        nature: draft.nature,
        priority: draft.priority,
        status,
        description: draft.description,
        address: draft.address,
        latitude: new Prisma.Decimal(draft.latitude.toFixed(6)),
        longitude: new Prisma.Decimal(draft.longitude.toFixed(6)),
        caller_name: named ? pick(CALLER_NAMES) : null,
        caller_phone: named ? `129${intBetween(6000, 9999)}${intBetween(1000, 9999)}` : null,
        unit_id: responderFor(draft, responders).id,
        opened_at: draft.openedAt,
        closed_at: closedAt,
      },
      select: { id: true },
    })

    const dispatchStatus = DISPATCH_STATUS[status]

    if (dispatchStatus && vehicles.length > 0) {
      // Dispatched about a minute and a half after the call, on the road for
      // the first third of the incident.
      const dispatchedAt = new Date(draft.openedAt.getTime() + intBetween(40, 180) * 1000)
      const arrivedAt = new Date(dispatchedAt.getTime() + intBetween(3, 16) * 60 * 1000)

      await prisma.dispatch.create({
        data: {
          status: dispatchStatus,
          occurrence_id: occurrence.id,
          vehicle_id: pick(vehicles).id,
          dispatched_at: dispatchedAt,
          arrived_at: dispatchStatus === "DESPACHADO" ? null : arrivedAt,
          finished_at: closedAt,
        },
      })

      dispatched += 1
    }
  }

  // Nothing is being driven right now except what the open incidents are using,
  // so every other vehicle goes back to available. Without this the fleet keeps
  // the commitments of the incidents that were just deleted.
  const busy = await prisma.dispatch.findMany({
    where: { status: { in: ["DESPACHADO", "A_CAMINHO", "NO_LOCAL", "RETORNANDO"] } },
    select: { vehicle_id: true },
  })

  const busyIds = [...new Set(busy.map((entry) => entry.vehicle_id))]

  await prisma.vehicle.updateMany({
    where: { id: { notIn: busyIds }, status: "EMPENHADA" },
    data: { status: "DISPONIVEL" },
  })

  await prisma.vehicle.updateMany({
    where: { id: { in: busyIds } },
    data: { status: "EMPENHADA" },
  })

  console.log(
    `Created ${drafts.length} occurrence(s) over ${DAYS} days, `
    + `${dispatched} with a dispatch, across ${responders.length} responding unit(s).`,
  )

  await prisma.$disconnect()
}

/** Decimal and BigInt do not survive `JSON.stringify` on their own. */
function jsonSafe(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Prisma.Decimal) return value.toString()
  return value
}

void main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
