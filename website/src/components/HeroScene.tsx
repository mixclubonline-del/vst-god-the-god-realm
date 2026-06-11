import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const GOLD = '#f8c85a';
const GOLD_HEX = 0xf8c85a;
const PARTICLE_COUNT = 3000;
const PARTICLE_RADIUS = 4;
const STAR_COUNT = 2000;

/* ─────────────────────────────────────────────
   Utility — check reduced-motion preference
   ───────────────────────────────────────────── */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/* ─────────────────────────────────────────────
   Utility — detect mobile
   ───────────────────────────────────────────── */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

/* ═════════════════════════════════════════════
   ParticleField — 3 000 golden particles
   ═════════════════════════════════════════════ */

const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    // Gentle sine float on Y
    pos.y += sin(uTime * 0.4 + aPhase) * 0.08;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = length(position) / ${PARTICLE_RADIUS.toFixed(1)};

    // Larger near center, smaller at edges
    gl_PointSize = aSize * (1.0 - dist * 0.5) * (300.0 / -mvPosition.z);

    // Alpha fades toward edges
    vAlpha = 0.35 + 0.65 * (1.0 - dist);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    // Soft circle falloff
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
    gl_FragColor = vec4(0.973, 0.784, 0.353, alpha);
  }
`;

function ParticleField({ paused }: { paused: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const ph = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Sphere distribution (cube-root for uniform volume)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = PARTICLE_RADIUS * Math.cbrt(Math.random());

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = 0.008 + Math.random() * 0.014; // 0.008–0.022
      ph[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, sizes: sz, phases: ph };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (paused) return;
    const pts = pointsRef.current;
    const mat = materialRef.current;
    if (!pts || !mat) return;

    mat.uniforms.uTime.value += delta;
    pts.rotation.y += 0.0003;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          args={[phases, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═════════════════════════════════════════════
   DivineCore — pulsating wireframe icosahedron
   ═════════════════════════════════════════════ */

function DivineCore({ paused }: { paused: boolean }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const outerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.8, 1), []);
  const innerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.6, 1), []);

  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();

    if (outerRef.current) {
      outerRef.current.rotation.x += 0.002;
      outerRef.current.rotation.y += 0.003;
      outerRef.current.rotation.z += 0.001;
    }
    if (innerRef.current) {
      innerRef.current.rotation.x -= 0.001;
      innerRef.current.rotation.y -= 0.002;
    }

    // Pulsating emissive
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.2);
    if (outerMatRef.current) {
      outerMatRef.current.emissiveIntensity = pulse;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.sin(t * 1.2) * 0.8;
    }
  });

  return (
    <group>
      {/* Wireframe outer shell */}
      <mesh ref={outerRef} geometry={outerGeo}>
        <meshStandardMaterial
          ref={outerMatRef}
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Solid translucent inner core */}
      <mesh ref={innerRef} geometry={innerGeo}>
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.3}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Central point light */}
      <pointLight
        ref={lightRef}
        color={GOLD_HEX}
        intensity={2}
        distance={8}
        decay={2}
      />
    </group>
  );
}

/* ═════════════════════════════════════════════
   OrbitalRing — tilted wireframe torus
   ═════════════════════════════════════════════ */

interface OrbitalRingProps {
  radius: number;
  tiltX: number;
  tiltZ: number;
  speed: number;
  opacity: number;
  paused: boolean;
}

function OrbitalRing({
  radius,
  tiltX,
  tiltZ,
  speed,
  opacity,
  paused,
}: OrbitalRingProps) {
  const ref = useRef<THREE.Mesh>(null);

  const geo = useMemo(
    () => new THREE.TorusGeometry(radius, 0.005, 16, 100),
    [radius],
  );

  useFrame(() => {
    if (paused || !ref.current) return;
    ref.current.rotation.y += speed;
    ref.current.rotation.z += speed * 0.3;
  });

  return (
    <mesh ref={ref} geometry={geo} rotation={[tiltX, 0, tiltZ]}>
      <meshBasicMaterial
        color={GOLD}
        wireframe
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ═════════════════════════════════════════════
   MouseFollowCamera — subtle parallax
   ═════════════════════════════════════════════ */

function MouseFollowCamera({
  paused,
  isMobile,
}: {
  paused: boolean;
  isMobile: boolean;
}) {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isMobile) return;

    const handler = (e: MouseEvent) => {
      // Normalize to -1…+1
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, [isMobile]);

  useFrame(() => {
    if (paused || isMobile) return;

    // Smooth lerp
    target.current.x += (mouse.current.x * 0.5 - target.current.x) * 0.05;
    target.current.y += (mouse.current.y * 0.5 - target.current.y) * 0.05;

    camera.position.x = target.current.x;
    camera.position.y = target.current.y;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ═════════════════════════════════════════════
   SceneContents — all 3D elements
   ═════════════════════════════════════════════ */

function SceneContents({
  paused,
  isMobile,
}: {
  paused: boolean;
  isMobile: boolean;
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight color={0xffeedd} intensity={0.3} />
      <directionalLight
        position={[4, 3, 2]}
        intensity={0.6}
        color={0xfff0dd}
      />

      {/* Background stars */}
      <Stars
        radius={50}
        depth={80}
        count={STAR_COUNT}
        factor={1.5}
        saturation={0.1}
        fade
        speed={paused ? 0 : 0.3}
      />

      {/* Particle cosmos */}
      <ParticleField paused={paused} />

      {/* Central divine geometry */}
      <DivineCore paused={paused} />

      {/* Orbital rings */}
      <OrbitalRing
        radius={1.5}
        tiltX={Math.PI * 0.35}
        tiltZ={Math.PI * 0.1}
        speed={0.001}
        opacity={0.2}
        paused={paused}
      />
      <OrbitalRing
        radius={2.2}
        tiltX={Math.PI * -0.2}
        tiltZ={Math.PI * 0.25}
        speed={0.0007}
        opacity={0.15}
        paused={paused}
      />
      <OrbitalRing
        radius={3.0}
        tiltX={Math.PI * 0.5}
        tiltZ={Math.PI * -0.15}
        speed={0.0005}
        opacity={0.1}
        paused={paused}
      />

      {/* Mouse-follow camera */}
      <MouseFollowCamera paused={paused} isMobile={isMobile} />
    </>
  );
}

/* ═════════════════════════════════════════════
   HeroScene — exported wrapper
   ═════════════════════════════════════════════ */

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  // Intersection Observer — pause when off-screen
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        setIsVisible(entry.isIntersecting);
      }
    },
    [],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.05,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection]);

  const paused = !isVisible || reducedMotion;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={[1, 2]}
        frameloop={paused ? 'demand' : 'always'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
      >
        <SceneContents paused={paused} isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
