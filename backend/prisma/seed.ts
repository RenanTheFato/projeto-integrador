import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import dotenv from "dotenv";

dotenv.config()

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! })
})

/// Hierarquia real do CB/PMESP ate o posto que cobre Taubate, cidade em que o
/// modelo de IA foi treinado. As coordenadas ficam dentro do grafo do OSM.
async function seedUnits() {
  const ccb = await prisma.unit.upsert({
    where: { acronym: "CCB" },
    update: {},
    create: {
      name: "Comando do Corpo de Bombeiros",
      acronym: "CCB",
      type: "COMANDO_GERAL",
      address: "Praca Clovis Bevilacqua, 421 - Se, Sao Paulo",
      latitude: -23.547500000000,
      longitude: -46.633300000000,
      phone: "1133273000"
    }
  })

  const cbi1 = await prisma.unit.upsert({
    where: { acronym: "CBI-1" },
    update: {},
    create: {
      name: "Comando de Bombeiros do Interior 1",
      acronym: "CBI-1",
      type: "COMANDO_REGIONAL",
      address: "Campinas, Sao Paulo",
      latitude: -22.907100000000,
      longitude: -47.062600000000,
      phone: "1932361000",
      parent_id: ccb.id
    }
  })

  const gb11 = await prisma.unit.upsert({
    where: { acronym: "11GB" },
    update: {},
    create: {
      name: "11o Grupamento de Bombeiros",
      acronym: "11GB",
      type: "GRUPAMENTO",
      address: "Sao Jose dos Campos, Sao Paulo",
      latitude: -23.196400000000,
      longitude: -45.884100000000,
      phone: "1239212000",
      parent_id: cbi1.id
    }
  })

  const taubate = await prisma.unit.upsert({
    where: { acronym: "PB-TAUBATE" },
    update: {},
    create: {
      name: "Posto de Bombeiros de Taubate",
      acronym: "PB-TAUBATE",
      type: "POSTO",
      address: "Taubate, Sao Paulo",
      latitude: -23.026000000000,
      longitude: -45.555000000000,
      phone: "1236210193",
      parent_id: gb11.id
    }
  })

  console.log(`  unidades: ${ccb.acronym} > ${cbi1.acronym} > ${gb11.acronym} > ${taubate.acronym}`)
  return taubate
}

async function main() {
  console.log("Populando dados iniciais...")
  await seedUnits()
  console.log("Concluido.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
