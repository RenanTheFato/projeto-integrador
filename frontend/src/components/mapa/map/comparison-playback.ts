import maplibregl from 'maplibre-gl'
import { STYLE } from '../constants/constants'
import { bearingBetween, type RouteMetrics } from '../routes/utils'
import { comparisonProgress, nextCameraLayout } from '../routes/comparison-policy'
import { addRouteLayers, set3DEnvironment, setBuildingLayersVisibility, setLayerVisibility } from './layers'
import {
  addComparisonAiVehicleLayer, addComparisonVehicleLayer, addCriticalVehicleLayer,
  moveComparisonAiVehicle, moveComparisonVehicle, moveCriticalVehicle,
  showComparisonAiVehicle, showComparisonVehicle, showCriticalVehicle,
} from './markers'

interface Participant { metrics: RouteMetrics; seconds: number; kind: 'ai' | 'standard' | 'critical' }
const styles = {
  ai: { label: 'IA', color: '#0B63A5', add: addComparisonAiVehicleLayer, move: moveComparisonAiVehicle, show: showComparisonAiVehicle },
  standard: { label: 'Padrão', color: '#B86A12', add: addComparisonVehicleLayer, move: moveComparisonVehicle, show: showComparisonVehicle },
  critical: { label: 'Modo crítico', color: '#B8322A', add: addCriticalVehicleLayer, move: moveCriticalVehicle, show: showCriticalVehicle },
}

export function startComparisonPlayback(
  map: maplibregl.Map,
  wrap: HTMLElement,
  participants: Participant[],
  onFinish: () => void,
): () => void {
  let frame = 0
  let stopped = false
  let elapsed = 0
  let previous: number | null = null
  let split = false
  let completed = false
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = motionPreference.matches
  let paused = reducedMotion
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  let speed = 1
  let lastLabelUpdate = -Infinity
  let lastLayoutChange = -Infinity
  let renderedFrames = 0
  let sampleStarted = performance.now()
  let slowSamples = 0
  const originalPixelRatio = map.getPixelRatio()
  const duration = Math.max(45_000, Math.min(90_000, Math.max(...participants.map((p) => p.metrics.followDurationMs)) * 1.65))
  const bearings = participants.map((p) => bearingBetween(p.metrics.coords[0], p.metrics.coords[1]))
  const seconds = participants.map((p) => p.seconds)
  const auxiliaries: { map: maplibregl.Map; ready: boolean; element: HTMLElement }[] = []
  const auxiliaryRoot = document.createElement('div')
  auxiliaryRoot.className = 'comparison-panes'
  wrap.append(auxiliaryRoot)
  wrap.style.setProperty('--comparison-count', String(participants.length))

  const hud = document.createElement('div')
  hud.className = 'comparison-hud'
  hud.setAttribute('role', 'region')
  hud.setAttribute('aria-label', 'Simulação comparativa de deslocamento')
  const heading = document.createElement('div')
  heading.className = 'comparison-heading'
  const headingCopy = document.createElement('div')
  headingCopy.className = 'comparison-heading-copy'
  const kicker = document.createElement('span')
  kicker.className = 'comparison-kicker'
  kicker.textContent = 'SIMULAÇÃO DE DESLOCAMENTO'
  const status = document.createElement('span')
  status.className = 'comparison-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  headingCopy.append(kicker, status)
  const actions = document.createElement('div')
  actions.className = 'comparison-actions'
  const performanceLabel = document.createElement('small')
  performanceLabel.className = 'comparison-fps'
  performanceLabel.title = 'Quadros renderizados por segundo no mapa principal'
  const measureRender = () => { renderedFrames++ }
  map.on('render', measureRender)
  const pause = document.createElement('button')
  pause.type = 'button'
  const updateStatus = () => {
    const camera = reducedMotion ? 'Câmera estável' : split ? 'Câmeras individuais' : 'Câmera conjunta'
    status.textContent = completed ? 'Todas as viaturas no destino' : `${camera}${paused ? ' · Pausada' : ''}`
    pause.textContent = paused ? 'Continuar' : 'Pausar'
    pause.setAttribute('aria-label', paused ? 'Continuar simulação' : 'Pausar simulação')
    pause.setAttribute('aria-pressed', String(paused))
  }
  pause.onclick = () => {
    paused = !paused
    updateStatus()
    syncPlayback()
  }
  const rate = document.createElement('button')
  rate.type = 'button'
  rate.textContent = '1×'
  rate.setAttribute('aria-label', 'Velocidade da simulação: 1 vez')
  rate.onclick = () => { speed = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1; rate.textContent = `${speed}×`; rate.setAttribute('aria-label', `Velocidade da simulação: ${speed} vezes`) }
  const stopButton = document.createElement('button')
  stopButton.type = 'button'
  stopButton.textContent = 'Encerrar'
  stopButton.setAttribute('aria-label', 'Encerrar simulação e liberar a câmera')
  const endPlayback = () => { cleanup(); if (!completed) onFinish() }
  stopButton.onclick = endPlayback
  actions.append(performanceLabel, pause, rate, stopButton)
  heading.append(headingCopy, actions)
  hud.append(heading)
  const rows = document.createElement('div')
  rows.className = 'comparison-telemetry'
  const values = participants.map((participant, index) => {
    const style = styles[participant.kind]
    style.add(map, participant.metrics.coords[0])
    style.move(map, participant.metrics.coords[0], bearings[index])
    style.show(map, true)
    const row = document.createElement('div')
    row.className = 'comparison-participant'
    row.style.setProperty('--route-color', style.color)
    const label = document.createElement('strong')
    label.textContent = style.label
    const value = document.createElement('span')
    const estimated = Math.max(0, Math.ceil(participant.seconds))
    value.textContent = `Estimativa ${Math.floor(estimated / 60)}:${String(estimated % 60).padStart(2, '0')}`
    const progress = document.createElement('progress')
    progress.max = 1
    progress.value = 0
    progress.setAttribute('aria-label', `Percurso ${style.label}`)
    row.append(label, value, progress)
    rows.append(row)
    return { value, progress }
  })
  hud.append(rows)
  const note = document.createElement('p')
  note.className = 'comparison-note'
  note.textContent = 'Tempos estimados · Reprodução acelerada, proporcional às chegadas. Não representa posições em tempo real.'
  hud.append(note)
  wrap.append(hud)
  const primaryLabel = document.createElement('div')
  primaryLabel.className = 'comparison-primary-label'
  primaryLabel.textContent = styles[participants[0].kind].label
  wrap.append(primaryLabel)

  const setupAuxiliaries = () => {
    if (auxiliaries.length) return
    participants.slice(1).forEach((participant) => {
      const pane = document.createElement('div')
      pane.className = 'comparison-pane'
      const canvas = document.createElement('div')
      canvas.className = 'comparison-pane-map'
      const label = document.createElement('span')
      label.className = 'comparison-pane-label'
      label.textContent = styles[participant.kind].label
      label.style.borderColor = styles[participant.kind].color
      const loading = document.createElement('span')
      loading.className = 'comparison-map-loading'
      loading.textContent = 'Carregando cartografia…'
      pane.append(canvas, label, loading)
      auxiliaryRoot.append(pane)
      const auxiliary = new maplibregl.Map({ container: canvas, style: STYLE,
        center: participant.metrics.coords[0], zoom: 16.8, pitch: 48,
        interactive: false, attributionControl: false, pixelRatio: Math.min(window.devicePixelRatio, 1.5) })
      const entry = { map: auxiliary, ready: false, element: pane }
      auxiliaries.push(entry)
      auxiliary.on('load', () => {
        if (stopped) return
        const coords = participant.metrics.coords
        addRouteLayers(auxiliary, participant.kind === 'ai' ? coords : [], participant.kind === 'standard' ? coords : [], participant.kind === 'critical' ? coords : [])
        setLayerVisibility(auxiliary, true)
        set3DEnvironment(auxiliary, true)
        setBuildingLayersVisibility(auxiliary, true)
        styles[participant.kind].add(auxiliary, coords[0])
        styles[participant.kind].show(auxiliary, true)
        entry.ready = true
        loading.remove()
      })
    })
  }

  const resize = new ResizeObserver(() => {
    wrap.classList.toggle('map-comparison-split', split && !completed)
    wrap.style.setProperty('--comparison-hud-height', `${hud.offsetHeight}px`)
    map.resize()
    auxiliaries.forEach((entry) => entry.map.resize())
  })
  wrap.style.setProperty('--comparison-hud-height', `${hud.offsetHeight}px`)
  resize.observe(wrap)
  resize.observe(hud)
  const loop = (timestamp: number) => {
    frame = 0
    if (stopped || completed || paused || document.hidden) return
    // React may replace the wrapper's class list when theater/fullscreen changes.
    wrap.classList.toggle('map-comparison-split', split)
    const dt = previous === null ? 0 : Math.min(100, timestamp - previous)
    previous = timestamp
    elapsed += dt * speed
    const progress = comparisonProgress(elapsed, duration, seconds)
    const vehicles = participants.map((participant, index) => {
      const travelled = participant.metrics.totalMeters * progress[index]
      const position = participant.metrics.pointAtDist(travelled)
      const ahead = participant.metrics.pointAtDist(Math.min(travelled + 30, participant.metrics.totalMeters))
      const behind = participant.metrics.pointAtDist(Math.max(0, travelled - 12))
      const target = bearingBetween(behind, ahead)
      const delta = ((target - bearings[index] + 540) % 360) - 180
      bearings[index] += delta * (1 - Math.exp(-dt / 180))
      // Small lateral lanes keep all three readable on shared road sections.
      const offset = split ? 0 : (index - (participants.length - 1) / 2) * 9
      styles[participant.kind].move(map, position, bearings[index], offset)
      return { position, ahead, bearing: bearings[index] }
    })
    const bounds = new maplibregl.LngLatBounds()
    vehicles.forEach((vehicle) => { bounds.extend(vehicle.position); bounds.extend(vehicle.ahead) })
    const width = map.getContainer().clientWidth
    const height = map.getContainer().clientHeight
    const padding = { top: Math.min(55, height * 0.12), bottom: Math.min(hud.offsetHeight + 30, height * 0.45), left: Math.min(70, width * 0.12), right: Math.min(70, width * 0.12) }
    const fitted = map.cameraForBounds(bounds, { padding, maxZoom: 17, bearing: 0 })
    const fittedZoom = (fitted?.zoom ?? 17) + (split ? Math.log2(wrap.clientWidth / Math.max(1, width)) : 0)
    const desiredSplit = !reducedMotion && nextCameraLayout(split, fittedZoom)
    let layoutChanged = false
    if (desiredSplit !== split && (timestamp - lastLayoutChange > 1800 || (desiredSplit && fittedZoom < 15))) {
      split = desiredSplit
      layoutChanged = true
      participants.forEach((participant, index) => styles[participant.kind].show(map, !split || index === 0))
      lastLayoutChange = timestamp
      wrap.classList.toggle('map-comparison-split', split)
      if (split) setupAuxiliaries()
      map.resize()
      auxiliaries.forEach((entry) => entry.map.resize())
      updateStatus()
    }
    const center = split ? vehicles[0].ahead : fitted?.center ?? vehicles[0].position
    const zoom = split ? 16.9 : Math.max(15.65, (fitted?.zoom ?? 16.9) - 0.25)
    // North remains fixed in the collective view; individual views follow the road.
    const targetBearing = split ? vehicles[0].bearing : 0
    const current = map.getCenter()
    const targetCenter = maplibregl.LngLat.convert(center)
    const amount = layoutChanged ? 1 : 1 - Math.exp(-Math.max(dt, 16) / 150)
    if (!reducedMotion) map.jumpTo({ center: [current.lng + (targetCenter.lng - current.lng) * amount, current.lat + (targetCenter.lat - current.lat) * amount],
      zoom: map.getZoom() + (zoom - map.getZoom()) * amount, pitch: split ? 48 : 25, padding: { top: 0, bottom: 0, left: 0, right: 0 },
      bearing: map.getBearing() + (((targetBearing - map.getBearing() + 540) % 360) - 180) * amount })
    if (split) auxiliaries.forEach((entry, index) => {
      if (!entry.ready) return
      const vehicle = vehicles[index + 1]
      styles[participants[index + 1].kind].move(entry.map, vehicle.position, vehicle.bearing)
      entry.map.jumpTo({ center: vehicle.ahead, bearing: vehicle.bearing, zoom: 16.9, pitch: 48, padding: { top: 0, bottom: 0, left: 0, right: 0 } })
    })
    if (timestamp - lastLabelUpdate > 180) {
      lastLabelUpdate = timestamp
      values.forEach((row, index) => {
        row.progress.value = progress[index]
        const remaining = Math.max(0, Math.ceil(seconds[index] * (1 - progress[index])))
        row.value.textContent = progress[index] >= 1 ? 'No destino' : `${Math.round(progress[index] * 100)}% · estimativa ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
      })
    }
    if (timestamp - sampleStarted >= 1500) {
      const fps = Math.round(renderedFrames * 1000 / (timestamp - sampleStarted))
      performanceLabel.textContent = paused || document.hidden ? '' : `${fps} FPS`
      slowSamples = !paused && !document.hidden && fps < 45 ? slowSamples + 1 : 0
      if (slowSamples >= 2 && map.getPixelRatio() > 1) {
        const ratio = Math.max(1, map.getPixelRatio() - 0.25)
        map.setPixelRatio(ratio)
        auxiliaries.forEach((entry) => entry.map.setPixelRatio(ratio))
        slowSamples = 0
      }
      renderedFrames = 0
      sampleStarted = timestamp
    }
    if (progress.every((value) => value >= 1)) {
      completed = true
      values.forEach((row) => { row.progress.value = 1; row.value.textContent = 'No destino' })
      updateStatus()
      pause.disabled = true
      rate.disabled = true
      wrap.classList.remove('map-comparison-split')
      participants.forEach((participant) => styles[participant.kind].show(map, true))
      map.resize()
      auxiliaries.forEach((entry) => entry.map.remove())
      auxiliaries.length = 0
      auxiliaryRoot.replaceChildren()
      map.off('render', measureRender)
      performanceLabel.textContent = ''
      map.setPixelRatio(originalPixelRatio)
      document.removeEventListener('visibilitychange', syncPlayback)
      motionPreference.removeEventListener('change', onMotionPreferenceChange)
      onFinish()
      return
    }
    frame = requestAnimationFrame(loop)
  }
  const syncPlayback = () => {
    cancelAnimationFrame(frame)
    frame = 0
    previous = null
    renderedFrames = 0
    slowSamples = 0
    sampleStarted = performance.now()
    performanceLabel.textContent = ''
    if (!stopped && !completed && !paused && !document.hidden) frame = requestAnimationFrame(loop)
  }
  const showStableOverview = () => {
    split = false
    wrap.classList.remove('map-comparison-split')
    participants.forEach((participant) => styles[participant.kind].show(map, true))
    map.resize()
    const bounds = new maplibregl.LngLatBounds()
    participants.forEach((participant) => participant.metrics.coords.forEach((point) => bounds.extend(point)))
    const height = map.getContainer().clientHeight
    const width = map.getContainer().clientWidth
    map.fitBounds(bounds, {
      padding: { top: 35, bottom: Math.min(hud.offsetHeight + 30, height * 0.45), left: Math.min(50, width * 0.12), right: Math.min(50, width * 0.12) },
      maxZoom: 16, pitch: 0, bearing: 0, duration: 0,
    })
  }
  const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches
    if (reducedMotion) {
      paused = true
      showStableOverview()
    }
    updateStatus()
    syncPlayback()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    endPlayback()
  }
  hud.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', syncPlayback)
  motionPreference.addEventListener('change', onMotionPreferenceChange)
  map.stop()
  if (reducedMotion) showStableOverview()
  else map.jumpTo({ center: participants[0].metrics.coords[0], zoom: 16.9, pitch: 25, bearing: 0 })
  updateStatus()
  syncPlayback()
  const cleanup = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    map.off('render', measureRender)
    map.setPixelRatio(originalPixelRatio)
    document.removeEventListener('visibilitychange', syncPlayback)
    motionPreference.removeEventListener('change', onMotionPreferenceChange)
    hud.removeEventListener('keydown', onKeyDown)
    resize.disconnect()
    auxiliaries.forEach((entry) => entry.map.remove())
    auxiliaries.length = 0
    auxiliaryRoot.remove()
    const restoreFocus = hud.contains(document.activeElement)
    hud.remove()
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    primaryLabel.remove()
    participants.forEach((participant) => styles[participant.kind].show(map, false))
    wrap.classList.remove('map-comparison-split')
    wrap.style.removeProperty('--comparison-count')
    wrap.style.removeProperty('--comparison-hud-height')
    map.resize()
  }
  return cleanup
}
