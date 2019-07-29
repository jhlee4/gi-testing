import React from 'react'
import * as THREE from 'three'
import OrbitControls from 'three-orbitcontrols'

export default class App extends React.Component {
  cameraRef
  scene
  camera
  renderer
  cube
  controls

  constructor(props){
    super(props)
    this.cameraRef = React.createRef()
  }

  componentWillMount() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0xEEEEEE)
    this.renderer.shadowMapEnabled = true
    this.renderer.shadowMapType = THREE.PCFSoftShadowMap

    document.body.appendChild(this.renderer.domElement)
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
    this.cube = new THREE.Mesh(geometry, material)
    this.cube.receiveShadow = true
    this.cube.castShadow = true
    this.scene.add(this.cube)
    const container = this.createContainer()
    container.map(n => this.scene.add(n))
    this.camera.position.z = 5
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    const light = new THREE.DirectionalLight( 0xffffbb, 0x080820, 0.1 )
    light.castShadow = true
    light.translateY(10)
    const helper = new THREE.CameraHelper(light.shadow.camera)
    this.scene.add(helper)
    this.scene.add(light)
    const ambLight = new THREE.AmbientLight( 0x404040 )
    this.scene.add(ambLight)
    this.animate()
  }

  createContainer = () => {
    const plane = new THREE.PlaneGeometry(4,4,4)
    plane.translate(0,0,-2)
    const mat = new THREE.MeshLambertMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    const plane_b = new THREE.Mesh(plane, mat)
    plane_b.rotateX(-Math.PI/2)
    const plane_f = new THREE.Mesh(plane, mat)
    const plane_r = new THREE.Mesh(plane, mat)
    plane_r.rotateY(-Math.PI/2)
    const plane_l = new THREE.Mesh(plane, mat)
    plane_l.rotateY(Math.PI/2)
    return [plane_b, plane_f, plane_r, plane_l]
  }

  componentDidUpdate() {
    this.animate()
  }

  animate = () => {
    requestAnimationFrame(this.animate)
    this.cube.rotation.x = 0.005
    this.cube.rotation.y = 0.01
    this.renderer.render(this.scene, this.camera)
  }

  render() {
    return (
      <div ref={this.cameraRef}></div>
    )
  }
}