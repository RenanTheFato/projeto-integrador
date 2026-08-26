/**
 * Types mirroring the backend domain. They are written by hand rather than
 * generated because the frontend only consumes a subset of each model, and a
 * generated client would drag the whole Prisma surface into the bundle.
 */

export type UserRole = "ADMIN" | "COMANDANTE" | "OPERADOR"

export type UnitType =
  | "COMANDO_GERAL" | "COMANDO_REGIONAL" | "GRUPAMENTO" | "SUBGRUPAMENTO" | "POSTO"

export type Rank =
  | "CORONEL" | "TENENTE_CORONEL" | "MAJOR" | "CAPITAO" | "PRIMEIRO_TENENTE"
  | "SEGUNDO_TENENTE" | "ASPIRANTE_OFICIAL" | "SUBTENENTE" | "PRIMEIRO_SARGENTO"
  | "SEGUNDO_SARGENTO" | "TERCEIRO_SARGENTO" | "CABO"
  | "SOLDADO_PRIMEIRA_CLASSE" | "SOLDADO_SEGUNDA_CLASSE"

export type FirefighterStatus = "ATIVO" | "FERIAS" | "AFASTADO" | "INATIVO"

export type VehicleType =
  | "ABT" | "ABTF" | "ABTR" | "AT" | "ASE" | "AEM" | "APM" | "UR" | "MOB" | "ABRESC" | "AV"

export type VehicleStatus = "DISPONIVEL" | "EMPENHADA" | "MANUTENCAO" | "INDISPONIVEL"

export type CrewRole = "COMANDANTE" | "MOTORISTA" | "COMBATENTE" | "SOCORRISTA"

export type ShiftType = "PLANTAO_24X72" | "PLANTAO_12X36" | "EXPEDIENTE"

export type OccurrenceNature =
  | "INCENDIO_EDIFICACAO" | "INCENDIO_VEGETACAO" | "INCENDIO_VEICULO" | "SALVAMENTO"
  | "ATENDIMENTO_PRE_HOSPITALAR" | "PRODUTOS_PERIGOSOS" | "AFOGAMENTO"
  | "CAPTURA_ANIMAL" | "VISTORIA" | "OUTROS"

export type OccurrencePriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA"

export type OccurrenceStatus =
  | "ABERTA" | "DESPACHADA" | "EM_ATENDIMENTO" | "ENCERRADA" | "CANCELADA"

export type DispatchStatus =
  | "DESPACHADO" | "A_CAMINHO" | "NO_LOCAL" | "RETORNANDO" | "FINALIZADO" | "CANCELADO"

export type RouteAlgorithm = "NEURAL" | "DIJKSTRA"

export type TrainingStatus = "PENDENTE" | "EXECUTANDO" | "CONCLUIDO" | "FALHOU"

export interface User {
  id: string
  email: string
  role: UserRole
  firefighter_id?: string | null
}

export interface Unit {
  id: string
  name: string
  acronym: string
  type: UnitType
  address: string
  city: string
  state: string
  phone?: string | null
  latitude: string | number
  longitude: string | number
  active: boolean
  parent_id?: string | null
  parent?: Pick<Unit, "id" | "name" | "acronym" | "type"> | null
}

export interface Firefighter {
  id: string
  name: string
  war_name: string
  military_id: string
  cpf: string
  rank: Rank
  status: FirefighterStatus
  phone: string
  email?: string | null
  admission_date: string
  unit_id: string
  unit?: Pick<Unit, "id" | "name" | "acronym"> | null
}

export interface Vehicle {
  id: string
  prefix: string
  type: VehicleType
  plate: string
  model: string
  year: number
  water_capacity_liters?: number | null
  crew_capacity: number
  status: VehicleStatus
  current_latitude?: string | number | null
  current_longitude?: string | number | null
  unit_id: string
  unit?: Pick<Unit, "id" | "name" | "acronym"> | null
}

export interface CrewMember {
  id: string
  role: CrewRole
  firefighter_id: string
  firefighter?: Pick<Firefighter, "id" | "war_name" | "rank"> | null
}

export interface Crew {
  id: string
  name: string
  active: boolean
  started_at: string
  ended_at?: string | null
  unit_id: string
  vehicle_id: string
  commander_id: string
  vehicle?: Pick<Vehicle, "id" | "prefix" | "type"> | null
  commander?: Pick<Firefighter, "id" | "war_name" | "rank"> | null
  members?: CrewMember[]
}

export interface Shift {
  id: string
  type: ShiftType
  start_at: string
  end_at: string
  firefighter_id: string
  unit_id: string
  firefighter?: Pick<Firefighter, "id" | "war_name" | "rank"> | null
  unit?: Pick<Unit, "id" | "acronym"> | null
}

export interface Occurrence {
  id: string
  protocol: string
  nature: OccurrenceNature
  priority: OccurrencePriority
  status: OccurrenceStatus
  description: string
  address: string
  latitude: string | number
  longitude: string | number
  caller_name?: string | null
  caller_phone?: string | null
  opened_at: string
  closed_at?: string | null
  unit_id: string
  unit?: Pick<Unit, "id" | "name" | "acronym"> | null
  dispatches?: Dispatch[]
}

export interface RouteVariant {
  id: string
  algorithm: RouteAlgorithm
  origin_latitude: string | number
  origin_longitude: string | number
  destination_latitude: string | number
  destination_longitude: string | number
  distance_meters: number
  estimated_time_seconds: number
  node_count: number
  /** Coordinate pairs as [latitude, longitude] — the axis order MapLibre does not use. */
  geometry: [number, number][]
  model_version?: string | null
  dispatch_id?: string | null
  created_at: string
}

export interface Dispatch {
  id: string
  status: DispatchStatus
  dispatched_at: string
  arrived_at?: string | null
  finished_at?: string | null
  occurrence_id: string
  vehicle_id: string
  crew_id?: string | null
  occurrence?: Pick<Occurrence, "id" | "protocol" | "nature" | "priority" | "status" | "address" | "latitude" | "longitude"> | null
  vehicle?: Pick<Vehicle, "id" | "prefix" | "type" | "status"> | null
  crew?: Crew | null
  routes?: RouteVariant[]
}

/** Both variants as the AI service returns them, before persistence. */
export interface RoutePreview {
  distance_meters: number
  estimated_time_seconds: number
  node_count: number
  geometry: [number, number][]
}

export interface ModelInfo {
  loaded: boolean
  model_version: string | null
  city: string
  graph_nodes: number
  graph_edges: number
}

export interface TrainingRun {
  id: string
  status: TrainingStatus
  epochs: number
  train_loss: number | null
  validation_loss: number | null
  best_validation_loss: number | null
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  model_path: string | null
  external_job_id: string | null
  created_at: string
}

export interface Paginated<T> {
  total: number
  page: number
  per_page: number
  items: T[]
}
