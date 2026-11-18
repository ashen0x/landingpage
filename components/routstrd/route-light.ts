/* routstrd's light: your agents on one side, routstrd's eye in the middle, and the nodes that
   sell a model on the other. Every fibre runs from an agent, through the eye, out to one node.
   Its path is worked out on the GPU from where those three are, so a node can move and a line
   can grow, snap and heal while the fibres simply follow.

   A node's distance from the eye is its price for the model shown, so the cheapest is nearest,
   and its line runs gold. Cut a line and it snaps: what was left on the node runs back to the
   eye, and the next one in line lights up. The look (colours, glow, grain) is the home page's. */

import {
  CAMERA,
  FOV,
  Glow,
  clamp,
  ease,
  multiply,
  perspective,
  program,
  rotate,
  software,
  translate,
  type Mat,
  type Program,
} from "@/components/try/light/kit";

/** A node selling the model, and what one request costs there. */
export type Seller = { key: string; name: string; sats: number };
/** A model and its sellers, in the order routstrd tries them. */
export type Route = { model: string; sellers: Seller[] };

export type LightEvent =
  /** The film at the start: 0 install, 1 set up, 2 top up, 3 the nodes. */
  | { kind: "beat"; beat: number }
  /** The node in use changed (null: none can take the request). */
  | { kind: "lead"; key: string | null }
  | { kind: "fail"; key: string }
  /** A failed node has rested and is back in line. */
  | { kind: "back"; key: string };

type Spot = { x: number; y: number };
/** Where things are on screen this frame, in CSS pixels from the canvas's corner. */
export type Frame = { portrait: boolean; eye: Spot; agents: Spot[]; nodes: Map<string, Spot>; film: number };

type Vec = [number, number, number];
type Place = { k: number; t: number };
type Slot = {
  key: string | null;
  from: Place;
  to: Place;
  moveAt: number;
  place: Place;
  pos: Vec;
  len: number;
  grow: number;
  growTo: number;
  growAt: number;
  cut: number;
  cutTo: number;
  cutAge: number;
  gold: number;
  refund: number;
  restUntil: number;
  hover: number;
};

const SEG = 128;
/** The share of each fibre between its agent and the eye; the rest runs out to its node. */
const SPLIT = 38 / SEG;
const SLOTS = 9;
const AGENTS = 5;
/** How long a failed node rests here, in seconds. routstrd rests it longer each time it fails. */
const REST = 7;
/** When each part of the film starts, in seconds: install, set up, top up, the nodes. */
const BEATS = [0.15, 1.45, 2.5, 3.4];

const FIBRE_VERT = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in float a_s;
layout(location=1) in float a_side;
layout(location=2) in vec4 a_seed;
layout(location=3) in vec4 a_lane;
uniform float u_time, u_width, u_blur, u_split, u_ring;
uniform mat4 u_mvp;
uniform vec2 u_res, u_touch;
uniform vec3 u_knot, u_dir, u_wallet, u_wdir, u_lead;
uniform vec3 u_agent[${AGENTS}];
uniform vec4 u_node[${SLOTS}];
uniform vec4 u_ns[${SLOTS}];
uniform vec4 u_nb[${SLOTS}];
out float v_side;
out float v_s;
out float v_depth;
out float v_soft;
out vec4 v_seed;
flat out int v_role;
flat out int v_node;
const float PI = 3.14159265;
const float TAU = 6.2831853;

vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float m = 1.0 - t;
  return m * m * m * a + 3.0 * m * m * t * b + 3.0 * m * t * t * c + t * t * t * d;
}
vec3 bezT(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float m = 1.0 - t;
  return 3.0 * m * m * (b - a) + 6.0 * m * t * (c - b) + 3.0 * t * t * (d - c);
}
// a bundle swells between its two ends, the way the home page's spindle does
float bulge(float u) { return pow(max(sin(PI * clamp(u, 0.0, 1.0)), 0.0), 1.2); }
// close to the eye every fibre passes through one small ring
float near(float u) { return pow(clamp(u, 0.0, 1.0), 6.0); }

vec3 at(float s) {
  int role = int(a_lane.z + 0.5);
  vec4 sd = a_seed;
  float t = u_time;
  vec3 K = u_knot;
  vec3 p0, p1, p2, p3;
  float u, r, turn;
  float sag = 0.0;
  float whip = 0.0;
  float body = 0.05 + 0.95 * sqrt(sd.x);
  if (role == 2) {
    // the install: one thin cable from off the edge into the eye
    u = s;
    float L = distance(u_lead, K);
    p0 = u_lead; p1 = u_lead + u_dir * L * 0.45; p2 = K - u_dir * L * 0.45; p3 = K;
    r = 0.016 * body + u_ring * near(u);
    turn = sd.y * TAU + (u - 1.0) * 9.0 + t * 0.44;
  } else if (role == 1) {
    // the wallet: sats coming in from the edge
    u = s;
    float L = distance(u_wallet, K);
    p0 = u_wallet; p1 = u_wallet + u_wdir * L * 0.5; p2 = K - u_dir * L * 0.35; p3 = K;
    r = 0.075 * bulge(u) * body + u_ring * near(u);
    turn = sd.y * TAU + (u - 1.0) * (2.0 + 1.5 * sd.z) + t * 0.09 + t * 0.35 * near(u);
  } else if (s < u_split) {
    // from one of your agents into the eye
    u = s / u_split;
    vec3 A = u_agent[int(a_lane.x + 0.5)];
    float L = distance(A, K);
    p0 = A; p1 = A + u_dir * L * 0.36; p2 = K - u_dir * L * 0.12; p3 = K;
    r = (0.03 + 0.035 * L) * bulge(u) * body + u_ring * near(u);
    turn = sd.y * TAU + (u - 1.0) * (2.3 + 1.7 * sd.z) + t * 0.09 + t * 0.35 * near(u);
  } else {
    // from the eye out to a node; a cut line pulls back from the break and hangs
    float w = (s - u_split) / (1.0 - u_split);
    int j = int(a_lane.y + 0.5);
    vec3 P = u_node[j].xyz;
    float L = max(distance(P, K), 1e-3);
    vec3 D = (P - K) / L;
    float cut = u_ns[j].y;
    float fray = 1.0;
    u = w;
    if (cut > 0.001) {
      float hang = w < 0.5 ? w * 2.0 : (1.0 - w) * 2.0;
      u = w < 0.5 ? w * (1.0 - 0.3 * cut) : 1.0 - (1.0 - w) * (1.0 - 0.3 * cut);
      sag = cut * hang * hang * (0.16 + 0.09 * L);
      whip = cut * hang * sin(t * 13.0 + sd.w * 6.0 + w * 10.0) * exp(-u_nb[j].x * 2.2) * 0.09;
      fray = 1.0 + cut * hang * 1.4;
    }
    p0 = K; p1 = K + u_dir * L * 0.12; p2 = P - normalize(D + u_dir) * L * 0.36; p3 = P;
    r = (0.06 + 0.03 * L) * bulge(u) * body * fray + u_ring * near(1.0 - u);
    turn = sd.y * TAU + u * (2.3 + 1.7 * sd.z) + t * 0.09 + t * 0.35 * near(1.0 - u);
  }
  vec3 c = bez(p0, p1, p2, p3, u);
  vec3 T = normalize(bezT(p0, p1, p2, p3, u) + vec3(1e-6, 0.0, 0.0));
  vec3 n1 = cross(T, vec3(0.0, 0.0, 1.0));
  float l = length(n1);
  n1 = l > 1e-5 ? n1 / l : vec3(0.0, 1.0, 0.0);
  vec3 n2 = cross(T, n1);
  c += r * (cos(turn) * n1 + sin(turn) * n2);
  c += 0.01 * (sin(s * 11.0 + sd.w * 30.0 + t * 0.7) * n1 + cos(s * 9.0 + sd.z * 30.0 + t * 0.6) * n2);
  c.y -= sag;
  c += whip * n1;
  return c;
}

void main() {
  vec4 here = u_mvp * vec4(at(a_s), 1.0);
  vec4 next = u_mvp * vec4(at(a_s + 1.0 / ${SEG}.0), 1.0);
  vec2 dir = (next.xy / next.w - here.xy / here.w) * u_res;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);

  // the fibres part softly around the pointer
  vec2 away = here.xy / here.w - u_touch;
  away.x *= u_res.x / u_res.y;
  here.xy += away * vec2(u_res.y / u_res.x, 1.0) * exp(-dot(away, away) * 6.5) * 0.1 * here.w;

  float off = clamp(abs(here.w - 6.0) / 2.4, 0.0, 1.0);
  float spread = 1.0 + off * off * u_blur * 3.2;
  int role = int(a_lane.z + 0.5);
  float few = 0.0;
  if (role == 0 && a_s >= u_split) {
    int j = int(a_lane.y + 0.5);
    float w = (a_s - u_split) / (1.0 - u_split);
    float g = u_ns[j].z;
    few = step(a_seed.x, 0.1) * step(0.002, g) * (1.0 - smoothstep(g * 1.06 - 0.06, g * 1.06, w));
  }
  float width = u_width * (0.55 + 0.95 * a_seed.x + 0.8 * few) * (role == 2 ? 1.6 : 1.0) * clamp(5.6 / here.w, 0.5, 2.4) * spread;
  here.xy += vec2(-dir.y, dir.x) * a_side * width / u_res * 2.0 * here.w;
  gl_Position = here;

  v_side = a_side;
  v_s = a_s;
  v_depth = here.w;
  v_soft = 1.0 / spread;
  v_seed = a_seed;
  v_role = role;
  v_node = int(a_lane.y + 0.5);
}`;

const FIBRE_FRAG = `#version 300 es
precision highp float;
precision highp int;
in float v_side;
in float v_s;
in float v_depth;
in float v_soft;
in vec4 v_seed;
flat in int v_role;
flat in int v_node;
uniform float u_flow, u_gain, u_split, u_req, u_install, u_leadGain, u_agents, u_wgrow, u_wgold;
uniform vec4 u_ns[${SLOTS}];
uniform vec4 u_nb[${SLOTS}];
out vec4 o;

float blip(float phase) { return smoothstep(0.0, 0.012, phase) * smoothstep(0.075, 0.012, phase); }

void main() {
  float edge = 1.0 - smoothstep(0.3 * v_soft, 1.0, abs(v_side));
  vec4 sd = v_seed;
  vec3 cool = mix(vec3(0.56, 0.68, 1.0), vec3(0.88, 0.93, 1.0), sd.z);
  vec3 gold = vec3(1.0, 0.68, 0.26);
  vec3 col = cool * (0.035 + 0.3 * sd.x * sd.x);
  float show = 1.0;
  float bright = 1.0;

  if (v_role == 2) {
    // the install cable, drawn in with a bright head
    float u = v_s;
    show = 1.0 - smoothstep(u_install - 0.03, u_install + 0.001, u);
    col = cool * 0.4 + gold * exp(-max(u_install - u, 0.0) * 26.0) * step(u_install, 0.995) * 1.3;
    bright = 2.6 * u_leadGain;
  } else if (v_role == 1) {
    // the wallet: gold runs in while it is topped up
    float u = v_s;
    show = 1.0 - smoothstep(u_wgrow - 0.03, u_wgrow + 0.001, u);
    float pulse = blip(fract(u * 2.5 - u_flow * (0.1 + 0.06 * sd.z) + sd.w)) * step(0.3, sd.y);
    col += gold * pulse * (0.3 + 1.8 * u_wgold);
    col = mix(col, gold * (0.08 + 0.7 * sd.x), 0.85 * u_wgold);
    col = mix(col, gold * 1.6, step(sd.x, 0.2) * u_wgold);
    col += gold * exp(-abs(u - u_wgrow) * 30.0) * step(u_wgrow, 0.98) * 1.4;
    bright = 0.8;
  } else if (v_s < u_split) {
    // your agents: their requests run in toward the eye
    float u = v_s / u_split;
    float from = 1.0 - u_agents;
    show = smoothstep(from - 0.002, from + 0.03, u);
    float pulse = blip(fract(u * (1.0 + floor(sd.x * 2.0)) - u_flow * (0.06 + 0.05 * sd.z) + sd.w)) * step(0.55, sd.y);
    col += gold * pulse * u_req * 1.9;
    col += cool * exp(-abs(u - from) * 40.0) * step(0.02, from) * 1.6;
    bright = 0.5;
  } else {
    // a node's line
    float u = (v_s - u_split) / (1.0 - u_split);
    vec4 st = u_ns[v_node];
    vec4 nb = u_nb[v_node];
    show = (1.0 - smoothstep(st.x - 0.025, st.x + 0.001, u)) * step(0.0005, st.x);
    // the tip glows while the line reaches out
    col += cool * exp(-abs(u - st.x) * 45.0) * (1.0 - smoothstep(0.96, 1.0, st.x)) * 2.2;
    // gold fills the line from the eye outward while it is the one in use, and drains back when not
    float front = st.z * 1.06;
    float lit = (1.0 - smoothstep(front - 0.06, front, u)) * step(0.002, st.z);
    col = mix(col, gold * (0.03 + 0.4 * sd.x * sd.x), 0.8 * lit);
    col = mix(col, gold * 1.7, step(sd.x, 0.1) * lit);
    float pulse = blip(fract(u * (1.5 + floor(sd.x * 2.0)) - u_flow * (0.07 + 0.06 * sd.z) + sd.w)) * step(0.35, sd.y);
    col += gold * pulse * lit * 1.9;
    col += gold * exp(-abs(u - front) * 30.0) * (1.0 - smoothstep(0.85, 1.0, st.z)) * step(0.002, st.z) * 1.4;
    // after a cut, what was left on the node runs back home
    float back = blip(fract(u * 3.0 + u_flow * 0.16 + sd.w)) * step(0.4, sd.y) * (1.0 - smoothstep(0.42, 0.5, u));
    col += gold * back * st.w * 1.8;
    // the snap: a flash runs away from the break, both ways
    float age = nb.x;
    float apart = abs(u - 0.5);
    float gone = 0.5 * (1.0 - exp(-2.6 * age));
    float burst = (1.0 - smoothstep(gone, gone + 0.015, apart)) * exp(-(gone - apart) * 10.0) * exp(-age * 1.3);
    col += gold * burst * st.y * 2.4;
    // the gap where it broke
    show *= mix(1.0, smoothstep(0.035, 0.07, apart), smoothstep(0.0, 0.25, st.y));
    bright = mix(0.85 + 0.35 * lit, 0.5, st.y) * (1.0 + 0.9 * nb.y);
  }

  // where every fibre meets, the light would only burn white: thin it so the eye reads as a ring
  float eye = v_role == 0 ? (v_s < u_split ? 1.0 - v_s / u_split : (v_s - u_split) / (1.0 - u_split)) : 1.0 - v_s;
  bright *= 1.0 - 0.6 * exp(-eye * 16.0);
  float fog = mix(1.0, 0.3, smoothstep(4.6, 8.6, v_depth));
  o = vec4(col * edge * fog * v_soft * show * bright * u_gain, 1.0);
}`;

const UNIFORMS = (
  "u_time u_width u_blur u_split u_ring u_mvp u_res u_touch u_knot u_dir u_wallet u_wdir u_lead u_agent u_node u_ns u_nb " +
  "u_flow u_gain u_req u_install u_leadGain u_agents u_wgrow u_wgold"
).split(" ");

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const toward = (v: number, to: number, step: number) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));
/** The first in line sits in the middle, then one each side: 0, +1, -1, +2, -2 ... */
const slotOf = (rank: number) => (rank === 0 ? 0 : rank % 2 ? (rank + 1) / 2 : -rank / 2);

function bezier(a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec {
  const m = 1 - t;
  return [0, 1, 2].map((i) => m * m * m * a[i] + 3 * m * m * t * b[i] + 3 * m * t * t * c[i] + t * t * t * d[i]) as Vec;
}

/** Seeded, so the light looks the same on every visit. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Where everything sits, for this size of canvas. Wide: agents on the left, the eye, the nodes
   to the right. Tall (a phone): agents at the top, the eye, the nodes below. A node's slot is
   its place in the try order, its distance from the eye its price (cheapest nearest). */
function layout(w: number, h: number) {
  const aspect = w / h;
  const H = Math.tan(FOV / 2) * CAMERA;
  const W = H * aspect;
  const depth = [0.45, -0.3, 0.1, -0.5, 0.3];
  if (aspect >= 1.05) {
    // keep room at the sides for the names beside the ends of the lines
    const room = (px: number) => Math.max(0.4, 1 - (2 * px) / w);
    const knot: Vec = [-W * 0.36, 0.02, 0];
    const step = Math.min(0.34, (H * 0.7) / 4);
    const rise = Math.min(0.42, (H * 0.84) / 2);
    const near = knot[0] + W * 0.3;
    const far = W * room(270);
    return {
      portrait: false,
      knot,
      dir: [1, 0, 0] as Vec,
      agents: [2, 1, 0, -1, -2].map((k, i): Vec => [-W * room(150), k * rise, depth[i]]),
      lead: [-W * 1.4, 0.36, 0] as Vec,
      wallet: [knot[0] - W * 0.1, -H * 1.35, 0.1] as Vec,
      wdir: [0, 1, 0] as Vec,
      place: ({ k, t }: Place): Vec => [lerp(near, far, t), knot[1] + k * step, 0.5 * Math.sin(k * 1.9 + 0.6)],
      turn: [-0.16, 0.08],
    };
  }
  const knot: Vec = [0, H * 0.4, 0];
  const step = (W * 0.8) / 4;
  const near = knot[1] - H * 0.36;
  return {
    portrait: true,
    knot,
    dir: [0, -1, 0] as Vec,
    // every other agent sits a little lower, so their names never touch
    agents: [-2, -1, 0, 1, 2].map((k, i): Vec => [k * W * 0.34, H * (0.8 - 0.07 * (i % 2)), depth[i]]),
    lead: [0.3, H * 1.45, 0] as Vec,
    wallet: [-W * 1.4, knot[1] - 0.2, 0.1] as Vec,
    wdir: [1, 0, 0] as Vec,
    place: ({ k, t }: Place): Vec => [k * step, lerp(near, -H * 0.7, t), 0.5 * Math.sin(k * 1.9 + 0.6)],
    turn: [0.1, 0.2],
  };
}

export class RouteLight {
  private gl: WebGL2RenderingContext | null;
  private fibre: Program | null = null;
  private glow: Glow | null = null;
  private fibreVao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private routes = 0;
  private quality = 1;
  /** Drawn on the CPU: a few frames a second, at fewer pixels. */
  private frugal = false;
  private slow = 0;
  private age = 0;
  private frame = 0;
  private w = 1;
  private h = 1;
  private lay = layout(1, 1);
  private mvp: Mat = new Float32Array(16);

  private clock = 0;
  private time = 0;
  private flow = 0;
  private filmAt = 0;
  private beat = -1;
  private still: boolean;
  private all: Route[] = [];
  private model = "";
  private slots: Slot[] = [];
  private lead: Slot | null = null;
  private req = 0;
  private hot: string | null = null;
  private pointer = [0, 0];
  private lean = [0, 0];
  private touch = [-9, -9];
  private touchTo = [-9, -9];
  readonly dead: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: { onEvent: (event: LightEvent) => void; onFrame: (frame: Frame) => void }
  ) {
    this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // with no motion wanted, the film is over before it starts
    if (this.still) this.filmAt = -99;
    this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    this.dead = !this.gl;
    for (let i = 0; i < SLOTS; i++) {
      const place = { k: 0, t: 0 };
      this.slots.push({
        key: null,
        from: place,
        to: place,
        moveAt: -99,
        place,
        pos: [0, 0, 0],
        len: 1,
        grow: 0,
        growTo: 0,
        growAt: 0,
        cut: 0,
        cutTo: 0,
        cutAge: 9,
        gold: 0,
        refund: 0,
        restUntil: 0,
        hover: 0,
      });
    }
    if (!this.gl) return;
    const gl = this.gl;
    // drawn on the CPU, every pixel costs: draw fewer of them
    this.frugal = software(gl);
    if (this.frugal) this.quality = 0.5;
    this.fibre = program(gl, FIBRE_VERT, FIBRE_FRAG, UNIFORMS);
    this.glow = new Glow(gl);
    this.routes = window.innerWidth < 760 ? 360 : 640;
    this.build(this.routes, window.innerWidth < 760 ? 30 : 48, 10);
    this.resize();
  }

  /** One ribbon per fibre: an agent's fibres to every node, the wallet's, and the install cable. */
  private build(routes: number, wallet: number, cable: number) {
    const gl = this.gl!;
    const random = seeded(2100);
    const total = routes + wallet + cable;
    const rows = SEG + 1;
    const data = new Float32Array(total * rows * 2 * 10);
    const index = new Uint32Array(total * SEG * 6);
    let d = 0;
    let n = 0;
    for (let f = 0; f < total; f++) {
      const role = f < routes ? 0 : f < routes + wallet ? 1 : 2;
      const seed = [random(), random(), random(), random()];
      const lane = [Math.floor(f / SLOTS) % AGENTS, f % SLOTS, role, 0];
      for (let r = 0; r < rows; r++) {
        for (const side of [-1, 1]) {
          data.set([r / SEG, side, ...seed, ...lane], d);
          d += 10;
        }
        if (r < SEG) {
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
    [
      [0, 1, 0],
      [1, 1, 4],
      [2, 4, 8],
      [3, 4, 24],
    ].forEach(([at, size, offset]) => {
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, 40, offset);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  resize() {
    if (!this.glow) return;
    this.w = Math.max(1, this.canvas.clientWidth);
    this.h = Math.max(1, this.canvas.clientHeight);
    this.lay = layout(this.w, this.h);
    this.glow.resize(this.w, this.h, this.quality);
    this.draw();
  }

  /* ── what it shows ───────────────────────────────────────────────────── */

  /** The models and their sellers. Lines already out move to their new places. */
  setRoutes(routes: Route[], model: string) {
    this.all = routes;
    this.show(model, false);
  }

  /** Show one model's sellers. */
  show(model: string, switching = true) {
    const route = this.all.find((r) => r.model === model);
    if (!route) return;
    this.model = model;
    const sellers = route.sellers.slice(0, SLOTS);
    const prices = sellers.map((seller) => seller.sats);
    const lo = Math.log(Math.max(1e-6, Math.min(...prices)));
    const hi = Math.log(Math.max(1e-6, Math.max(...prices)));
    const keys = new Set(sellers.map((seller) => seller.key));
    // a node that does not sell this model draws its line back in, and its slot is free again
    for (const slot of this.slots) {
      slot.restUntil = 0;
      slot.cutTo = 0;
      if (slot.key && !keys.has(slot.key)) slot.growTo = 0;
    }
    const free = () =>
      this.slots.find((slot) => !slot.key || (!keys.has(slot.key) && slot.grow < 0.02)) ??
      this.slots.find((slot) => !slot.key || !keys.has(slot.key))!;
    const routing = this.beat >= 3;
    sellers.forEach((seller, rank) => {
      const to = { k: slotOf(rank), t: hi > lo ? (Math.log(Math.max(1e-6, seller.sats)) - lo) / (hi - lo) : 0 };
      let slot = this.slots.find((s) => s.key === seller.key);
      if (slot && slot.grow > 0.05) {
        slot.from = { ...slot.place };
        slot.to = to;
        slot.moveAt = this.clock + 0.05 * rank;
      } else {
        slot ??= free();
        slot.key = seller.key;
        slot.from = slot.to = slot.place = to;
        slot.grow = 0;
        // when lines are leaving, the new ones wait until they are gone
        slot.growAt = this.clock + (switching ? 0.35 : 0);
      }
      slot.growTo = routing ? 1 : 0;
    });
  }

  /** Make a node fail: its line snaps, and the next in line takes over. */
  fail(key: string) {
    const slot = this.slots.find((s) => s.key === key);
    if (this.beat < 3 || !slot || !this.ready(slot) || slot.grow < 0.9) return;
    slot.cutTo = 1;
    slot.cutAge = 0;
    slot.refund = 1;
    slot.restUntil = this.clock + REST;
    this.hooks.onEvent({ kind: "fail", key });
  }

  /** The pointer, as a share of the canvas from its middle (-0.5..0.5). */
  point(x: number, y: number) {
    this.pointer = [x, y];
    this.touchTo = [x * 2, -y * 2];
    if (this.touch[0] < -8) this.touch = [...this.touchTo];
  }
  leave() {
    this.touchTo = [-9, -9];
    this.hot = null;
  }
  hover(key: string | null) {
    this.hot = key;
  }

  /** The node whose line passes within `reach` pixels of this spot on the canvas, if any. */
  hit(x: number, y: number, reach: number): string | null {
    let best: string | null = null;
    let least = reach * reach;
    const { knot: K, dir } = this.lay;
    for (const slot of this.slots) {
      if (!slot.key || slot.growTo === 0 || slot.grow < 0.95 || slot.cutTo) continue;
      const P = slot.pos;
      const L = Math.max(slot.len, 1e-3);
      const bend = [0, 1, 2].map((i) => (P[i] - K[i]) / L + dir[i]);
      const bl = Math.hypot(...bend) || 1;
      const p1 = K.map((v, i) => v + dir[i] * L * 0.12) as Vec;
      const p2 = P.map((v, i) => v - (bend[i] / bl) * L * 0.36) as Vec;
      let prev: Spot | null = null;
      for (let i = 0; i <= 18; i++) {
        const q = this.project(bezier(K, p1, p2, P, 0.16 + (0.84 * i) / 18));
        if (prev) {
          const vx = q.x - prev.x;
          const vy = q.y - prev.y;
          const t = clamp(((x - prev.x) * vx + (y - prev.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
          const d = (prev.x + vx * t - x) ** 2 + (prev.y + vy * t - y) ** 2;
          if (d < least) {
            least = d;
            best = slot.key;
          }
        }
        prev = q;
      }
    }
    return best;
  }

  /* ── running ─────────────────────────────────────────────────────────── */

  start() {
    cancelAnimationFrame(this.frame);
    if (this.dead || document.hidden) return;
    // drawn on the CPU, or with motion turned off: a few frames a second are enough
    const sparing = this.frugal || this.still;
    let last = performance.now();
    let fresh = true;
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick);
      if (sparing && !fresh && now - last < 140) return;
      const dt = Math.min(sparing ? 0.3 : 0.05, (now - last) / 1000);
      last = now;
      fresh = false;
      // a machine that cannot keep up gets fewer pixels, not a slower page
      this.age += dt;
      this.slow = dt > 0.03 && this.age > 4 ? this.slow + 1 : Math.max(0, this.slow - 1);
      if (!sparing && this.slow > 24 && this.quality > 0.5) {
        this.slow = 0;
        this.quality *= 0.78;
        this.resize();
      }
      this.update(dt);
      this.draw();
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }

  private ready(slot: Slot) {
    return slot.growTo === 1 && slot.cutTo === 0 && slot.cut < 0.02;
  }

  private update(dt: number) {
    this.clock += dt;
    if (!this.still) {
      this.time += dt;
      this.flow += dt;
    }
    const film = this.clock - this.filmAt;
    while (this.beat < 3 && film >= BEATS[this.beat + 1]) {
      this.beat++;
      this.hooks.onEvent({ kind: "beat", beat: this.beat });
      if (this.beat === 3) {
        for (const slot of this.slots) {
          if (
            slot.key &&
            slot.growTo === 0 &&
            this.all.find((r) => r.model === this.model)?.sellers.some((s) => s.key === slot.key)
          ) {
            slot.growTo = 1;
            slot.growAt = this.clock;
          }
        }
      }
    }
    // settle at once when motion is not wanted
    const pace = this.still ? 99 : 1;
    const route = this.all.find((r) => r.model === this.model);
    for (const slot of this.slots) {
      const m = ease(clamp(((this.clock - slot.moveAt) / 0.9) * pace, 0, 1));
      slot.place = { k: lerp(slot.from.k, slot.to.k, m), t: lerp(slot.from.t, slot.to.t, m) };
      slot.pos = this.lay.place(slot.place);
      const K = this.lay.knot;
      slot.len = Math.hypot(slot.pos[0] - K[0], slot.pos[1] - K[1], slot.pos[2] - K[2]);
      // the tips all travel at one speed, so the nearest (cheapest) node is reached first
      if (this.clock >= slot.growAt)
        slot.grow = toward(slot.grow, slot.growTo, (dt * pace * (slot.growTo ? 3.4 : 4.6)) / slot.len);
      if (slot.grow === 0 && slot.growTo === 0) slot.key = route?.sellers.some((s) => s.key === slot.key) ? slot.key : null;
      if (slot.cutTo === 1 && this.clock >= slot.restUntil) {
        slot.cutTo = 0;
        if (slot.key) this.hooks.onEvent({ kind: "back", key: slot.key });
      }
      slot.cut += (slot.cutTo - slot.cut) * (1 - Math.exp(-dt * pace * (slot.cutTo ? 10 : 2.6)));
      if (slot.cutTo === 0 && slot.cut < 0.002) slot.cut = 0;
      slot.cutAge += dt;
      slot.refund = Math.max(0, slot.refund - dt / 3.5);
      slot.hover += ((slot.key && slot.key === this.hot ? 1 : 0) - slot.hover) * (1 - Math.exp(-dt * 10));
    }
    // the node in use: the first in line that works, once its line has reached it
    const first =
      this.beat >= 3 && route
        ? route.sellers.map((s) => this.slots.find((slot) => slot.key === s.key)).find((slot) => slot && this.ready(slot))
        : undefined;
    const lead = first && first.grow >= 0.999 ? first : null;
    for (const slot of this.slots)
      slot.gold = toward(slot.gold, slot === lead ? 1 : 0, (dt * pace) / (slot === lead ? 0.55 : 0.85));
    if (lead !== this.lead) {
      this.lead = lead;
      this.hooks.onEvent({ kind: "lead", key: lead?.key ?? null });
    }
    this.req = toward(this.req, lead ? 1 : 0, dt * pace);
    this.lean[0] += (this.pointer[0] - this.lean[0]) * 0.05;
    this.lean[1] += (this.pointer[1] - this.lean[1]) * 0.05;
    this.touch[0] += (this.touchTo[0] - this.touch[0]) * 0.12;
    this.touch[1] += (this.touchTo[1] - this.touch[1]) * 0.12;
  }

  private project(p: Vec): Spot {
    const m = this.mvp;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return { x: ((x / w) * 0.5 + 0.5) * this.w, y: (0.5 - (y / w) * 0.5) * this.h };
  }

  private draw() {
    const gl = this.gl;
    const scene = this.glow?.scene;
    if (!gl || !this.glow || !this.fibre || !scene) return;
    const film = this.clock - this.filmAt;
    const install = ease(clamp((film - 0.15) / 1.25, 0, 1));
    const agents = ease(clamp((film - 1.45) / 1.0, 0, 1));
    const lay = this.lay;
    const aspect = this.w / this.h;
    const model = multiply(
      rotate(1, lay.turn[0] + Math.sin(this.time * 0.11) * 0.07 + this.lean[0] * 0.2),
      rotate(0, lay.turn[1] + this.lean[1] * 0.12)
    );
    this.mvp = multiply(multiply(perspective(FOV, aspect, 0.1, 60), translate(0, 0, -CAMERA)), model);
    const flat = (list: number[][]) => new Float32Array(list.flat());

    // 1. the fibres, added light on light
    const fibre = this.fibre;
    const u = fibre.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(fibre.p);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform1f(u.u_flow, this.flow);
    gl.uniform1f(u.u_width, 1.15 * (scene.w / this.w));
    gl.uniform1f(u.u_blur, 0.4);
    gl.uniform1f(u.u_split, SPLIT);
    gl.uniform1f(u.u_ring, 0.075);
    gl.uniformMatrix4fv(u.u_mvp, false, this.mvp);
    gl.uniform2f(u.u_res, scene.w, scene.h);
    gl.uniform2f(u.u_touch, this.touch[0], this.touch[1]);
    gl.uniform3fv(u.u_knot, lay.knot);
    gl.uniform3fv(u.u_dir, lay.dir);
    gl.uniform3fv(u.u_wallet, lay.wallet);
    gl.uniform3fv(u.u_wdir, lay.wdir);
    gl.uniform3fv(u.u_lead, lay.lead);
    gl.uniform3fv(u.u_agent, flat(lay.agents));
    gl.uniform4fv(u.u_node, flat(this.slots.map((s) => [...s.pos, 0])));
    gl.uniform4fv(u.u_ns, flat(this.slots.map((s) => [s.grow, s.cut, s.gold, s.refund])));
    gl.uniform4fv(u.u_nb, flat(this.slots.map((s) => [s.cutAge, s.hover, 0, 0])));
    // the same light whether there are few fibres or many; a flash as the install cable lands
    const flash = 1 + 0.9 * Math.exp(-(((film - 1.42) / 0.16) ** 2));
    gl.uniform1f(u.u_gain, 0.62 * Math.sqrt(640 / this.routes) * flash);
    gl.uniform1f(u.u_req, this.req);
    gl.uniform1f(u.u_install, install);
    gl.uniform1f(u.u_leadGain, film < 1.6 ? 1 : 1 - ease(clamp((film - 1.6) / 0.9, 0, 1)));
    gl.uniform1f(u.u_agents, agents);
    gl.uniform1f(u.u_wgrow, ease(clamp((film - 2.5) / 0.8, 0, 1)));
    gl.uniform1f(u.u_wgold, film < 2.5 ? 0 : film < 3.4 ? 1 : 0.14 + 0.86 * Math.exp(-(film - 3.4) * 0.9));
    gl.bindVertexArray(this.fibreVao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND);

    // 2. glow and haze, and everything together
    this.glow.finish(this.time, aspect);

    // where the words go
    const nodes = new Map<string, Spot>();
    for (const slot of this.slots)
      if (slot.key && slot.growTo === 1 && slot.grow > 0.97) nodes.set(slot.key, this.project(slot.pos));
    this.hooks.onFrame({
      portrait: lay.portrait,
      eye: this.project(lay.knot),
      agents: lay.agents.map((p) => this.project(p)),
      nodes,
      film,
    });
  }

  /** For checking frames one at a time: run the clock on by this many seconds, then draw. */
  run(seconds: number, fps = 30) {
    for (let i = 0; i < seconds * fps; i++) this.update(1 / fps);
    this.draw();
  }
}
