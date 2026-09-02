/**
 * End-to-end smoke test for the whole stack.
 *
 * It drives the public HTTP API exactly as a client would: every CRUD, the
 * dispatch lifecycle, the realtime socket and the AI bridge. Nothing is
 * stubbed, so a green run proves Node, Postgres and the Python routing service
 * are all talking to each other.
 *
 * Prerequisites:
 *   1. Postgres up, with `npx prisma migrate deploy` and `npx prisma db seed`
 *   2. The AI service running:  poetry run uvicorn api.main:app --port 8000
 *   3. The backend running:     npm run dev
 *
 * Then:  npm run test:e2e
 *
 * Records are created with a per-run stamp, so repeated runs never collide and
 * the data is left in place for inspection.
 */

const BASE = "http://127.0.0.1:3333/api/v1"
const WS = "ws://127.0.0.1:3333/api/v1/realtime"

let passed = 0
let failed = 0

const stamp = Date.now().toString().slice(-8)

/// Plates must be unique in the database and match the Brazilian Mercosul
/// format, so they are derived from the run stamp instead of hardcoded.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const makePlate = (seed) => {
  const n = Number(stamp) + seed
  return `${LETTERS[n % 26]}${LETTERS[(n >> 3) % 26]}${LETTERS[(n >> 6) % 26]}`
    + `${n % 10}${LETTERS[(n >> 9) % 26]}${String(n % 100).padStart(2, "0")}`
}

/// The API validates the CPF check digits, so the test cannot invent numbers:
/// it builds the first nine digits from the run stamp and computes the last
/// two the same way the real algorithm does.
const makeCpf = (seed) => {
  const base = String(Number(stamp) + seed).padStart(9, "0").slice(-9).split("").map(Number)

  const digit = (digits) => {
    const length = digits.length
    const sum = digits.reduce((acc, d, i) => acc + d * (length + 1 - i), 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const first = digit(base)
  const second = digit([...base, first])

  return [...base, first, second].join("")
}

async function call(method, path, body) {
  const headers = {}
  if (body) headers["Content-Type"] = "application/json"

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  let payload = null
  if (text) { try { payload = JSON.parse(text) } catch { payload = text } }
  return { status: res.status, payload }
}

/// Every case declares the status it expects; any divergence fails the run.
async function check(label, expectedStatus, method, path, body) {
  const { status, payload } = await call(method, path, body)
  const ok = status === expectedStatus

  if (ok) { passed++ } else { failed++ }

  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) {
    console.log(`      ${method} ${path} -> ${status} (expected ${expectedStatus})`)
    console.log(`      ${JSON.stringify(payload).slice(0, 300)}`)
  }

  return payload
}

function assert(label, condition, detail) {
  if (condition) { passed++; console.log(`PASS  ${label}`) }
  else { failed++; console.log(`FAIL  ${label}\n      ${detail ?? ""}`) }
}

/// Collects realtime events so the dispatch flow can be checked from the
/// console's point of view, not only from the HTTP responses.
function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS)
    const events = []

    socket.addEventListener("message", (e) => {
      if (e.data === "pong") { events.push({ type: "pong" }); return }
      try { events.push(JSON.parse(e.data)) } catch { /* ignore frames that are not JSON */ }
    })

    socket.addEventListener("open", () => resolve({ socket, events }))
    socket.addEventListener("error", reject)

    setTimeout(() => reject(new Error("WebSocket handshake timed out")), 5000)
  })
}

const waitFor = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log("=== units ===")
  const unitList = await check("list units", 200, "GET", "/units?page=1&per_page=50")
  const taubate = unitList.units.find((u) => u.acronym === "PB-TAUBATE")
  assert("PB-TAUBATE present in the seed", !!taubate)

  console.log("\n=== firefighters ===")
  await check("firefighter with malformed cpf", 400, "POST", "/firefighters", {
    name: "Teste Invalido", war_name: "INVALIDO", military_id: `MI${stamp}X`,
    cpf: "123.456.789-00", rank: "SOLDADO_PRIMEIRA_CLASSE", phone: "12991234567",
    admission_date: "2020-03-01", unit_id: taubate.id
  })

  // Eleven digits, but the check digits do not match: the shape is right and
  // only the algorithm can tell it apart from a real number.
  await check("firefighter with invalid cpf check digits", 400, "POST", "/firefighters", {
    name: "Teste Digito", war_name: "DIGITO", military_id: `MI${stamp}Y`,
    cpf: "11111111111", rank: "SOLDADO_PRIMEIRA_CLASSE", phone: "12991234567",
    admission_date: "2020-03-01", unit_id: taubate.id
  })

  await check("firefighter admitted in the future", 400, "POST", "/firefighters", {
    name: "Teste Futuro", war_name: "FUTURO", military_id: `MI${stamp}Z`,
    cpf: makeCpf(9), rank: "CABO", phone: "12991234567",
    admission_date: "2035-01-01", unit_id: taubate.id
  })

  const driver = await check("create driver", 201, "POST", "/firefighters", {
    name: "Carlos Eduardo Ramos", war_name: "RAMOS", military_id: `MI${stamp}1`,
    cpf: makeCpf(1), rank: "TERCEIRO_SARGENTO",
    phone: "12991234567", email: `ramos${stamp}@bombeiros.local`,
    admission_date: "2015-03-01", unit_id: taubate.id
  })

  const commander = await check("create crew commander", 201, "POST", "/firefighters", {
    name: "Ana Paula Moreira", war_name: "MOREIRA", military_id: `MI${stamp}2`,
    cpf: makeCpf(2), rank: "PRIMEIRO_TENENTE",
    phone: "12991234568", admission_date: "2012-06-15", unit_id: taubate.id
  })

  await check("duplicated military id", 409, "POST", "/firefighters", {
    name: "Outro Bombeiro", war_name: "OUTRO", military_id: `MI${stamp}1`,
    cpf: makeCpf(3), rank: "CABO",
    phone: "12991234569", admission_date: "2018-01-10", unit_id: taubate.id
  })

  console.log("\n=== vehicles ===")
  await check("vehicle with invalid plate", 400, "POST", "/vehicles", {
    prefix: `UR-${stamp}`, type: "UR", plate: "1234ABC", model: "Sprinter",
    year: 2022, crew_capacity: 3, unit_id: taubate.id
  })

  const vehicle = await check("create ABT", 201, "POST", "/vehicles", {
    prefix: `ABT-${stamp}`, type: "ABT", plate: makePlate(1), model: "Mercedes Atego",
    year: 2021, water_capacity_liters: 5000, crew_capacity: 6, unit_id: taubate.id
  })

  await check("duplicated prefix", 409, "POST", "/vehicles", {
    prefix: `ABT-${stamp}`, type: "ABT", plate: makePlate(2), model: "Volvo",
    year: 2020, crew_capacity: 6, unit_id: taubate.id
  })

  console.log("\n=== crews and shifts ===")
  const crew = await check("create crew", 201, "POST", "/crews", {
    name: `Guarnicao Alfa ${stamp}`,
    vehicle_id: vehicle.vehicle.id,
    unit_id: taubate.id,
    commander_id: commander.firefighter.id,
    started_at: new Date().toISOString(),
    members: [
      { firefighter_id: commander.firefighter.id, role: "COMANDANTE" },
      { firefighter_id: driver.firefighter.id, role: "MOTORISTA" }
    ]
  })

  await check("create shift", 201, "POST", "/shifts", {
    type: "PLANTAO_24X72",
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    firefighter_id: driver.firefighter.id,
    unit_id: taubate.id
  })

  console.log("\n=== realtime ===")
  let stream = null
  try {
    stream = await openSocket()
    assert("WebSocket handshake accepted", true)
    await waitFor(200)
    assert("connected frame received", stream.events.some((e) => e.type === "connected"),
      JSON.stringify(stream.events))
  } catch (error) {
    failed++
    console.log(`FAIL  WebSocket handshake accepted\n      ${error.message}`)
  }

  console.log("\n=== occurrences ===")
  const occurrence = await check("open occurrence in Taubate", 201, "POST", "/occurrences", {
    nature: "INCENDIO_EDIFICACAO",
    priority: "ALTA",
    description: "Fogo em residencia de dois andares, com vitimas no interior",
    address: "Rua Coronel Gomes Nogueira, Centro, Taubate",
    latitude: -23.0400,
    longitude: -45.5700,
    caller_name: "Vizinho",
    caller_phone: "12991110000",
    unit_id: taubate.id
  })

  assert("protocol follows the YYYY-NNNNNN format",
    /^\d{4}-\d{6}$/.test(occurrence.occurrence?.protocol ?? ""),
    occurrence.occurrence?.protocol)

  await check("occurrence for an unknown unit", 404, "POST", "/occurrences", {
    nature: "SALVAMENTO", priority: "MEDIA",
    description: "Ocorrencia de teste para unidade inexistente",
    address: "Rua X", latitude: -23.03, longitude: -45.56,
    unit_id: "00000000-0000-0000-0000-000000000000"
  })

  console.log("\n=== dispatch with route from the AI ===")
  const dispatch = await check("dispatch the vehicle", 201, "POST", "/dispatches", {
    occurrence_id: occurrence.occurrence.id,
    vehicle_id: vehicle.vehicle.id,
    crew_id: crew.crew.id
  })

  const routes = dispatch.routes ?? []
  assert("two routes persisted (neural + dijkstra)", routes.length === 2,
    `received ${routes.length}: ${dispatch.message}`)

  const neural = routes.find((r) => r.algorithm === "NEURAL")
  const dijkstra = routes.find((r) => r.algorithm === "DIJKSTRA")

  assert("neural route has distance and time", !!neural && neural.distance_meters > 0 && neural.estimated_time_seconds > 0,
    JSON.stringify(neural)?.slice(0, 200))
  assert("dijkstra route has distance and time", !!dijkstra && dijkstra.distance_meters > 0,
    JSON.stringify(dijkstra)?.slice(0, 200))
  assert("neural geometry is a coordinate list", Array.isArray(neural?.geometry) && neural.geometry.length > 1,
    `${neural?.geometry?.length} points`)
  assert("model version recorded", !!neural?.model_version, String(neural?.model_version))

  if (neural && dijkstra) {
    console.log(`      neural:   ${neural.distance_meters} m, ${neural.estimated_time_seconds.toFixed(1)} s, ${neural.node_count} nodes`)
    console.log(`      dijkstra: ${dijkstra.distance_meters} m, ${dijkstra.estimated_time_seconds.toFixed(1)} s, ${dijkstra.node_count} nodes`)
  }

  const afterDispatch = await check("occurrence advanced to DESPACHADA", 200, "GET", `/occurrences/${occurrence.occurrence.id}`)
  assert("occurrence status is DESPACHADA", afterDispatch.occurrence?.status === "DESPACHADA",
    afterDispatch.occurrence?.status)

  const busy = await check("vehicle marked as busy", 200, "GET", `/vehicles/${vehicle.vehicle.id}`)
  assert("vehicle status is EMPENHADA", busy.vehicle?.status === "EMPENHADA", busy.vehicle?.status)

  await check("dispatching a busy vehicle again", 409, "POST", "/dispatches", {
    occurrence_id: occurrence.occurrence.id,
    vehicle_id: vehicle.vehicle.id
  })

  await check("advance dispatch to A_CAMINHO", 200, "PATCH", `/dispatches/${dispatch.dispatch.id}`, { status: "A_CAMINHO" })
  await check("skipping NO_LOCAL is refused", 400, "PATCH", `/dispatches/${dispatch.dispatch.id}`, { status: "FINALIZADO" })
  await check("crew arrives (NO_LOCAL)", 200, "PATCH", `/dispatches/${dispatch.dispatch.id}`, { status: "NO_LOCAL" })

  const attending = await check("occurrence read back after arrival", 200, "GET", `/occurrences/${occurrence.occurrence.id}`)
  assert("occurrence moved to EM_ATENDIMENTO", attending.occurrence?.status === "EM_ATENDIMENTO", attending.occurrence?.status)

  await check("finish the dispatch", 200, "PATCH", `/dispatches/${dispatch.dispatch.id}`, { status: "FINALIZADO" })
  await check("reopening a finished dispatch", 400, "PATCH", `/dispatches/${dispatch.dispatch.id}`, { status: "A_CAMINHO" })

  const released = await check("vehicle read back after finishing", 200, "GET", `/vehicles/${vehicle.vehicle.id}`)
  assert("vehicle released to DISPONIVEL", released.vehicle?.status === "DISPONIVEL", released.vehicle?.status)

  if (stream) {
    await waitFor(300)
    assert("occurrence.created broadcast", stream.events.some((e) => e.type === "occurrence.created"))
    assert("dispatch.created broadcast", stream.events.some((e) => e.type === "dispatch.created"))
    assert("dispatch.updated broadcast", stream.events.some((e) => e.type === "dispatch.updated"))
    stream.socket.close()
  }

  console.log("\n=== AI endpoints ===")
  const model = await check("model info", 200, "GET", "/ai/model")
  assert("model reported as loaded", model.model?.loaded === true, JSON.stringify(model))
  assert("graph has nodes and edges", (model.model?.graph_nodes ?? 0) > 0 && (model.model?.graph_edges ?? 0) > 0,
    `${model.model?.graph_nodes} / ${model.model?.graph_edges}`)

  const exploratory = await check("exploratory route from the unit", 200, "POST", "/ai/routes", {
    origin_unit_id: taubate.id,
    destination_latitude: -23.0330,
    destination_longitude: -45.5620
  })
  assert("exploratory route is not persisted", exploratory.routes === null, JSON.stringify(exploratory.routes))
  assert("exploratory route returns both variants", !!exploratory.neural && !!exploratory.shortest)

  await check("route without an origin", 400, "POST", "/ai/routes", {
    destination_latitude: -23.03, destination_longitude: -45.56
  })

  await check("route from an unknown unit", 404, "POST", "/ai/routes", {
    origin_unit_id: "00000000-0000-0000-0000-000000000000",
    destination_latitude: -23.03, destination_longitude: -45.56
  })

  await check("route to a point outside the graph", 400, "POST", "/ai/routes", {
    origin_unit_id: taubate.id,
    destination_latitude: -3.1190, destination_longitude: -60.0217
  })

  await check("list training runs", 200, "GET", "/ai/training?page=1&per_page=5")

  console.log("\n=== open console ===")
  // There is no login: every screen of the console talks to the API straight
  // away, so the smoke test proves the same calls answer without a session.
  await check("administrative vehicle without a session", 201, "POST", "/vehicles", {
    prefix: `AV-${stamp}`, type: "AV", plate: makePlate(3), model: "Fiat Toro",
    year: 2023, crew_capacity: 2, unit_id: taubate.id
  })

  await check("occurrence without a session", 201, "POST", "/occurrences", {
    nature: "CAPTURA_ANIMAL", priority: "BAIXA",
    description: "Enxame de abelhas em escola municipal do centro",
    address: "Avenida Tiradentes, Taubate",
    latitude: -23.0290, longitude: -45.5560, unit_id: taubate.id
  })

  await check("dispatch listing without a session", 200, "GET", "/dispatches")

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
