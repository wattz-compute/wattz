'use client';

import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import {
  vertexShader as particleVertex,
  fragmentShader as particleFragment,
} from './shaders/electricParticle.glsl';
import {
  vertexShader as wireVertex,
  fragmentShader as wireFragment,
} from './shaders/wireGlow.glsl';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/cn';

const TRANSFORMERS = [
  { label: 'Llama 3.1 8B', color: '#5BC0EB', position: [-6, 0, 1] as [number, number, number], status: 'relay' },
  { label: 'Llama 3.3 70B', color: '#93D8F2', position: [-2.4, 0, -1.4] as [number, number, number], status: 'relay' },
  { label: 'GPT-OSS 20B', color: '#FFD93D', position: [1.4, 0, -0.8] as [number, number, number], status: 'relay' },
  { label: 'Whisper v3', color: '#F0EAD6', position: [4.6, 0, 1.2] as [number, number, number], status: 'awaiting node' },
  { label: 'SDXL', color: '#D4AF37', position: [7.6, 0, -0.4] as [number, number, number], status: 'awaiting node' },
] as const;

// Bezier path between two 3D points, with vertical arch.
function bezierPoints(a: THREE.Vector3, b: THREE.Vector3, count: number, arch: number) {
  const points: THREE.Vector3[] = [];
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += arch;
  const c1 = a.clone().lerp(mid, 0.55);
  const c2 = b.clone().lerp(mid, 0.55);
  c1.y += arch * 0.35;
  c2.y += arch * 0.35;
  const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
  for (let i = 0; i <= count; i++) {
    points.push(curve.getPoint(i / count));
  }
  return { points, curve };
}

// Disable raycast on decorative meshes -- hover is decided by screen-space
// zones on the Canvas element, not by 3D pointer events. Pointer hits inside
// the scene are ignored entirely so the transformer can scale without the
// hit region ever shifting under the cursor.
const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

function Transformer({
  label,
  color,
  position,
  isHovered,
  status,
}: {
  label: string;
  color: string;
  position: [number, number, number];
  isHovered: boolean;
  status: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerScaleRef = useRef<THREE.Group>(null);
  const insulatorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.substationShadow,
        metalness: 0.6,
        roughness: 0.6,
      }),
    [],
  );
  const shellMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.steel,
        metalness: 0.72,
        roughness: 0.45,
      }),
    [],
  );
  const coilMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        metalness: 0.15,
        roughness: 0.28,
      }),
    [color],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const y = Math.sin(t * 1.4 + position[0]) * 0.03;
    // Only the outer group bobs. Its scale stays fixed at 1 so the hit target
    // (a child of this group) never grows or moves during a hover.
    groupRef.current.position.y = position[1] + y;
    if (innerScaleRef.current) {
      const targetScale = isHovered ? 1.06 : 1;
      innerScaleRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.08,
      );
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Visible content — scales on hover. Every mesh opts out of raycasting;
          hover is decided at Canvas level from the mouse X position. */}
      <group ref={innerScaleRef}>
        {/* Concrete pad */}
        <mesh receiveShadow position={[0, -0.55, 0]} raycast={NO_RAYCAST}>
          <boxGeometry args={[3.4, 0.15, 2.4]} />
          <meshStandardMaterial color={palette.steel} metalness={0.4} roughness={0.85} />
        </mesh>
        {/* Main transformer tank */}
        <mesh castShadow position={[0, 0.5, 0]} material={shellMat} raycast={NO_RAYCAST}>
          <boxGeometry args={[2.4, 2, 1.6]} />
        </mesh>
        {/* Cooling fins */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={`fin-${i}`}
            position={[1.28, 0.5, -0.6 + i * 0.24]}
            material={shellMat}
            raycast={NO_RAYCAST}
          >
            <boxGeometry args={[0.14, 1.6, 0.06]} />
          </mesh>
        ))}
        {/* Insulators / bushings */}
        <group position={[0, 1.55, 0]}>
          {[-0.7, 0, 0.7].map((x) => (
            <group key={`ins-${x}`} position={[x, 0, 0]}>
              <mesh material={insulatorMat} position={[0, 0.4, 0]} raycast={NO_RAYCAST}>
                <cylinderGeometry args={[0.09, 0.11, 0.8, 12]} />
              </mesh>
              <mesh material={coilMat} position={[0, 0.86, 0]} raycast={NO_RAYCAST}>
                <sphereGeometry args={[0.15, 14, 14]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Colored accent ring under the transformer */}
        <mesh position={[0, -0.35, 0.86]} raycast={NO_RAYCAST}>
          <ringGeometry args={[0.32, 0.36, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
        <Html position={[0, -0.9, 0.86]} center distanceFactor={7}>
          <div className="pointer-events-none flex flex-col items-center gap-1">
            <div
              className="font-mono-tech text-[10px] uppercase tracking-[0.24em]"
              style={{ color: palette.clusterWhite }}
            >
              {label}
            </div>
            <div className="font-mono-tech text-[9px]" style={{ color: palette.fogGrey }}>
              {status}
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}

// Screen-space hover overlay: five glassmorphic strips clustered in the middle
// of the viewport. Each strip carries the transformer's name and drives the
// scene's hover state via plain DOM enter/leave events.
function HoverStrips({
  hovered,
  setHovered,
}: {
  hovered: string | null;
  setHovered: (label: string | null) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
      <div
        className="pointer-events-auto grid h-[38%] w-[64%] max-w-[820px] min-w-[420px] gap-2"
        style={{ gridTemplateColumns: `repeat(${TRANSFORMERS.length}, 1fr)` }}
        onMouseLeave={() => setHovered(null)}
      >
        {TRANSFORMERS.map((t) => {
          const active = hovered === t.label;
          return (
            <button
              key={t.label}
              type="button"
              onMouseEnter={() => setHovered(t.label)}
              onFocus={() => setHovered(t.label)}
              className="group relative flex flex-col items-center justify-end overflow-hidden rounded-lg border transition-colors duration-200"
              style={{
                borderColor: active ? 'rgba(240,234,214,0.24)' : 'rgba(240,234,214,0.08)',
                backgroundColor: active ? 'rgba(91,192,235,0.06)' : 'rgba(10,14,39,0.10)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <span
                className="mb-4 font-mono-tech uppercase tracking-[0.28em] transition-opacity duration-200"
                style={{
                  fontSize: '11px',
                  color: active ? 'rgba(240,234,214,0.92)' : 'rgba(240,234,214,0.55)',
                  textShadow: active ? '0 0 12px rgba(91,192,235,0.35)' : 'none',
                }}
              >
                {t.label}
              </span>
              <span
                aria-hidden
                className="absolute inset-x-4 bottom-2 h-px transition-opacity duration-200"
                style={{
                  backgroundColor: t.color,
                  opacity: active ? 0.7 : 0.2,
                  boxShadow: active ? `0 0 8px ${t.color}` : 'none',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ElectricFlow({
  from,
  to,
  arch = 4,
  particleCount = 320,
  color = palette.cyanGlow,
  warm = palette.wireGlow,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  arch?: number;
  particleCount?: number;
  color?: string;
  warm?: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const { curve } = useMemo(() => bezierPoints(from, to, 128, arch), [from, to, arch]);

  const { positions, flows, seeds } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const flows = new Float32Array(particleCount);
    const seeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const p = curve.getPoint(t);
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      flows[i] = t;
      seeds[i] = Math.random();
    }
    return { positions, flows, seeds };
  }, [curve, particleCount]);

  useFrame(({ clock }) => {
    if (!materialRef.current || !geometryRef.current) return;
    const t = clock.getElapsedTime();
    materialRef.current.uniforms.uTime.value = t;
    const positionAttr = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
    const flowAttr = geometryRef.current.getAttribute('aFlow') as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      let flow = flowAttr.getX(i) + 0.0035;
      if (flow > 1) flow -= 1;
      flowAttr.setX(i, flow);
      const p = curve.getPoint(flow);
      positionAttr.setXYZ(i, p.x, p.y, p.z);
    }
    positionAttr.needsUpdate = true;
    flowAttr.needsUpdate = true;
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 16 },
      uColor: { value: new THREE.Color(color) },
      uColorWarm: { value: new THREE.Color(warm) },
    }),
    [color, warm],
  );

  // Also emit a translucent tube for the wire body.
  const tubeGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 96, 0.03, 8, false),
    [curve],
  );

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: uniforms.uTime,
            uColor: { value: new THREE.Color(color).multiplyScalar(0.8) },
            uColorAccent: { value: new THREE.Color(warm) },
            uIntensity: { value: 1.2 },
          }}
          vertexShader={wireVertex}
          fragmentShader={wireFragment}
        />
      </mesh>
      <points>
        <bufferGeometry ref={geometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute attach="attributes-aFlow" args={[flows, 1]} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
        />
      </points>
    </group>
  );
}

function DistantCity() {
  // Silhouette of GPU cluster buildings in the distance, with soft top lights.
  const buildings = useMemo(() => {
    const list: {
      x: number;
      z: number;
      height: number;
      width: number;
      depth: number;
      light: string;
    }[] = [];
    const rand = mulberry32(19980521);
    const lightHues = [palette.cyanGlow, palette.wireGlow, palette.accentGold];
    for (let i = 0; i < 34; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      list.push({
        x: side * (12 + rand() * 22),
        z: -20 + rand() * 26,
        height: 2 + rand() * 6,
        width: 1.4 + rand() * 2,
        depth: 1.4 + rand() * 2,
        light: lightHues[Math.floor(rand() * lightHues.length)],
      });
    }
    return list;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={`b-${i}`} position={[b.x, b.height / 2 - 0.6, b.z]}>
          <mesh>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial
              color={palette.substationShadow}
              metalness={0.65}
              roughness={0.55}
            />
          </mesh>
          <mesh position={[0, b.height / 2 + 0.02, 0]}>
            <boxGeometry args={[b.width * 0.6, 0.05, b.depth * 0.6]} />
            <meshBasicMaterial color={b.light} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GroundGrid() {
  // Ground plane with subtle grid pattern under fog.
  const size = 60;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
      <planeGeometry args={[size, size, 40, 40]} />
      <meshStandardMaterial
        color={palette.substationShadow}
        metalness={0.3}
        roughness={0.9}
        wireframe={false}
      />
    </mesh>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const list: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    const range = 24;
    const step = 3;
    for (let i = -range; i <= range; i += step) {
      list.push({
        start: new THREE.Vector3(-range, -0.58, i),
        end: new THREE.Vector3(range, -0.58, i),
      });
      list.push({
        start: new THREE.Vector3(i, -0.58, -range),
        end: new THREE.Vector3(i, -0.58, range),
      });
    }
    return list;
  }, []);
  return (
    <group>
      {lines.map((l, i) => (
        <line key={`gl-${i}`}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(g) => g.setFromPoints([l.start, l.end])}
          />
          <lineBasicMaterial
            attach="material"
            color={palette.cyanGlow}
            transparent
            opacity={0.09}
          />
        </line>
      ))}
    </group>
  );
}

function CameraRig({ hovered }: { hovered: string | null }) {
  const { camera } = useThree();
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (hovered) {
      const target = TRANSFORMERS.find((t) => t.label === hovered);
      if (target) {
        tweenRef.current?.kill();
        tweenRef.current = gsap.to(camera.position, {
          x: target.position[0] * 1.05,
          y: 2.4,
          z: target.position[2] + 5.2,
          duration: 1.6,
          ease: 'power3.inOut',
          onUpdate: () => camera.lookAt(target.position[0], 0.8, target.position[2]),
        });
      }
    } else {
      // Hover released: stop the focus tween before the orbit lerp resumes so
      // the two never fight over camera.position.
      tweenRef.current?.kill();
      tweenRef.current = null;
    }
    return () => {
      tweenRef.current?.kill();
    };
  }, [hovered, camera]);

  useFrame((_, delta) => {
    if (hovered) return;
    timeRef.current += delta * 0.14;
    const radius = 14;
    const x = Math.sin(timeRef.current) * radius;
    const z = Math.cos(timeRef.current) * radius;
    camera.position.x += (x - camera.position.x) * 0.02;
    camera.position.z += (z - camera.position.z) * 0.02;
    camera.position.y += (5.5 + Math.sin(timeRef.current * 0.6) * 0.6 - camera.position.y) * 0.02;
    camera.lookAt(0, 0.6, 0);
  });

  return null;
}

function SubstationInterior({
  hoveredLabel,
  particleScale,
}: {
  hoveredLabel: string | null;
  particleScale: number;
}) {
  const busbarY = 4.2;
  const busbarStart = new THREE.Vector3(-8, busbarY, -3.4);
  const busbarEnd = new THREE.Vector3(8.5, busbarY, -3.4);
  const scale = (n: number) => Math.max(20, Math.round(n * particleScale));

  return (
    <group>
      {/* Steel frame overhead */}
      <mesh position={[0, busbarY, -3.4]}>
        <boxGeometry args={[18, 0.14, 0.28]} />
        <meshStandardMaterial color={palette.steel} metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Support columns */}
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={`col-${x}`} position={[x, busbarY / 2, -3.4]}>
          <boxGeometry args={[0.18, busbarY, 0.18]} />
          <meshStandardMaterial color={palette.steel} metalness={0.65} roughness={0.4} />
        </mesh>
      ))}

      {/* Main incoming busbar */}
      <ElectricFlow
        from={busbarStart}
        to={busbarEnd}
        arch={0.4}
        particleCount={scale(520)}
        color={palette.cyanGlow}
        warm={palette.wireGlow}
      />

      {/* Transformers + drop wires from busbar */}
      {TRANSFORMERS.map((t) => (
        <group key={t.label}>
          <Transformer
            label={t.label}
            color={t.color}
            position={t.position}
            status={t.status}
            isHovered={hoveredLabel === t.label}
          />
          <ElectricFlow
            from={new THREE.Vector3(t.position[0], busbarY, -3.4)}
            to={new THREE.Vector3(t.position[0], 2.1, t.position[2])}
            arch={0.6}
            particleCount={scale(120)}
            color={t.color}
            warm={palette.accentGold}
          />
        </group>
      ))}

      {/* Outgoing wires to distant city */}
      {TRANSFORMERS.map((t, i) => {
        const targetX = (i - (TRANSFORMERS.length - 1) / 2) * 6 + Math.sin(i) * 4;
        return (
          <ElectricFlow
            key={`out-${t.label}`}
            from={new THREE.Vector3(t.position[0], 1.6, t.position[2])}
            to={new THREE.Vector3(targetX, 4.5, 16)}
            arch={3.6 + i * 0.4}
            particleCount={scale(220)}
            color={t.color}
            warm={palette.cyanGlow}
          />
        );
      })}
    </group>
  );
}

function AmbientHum() {
  // Slow flicker light to sell the "hum" of a live substation.
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.intensity = 1.6 + Math.sin(t * 2.2) * 0.15 + Math.sin(t * 5.3) * 0.05;
  });
  return (
    <pointLight
      ref={ref}
      color={palette.cyanGlow}
      intensity={1.6}
      position={[0, 5, 0]}
      distance={22}
    />
  );
}

function Fog() {
  return <fog attach="fog" args={[palette.nightDeep, 12, 42]} />;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scale render cost to the device. Weak CPUs/GPUs get a lower dpr ceiling and
// thinner particle streams; a prefers-reduced-motion user gets a single static
// frame instead of the continuous orbit.
function detectTier(): { maxDpr: number; particleScale: number; reducedMotion: boolean } {
  if (typeof navigator === 'undefined') {
    return { maxDpr: 1.5, particleScale: 1, reducedMotion: false };
  }
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let maxDpr = 1.7;
  let particleScale = 1;
  if (cores <= 4 || mem <= 4) {
    maxDpr = 1.3;
    particleScale = 0.55;
  }
  if (cores <= 2 || mem <= 2) {
    maxDpr = 1;
    particleScale = 0.32;
  }
  return { maxDpr, particleScale, reducedMotion };
}

export default function SubstationScene() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tier] = useState(detectTier);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('wattz-hover-hint')) setShowHint(true);
    } catch {
      setShowHint(true);
    }
  }, []);

  useEffect(() => {
    if (hovered && showHint) {
      setShowHint(false);
      try {
        sessionStorage.setItem('wattz-hover-hint', '1');
      } catch {
        // Session storage unavailable; the hint just won't persist.
      }
    }
  }, [hovered, showHint]);

  return (
    <div className="pointer-events-auto relative h-[55vh] min-h-[380px] w-full overflow-hidden md:h-[92vh] md:min-h-[620px]">
      <Canvas
        dpr={[1, tier.maxDpr]}
        frameloop={tier.reducedMotion ? 'demand' : 'always'}
        shadows={false}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        style={{ background: 'radial-gradient(circle at 50% 35%, #101534 0%, #050818 65%)' }}
      >
        <PerspectiveCamera makeDefault fov={48} position={[0, 5.5, 14]} near={0.1} far={220} />
        <Fog />
        <ambientLight intensity={0.35} color={palette.clusterWhite} />
        <directionalLight intensity={0.5} position={[-6, 12, -2]} color={palette.cyanGlow} />
        <directionalLight intensity={0.28} position={[8, 6, 4]} color={palette.accentGold} />
        <AmbientHum />
        <Suspense fallback={null}>
          <Environment preset="warehouse" background={false} />
          <GroundGrid />
          <GridLines />
          <DistantCity />
          <SubstationInterior hoveredLabel={hovered} particleScale={tier.particleScale} />
        </Suspense>
        <CameraRig hovered={hovered} />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.85}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.4}
            kernelSize={KernelSize.LARGE}
            mipmapBlur
          />
          <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
          <Vignette eskil={false} offset={0.28} darkness={0.75} />
        </EffectComposer>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-night-deep/60 to-night-deep" />
      <div
        className={cn(
          'pointer-events-none absolute bottom-32 left-6 z-10 hidden font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/45 transition-opacity duration-700 lg:block',
          showHint ? 'opacity-100' : 'opacity-0',
        )}
      >
        hover a transformer to inspect the load
      </div>
      <HoverStrips hovered={hovered} setHovered={setHovered} />
    </div>
  );
}
