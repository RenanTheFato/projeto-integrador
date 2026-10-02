import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

type TruckVariant = "normal" | "ai" | "distance"

function createMaterials(variant: TruckVariant) {
  const colors = variant === "ai" ? [0x24668c, 0x153f59, 0x3685ad]
    : variant === "distance" ? [0xad691f, 0x69451c, 0xce8d34]
      : [0xac3035, 0x68252b, 0xc54446]
  const painted = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.22 })
  const signal = () => new THREE.MeshStandardMaterial({ color: 0xdc332b, emissive: 0xe93524, emissiveIntensity: 0.65, roughness: 0.3 })

  // Each model owns its materials, including on maps used for comparison.
  return {
    body: painted(colors[0]),
    lower: painted(colors[1]),
    cab: painted(colors[2]),
    white: new THREE.MeshStandardMaterial({ color: 0xe0e7e3, roughness: 0.54, metalness: 0.15 }),
    silver: new THREE.MeshStandardMaterial({ color: 0x9daeb0, roughness: 0.42, metalness: 0.65 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x233038, roughness: 0.64, metalness: 0.12 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x173c4b, roughness: 0.18, metalness: 0.35 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x171d21, roughness: 0.92 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xceac57, roughness: 0.6, metalness: 0.08 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xece9d5, emissive: 0xe5dcc1, emissiveIntensity: 0.24, roughness: 0.35 }),
    leftSignal: signal(),
    rightSignal: signal(),
    shadow: new THREE.MeshBasicMaterial({ color: 0x101d24, vertexColors: true, transparent: true, depthWrite: false }),
    route: new THREE.MeshBasicMaterial({ color: variant === "distance" ? 0xb86a12 : 0x0b63a5, transparent: true, opacity: 0.58, depthWrite: false }),
  }
}

type TruckMaterials = ReturnType<typeof createMaterials>
const signalMaterials = new WeakMap<THREE.Object3D, Pick<TruckMaterials, "leftSignal" | "rightSignal">>()

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  parent.add(mesh)
  return mesh
}

function addWheel(parent: THREE.Object3D, x: number, y: number, materials: TruckMaterials) {
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.36, 16), materials.tire)
  tire.rotation.z = Math.PI / 2
  tire.position.set(x, y, 0.59)
  parent.add(tire)

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.38, 12), materials.silver)
  hub.rotation.z = Math.PI / 2
  hub.position.copy(tire.position)
  parent.add(hub)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.395, 10), materials.dark)
  axle.rotation.z = Math.PI / 2
  axle.position.copy(tire.position)
  parent.add(axle)
}

function addCab(parent: THREE.Object3D, materials: TruckMaterials) {
  const profile = new THREE.Shape()
    .moveTo(0.94, 0.82).lineTo(3.96, 0.82).lineTo(3.96, 1.74)
    .lineTo(3.58, 2.77).lineTo(0.94, 2.77).closePath()
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: 2.42, bevelEnabled: false, steps: 1 })
  const positions = geometry.getAttribute("position")
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, positions.getZ(i) - 1.21, positions.getX(i), positions.getY(i))
  }
  geometry.computeVertexNormals()
  parent.add(new THREE.Mesh(geometry, materials.cab))

  // Keep glazing outside the cab shell, including its raked front face.
  addBox(parent, [2.16, 0.045, 0.83], [0, 3.786, 2.25], materials.glass, [0.354, 0, 0])
  addBox(parent, [0.06, 0.054, 0.85], [0, 3.808, 2.25], materials.dark, [0.354, 0, 0])
  addBox(parent, [0.58, 0.04, 0.035], [-0.56, 3.959, 1.93], materials.dark, [0, 0.1, 0])
  addBox(parent, [0.58, 0.04, 0.035], [0.56, 3.959, 1.93], materials.dark, [0, 0.1, 0])

  for (const side of [-1, 1]) {
    const x = side * 1.236
    addBox(parent, [0.038, 1.07, 0.76], [x, 2.77, 2.25], materials.glass)
    addBox(parent, [0.038, 0.71, 0.76], [x, 1.63, 2.25], materials.glass)
    addBox(parent, [0.045, 0.07, 1.65], [x, 2.08, 1.77], materials.lower)
    addBox(parent, [0.053, 2.68, 0.13], [x, 2.38, 1.67], materials.white)
    addBox(parent, [0.055, 0.24, 0.045], [x, 2.22, 1.5], materials.dark)
    addBox(parent, [0.055, 0.2, 0.045], [x, 1.3, 1.5], materials.dark)
    addBox(parent, [0.22, 0.83, 0.1], [side * 1.22, 1.4, 0.75], materials.silver)
    addBox(parent, [0.3, 0.08, 0.065], [side * 1.35, 3.3, 2.03], materials.dark)
    addBox(parent, [0.16, 0.27, 0.38], [side * 1.5, 3.3, 2.15], materials.dark)
    addBox(parent, [0.02, 0.2, 0.29], [side * 1.59, 3.3, 2.15], materials.silver)
    addBox(parent, [0.62, 0.055, 0.27], [side * 0.79, 4.003, 1.12], materials.lamp)
    addBox(parent, [0.17, 0.06, 0.12], [side * 1.03, 4.006, 1.41], materials.yellow)
  }

  addBox(parent, [1.07, 0.07, 0.53], [0, 4.003, 1.26], materials.dark)
  for (const z of [1.11, 1.25, 1.39]) addBox(parent, [0.94, 0.035, 0.026], [0, 4.052, z], materials.silver)
  addBox(parent, [2.48, 0.2, 0.23], [0, 4.015, 0.79], materials.silver)
  addBox(parent, [1.75, 0.38, 0.09], [0, 2.65, 2.86], materials.dark)
  addBox(parent, [0.67, 0.32, 0.17], [-0.53, 2.65, 2.96], materials.leftSignal)
  addBox(parent, [0.67, 0.32, 0.17], [0.53, 2.65, 2.96], materials.rightSignal)
  addBox(parent, [0.38, 0.31, 0.12], [0, 2.65, 2.95], materials.white)
}

function addEquipment(parent: THREE.Object3D, materials: TruckMaterials) {
  addBox(parent, [2.42, 4.72, 2.08], [0, -1.5, 1.81], materials.body)
  addBox(parent, [2.46, 4.78, 0.09], [0, -1.5, 2.88], materials.silver)
  for (const side of [-1, 1]) {
    const x = side * 1.234
    for (const y of [-0.12, -1.47, -2.82]) {
      addBox(parent, [0.055, 1.2, 1.28], [x, y, 1.86], materials.dark)
      addBox(parent, [0.066, 1.08, 1.16], [x, y, 1.86], materials.silver)
      for (const z of [1.48, 1.71, 1.94, 2.17]) {
        addBox(parent, [0.075, 1.06, 0.018], [x, y, z], materials.dark)
      }
      addBox(parent, [0.094, 0.3, 0.047], [x, y, 1.39], materials.dark)
    }
    addBox(parent, [0.073, 4.62, 0.13], [x, -1.5, 2.61], materials.white)
    addBox(parent, [0.078, 4.62, 0.05], [x, -1.5, 2.49], materials.yellow)
    addBox(parent, [0.19, 4.56, 0.12], [side * 1.22, -1.49, 0.87], materials.dark)
    for (const y of [0.59, -3.56]) addBox(parent, [0.081, 0.16, 0.075], [x, y, 1.05], materials.yellow)
    addBox(parent, [0.09, 4.48, 0.1], [side * 1.12, -1.5, 3.06], materials.silver)
    for (const y of [0.52, -3.51]) addBox(parent, [0.07, 0.07, 0.23], [side * 1.12, y, 2.97], materials.silver)
    addBox(parent, [0.28, 0.12, 0.34], [side * 1.0, -3.907, 1.22], materials.cab)
  }

  // Roof ladder and suction hoses distinguish the appliance from a delivery van.
  for (const x of [-0.43, 0.43]) addBox(parent, [0.095, 4.08, 0.095], [x, -1.35, 3.04], materials.silver)
  for (let y = -3.18; y < 0.6; y += 0.48) addBox(parent, [0.86, 0.065, 0.068], [0, y, 3.04], materials.silver)
  for (const x of [-0.79, 0.79]) {
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 3.33, 10), materials.dark)
    hose.position.set(x, -1.44, 3.05)
    parent.add(hose)
    for (const y of [0.2, -3.07]) {
      const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 10), materials.silver)
      coupling.position.set(x, y, 3.05)
      parent.add(coupling)
    }
  }
  addBox(parent, [1.43, 0.08, 1.27], [0, -3.907, 1.99], materials.silver)
  for (const side of [-1, 1]) {
    addBox(parent, [0.1, 0.1, 1.75], [side * 0.52, -3.98, 1.88], materials.silver)
    addBox(parent, [0.18, 0.075, 0.4], [side * 0.86, -3.955, 2.03], materials.yellow, [0, side * 0.55, 0])
  }
  for (const z of [1.35, 1.7, 2.05, 2.4]) addBox(parent, [0.94, 0.08, 0.06], [0, -4.015, z], materials.dark)
  addBox(parent, [2.47, 0.22, 0.19], [0, -4.04, 0.76], materials.silver)
}

function addGroundMark(parent: THREE.Object3D, materials: TruckMaterials, variant: TruckVariant) {
  const geometry = new THREE.RingGeometry(0, 1, 32, 4)
  const positions = geometry.getAttribute("position")
  const colors = new Float32Array(positions.count * 4)
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(positions.getX(i), positions.getY(i))
    colors.set([1, 1, 1, 0.27 * Math.pow(Math.max(0, 1 - radius), 0.8)], i * 4)
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4))
  const shadow = new THREE.Mesh(geometry, materials.shadow)
  shadow.scale.set(1.8, 4.55, 1)
  shadow.position.set(0, -0.06, 0.015)
  shadow.renderOrder = -2
  parent.add(shadow)

  if (variant !== "normal") {
    // Lane brackets identify each comparison route while leaving the road visible.
    for (const side of [-1, 1]) {
      addBox(parent, [0.085, 5.0, 0.025], [side * 1.77, -0.1, 0.03], materials.route).renderOrder = -1
      for (const y of [-2.6, 2.4]) addBox(parent, [0.42, 0.085, 0.025], [side * 1.6, y, 0.03], materials.route).renderOrder = -1
    }
  } else materials.route.dispose()
}

export function createFireTruckModel(variant: TruckVariant = "normal") {
  const truck = new THREE.Group()
  const materials = createMaterials(variant)
  addGroundMark(truck, materials, variant)
  addBox(truck, [2.36, 8.13, 0.35], [0, -0.04, 0.66], materials.lower)
  addBox(truck, [1.8, 7.08, 0.16], [0, -0.1, 0.31], materials.dark)
  addCab(truck, materials)
  addEquipment(truck, materials)
  for (const x of [-1.24, 1.24]) {
    addWheel(truck, x, 2.65, materials)
    addWheel(truck, x, -2.44, materials)
  }

  truck.updateMatrixWorld(true)
  const batches = new Map<THREE.Material, { geometries: THREE.BufferGeometry[], renderOrder: number }>()
  truck.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
    // Cab extrusion is non-indexed; normalize before batching its painted trim.
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    const batch = batches.get(object.material) ?? { geometries: [], renderOrder: object.renderOrder }
    batch.geometries.push(geometry)
    batches.set(object.material, batch)
    object.geometry.dispose()
  })

  const optimized = new THREE.Group()
  optimized.name = "zeno-firetruck"
  batches.forEach(({ geometries, renderOrder }, material) => {
    const merged = mergeGeometries(geometries)
    if (merged) {
      const mesh = new THREE.Mesh(merged, material)
      mesh.renderOrder = renderOrder
      optimized.add(mesh)
      geometries.forEach((geometry) => geometry.dispose())
    } else geometries.forEach((geometry) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.renderOrder = renderOrder
      optimized.add(mesh)
    })
  })
  signalMaterials.set(optimized, materials)
  return optimized
}

/** Uses playback's existing repaint; never schedules a second animation loop. */
export function updateFireTruckSignals(root: THREE.Object3D, seconds: number, moving: boolean, reducedMotion: boolean) {
  const signals = signalMaterials.get(root)
  if (!signals) return
  const phase = moving && !reducedMotion ? Math.sin(seconds * Math.PI * 2) * 0.36 : 0
  signals.leftSignal.emissiveIntensity = 0.65 + phase
  signals.rightSignal.emissiveIntensity = 0.65 - phase
}

export function disposeFireTruckModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  signalMaterials.delete(root)
}
