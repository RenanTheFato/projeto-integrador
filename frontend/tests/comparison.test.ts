import assert from 'node:assert/strict'
import { test } from 'node:test'
import { comparisonProgress, nextCameraLayout } from '../src/components/mapa/routes/comparison-policy.ts'

test('three vehicles share a clock and retain real arrival order', () => {
  assert.deepEqual(comparisonProgress(30_000, 60_000, [120, 240, 80]), [1, 0.5, 1])
  assert.deepEqual(comparisonProgress(60_000, 60_000, [120, 240, 80]), [1, 1, 1])
})

test('camera separates distant vehicles and uses hysteresis before reuniting', () => {
  assert.equal(nextCameraLayout(false, 14), true)
  assert.equal(nextCameraLayout(false, 16.5), false)
  assert.equal(nextCameraLayout(true, 15.9), true)
  assert.equal(nextCameraLayout(true, 16.6), false)
})

test('missing critical route still supports a pair and zero elapsed time', () => {
  assert.deepEqual(comparisonProgress(0, 60_000, [100, 200]), [0, 0])
  assert.deepEqual(comparisonProgress(15_000, 60_000, [100, 200]), [0.5, 0.25])
})
