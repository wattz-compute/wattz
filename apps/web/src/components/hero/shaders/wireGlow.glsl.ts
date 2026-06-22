// Wire glow shader for bezier tube geometry. Emissive gradient with an
// animated current stripe.

export const vertexShader = /* glsl */ `
varying float vAlong;
varying vec3 vWorldPos;

void main() {
  vAlong = uv.x;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform vec3 uColorAccent;
uniform float uTime;
uniform float uIntensity;

varying float vAlong;
varying vec3 vWorldPos;

void main() {
  float pulse = fract(vAlong * 2.0 - uTime * 0.35);
  float stripe = smoothstep(0.02, 0.0, abs(pulse - 0.5));
  vec3 col = mix(uColor, uColorAccent, stripe);
  float baseAlpha = 0.35 + 0.65 * stripe;
  gl_FragColor = vec4(col * uIntensity, baseAlpha);
}
`;
