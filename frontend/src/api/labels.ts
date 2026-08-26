/**
 * Human labels and colours for the domain enums.
 *
 * The enum values keep the corporation's official nomenclature, which is not
 * translatable and not readable in an interface either, so every screen goes
 * through this module instead of printing the raw value.
 */

import type {
  CrewRole, DispatchStatus, FirefighterStatus, OccurrenceNature, OccurrencePriority,
  OccurrenceStatus, Rank, ShiftType, TrainingStatus, UnitType, UserRole,
  VehicleStatus, VehicleType,
} from "./types"

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  COMANDO_GERAL: "Comando Geral",
  COMANDO_REGIONAL: "Comando Regional",
  GRUPAMENTO: "Grupamento",
  SUBGRUPAMENTO: "Subgrupamento",
  POSTO: "Posto",
}

export const RANK_LABEL: Record<Rank, string> = {
  CORONEL: "Coronel",
  TENENTE_CORONEL: "Tenente-Coronel",
  MAJOR: "Major",
  CAPITAO: "Capitão",
  PRIMEIRO_TENENTE: "1º Tenente",
  SEGUNDO_TENENTE: "2º Tenente",
  ASPIRANTE_OFICIAL: "Aspirante a Oficial",
  SUBTENENTE: "Subtenente",
  PRIMEIRO_SARGENTO: "1º Sargento",
  SEGUNDO_SARGENTO: "2º Sargento",
  TERCEIRO_SARGENTO: "3º Sargento",
  CABO: "Cabo",
  SOLDADO_PRIMEIRA_CLASSE: "Soldado 1ª Classe",
  SOLDADO_SEGUNDA_CLASSE: "Soldado 2ª Classe",
}

export const FIREFIGHTER_STATUS_LABEL: Record<FirefighterStatus, string> = {
  ATIVO: "Ativo",
  FERIAS: "Férias",
  AFASTADO: "Afastado",
  INATIVO: "Inativo",
}

export const FIREFIGHTER_STATUS_TONE: Record<FirefighterStatus, string> = {
  ATIVO: "bg-green-600",
  FERIAS: "bg-sky-600",
  AFASTADO: "bg-[#E8A240]",
  INATIVO: "bg-neutral-500",
}

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  COMANDANTE: "Comandante",
  OPERADOR: "Operador",
}

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  ABT: "Auto Bomba Tanque",
  ABTF: "Auto Bomba Tanque Florestal",
  ABTR: "Auto Bomba Tanque Resgate",
  AT: "Auto Tanque",
  ASE: "Auto Salvamento Específico",
  AEM: "Auto Escada Mecânica",
  APM: "Auto Plataforma Mecânica",
  UR: "Unidade de Resgate",
  MOB: "Moto Operacional Bombeiro",
  ABRESC: "Auto Busca, Resgate e Salvamento com Cães",
  AV: "Auto Viatura administrativa",
}

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  DISPONIVEL: "Disponível",
  EMPENHADA: "Empenhada",
  MANUTENCAO: "Manutenção",
  INDISPONIVEL: "Indisponível",
}

export const VEHICLE_STATUS_TONE: Record<VehicleStatus, string> = {
  DISPONIVEL: "bg-green-600",
  EMPENHADA: "bg-[#DE5656]",
  MANUTENCAO: "bg-[#E8A240]",
  INDISPONIVEL: "bg-neutral-500",
}

export const CREW_ROLE_LABEL: Record<CrewRole, string> = {
  COMANDANTE: "Comandante",
  MOTORISTA: "Motorista",
  COMBATENTE: "Combatente",
  SOCORRISTA: "Socorrista",
}

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  PLANTAO_24X72: "Plantão 24x72",
  PLANTAO_12X36: "Plantão 12x36",
  EXPEDIENTE: "Expediente",
}

export const NATURE_LABEL: Record<OccurrenceNature, string> = {
  INCENDIO_EDIFICACAO: "Incêndio em edificação",
  INCENDIO_VEGETACAO: "Incêndio em vegetação",
  INCENDIO_VEICULO: "Incêndio em veículo",
  SALVAMENTO: "Salvamento",
  ATENDIMENTO_PRE_HOSPITALAR: "Atendimento pré-hospitalar",
  PRODUTOS_PERIGOSOS: "Produtos perigosos",
  AFOGAMENTO: "Afogamento",
  CAPTURA_ANIMAL: "Captura de animal",
  VISTORIA: "Vistoria",
  OUTROS: "Outros",
}

export const PRIORITY_LABEL: Record<OccurrencePriority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
}

/// The palette the original screens used for severity: red for the worst,
/// amber in the middle, green for the routine call.
export const PRIORITY_TONE: Record<OccurrencePriority, string> = {
  BAIXA: "bg-green-600",
  MEDIA: "bg-[#E8A240]",
  ALTA: "bg-[#DE5656]",
  CRITICA: "bg-red-800",
}

export const PRIORITY_TEXT_TONE: Record<OccurrencePriority, string> = {
  BAIXA: "text-green-700",
  MEDIA: "text-orange-600",
  ALTA: "text-red-600",
  CRITICA: "text-red-800",
}

export const OCCURRENCE_STATUS_LABEL: Record<OccurrenceStatus, string> = {
  ABERTA: "Aberta",
  DESPACHADA: "Despachada",
  EM_ATENDIMENTO: "Em atendimento",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
}

export const OCCURRENCE_STATUS_TONE: Record<OccurrenceStatus, string> = {
  ABERTA: "bg-[#DE5656]",
  DESPACHADA: "bg-[#E8A240]",
  EM_ATENDIMENTO: "bg-sky-600",
  ENCERRADA: "bg-green-600",
  CANCELADA: "bg-neutral-500",
}

export const DISPATCH_STATUS_LABEL: Record<DispatchStatus, string> = {
  DESPACHADO: "Despachado",
  A_CAMINHO: "A caminho",
  NO_LOCAL: "No local",
  RETORNANDO: "Retornando",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
}

export const DISPATCH_STATUS_TONE: Record<DispatchStatus, string> = {
  DESPACHADO: "bg-[#E8A240]",
  A_CAMINHO: "bg-sky-600",
  NO_LOCAL: "bg-indigo-600",
  RETORNANDO: "bg-teal-600",
  FINALIZADO: "bg-green-600",
  CANCELADO: "bg-neutral-500",
}

/**
 * The backend refuses a jump that skips a step, so the interface only offers
 * the transitions it will accept. Terminal states offer nothing.
 */
export const DISPATCH_NEXT_STATUSES: Record<DispatchStatus, DispatchStatus[]> = {
  DESPACHADO: ["A_CAMINHO", "CANCELADO"],
  A_CAMINHO: ["NO_LOCAL", "CANCELADO"],
  NO_LOCAL: ["RETORNANDO", "FINALIZADO"],
  RETORNANDO: ["FINALIZADO"],
  FINALIZADO: [],
  CANCELADO: [],
}

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  PENDENTE: "Pendente",
  EXECUTANDO: "Executando",
  CONCLUIDO: "Concluído",
  FALHOU: "Falhou",
}

export const TRAINING_STATUS_TONE: Record<TrainingStatus, string> = {
  PENDENTE: "bg-neutral-500",
  EXECUTANDO: "bg-sky-600",
  CONCLUIDO: "bg-green-600",
  FALHOU: "bg-[#DE5656]",
}

/** Turns a `Record<K, string>` into the option list a <select> expects. */
export function optionsOf<K extends string>(labels: Record<K, string>): { value: K, label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
}
