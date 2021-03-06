import React from 'react'
import * as THREE from 'three'
import OrbitControls from 'three-orbitcontrols'
import ShaderTexture from './ShaderTexture'

export default class App extends React.Component {
  cameraRef
  scene
  camera
  renderer
  cube
  cudeContainer
  controls
  bounces
  maxBounces
  startTime
  meshes
  meshColors
  ranges
  total
  ptr
  samples
  computeObjectGI
  helper
  ambLight
  dirLight

  constructor(props){
    super(props)
    this.cameraRef = React.createRef()
  }

  initialize = () => {
    this.ptr = 0
    this.ranges = []
    this.samples = 40
    this.meshes = []
    this.meshColors = []
    this.maxBounces = 4
    this.bounces = 0
    this.startTime = 0

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.z = 5
    this.scene.add(this.camera)
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0xEEEEEE)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.body.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    this.cube = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(geometry), this.createMaterial({ color: 0xffffff, side: THREE.FrontSide }))
    this.cube.receiveShadow = true
    this.cube.castShadow = true
    this.cube.rotation.x = 0.5
    this.cube.rotation.y = 0.1
    this.scene.add(this.cube)
    
    this.meshes.push(this.cube)

    this.cubeContainer = this.createContainer()
    this.cubeContainer.forEach(n => {
      this.meshes.push(n)
      this.scene.add(n)
    })
    
    this.ambLight = new THREE.AmbientLight(0x404040)
    this.scene.add(this.ambLight)
    this.dirLight = new THREE.DirectionalLight(0xffffbb, 0x080820, 0.1)
    this.dirLight.target = this.cube
    this.dirLight.position.set(3, 4, 5)
    this.dirLight.castShadow = true
    this.dirLight.translateY(10)
    this.scene.add(this.dirLight)
    
    this.helper = new THREE.CameraHelper(this.dirLight.shadow.camera)
    this.scene.add(this.helper)
    this.computeObjectGI = this.initializeGlobalIllumination()
    this.prepareData()

    this.startTime = performance.now()
    this.animate()
  }

  componentWillMount() {
    this.initialize()
  }

  initializeGlobalIllumination = () => {
    const renderRT = new THREE.WebGLRenderTarget(32, 32, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      stencilBuffer: false,
      depthBuffer: true
    })
    const scaleShader = new THREE.RawShaderMaterial({
      uniforms: {
        tInput: { type: 't', value: renderRT.texture }
      },
      vertexShader: document.getElementById('ortho-vs').textContent,
      fragmentShader: document.getElementById('scale-fs').textContent
    })
    const texture = new ShaderTexture(this.renderer, scaleShader, 1, 1)
    texture.fbo.texture.minFilter = THREE.LinearMipMapLinearFilter
    const position = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const wideCamera = new THREE.PerspectiveCamera(90, 1, .0001, 100)
    const buffer = new Uint8Array(4)

    const computeObjectGI = (mesh, offset, count) => {
      const positions = mesh.geometry.attributes.position.array
      const normals = mesh.geometry.attributes.normal.array
      const colors = mesh.geometry.attributes.color.array
      const end = Math.min((offset + count) * 3, positions.length)
      if (offset * 3 >= positions.length) return true // we're done
      mesh.visible = false
      for (let j = offset * 3; j < end; j += 3) {
        position.set(positions[j], positions[j + 1], positions[j + 2])
        normal.set(normals[j], normals[j + 1], normals[j + 2])
        wideCamera.position.copy(position)
        wideCamera.lookAt(position.add(normal))
        this.renderer.setRenderTarget(renderRT)
        this.renderer.render(this.scene, wideCamera)
        texture.render()
        this.renderer.readRenderTargetPixels(texture.fbo, 0, 0, 1, 1, buffer)
        colors[j] = buffer[0] / 255
        colors[j + 1] = buffer[1] / 255
        colors[j + 2] = buffer[2] / 255
      }
      mesh.visible = true
      return false // more to process
    }
    return computeObjectGI
  }

  computeGI = () => {
    this.startStep()
    this.processSamples()
    this.endStep()
  }

  processSamples = () => {
    this.ranges.forEach((r) => {
      if (this.ptr >= r.from && this.ptr < r.to) {
        this.computeObjectGI(r.mesh, this.ptr - r.from, this.samples);
        this.ptr += Math.min(r.to - this.ptr, this.samples);
      }
    })
    if (this.ptr >= this.total) {
      this.meshes.forEach((m, id) => {
        m.geometry.attributes.color.needsUpdate = true;
      });
      this.startTime = performance.now();
      this.bounces++;
      this.ptr = 0;
      console.log(this.bounces)
    }
  }

  startStep = () => {
    if (this.bounces === 0) {
      this.meshes.forEach((m, i) => {
        console.log(m)
        this.meshes[i].material.uniforms.uColor.value.set(0)
        this.meshes[i].material.uniforms.uCheck.value = 1
      })
    }
  }
  endStep = () => {
    console.log(this.meshColors)
    this.meshes.forEach((m, id) => {
      m.material.uniforms.uColor.value.copy(this.meshColors[id])
      m.material.uniforms.uCheck.value = 0
    })
  }

  createMaterial = (opts) => {
    opts = opts || {}
    return new THREE.RawShaderMaterial({
      uniforms: {
        uCheck: { type: 'f', value: 0 },
        uColor: { type: 'c', value: new THREE.Color(opts.color) }
      },
      vertexShader: document.getElementById('object-vs').textContent,
      fragmentShader: document.getElementById('object-fs').textContent,
      side: opts.side
    })
  }

  prepareData = () => {
    this.total = 0
    this.meshes.forEach((m) => {
      var l = m.geometry.attributes.position.count
      this.ranges.push({ from: this.total, to: this.total + l, length: l, mesh: m })
      this.total += l
    })
    this.meshColors = this.meshes.map((m) => {
      console.log(m)
      return m.material.uniforms.uColor.value.clone()
    })
    console.log(this.meshColors)
  }

  createContainer = () => {
    const wallColor = 0xbababa;
    const lightMaterial = this.createMaterial({ color: 0xffffff, side: THREE.FrontSide })
    const wallMaterial = this.createMaterial({ color: wallColor, side: THREE.FrontSide })
    const boxMaterial = this.createMaterial({ color: wallColor, side: THREE.FrontSide })
    const redMaterial = this.createMaterial({ color: 0x9c0e10, side: THREE.FrontSide })
    const greenMaterial = this.createMaterial( { color: 0x1e691e, side: THREE.FrontSide } )

    const plane = new THREE.PlaneGeometry(4, 4, 4)
    plane.translate(0, 0, -2)
    const plane_b = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(new THREE.PlaneGeometry(4, 4, 4)), redMaterial)
    plane_b.rotateX(-Math.PI/2)
    const plane_f = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(new THREE.PlaneGeometry(4, 4, 4)), lightMaterial)
    const plane_r = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(new THREE.PlaneGeometry(4, 4, 4)), wallMaterial)
    plane_r.rotateY(-Math.PI/2)
    const plane_l = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(new THREE.PlaneGeometry(4, 4, 4)), greenMaterial)
    plane_l.rotateY(Math.PI/2)
    return [plane_b, plane_f, plane_r, plane_l]
  }

  animate = () => {
    requestAnimationFrame(this.animate)
    this.controls.update()
    if(this.bounces < this.maxBounces) this.computeGI()
    this.renderer.render(this.scene, this.camera)
  }

  render() {
    return (
      <div ref={this.cameraRef}></div>
    )
  }
}