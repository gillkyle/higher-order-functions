import * as THREE from 'three'
import TWEEN from 'tween.js'
// import MakeOrbitControls from 'three-orbit-controls'
// const OrbitControls = MakeOrbitControls(THREE)

import Stats from 'stats-js'

let stats = new Stats()
stats.setMode(0) // 0: fps, 1: ms
// Align top-left
stats.domElement.style.position = 'absolute'
stats.domElement.style.left = '0px'
stats.domElement.style.top = '0px'

document.body.appendChild(stats.domElement)

import PixelManager from './pixel-manager'
import sceneManager from 'core/scene'

// Constants
const ZOOM = {
  // min: 2,
  min: 14,
  max: 1600,
  point: 40,
}
const ANIMATION_OFFSET = 800
const MAX_PIXEL_SIZE_PX = 128

const ANIMATION_TIME = 30000
const ZOOM_TIME = 3000
const SWING = 500

// Closure variables
let camera, scene, renderer, raycaster, pixelManager

export function animate() {
  requestAnimationFrame(animate)
  render()
  stats.update()
}

export function init(container) {
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    30000,
  )
  camera.position.z = ZOOM.min
  // controls = new OrbitControls(camera)

  raycaster = new THREE.Raycaster()
  scene = new THREE.Scene()

  renderer = new THREE.WebGLRenderer()
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)

  pixelManager = new PixelManager(renderer)
  pixelManager.addPixelsToScene(scene)

  container.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize, false)

  animate()
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

// Animation state machine
let start

const zoomParam = { z: ZOOM.min, x: 0, y: 0 }
const timeParam = { t: 0.00004 }
const swingParam = { s: 1, stop: false }

window.zoomParam = zoomParam

function render() {
  TWEEN.update()

  // Update the pixel geometry size based on the zoom of the camera
  const vFOV = camera.fov * Math.PI / 180
  const height = 2 * Math.tan(vFOV / 2) * zoomParam.z
  const maxPixelFraction = MAX_PIXEL_SIZE_PX / window.innerHeight
  const maxSize = maxPixelFraction * height

  const size = Math.min(pixelManager.pixelSize, maxSize)
  pixelManager.updatePixelSize(size)

  if (sceneManager.isAnimationActive) {
    const now = Date.now()
    const elapsed = now - start

    let time = (elapsed + ANIMATION_OFFSET) * timeParam.t

    const pixelGroups = pixelManager.pixelGroups
    for (let i = 0; i < pixelGroups.length; i++) {
      const pixelGroup = pixelGroups[i]
      const s = swingParam.stop ? 0 : swingParam.s
      pixelGroup.position.z = Math.sin(time * i) * SWING * s
    }

    // Add in a quick override of the swing tween, since it ought to
    // stop at approximately 80% of the animation time
    if (elapsed > ANIMATION_TIME * 0.85 && !swingParam.stop) {
      swingParam.stop = true
      sceneManager.isInteractive = true
    }

    if (elapsed >= ANIMATION_TIME) {
      sceneManager.isAnimationActive = false
      sceneManager.isAnimationFinished = true
    }
  }

  camera.position.x = zoomParam.x
  camera.position.y = zoomParam.y
  camera.position.z = zoomParam.z

  renderer.render(scene, camera)
}

export function click(event) {
  if (!sceneManager.isInteractive) {
    return
  }

  const mouse = new THREE.Vector2()
  mouse.x = event.clientX / window.innerWidth * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.params.Points.threshold = sceneManager.isZoomedIn ? 2 : 6
  camera.updateMatrixWorld()
  raycaster.setFromCamera(mouse, camera)

  let intersects = raycaster.intersectObjects(pixelManager.pixelGroups)

  if (intersects.length > 0) {
    const { point } = intersects[0]
    const pixel = pixelManager.getPixelFromCoordinates(point.x, point.y)

    // We'll want to zoom out / return when clicking a black pixel
    if (pixel.colorIndex === 13) {
      return zoomOut()
    }

    // const point = object.geometry.vertices[index]
    zoomToPixel(pixel)
  } else {
    zoomOut()
  }
}

function zoomOut() {
  if (!sceneManager.isZoomedIn) {
    return
  }

  sceneManager.isInteractive = false
  sceneManager.deselectPixel()

  new TWEEN.Tween(zoomParam)
    .to({ x: 0, y: 0, z: ZOOM.max }, ZOOM_TIME)
    .easing(TWEEN.Easing.Quintic.InOut)
    .start()
    .onComplete(() => {
      sceneManager.isInteractive = true
      sceneManager.isZoomedIn = false
      pixelManager.updateBufferGeometry()
    })
}

function zoomToPixel(pixel) {
  if (!sceneManager.isInteractive) {
    return
  }

  const { x, y } = pixelManager.getCoordinatesFromPixel(pixel)

  sceneManager.isInteractive = false
  sceneManager.selectPixel(pixel)

  new TWEEN.Tween(zoomParam)
    .to({ x, y, z: ZOOM.point }, ZOOM_TIME)
    .easing(TWEEN.Easing.Quintic.InOut)
    .start()
    .onComplete(() => {
      sceneManager.isInteractive = true
      sceneManager.isZoomedIn = true
      pixelManager.updateBufferGeometry()
    })
}

export function activate() {
  sceneManager.isAnimationActive = true
  start = Date.now()

  new TWEEN.Tween(zoomParam)
    .to({ z: ZOOM.max }, ANIMATION_TIME * 0.95)
    .easing(TWEEN.Easing.Quintic.InOut)
    .start()

  new TWEEN.Tween(timeParam)
    .to({ t: timeParam.t * 1.5 }, ANIMATION_TIME)
    .easing(TWEEN.Easing.Quadratic.In)
    .start()

  new TWEEN.Tween(swingParam)
    .to({ s: 0 }, ANIMATION_TIME)
    .easing(TWEEN.Easing.Quintic.InOut)
    .start()
}
