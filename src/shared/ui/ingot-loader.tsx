'use client'

/**
 * BEF Loader — Three independently-rotating orbital rings around a dark core.
 *
 * Same technical quality as Porto's sphere (MeshDistortMaterial, Environment,
 * toneMapped:false emissives, TubeGeometry precision), but a completely
 * different object — an abstract gyroscope / turbine form that reads as
 * industrial and engineered, not athletic.
 *
 * Structure:
 *   • Dark matte sphere core (MeshDistortMaterial, subtle wobble)
 *   • Ring A: brightest, thickest  — spins on X (vertical flip plane)
 *   • Ring B: medium intensity     — spins on Y (horizontal spin plane)
 *   • Ring C: softest, thinnest    — counter-rotates on Z (diagonal plane)
 *   • All three rings start at different static orientations so they
 *     never look aligned — creates depth and visual interest at every frame.
 *   • Dim orange point light at center bleeds warm glow onto the core.
 *   • 190 white star particles on a shell outside the rings.
 */

import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Environment, Lightformer } from '@react-three/drei'
import { useRef, useMemo, useEffect, useState, Suspense } from 'react'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
const RING_R   = 1.08   // outer radius of each ring
const ORANGE   = '#D4521A'

// ─────────────────────────────────────────────────────────────────────────────
function OrbitalCore() {
  // ── Rotating group refs ────────────────────────────────────────────────
  const ringARef = useRef<THREE.Group>(null)   // spins on X
  const ringBRef = useRef<THREE.Group>(null)   // spins on Y
  const ringCRef = useRef<THREE.Group>(null)   // counter-spins on Z
  const particlesRef = useRef<THREE.Group>(null) // slow orbit

  // ── Material refs (for live emissive pulsing) ──────────────────────────
  const matARef = useRef<THREE.MeshStandardMaterial>(null)
  const matBRef = useRef<THREE.MeshStandardMaterial>(null)
  const matCRef = useRef<THREE.MeshStandardMaterial>(null)

  const innerLightRef = useRef<THREE.PointLight>(null)

  // ── Soft-glow sprite texture (canvas radial gradient) ───────────────────
  // Each particle renders as a bright white core that fades to transparent —
  // this is how you get glow without post-processing.
  const particleTexture = useMemo(() => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)')
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)')
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.25)')
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])

  // ── Star particles ────────────────────────────────────────────────────
  const particles = useMemo(() => {
    const count = 190
    const arr   = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r     = RING_R * (1.55 + Math.random() * 1.30)
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  // ── Animation ─────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    // Each ring spins on its own axis at a distinct speed.
    // The static initial orientation (set in JSX) stays intact because
    // we're only writing to ONE axis component per group here.
    if (ringARef.current) ringARef.current.rotation.x = t * 0.68
    if (ringBRef.current) ringBRef.current.rotation.y = t * 0.42
    if (ringCRef.current) ringCRef.current.rotation.z = -t * 0.30

    // Particles: slow orbit on Y + slight X drift
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.055
      particlesRef.current.rotation.x = t * 0.028
    }

    // Breathing emissive — slight heat-glow pulse
    const pulse = 2.5 + Math.sin(t * 1.7) * 0.55
    if (matARef.current) matARef.current.emissiveIntensity = pulse
    if (matBRef.current) matBRef.current.emissiveIntensity = pulse * 0.72
    if (matCRef.current) matCRef.current.emissiveIntensity = pulse * 0.50

    // Inner light throb
    if (innerLightRef.current) {
      innerLightRef.current.intensity = 0.9 + Math.sin(t * 2.3) * 0.25
    }
  })

  return (
    <group position={[0, 0.25, 0]}>
      {/* ── Dark sphere core ─────────────────────────────────────────────
            MeshDistortMaterial: identical to Porto — subtle organic surface
            distortion that prevents it reading as a flat CG ball.          */}
      <mesh>
        <sphereGeometry args={[0.36, 56, 56]} />
        <MeshDistortMaterial
          color="#07090F"
          roughness={0.10}
          metalness={0.90}
          distort={0.05}
          speed={1.8}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Warm glow from inside the core — casts slight orange on rings */}
      <pointLight
        ref={innerLightRef}
        position={[0, 0, 0]}
        color={ORANGE}
        intensity={0.9}
        distance={2.8}
        decay={2}
      />

      {/* ── Ring A  (brightest, thickest) ────────────────────────────────
            Default torus lies in the XY plane.
            Static outer rotation: none — starts flat, then X-spin flips it
            Object group offset: y=+0.25 shifts everything above screen center */}
      <group ref={ringARef}>
        <mesh>
          {/* tube radius 0.022, 14 radial segs — visibly round 3-D tube  */}
          <torusGeometry args={[RING_R, 0.022, 14, 180]} />
          <meshStandardMaterial
            ref={matARef}
            color={ORANGE}
            emissive={new THREE.Color(ORANGE)}
            emissiveIntensity={2.5}
            roughness={0.04}
            metalness={0.05}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── Ring B  (medium intensity) ────────────────────────────────────
            Static initial tilt: 60° on Z → ring starts in a tilted plane.
            Y-spin then sweeps it through 3D space.                         */}
      <group rotation={[0, 0, Math.PI / 3]}>
        <group ref={ringBRef}>
          <mesh>
            <torusGeometry args={[RING_R, 0.017, 12, 180]} />
            <meshStandardMaterial
              ref={matBRef}
              color="#D04810"
              emissive={new THREE.Color('#C04010')}
              emissiveIntensity={1.8}
              roughness={0.04}
              metalness={0.05}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* ── Ring C  (softest, thinnest) ────────────────────────────────────
            Static initial tilt: 50° on X + 30° on Y → another distinct plane.
            Z counter-rotation creates opposing motion vs Ring A.            */}
      <group rotation={[Math.PI / 3.6, Math.PI / 6, 0]}>
        <group ref={ringCRef}>
          <mesh>
            <torusGeometry args={[RING_R, 0.013, 10, 180]} />
            <meshStandardMaterial
              ref={matCRef}
              color="#A83408"
              emissive={new THREE.Color('#903006')}
              emissiveIntensity={1.4}
              roughness={0.04}
              metalness={0.05}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* ── Star field — wrapped in group so it slowly orbits ────────── */}
      <group ref={particlesRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={particles}
              count={particles.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            map={particleTexture}
            color="#FFFFFF"
            size={0.052}
            sizeAttenuation
            transparent
            opacity={0.80}
            depthWrite={false}
            alphaTest={0.005}
          />
        </points>
      </group>
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function Scene() {
  return (
    <>
      {/* Near-zero ambient — emissive tubes + env IBL carry all the light  */}
      <ambientLight intensity={0.04} color="#04060D" />

      {/* Cool steel-blue fill — thin specular catch on dark sphere surface  */}
      <directionalLight position={[4, 6, 3]} intensity={0.45} color="#96B4F0" />

      {/* Programmatic environment — avoids external CDN fetches that can fail */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <Lightformer form="rect" intensity={2} color="#96B4F0" position={[5, 5, -10]} scale={[20, 5, 1]} />
          <Lightformer form="rect" intensity={1} color="#FFFFFF" position={[-5, 5, -10]} scale={[20, 5, 1]} />
          <Lightformer form="circle" intensity={1.5} color="#D4521A" position={[0, 5, 0]} scale={[10, 10, 1]} />
        </group>
      </Environment>

      <OrbitalCore />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export function IngotLoader() {
  const [dpr, setDpr] = useState(1)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(Math.min(window.devicePixelRatio, 1.5))
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080C14', overflow: 'hidden' }}>

      <Canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 6.8], fov: 38 }}
        dpr={dpr}
        gl={{
          antialias:           true,
          alpha:               false,
          toneMapping:         THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
      >
        <color attach="background" args={['#080C14']} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* BEF branding — raised so rings never overlap */}
      <div
        style={{
          position:      'absolute',
          bottom:        '13%',
          left:          0,
          right:         0,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '8px',
          userSelect:    'none',
          pointerEvents: 'none',
        }}
      >
        {/* BEF wordmark */}
        <span
          style={{
            fontFamily:    'var(--font-heading), "Space Grotesk", sans-serif',
            fontWeight:    700,
            fontSize:      '2.6rem',
            letterSpacing: '0.5em',
            color:         '#F0F0F0',
            lineHeight:    1,
          }}
        >
          BEF
        </span>

        {/* Status label */}
        <span
          style={{
            fontSize:      '8.5px',
            letterSpacing: '0.55em',
            color:         '#6C7A96',
            textTransform: 'uppercase',
            fontFamily:    '"Geist Mono", "Courier New", monospace',
          }}
        >
          Initializing
        </span>

        {/* ── Progress bar — 2 px with glowing sweep head ─────────────── */}
        <div
          style={{
            marginTop:    '14px',
            position:     'relative',
            width:        '180px',
            height:       '2px',
            borderRadius: '1px',
            background:   'rgba(255,255,255,0.06)',
            overflow:     'hidden',
          }}
        >
          {/* Sweep bar with gradient head */}
          <div
            className="bef-progress-bar"
          />
        </div>

      </div>

      <style>{`
        /* Progress sweep — gradient head gives a sense of motion */
        .bef-progress-bar {
          position:         absolute;
          inset:            0;
          width:            45%;
          border-radius:    1px;
          background:       linear-gradient(
            to right,
            rgba(232, 88, 26, 0),
            rgba(232, 88, 26, 0.6) 35%,
            #D4521A 80%,
            #FF9058 100%
          );
          box-shadow:       0 0 8px rgba(232, 88, 26, 0.7), 0 0 2px #D4521A;
          animation:        befSweep 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes befSweep {
          0%   { transform: translateX(-160%); }
          100% { transform: translateX(270%); }
        }
      `}</style>
    </div>
  )
}
