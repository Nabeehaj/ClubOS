import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

// Login backdrop: interlocking copper gears around a glowing core, with steam rising through them.
// `boost` spins the machine up when sign-in succeeds ("the engine starts").

function gearShape({ teeth, outer, root, hole, spokes = 0 }) {
  const shape = new THREE.Shape()
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    const pts = [
      [root, a],
      [outer, a + step * 0.12],
      [outer, a + step * 0.45],
      [root, a + step * 0.57],
    ]
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r
      const y = Math.sin(ang) * r
      if (i === 0 && j === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
  }
  shape.closePath()

  const center = new THREE.Path()
  center.absarc(0, 0, hole, 0, Math.PI * 2, true)
  shape.holes.push(center)

  // Window cut-outs between the hub and the rim
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    const r = (root + hole) / 2
    const w = new THREE.Path()
    w.absarc(Math.cos(a) * r, Math.sin(a) * r, (root - hole) * 0.28, 0, Math.PI * 2, true)
    shape.holes.push(w)
  }
  return shape
}

function Gear({ teeth, outer, depth = 0.32, spokes = 5, position, speed, boost, phase = 0, color = '#c97a44' }) {
  const ref = useRef()
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gearShape({ teeth, outer, root: outer * 0.86, hole: outer * 0.22, spokes }), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 24,
    })
    g.center()
    return g
  }, [teeth, outer, depth, spokes])

  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.z += dt * speed * boost.current
  })

  return (
    <mesh ref={ref} geometry={geometry} position={position} rotation={[0, 0, phase]}>
      <meshStandardMaterial color={color} metalness={1} roughness={0.28} envMapIntensity={1.4} />
    </mesh>
  )
}

function Core({ boost }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.04 + (boost.current - 1) * 0.04
    ref.current?.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[0, 0, 0.35]}>
      <sphereGeometry args={[0.42, 48, 48]} />
      <meshStandardMaterial color="#b8a6ff" emissive="#8b6cff" emissiveIntensity={2.2} toneMapped={false} />
    </mesh>
  )
}

function OrbitRing({ radius, tilt, speed, color, boost }) {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed * boost.current
  })
  return (
    <group rotation={tilt}>
      <mesh ref={ref}>
        <torusGeometry args={[radius, 0.012, 8, 160]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

// Steam: points that rise, sway and fade, then recycle at the bottom.
function Steam({ count = 420, boost }) {
  const ref = useRef()
  const { positions, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const offsets = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
      speeds[i] = 0.15 + Math.random() * 0.45
      offsets[i] = Math.random() * Math.PI * 2
    }
    return { positions, speeds, offsets }
  }, [count])

  useFrame(({ clock }, dt) => {
    const p = ref.current?.geometry.attributes.position
    if (!p) return
    const t = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      let y = p.array[i * 3 + 1] + dt * speeds[i] * boost.current
      if (y > 4.5) y = -4.5
      p.array[i * 3 + 1] = y
      p.array[i * 3] += Math.sin(t * 0.6 + offsets[i]) * 0.0025
    }
    p.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#9be8f5"
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

// Leans the whole machine toward the cursor.
function Rig({ children }) {
  const ref = useRef()
  useFrame(({ pointer }, dt) => {
    if (!ref.current) return
    const k = 1 - Math.pow(0.001, dt)
    ref.current.rotation.y += (pointer.x * 0.35 - ref.current.rotation.y) * k
    ref.current.rotation.x += (-pointer.y * 0.25 - ref.current.rotation.x) * k
  })
  return <group ref={ref}>{children}</group>
}

function Machine({ boostTarget }) {
  const boost = useRef(1)
  useFrame((_, dt) => {
    boost.current += (boostTarget.current - boost.current) * Math.min(1, dt * 2.5)
  })

  // Big gear (24 teeth) drives two smaller ones; speeds follow tooth ratios so they look meshed.
  const base = 0.18
  return (
    <Rig>
      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.6}>
        <group position={[-2.4, 1.1, 0]} scale={0.92} rotation={[0.25, -0.35, 0]}>
          <Gear teeth={24} outer={2.1} spokes={6} position={[0, 0, 0]} speed={base} boost={boost} />
          <Gear
            teeth={14}
            outer={1.25}
            spokes={5}
            position={[3.1, 1.15, -0.05]}
            speed={(-base * 24) / 14}
            boost={boost}
            phase={0.11}
            color="#d9915d"
          />
          <Gear
            teeth={11}
            outer={0.98}
            spokes={4}
            position={[-1.55, -2.55, 0.05]}
            speed={(-base * 24) / 11}
            boost={boost}
            phase={0.2}
            color="#b86d3d"
          />
          <Core boost={boost} />
          <OrbitRing radius={3.2} tilt={[1.2, 0.2, 0]} speed={0.35} color="#8b6cff" boost={boost} />
          <OrbitRing radius={3.7} tilt={[1.0, -0.5, 0.4]} speed={-0.22} color="#22d3ee" boost={boost} />
        </group>
      </Float>
      <Steam boost={boost} />
    </Rig>
  )
}

export default function GearScene({ boostTarget, quality = 'high' }) {
  const high = quality === 'high'
  return (
    <Canvas
      dpr={high ? [1, 1.75] : 1}
      camera={{ position: [0, 0, 10], fov: 38 }}
      gl={{ antialias: !high, powerPreference: 'high-performance', alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.15} />
      <pointLight position={[-4, 3, 4]} intensity={60} color="#8b6cff" />
      <pointLight position={[5, -2, 3]} intensity={45} color="#22d3ee" />
      <pointLight position={[-2.4, 1.1, 3]} intensity={5} color="#b8a6ff" />
      {/* Procedural studio lighting for the metal: no HDR download needed at the venue */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} color="#f4b88a" position={[0, 5, -6]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#8b6cff" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2} color="#22d3ee" position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={1.5} color="white" position={[0, 0, 6]} scale={3} />
      </Environment>
      <Machine boostTarget={boostTarget} />
      {high && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
