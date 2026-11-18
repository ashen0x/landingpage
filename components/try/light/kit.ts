/* What every light on the site is made with: a program from two shaders, the glow, and a
   small matrix kit. The fibres are drawn as light added on light into a scene; the glow
   lays a tight bloom and a wide haze around them, then brings the three together on the
   canvas with a little lens fringe, tone-mapping and grain. */

const QUAD_VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_step;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb * 0.227027;
  c += (texture(u_tex, v_uv + u_step * 1.3846).rgb + texture(u_tex, v_uv - u_step * 1.3846).rgb) * 0.316216;
  c += (texture(u_tex, v_uv + u_step * 3.2308).rgb + texture(u_tex, v_uv - u_step * 3.2308).rgb) * 0.070270;
  o = vec4(c, 1.0);
}`;

const FINAL_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene, u_glow, u_haze;
uniform float u_time, u_aspect;
out vec4 o;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
void main() {
  // a lens: colours part a hair toward the edges of the frame
  vec2 out2 = (v_uv - 0.5) * dot(v_uv - 0.5, v_uv - 0.5) * 0.014;
  vec3 sharp = vec3(texture(u_scene, v_uv + out2).r, texture(u_scene, v_uv).g, texture(u_scene, v_uv - out2).b);
  vec3 c = sharp + texture(u_glow, v_uv).rgb * 0.55 + texture(u_haze, v_uv).rgb * 0.5;
  c = 1.0 - exp(-c * 1.35);
  float centre = smoothstep(1.2, 0.2, length((v_uv - 0.5) * vec2(u_aspect, 1.0)));
  c = c * mix(0.7, 1.0, centre) + vec3(0.010, 0.011, 0.016) * centre;
  c += (hash(gl_FragCoord.xy + fract(u_time) * 61.0) - 0.5) * 0.028;
  o = vec4(c, 1.0);
}`;

export type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
export type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

export function program(gl: WebGL2RenderingContext, vert: string, frag: string, names: string[]): Program {
  const p = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vert],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
    gl.attachShader(p, shader);
  }
  gl.linkProgram(p);
  const u: Program["u"] = {};
  for (const name of names) u[name] = gl.getUniformLocation(p, name);
  return { p, u };
}

/** True when there is no graphics chip and every pixel is drawn on the CPU. */
export function software(gl: WebGL2RenderingContext) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return /swiftshader|llvmpipe|software|basic render/i.test(
    String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  );
}

export class Glow {
  private float: boolean;
  private blur: Program;
  private final: Program;
  private quad: WebGLVertexArrayObject | null;
  /** The scene, then a tight glow (two passes) and a wide haze (two passes). */
  private targets: Target[] = [];

  constructor(private gl: WebGL2RenderingContext) {
    this.float = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    this.blur = program(gl, QUAD_VERT, BLUR_FRAG, ["u_tex", "u_step"]);
    this.final = program(gl, QUAD_VERT, FINAL_FRAG, ["u_scene", "u_glow", "u_haze", "u_time", "u_aspect"]);
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** Where the fibres are drawn, before the glow; none until the first resize. */
  get scene(): Target | undefined {
    return this.targets[0];
  }

  /** Size the canvas for a box of w by h CSS pixels, at this share of full sharpness. */
  resize(w: number, h: number, quality: number) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    // sharp on a laptop, but never more pixels than a 1440p screen
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3_700_000 / (w * h))) * quality;
    canvas.width = Math.max(2, Math.round(w * ratio));
    canvas.height = Math.max(2, Math.round(h * ratio));
    for (const target of this.targets) {
      gl.deleteFramebuffer(target.fbo);
      gl.deleteTexture(target.tex);
    }
    const [cw, ch] = [canvas.width, canvas.height];
    const half = [Math.ceil(cw / 2), Math.ceil(ch / 2)] as const;
    const sixth = [Math.ceil(cw / 6), Math.ceil(ch / 6)] as const;
    this.targets = [
      this.target(cw, ch),
      this.target(...half),
      this.target(...half),
      this.target(...sixth),
      this.target(...sixth),
    ];
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  /** The glow and the haze around the scene, then all three onto the canvas. */
  finish(time: number, aspect: number) {
    const gl = this.gl;
    const [scene, glowA, glowB, hazeA, hazeB] = this.targets;
    gl.bindVertexArray(this.quad);
    gl.useProgram(this.blur.p);
    gl.uniform1i(this.blur.u.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    const pass = (from: Target, to: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
      gl.viewport(0, 0, to.w, to.h);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform2f(this.blur.u.u_step, dx / to.w, dy / to.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    pass(scene, glowA, 1, 0);
    pass(glowA, glowB, 0, 1);
    pass(glowB, hazeA, 1.6, 0);
    pass(hazeA, hazeB, 0, 1.6);
    pass(hazeB, hazeA, 1.6, 0);
    pass(hazeA, hazeB, 0, 1.6);

    const final = this.final;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(final.p);
    [scene, glowB, hazeB].forEach((target, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
    });
    gl.uniform1i(final.u.u_scene, 0);
    gl.uniform1i(final.u.u_glow, 1);
    gl.uniform1i(final.u.u_haze, 2);
    gl.uniform1f(final.u.u_time, time);
    gl.uniform1f(final.u.u_aspect, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}

/* ── small matrix kit, column-major ─────────────────────────────────────── */
export type Mat = Float32Array;
const identity = (): Mat => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function multiply(a: Mat, b: Mat): Mat {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return m;
}
export function perspective(fov: number, aspect: number, near: number, far: number): Mat {
  const f = 1 / Math.tan(fov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
export function translate(x: number, y: number, z: number): Mat {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
export function rotate(axis: 0 | 1 | 2, angle: number): Mat {
  const m = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [a, b] = axis === 0 ? [1, 2] : axis === 1 ? [2, 0] : [0, 1];
  m[a * 4 + a] = c;
  m[b * 4 + b] = c;
  m[a * 4 + b] = s;
  m[b * 4 + a] = -s;
  return m;
}
export function scale(k: number): Mat {
  const m = identity();
  m[0] = m[5] = m[10] = k;
  return m;
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const ease = (t: number) => t * t * (3 - 2 * t);

/** Where the camera stands, and how wide it sees. */
export const CAMERA = 6;
export const FOV = 0.6;
