/* The light: several hundred fibres drawn as soft ribbons, with bloom.

   Every fibre's path is computed on the GPU from a formation (a spindle, a
   woven sheet, a cable, a ring, a sphere, strings, a horizon, the mark), so the whole
   object can flow from one shape into the next as the page scrolls. Gold
   pulses travel along the fibres: sats on their way.

   Pipeline: fibres -> half-float scene -> two blurred copies -> one composite
   pass that adds the glow, a little lens fringe, tone-maps, and lays grain. */

import { ROUTSTR_MARK_PATH, ROUTSTR_MARK_VIEWBOX_MIN, ROUTSTR_MARK_VIEWBOX_SIZE } from "@/lib/brand";

export type Pose = {
  form: number;
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
  gain: number;
  pulse: number;
  /** How strongly the few "chosen" fibres light up gold. */
  chosen: number;
  /** How much near and far fibres go out of focus. */
  blur: number;
  /** 1 where the fibres are cut to the shape of the mark. */
  mark: number;
};

const SEGMENTS = 132;

const FIBRE_VERT = `#version 300 es
precision highp float;
layout(location=0) in float a_s;
layout(location=1) in float a_side;
layout(location=2) in vec4 a_seed;
layout(location=3) in float a_id;
uniform float u_time, u_from, u_to, u_mix, u_width, u_chosen, u_rush, u_blur, u_pluck;
uniform vec4 u_sparks;
uniform mat4 u_mvp;
uniform vec2 u_res;
uniform vec2 u_touch;
uniform vec3 u_ring[4];
out float v_side;
out float v_s;
out vec4 v_seed;
out float v_id;
out float v_depth;
out float v_ends;
out float v_soft;
out vec2 v_mark;
out vec4 v_hit;
out vec4 v_near;
out float v_closed;
const float PI = 3.14159265;
const float TAU = 6.2831853;

vec3 form(float k, float s, vec4 sd, float id, float t) {
  if (k < 0.5) {
    // spindle: everything leaves one point, spreads, and meets again
    float e = pow(sin(PI * clamp(s, 0.0, 1.0)), 1.2);
    float r = (0.05 + 0.95 * sqrt(sd.x)) * 0.96 * e;
    float a = sd.y * TAU + (s - 0.5) * (2.3 + 1.7 * sd.z) + t * 0.09;
    vec3 p = vec3((s - 0.5) * 3.7, r * cos(a), r * sin(a));
    p.yz += 0.018 * vec2(sin(s * 11.0 + sd.w * 30.0 + t * 0.7), cos(s * 9.0 + sd.z * 30.0 + t * 0.6));
    return p;
  }
  if (k < 1.5) {
    // sheet: lanes side by side, moving like cloth; the winning lane rides the middle
    float won = step(abs(id - 0.003), 0.003);
    float x = (s - 0.5) * 8.4;
    float z = (mix(id, 0.46 + id * 6.0, won) - 0.5) * 3.6;
    float y = 0.17 * sin(x * 1.05 + t * 0.42 + z * 1.25) + 0.07 * sin(x * 2.6 - t * 0.31 + z * 3.0);
    return vec3(x, y + 0.05 * won, z);
  }
  if (k < 2.5) {
    // cable: every fibre twisted into one line
    float x = (s - 0.5) * 9.0;
    float r = 0.02 + 0.2 * sd.x * sd.x;
    float a = sd.y * TAU + s * (5.0 + 5.0 * sd.z) + t * 0.4;
    float sag = 0.26 * sin(x * 0.62 + t * 0.2);
    return vec3(x, sag + r * cos(a), r * sin(a));
  }
  if (k < 3.5) {
    // ring: fibres wound round a torus
    float th = s * TAU + sd.y * TAU;
    float r = 0.04 + 0.30 * sqrt(sd.x);
    float ph = sd.z * TAU + th * (1.0 + floor(sd.w * 3.0)) + t * 0.16;
    float big = 1.16 + r * cos(ph);
    return vec3(big * cos(th), r * sin(ph), big * sin(th));
  }
  if (k < 4.5) {
    // sphere: each fibre a great circle
    float th = s * TAU + t * 0.06 * (sd.w - 0.5);
    float a1 = sd.y * TAU;
    float a2 = acos(2.0 * sd.z - 1.0);
    vec3 n = vec3(sin(a2) * cos(a1), cos(a2), sin(a2) * sin(a1));
    vec3 u = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 v = cross(n, u);
    return (1.08 + 0.03 * sd.x) * (cos(th) * u + sin(th) * v);
  }
  if (k < 5.5) {
    // horizon: lanes running to the edge of the world
    float x = (s - 0.5) * 12.0;
    float z = (id - 0.5) * 9.0;
    return vec3(x, 0.05 * sin(x * 0.8 + t * 0.3 + z), z);
  }
  if (k < 6.5) {
    // the mark: a field of lanes facing you, a little alive; its shape is cut in the fragment shader
    float x = (s - 0.5) * 3.0;
    float y = (id - 0.5) * 2.5;
    return vec3(x, y + 0.012 * sin(x * 5.0 + t * 0.9 + id * 40.0), 0.06 * sin(x * 2.2 + t * 0.6 + y * 3.0));
  }
  // strings: every fibre a string sounding its own note in its own plane. How far they swing
  // rises and falls along the line and travels, the way speech looks when it is drawn.
  float x = (s - 0.5) * 9.0;
  // (it all travels to the left, the way the posts above it do)
  float swell = pow(0.5 + 0.5 * sin(x * 2.0 + t * 0.4), 2.0) * (0.62 + 0.38 * sin(x * 0.53 + t * 0.17 + 1.7));
  float reach = (0.1 + 0.62 * sd.x) * (0.16 + 0.84 * swell) * (0.8 + 0.7 * u_pluck);
  float swing = sin(x * (3.0 + 3.6 * sd.z) + t * (0.9 + 1.1 * sd.z) + sd.w * TAU);
  float lean = sd.y * TAU;
  return vec3(x, reach * swing * cos(lean), reach * swing * sin(lean) * 0.7);
}

float loose(float k) {
  // sheet, cable, horizon, mark and strings run off their ends; spindle, ring and sphere do not
  return step(0.5, k) * step(k, 2.5) + step(4.5, k);
}

float closed(float k) {
  // the ring and the sphere come back round to where they began
  return step(2.5, k) * step(k, 4.5);
}

/* How gold this fibre is: the scene's own few, or the few that belong to a hovered tool. */
float chosen(float id) {
  float c = step(abs(id - 0.003), 0.003) * u_chosen;
  for (int k = 0; k < 4; k++) c = max(c, step(abs(id - (0.05 + 0.3 * float(k))), 0.003) * u_sparks[k]);
  return c;
}

vec3 at(float s, float m) {
  vec3 p;
  if (m <= 0.0) p = form(u_from, s, a_seed, a_id, u_time);
  else if (m >= 1.0) p = form(u_to, s, a_seed, a_id, u_time);
  else p = mix(form(u_from, s, a_seed, a_id, u_time), form(u_to, s, a_seed, a_id, u_time), m);
  // a fast scroll winds the whole thing up along its length
  float w = u_rush * 0.9 * (s - 0.5);
  float c = cos(w);
  float n = sin(w);
  return vec3(p.x, p.y * c - p.z * n, p.y * n + p.z * c);
}

/* How far this point of the fibre is from a click, on screen (squared). */
float miss(float s, float m, vec2 spot) {
  vec4 p = u_mvp * vec4(at(s, m), 1.0);
  vec2 d = p.xy / p.w - spot;
  d.x *= u_res.x / u_res.y;
  return dot(d, d);
}

void main() {
  // fibres set off one after another, so a change of shape reads as a flow
  float m = clamp(u_mix * 1.4 - a_seed.w * 0.4, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec4 here = u_mvp * vec4(at(a_s, m), 1.0);
  vec4 next = u_mvp * vec4(at(a_s + 1.0 / ${SEGMENTS}.0, m), 1.0);
  vec2 dir = (next.xy / next.w - here.xy / here.w) * u_res;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);

  // the fibres part softly around the pointer
  vec2 away = here.xy / here.w - u_touch;
  away.x *= u_res.x / u_res.y;
  here.xy += away * vec2(u_res.y / u_res.x, 1.0) * exp(-dot(away, away) * 6.5) * 0.13 * here.w;

  // out of the plane of focus a fibre gets wider and fainter
  float off = clamp(abs(here.w - 6.0) / 2.4, 0.0, 1.0);
  float spread = 1.0 + off * off * u_blur * 3.2;
  float isChosen = chosen(a_id);
  float width = u_width * (0.55 + 0.95 * a_seed.x + 1.6 * isChosen) * clamp(5.6 / here.w, 0.5, 2.4) * spread;
  here.xy += vec2(-dir.y, dir.x) * a_side * width / u_res * 2.0 * here.w;
  gl_Position = here;

  v_side = a_side;
  v_s = a_s;
  v_seed = a_seed;
  v_id = a_id;
  v_depth = here.w;
  v_soft = 1.0 / spread;
  v_ends = mix(1.0, smoothstep(0.0, 0.14, a_s) * smoothstep(1.0, 0.86, a_s), mix(loose(u_from), loose(u_to), m));
  // where this point of the fibre sits in the mark's square
  vec3 plane = form(6.0, a_s, a_seed, a_id, 0.0);
  v_mark = plane.xy / 2.3 + 0.5;

  // each click still running: find where along itself this fibre passes nearest to it
  // (a coarse walk, then a finer one)
  v_hit = vec4(0.0);
  v_near = vec4(0.0);
  v_closed = mix(closed(u_from), closed(u_to), m);
  for (int k = 0; k < 4; k++) {
    if (u_ring[k].z > 1.7) continue;
    vec2 spot = u_ring[k].xy;
    float best = 0.0;
    float least = 1e9;
    for (int i = 0; i < 10; i++) {
      float s = (float(i) + 0.5) / 10.0;
      float d = miss(s, m, spot);
      if (d < least) {
        least = d;
        best = s;
      }
    }
    float around = best;
    for (int i = -2; i <= 2; i++) {
      float s = clamp(around + float(i) / 40.0, 0.0, 1.0);
      float d = miss(s, m, spot);
      if (d < least) {
        least = d;
        best = s;
      }
    }
    v_hit[k] = best;
    v_near[k] = exp(-least / 0.008);
  }
}`;

const FIBRE_FRAG = `#version 300 es
precision highp float;
in float v_side;
in float v_s;
in vec4 v_seed;
in float v_id;
in float v_depth;
in float v_ends;
in float v_soft;
in vec2 v_mark;
in vec4 v_hit;
in vec4 v_near;
in float v_closed;
uniform float u_flow, u_gain, u_pulse, u_chosen, u_mark, u_calm;
uniform vec4 u_sparks;
uniform vec3 u_ring[4];
uniform sampler2D u_logo;
out vec4 o;
void main() {
  float edge = 1.0 - smoothstep(0.3 * v_soft, 1.0, abs(v_side));
  // one fibre in three carries a pulse of gold
  float carries = step(0.66, v_seed.y);
  float phase = fract(v_s * (1.0 + floor(v_seed.x * 2.0)) - u_flow * (0.03 + 0.05 * v_seed.z) + v_seed.w);
  float pulse = smoothstep(0.0, 0.012, phase) * smoothstep(0.075, 0.012, phase) * carries;
  vec3 cool = mix(vec3(0.56, 0.68, 1.0), vec3(0.88, 0.93, 1.0), v_seed.z);
  vec3 gold = vec3(1.0, 0.68, 0.26);
  vec3 col = cool * (0.035 + 0.3 * v_seed.x * v_seed.x);
  col += gold * pulse * u_pulse * 1.9;
  float isChosen = step(abs(v_id - 0.003), 0.003) * u_chosen;
  for (int k = 0; k < 4; k++) isChosen = max(isChosen, step(abs(v_id - (0.05 + 0.3 * float(k))), 0.003) * u_sparks[k]);
  col = mix(col, gold * 1.9, isChosen);

  // a click: the fibres under it light up there, and the gold runs away along each of them,
  // both ways. Up to four clicks run at once, each to its own end.
  float burst = 0.0;
  for (int k = 0; k < 4; k++) {
    float age = u_ring[k].z;
    float since = age - v_seed.w * 0.12;
    float apart = abs(v_s - v_hit[k]);
    apart = mix(apart, min(apart, 1.0 - apart), v_closed);
    float gone = 0.46 * (1.0 - exp(-2.3 * max(since, 0.0))) * (0.7 + 0.6 * v_seed.z);
    float head = (1.0 - smoothstep(gone, gone + 0.012, apart)) * exp(-(gone - apart) * 12.0);
    burst += head * v_near[k] * step(0.0, since) * exp(-since * 1.1) * (1.0 - smoothstep(0.9, 1.6, age));
  }
  // several at once each give a little less, so a flurry of clicks stays light, not a flood
  col += gold * min(burst * u_calm, 1.7) * 2.5;

  // the mark: bright inside its shape, nearly gone outside it
  float inside = texture(u_logo, v_mark).r * step(0.0, v_mark.x) * step(v_mark.x, 1.0) * step(0.0, v_mark.y) * step(v_mark.y, 1.0);
  float cut = mix(1.0, mix(0.004, 1.0, inside), u_mark);

  float fog = mix(1.0, 0.22, smoothstep(4.4, 8.2, v_depth));
  o = vec4(col * edge * fog * v_ends * v_soft * cut * u_gain, 1.0);
}`;

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

type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

/* ── small matrix kit, column-major ─────────────────────────────────────── */
type Mat = Float32Array;
const identity = (): Mat => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function multiply(a: Mat, b: Mat): Mat {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return m;
}
function perspective(fov: number, aspect: number, near: number, far: number): Mat {
  const f = 1 / Math.tan(fov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
function translate(x: number, y: number, z: number): Mat {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
function rotate(axis: 0 | 1 | 2, angle: number): Mat {
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
function scale(k: number): Mat {
  const m = identity();
  m[0] = m[5] = m[10] = k;
  return m;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => t * t * (3 - 2 * t);

const CAMERA = 6;
const FOV = 0.6;
/** How long the opening takes: one cable crosses the page, then opens. */
const OPENING = 2.6;
const BASE_COUNT = 560;

/** Half the width of the screen, in the light's own units, at the plane of focus. */
export const reach = (aspect: number) => Math.tan(FOV / 2) * CAMERA * aspect;

/** The mark as a soft-edged mask, white on black. */
function markMask(): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const k = size / ROUTSTR_MARK_VIEWBOX_SIZE;
  context.fillStyle = "#000";
  context.fillRect(0, 0, size, size);
  context.filter = "blur(1.2px)";
  context.setTransform(k, 0, 0, k, -ROUTSTR_MARK_VIEWBOX_MIN * k, -ROUTSTR_MARK_VIEWBOX_MIN * k);
  context.fillStyle = "#fff";
  context.fill(new Path2D(ROUTSTR_MARK_PATH));
  return canvas;
}

export class Fibres {
  private gl: WebGL2RenderingContext | null;
  private programs: Record<string, Program> = {};
  private fibreVao: WebGLVertexArrayObject | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private logo: WebGLTexture | null = null;
  private indexCount = 0;
  private count = BASE_COUNT;
  private targets: Target[] = [];
  private float = false;
  private frame = 0;
  private time = 0;
  private flow = 0;
  private stage = 0;
  private rush = 0;
  private pointer = [0, 0];
  private lean = [0, 0];
  /** The pointer on screen, -1..1, eased; far away until it first moves. */
  private touch = [-9, -9];
  private touchTarget = [-9, -9];
  /** Up to four clicks in flight: where each landed on screen, and how long ago. */
  private rings = new Float32Array([0, 0, 9, 0, 0, 9, 0, 0, 9, 0, 0, 9]);
  /** How lit each of the four hoverable sets of fibres is, and where each is heading. */
  private sparks = new Float32Array(4);
  private sparkTargets = new Float32Array(4);
  private quality = 1;
  private slow = 0;
  private age = 0;
  private plucked = 0;
  private pluckWant = 0;
  private w = 1;
  private h = 1;
  private lifted = 0;
  /** Drawn on the CPU: keep a still picture that follows the page, never an animation. */
  private frugal = false;
  /** Where the page is: 0 for the first pose, 1 for the second, and between. */
  target = 0;
  /** Carries the whole light up the screen: 1 is one full screen. */
  lift = 0;
  readonly dead: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private poses: (width: number, height: number) => { opening: Pose; list: Pose[] },
    private onStage?: (stage: number) => void,
    fibres?: number
  ) {
    this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    this.dead = !this.gl;
    if (!this.gl) return;
    const gl = this.gl;
    this.float = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    // without a graphics chip every frame would cost the page its scrolling
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    this.frugal = /swiftshader|llvmpipe|software|basic render/i.test(
      String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    );
    if (this.frugal) this.quality = 0.5;
    this.programs.fibre = this.program(FIBRE_VERT, FIBRE_FRAG, [
      "u_time", "u_flow", "u_from", "u_to", "u_mix", "u_width", "u_chosen", "u_sparks", "u_rush", "u_blur", "u_pluck",
      "u_mvp", "u_res", "u_touch", "u_gain", "u_pulse", "u_mark", "u_ring", "u_calm", "u_logo",
    ]);
    this.programs.blur = this.program(QUAD_VERT, BLUR_FRAG, ["u_tex", "u_step"]);
    this.programs.final = this.program(QUAD_VERT, FINAL_FRAG, ["u_scene", "u_glow", "u_haze", "u_time", "u_aspect"]);
    // more fibres where the machine can clearly afford them
    const strong = (navigator.hardwareConcurrency ?? 4) >= 8 && window.innerWidth >= 1100;
    this.count = fibres ?? (window.innerWidth < 760 ? 260 : strong ? 760 : BASE_COUNT);
    this.build(this.count);
    this.logo = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.logo);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, markMask());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.resize();
  }

  private program(vert: string, frag: string, names: string[]): Program {
    const gl = this.gl!;
    const p = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
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

  /** One ribbon per fibre: two vertices at each step along it. */
  private build(count: number) {
    const gl = this.gl!;
    const rows = SEGMENTS + 1;
    const data = new Float32Array(count * rows * 2 * 7);
    const index = new Uint32Array(count * SEGMENTS * 6);
    let d = 0;
    let n = 0;
    for (let f = 0; f < count; f++) {
      const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
      for (let r = 0; r < rows; r++) {
        for (const side of [-1, 1]) {
          data.set([r / SEGMENTS, side, ...seed, f / (count - 1)], d);
          d += 7;
        }
        if (r < SEGMENTS) {
          const a = (f * rows + r) * 2;
          index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], n);
          n += 6;
        }
      }
    }
    this.indexCount = index.length;
    this.fibreVao = gl.createVertexArray();
    gl.bindVertexArray(this.fibreVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 28;
    [[0, 1, 0], [1, 1, 4], [2, 4, 8], [3, 1, 24]].forEach(([at, size, offset]) => {
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl!;
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

  resize() {
    if (!this.gl) return;
    const gl = this.gl;
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    // sharp on a laptop, but never more pixels than a 1440p screen
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3_700_000 / (this.w * this.h))) * this.quality;
    const w = Math.max(2, Math.round(this.w * ratio));
    const h = Math.max(2, Math.round(this.h * ratio));
    this.canvas.width = w;
    this.canvas.height = h;
    for (const target of this.targets) {
      gl.deleteFramebuffer(target.fbo);
      gl.deleteTexture(target.tex);
    }
    const half = [Math.ceil(w / 2), Math.ceil(h / 2)];
    const sixth = [Math.ceil(w / 6), Math.ceil(h / 6)];
    // scene, then a tight glow (two passes) and a wide haze (two passes)
    this.targets = [
      this.makeTarget(w, h),
      this.makeTarget(half[0], half[1]),
      this.makeTarget(half[0], half[1]),
      this.makeTarget(sixth[0], sixth[1]),
      this.makeTarget(sixth[0], sixth[1]),
    ];
    this.draw(0);
  }

  /** The pointer, as a share of the screen from its middle (-0.5..0.5). */
  point(x: number, y: number) {
    this.pointer = [x, y];
    this.touchTarget = [x * 2, -y * 2];
    if (this.touch[0] < -8) this.touch = [x * 2, -y * 2];
  }

  /** A click: the fibres passing under this spot carry a burst of gold away along themselves. */
  tap(x: number, y: number) {
    // each click gets its own burst; with four still running, the next waits for the oldest to end
    let oldest = 0;
    for (let k = 1; k < 4; k++) if (this.rings[k * 3 + 2] > this.rings[oldest * 3 + 2]) oldest = k;
    if (this.rings[oldest * 3 + 2] < 1.6) return;
    this.rings.set([x * 2, -y * 2, 0], oldest * 3);
  }

  /** Light the fibres of one of four things gold (0 to 3), or let them all go with null.
   *  Each set fades on its own, so moving from one to the next is a cross-fade, never a jump. */
  choose(which: number | null) {
    for (let k = 0; k < 4; k++) this.sparkTargets[k] = k === which ? 1 : 0;
  }

  /** Pluck the strings: they swell for a moment, then settle. It comes in softly, never as a jump. */
  pluck() {
    this.pluckWant = 1;
  }

  start() {
    cancelAnimationFrame(this.frame);
    if (this.dead || document.hidden) return;
    const still = this.frugal || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let fresh = true;
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick);
      if (this.frugal) {
        // only when the page has moved, and not more than a few times a second
        const moved = Math.abs(this.target - this.stage) > 0.002 || Math.abs(this.lift - this.lifted) > 0.002;
        if (!fresh && (!moved || now - last < 140)) return;
      }
      const dt = Math.min(this.frugal ? 0.3 : 0.05, (now - last) / 1000);
      last = now;
      fresh = false;
      this.draw(dt, still);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }

  private blur(from: Target, to: Target, dx: number, dy: number) {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
    gl.viewport(0, 0, to.w, to.h);
    gl.bindTexture(gl.TEXTURE_2D, from.tex);
    gl.uniform2f(this.programs.blur.u.u_step, dx / to.w, dy / to.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private draw(dt: number, still = false) {
    const gl = this.gl;
    if (!gl || !this.targets.length) return;

    // a machine that cannot keep up gets fewer pixels, not a slower page
    // (a page is busy while it loads, whatever the machine: the first seconds do not count)
    this.age += dt;
    this.slow = dt > 0.03 && this.age > 4 ? this.slow + 1 : Math.max(0, this.slow - 1);
    if (!this.frugal && this.slow > 24 && this.quality > 0.5) {
      this.slow = 0;
      this.quality *= 0.78;
      this.resize();
      return;
    }

    // the shape follows the page with a little weight, never a snap
    const before = this.stage;
    this.stage += (this.target - this.stage) * (dt ? 1 - Math.exp(-dt * 5) : 1);
    const speed = dt ? clamp(((this.stage - before) / dt) * 0.55, -1, 1) : 0;
    this.rush += (speed - this.rush) * 0.08;
    if (!still) {
      this.time += dt;
      // the pulses run faster while the page is moving
      this.flow += dt * (1 + Math.abs(this.rush) * 7);
    }
    for (let k = 2; k < 12; k += 3) this.rings[k] = Math.min(9, this.rings[k] + dt);
    this.pluckWant *= Math.exp(-dt * 1.5);
    this.plucked += (this.pluckWant - this.plucked) * (dt ? 1 - Math.exp(-dt * 4.5) : 1);
    for (let k = 0; k < 4; k++) this.sparks[k] += (this.sparkTargets[k] - this.sparks[k]) * (dt ? 1 - Math.exp(-dt * 4.5) : 1);
    this.lean[0] += (this.pointer[0] - this.lean[0]) * 0.05;
    this.lean[1] += (this.pointer[1] - this.lean[1]) * 0.05;
    this.touch[0] += (this.touchTarget[0] - this.touch[0]) * 0.12;
    this.touch[1] += (this.touchTarget[1] - this.touch[1]) * 0.12;
    this.onStage?.(this.stage);

    this.lifted += (this.lift - this.lifted) * (dt ? 1 - Math.exp(-dt * 22) : 1);
    const { opening, list } = this.poses(this.w, this.h);
    let a: Pose;
    let b: Pose;
    let mix: number;
    let flash = 1;
    const intro = still ? 1 : Math.min(1, this.time / OPENING);
    if (intro < 1 && this.stage < 0.25) {
      // the opening: one cable crosses the page, then lets go into the first shape
      a = opening;
      b = list[0];
      mix = ease(clamp((intro - 0.22) / 0.78, 0, 1));
      flash = Math.min(1, intro * 6) * (1 + 0.9 * Math.exp(-Math.pow((intro - 0.4) / 0.16, 2)));
    } else {
      const from = Math.min(list.length - 1, Math.floor(this.stage));
      a = list[from];
      b = list[Math.min(list.length - 1, from + 1)];
      // hold each shape while its scene is on screen, change in between
      mix = ease(clamp((this.stage - from - 0.22) / 0.56, 0, 1));
    }
    const lerp = (key: keyof Pose) => a[key] + (b[key] - a[key]) * mix;

    const [scene, glowA, glowB, hazeA, hazeB] = this.targets;
    const aspect = this.w / this.h;
    const model = [
      translate(lerp("x"), lerp("y"), 0),
      rotate(1, lerp("yaw") + Math.sin(this.time * 0.11) * 0.1 + this.lean[0] * 0.22),
      rotate(0, lerp("pitch") + this.lean[1] * 0.14),
      rotate(2, lerp("roll")),
      scale(lerp("scale")),
    ].reduce(multiply);
    const view = multiply(perspective(FOV, aspect, 0.1, 60), translate(0, 0, -CAMERA));
    const mvp = multiply(translate(0, this.lifted * 2, 0), multiply(view, model));

    // 1. the fibres, added light on light
    const fibre = this.programs.fibre;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(fibre.p);
    gl.uniform1f(fibre.u.u_time, this.time);
    gl.uniform1f(fibre.u.u_flow, this.flow);
    gl.uniform1f(fibre.u.u_from, a.form);
    gl.uniform1f(fibre.u.u_to, b.form);
    gl.uniform1f(fibre.u.u_mix, mix);
    gl.uniform1f(fibre.u.u_width, 1.15 * (scene.w / this.w));
    // the scene's own few chosen fibres, and those of whichever tool is hovered
    gl.uniform1f(fibre.u.u_chosen, lerp("chosen"));
    gl.uniform4fv(fibre.u.u_sparks, this.sparks);
    gl.uniform1f(fibre.u.u_rush, this.rush);
    gl.uniform1f(fibre.u.u_blur, lerp("blur"));
    gl.uniform1f(fibre.u.u_pluck, this.plucked);
    gl.uniform1f(fibre.u.u_mark, lerp("mark"));
    // the same light whether there are few fibres or many
    gl.uniform1f(fibre.u.u_gain, lerp("gain") * flash * (BASE_COUNT / this.count) * (1 + Math.abs(this.rush) * 0.5));
    gl.uniform1f(fibre.u.u_pulse, lerp("pulse") * (1 + Math.abs(this.rush) * 1.5));
    gl.uniformMatrix4fv(fibre.u.u_mvp, false, mvp);
    gl.uniform2f(fibre.u.u_res, scene.w, scene.h);
    gl.uniform2f(fibre.u.u_touch, this.touch[0], this.touch[1]);
    gl.uniform3fv(fibre.u.u_ring, this.rings);
    let running = 0;
    for (let k = 2; k < 12; k += 3) if (this.rings[k] < 1.6) running++;
    gl.uniform1f(fibre.u.u_calm, 1 / Math.sqrt(Math.max(1, running)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.logo);
    gl.uniform1i(fibre.u.u_logo, 0);
    gl.bindVertexArray(this.fibreVao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND);

    // 2. glow and haze
    gl.bindVertexArray(this.quadVao);
    gl.useProgram(this.programs.blur.p);
    gl.uniform1i(this.programs.blur.u.u_tex, 0);
    this.blur(scene, glowA, 1, 0);
    this.blur(glowA, glowB, 0, 1);
    this.blur(glowB, hazeA, 1.6, 0);
    this.blur(hazeA, hazeB, 0, 1.6);
    this.blur(hazeB, hazeA, 1.6, 0);
    this.blur(hazeA, hazeB, 0, 1.6);

    // 3. everything together
    const final = this.programs.final;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(final.p);
    [scene, glowB, hazeB].forEach((target, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
    });
    gl.uniform1i(final.u.u_scene, 0);
    gl.uniform1i(final.u.u_glow, 1);
    gl.uniform1i(final.u.u_haze, 2);
    gl.uniform1f(final.u.u_time, this.time);
    gl.uniform1f(final.u.u_aspect, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}
