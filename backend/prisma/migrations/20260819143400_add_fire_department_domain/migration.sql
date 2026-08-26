/*
  Warnings:

  - You are about to drop the `base` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('COMANDO_GERAL', 'COMANDO_REGIONAL', 'GRUPAMENTO', 'SUBGRUPAMENTO', 'POSTO');

-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('CORONEL', 'TENENTE_CORONEL', 'MAJOR', 'CAPITAO', 'PRIMEIRO_TENENTE', 'SEGUNDO_TENENTE', 'ASPIRANTE_OFICIAL', 'SUBTENENTE', 'PRIMEIRO_SARGENTO', 'SEGUNDO_SARGENTO', 'TERCEIRO_SARGENTO', 'CABO', 'SOLDADO_PRIMEIRA_CLASSE', 'SOLDADO_SEGUNDA_CLASSE');

-- CreateEnum
CREATE TYPE "FirefighterStatus" AS ENUM ('ATIVO', 'FERIAS', 'AFASTADO', 'INATIVO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMANDANTE', 'OPERADOR');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('ABT', 'ABTF', 'ABTR', 'AT', 'ASE', 'AEM', 'APM', 'UR', 'MOB', 'ABRESC', 'AV');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DISPONIVEL', 'EMPENHADA', 'MANUTENCAO', 'INDISPONIVEL');

-- CreateEnum
CREATE TYPE "CrewRole" AS ENUM ('COMANDANTE', 'MOTORISTA', 'COMBATENTE', 'SOCORRISTA');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('PLANTAO_24X72', 'PLANTAO_12X36', 'EXPEDIENTE');

-- CreateEnum
CREATE TYPE "OccurrenceNature" AS ENUM ('INCENDIO_EDIFICACAO', 'INCENDIO_VEGETACAO', 'INCENDIO_VEICULO', 'SALVAMENTO', 'ATENDIMENTO_PRE_HOSPITALAR', 'PRODUTOS_PERIGOSOS', 'AFOGAMENTO', 'CAPTURA_ANIMAL', 'VISTORIA', 'OUTROS');

-- CreateEnum
CREATE TYPE "OccurrencePriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('ABERTA', 'DESPACHADA', 'EM_ATENDIMENTO', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DESPACHADO', 'A_CAMINHO', 'NO_LOCAL', 'RETORNANDO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "RouteAlgorithm" AS ENUM ('NEURAL', 'DIJKSTRA');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'FALHOU');

-- DropTable
DROP TABLE "base";

-- CreateTable
CREATE TABLE "unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(15,12) NOT NULL,
    "longitude" DECIMAL(15,12) NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firefighter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "war_name" TEXT NOT NULL,
    "military_id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rank" "Rank" NOT NULL,
    "status" "FirefighterStatus" NOT NULL DEFAULT 'ATIVO',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "admission_date" TIMESTAMP(3) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firefighter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERADOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "firefighter_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "water_capacity_liters" INTEGER,
    "crew_capacity" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "current_latitude" DECIMAL(15,12),
    "current_longitude" DECIMAL(15,12),
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unit_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "commander_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_member" (
    "id" TEXT NOT NULL,
    "role" "CrewRole" NOT NULL,
    "crew_id" TEXT NOT NULL,
    "firefighter_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift" (
    "id" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "firefighter_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "nature" "OccurrenceNature" NOT NULL,
    "priority" "OccurrencePriority" NOT NULL DEFAULT 'MEDIA',
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'ABERTA',
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(15,12) NOT NULL,
    "longitude" DECIMAL(15,12) NOT NULL,
    "caller_name" TEXT,
    "caller_phone" TEXT,
    "unit_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch" (
    "id" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DESPACHADO',
    "occurrence_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "crew_id" TEXT,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrived_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" TEXT NOT NULL,
    "algorithm" "RouteAlgorithm" NOT NULL,
    "origin_latitude" DECIMAL(15,12) NOT NULL,
    "origin_longitude" DECIMAL(15,12) NOT NULL,
    "destination_latitude" DECIMAL(15,12) NOT NULL,
    "destination_longitude" DECIMAL(15,12) NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "estimated_time_seconds" DOUBLE PRECISION NOT NULL,
    "node_count" INTEGER NOT NULL,
    "geometry" JSONB NOT NULL,
    "model_version" TEXT,
    "dispatch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_run" (
    "id" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'PENDENTE',
    "epochs" INTEGER NOT NULL,
    "train_loss" DOUBLE PRECISION,
    "validation_loss" DOUBLE PRECISION,
    "best_validation_loss" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "model_path" TEXT,
    "external_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_acronym_key" ON "unit"("acronym");

-- CreateIndex
CREATE INDEX "unit_parent_id_idx" ON "unit"("parent_id");

-- CreateIndex
CREATE INDEX "unit_type_idx" ON "unit"("type");

-- CreateIndex
CREATE UNIQUE INDEX "firefighter_military_id_key" ON "firefighter"("military_id");

-- CreateIndex
CREATE UNIQUE INDEX "firefighter_cpf_key" ON "firefighter"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "firefighter_email_key" ON "firefighter"("email");

-- CreateIndex
CREATE INDEX "firefighter_unit_id_idx" ON "firefighter"("unit_id");

-- CreateIndex
CREATE INDEX "firefighter_status_idx" ON "firefighter"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_firefighter_id_key" ON "user"("firefighter_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_prefix_key" ON "vehicle"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_plate_key" ON "vehicle"("plate");

-- CreateIndex
CREATE INDEX "vehicle_unit_id_idx" ON "vehicle"("unit_id");

-- CreateIndex
CREATE INDEX "vehicle_status_idx" ON "vehicle"("status");

-- CreateIndex
CREATE INDEX "crew_unit_id_idx" ON "crew"("unit_id");

-- CreateIndex
CREATE INDEX "crew_vehicle_id_idx" ON "crew"("vehicle_id");

-- CreateIndex
CREATE INDEX "crew_active_idx" ON "crew"("active");

-- CreateIndex
CREATE INDEX "crew_member_firefighter_id_idx" ON "crew_member"("firefighter_id");

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_crew_id_firefighter_id_key" ON "crew_member"("crew_id", "firefighter_id");

-- CreateIndex
CREATE INDEX "shift_firefighter_id_idx" ON "shift"("firefighter_id");

-- CreateIndex
CREATE INDEX "shift_start_at_end_at_idx" ON "shift"("start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "occurrence_protocol_key" ON "occurrence"("protocol");

-- CreateIndex
CREATE INDEX "occurrence_status_idx" ON "occurrence"("status");

-- CreateIndex
CREATE INDEX "occurrence_unit_id_idx" ON "occurrence"("unit_id");

-- CreateIndex
CREATE INDEX "occurrence_opened_at_idx" ON "occurrence"("opened_at");

-- CreateIndex
CREATE INDEX "dispatch_occurrence_id_idx" ON "dispatch"("occurrence_id");

-- CreateIndex
CREATE INDEX "dispatch_vehicle_id_idx" ON "dispatch"("vehicle_id");

-- CreateIndex
CREATE INDEX "dispatch_status_idx" ON "dispatch"("status");

-- CreateIndex
CREATE INDEX "route_dispatch_id_idx" ON "route"("dispatch_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_run_external_job_id_key" ON "training_run"("external_job_id");

-- CreateIndex
CREATE INDEX "training_run_status_idx" ON "training_run"("status");

-- AddForeignKey
ALTER TABLE "unit" ADD CONSTRAINT "unit_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firefighter" ADD CONSTRAINT "firefighter_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_firefighter_id_fkey" FOREIGN KEY ("firefighter_id") REFERENCES "firefighter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew" ADD CONSTRAINT "crew_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew" ADD CONSTRAINT "crew_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew" ADD CONSTRAINT "crew_commander_id_fkey" FOREIGN KEY ("commander_id") REFERENCES "firefighter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_firefighter_id_fkey" FOREIGN KEY ("firefighter_id") REFERENCES "firefighter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_firefighter_id_fkey" FOREIGN KEY ("firefighter_id") REFERENCES "firefighter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
