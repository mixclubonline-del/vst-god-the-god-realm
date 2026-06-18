import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uRMS;
varying vec2 vUv;
varying vec3 vPosition;
varying float vDisplacement;

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  vPosition = position;
  
  // Create flowing displacement based on time and audio RMS
  float noise = snoise(position * 2.0 + uTime * 0.5);
  
  // The star pulsates heavily with the music
  float displacement = noise * (0.2 + (uRMS * 0.8));
  vDisplacement = displacement;
  
  vec3 newPosition = position + normal * displacement;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uRMS;
varying vec2 vUv;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  // Color palette for the Molten Star Core (Gold / Fire / White hot)
  vec3 colorBase = vec3(0.1, 0.0, 0.0);       // Dark red edges
  vec3 colorMid = vec3(1.0, 0.3, 0.0);        // Orange/Red mid
  vec3 colorHigh = vec3(1.0, 0.8, 0.1);       // Golden yellow peak
  vec3 colorPeak = vec3(1.0, 1.0, 1.0);       // White hot 

  // Map displacement to color intensity
  float intensity = (vDisplacement + 0.2) * 2.0;
  
  // Eruptions flare white hot when the beat drops (uRMS)
  intensity += uRMS * 0.5;

  vec3 finalColor = mix(colorBase, colorMid, smoothstep(0.0, 0.4, intensity));
  finalColor = mix(finalColor, colorHigh, smoothstep(0.4, 0.7, intensity));
  finalColor = mix(finalColor, colorPeak, smoothstep(0.7, 1.0, intensity));

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface CoreMeshProps {
  rms: number;
}

const CoreMesh: React.FC<CoreMeshProps> = ({ rms }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // Smoothly interpolate RMS to avoid jerky vertex snapping
      materialRef.current.uniforms.uRMS.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uRMS.value,
        rms,
        0.1
      );
    }
    if (meshRef.current) {
      // Slow rotation for celestial feel
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.x += 0.002;
    }
  });

  const uniforms = {
    uTime: { value: 0 },
    uRMS: { value: 0 }
  };

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        wireframe={false}
      />
    </mesh>
  );
};

export const MoltenCore3D: React.FC<{ rms: number }> = ({ rms }) => {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <CoreMesh rms={rms} />
      </Canvas>
    </div>
  );
};
