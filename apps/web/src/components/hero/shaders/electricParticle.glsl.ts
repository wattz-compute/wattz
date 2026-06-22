// Electric particle shader. Cyan-glow current flowing along a bezier path.
// Vertex shader: displaces a screen-space quad based on flow.
// Fragment shader: soft radial glow with additive falloff.

export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute float aFlow;
attribute float aSeed;

varying float vFlow;
varying float vSeed;

void main() {
  vFlow = aFlow;
  vSeed = aSeed;

  vec3 transformed = position;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_PointSize = uSize * (1.0 + 0.4 * sin(uTime * 3.0 + aSeed * 12.0));
  gl_PointSize *= (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform vec3 uColorWarm;
uniform float uTime;

varying float vFlow;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);
  float core = smoothstep(1.0, 0.0, d);
  float halo = smoothstep(0.55, 0.0, d);
  vec3 col = mix(uColor, uColorWarm, 0.35 + 0.25 * sin(vSeed * 6.28 + uTime * 2.0));
  float alpha = core * 0.85 + halo * 0.35;
  alpha *= 0.6 + 0.4 * sin(vSeed * 3.14 + uTime * 4.0);
  gl_FragColor = vec4(col, alpha * 0.9);
  if (alpha < 0.02) discard;
}
`;
