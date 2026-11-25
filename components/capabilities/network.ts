/* Routstr as light: you on one side, the nodes in the middle, the models on the other. Every
   fibre is a request's way from you, through your key, to a node, and on to a model. Its path is
   worked out on the GPU from where those are, so the light simply follows as they change.

   Each capability is an act the light plays on that one network: sats running in to make a key,
   gold going out with a request and change coming back, a node snapping and the next one taking
   over, the way pulling tight and dark, the nodes announcing themselves one by one, a team's
   lines meeting in one wallet, and sats filling the nodes that sell. The look (colours, glow,
   grain) is the home page's. */

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
  release,
} from "@/components/try/light/kit";
import type { Act } from "./capabilities";

type Vec = [number, number, number];
/** A spot on the canvas, in CSS pixels from its corner. */
export type Spot = { x: number; y: number };

const SEG = 128;
const NODES = 6;
const ENDS = 7;
const MEMBERS = 5;
/** Where along each fibre it reaches your key, and where it reaches its node. */
const AT_KEY = 0.3;
const AT_NODE = 0.62;
/** The node most requests go to, and the one that takes over when it fails. */
const LEAD = 2;
const NEXT = 3;
/** When the cable has come in, and how long the nodes and models take to grow, in seconds. */
const IN = 0.9;
const OPEN = 1.3;
/** The turn of the scene about its upright: at rest, the slow sway, and how far the pointer leans it. */
const TURN = -0.1;
const SWAY = 0.05;
const LEAN = 0.16;
/** How long each act takes before it plays again, in seconds; 0 runs on and on. */
const LOOP: Record<Act, number> = {
  key: 4.6,
  pay: 0,
  api: 5.6,
  route: 6.4,
  private: 0,
  found: 7.2,
  teams: 0,
  sell: 5.2,
};
/** How long the light takes to open, and to play an act through once, in seconds. */
export const OPENING = IN + OPEN;
export const playsFor = (act: Act) => Math.max(LOOP[act], 5) + 0.8;
/** With motion turned off, the moment of each act that tells it best. */
const STILL: Record<Act, number> = {
  key: 2.4,
  pay: 1,
  api: 4.2,
  route: 2.6,
  private: 1,
  found: 5.6,
  teams: 1,
  sell: 3.6,
};

const FIBRE_VERT = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in float a_s;
layout(location=1) in float a_side;
layout(location=2) in vec4 a_seed;
layout(location=3) in vec4 a_lane;
uniform float u_time, u_width, u_blur, u_ring, u_spread, u_fan, u_seal;
uniform mat4 u_mvp;
uniform vec2 u_res, u_touch;
uniform vec4 u_src;
uniform vec3 u_key, u_dir;
uniform vec4 u_node[${NODES}];
uniform vec4 u_ns[${NODES}];
uniform vec4 u_end[${ENDS}];
out float v_side;
out float v_s;
out float v_depth;
out float v_soft;
out float v_lit;
out float v_end;
out vec4 v_seed;
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
// close to your key every fibre passes through one small ring
float near(float u) { return pow(clamp(u, 0.0, 1.0), 6.0); }

vec3 at(float s) {
  vec4 sd = a_seed;
  int j = int(a_lane.x + 0.5);
  float lit = u_ns[j].y;
  float t = u_time;
  vec3 K = u_key;
  vec3 p0, p1, p2, p3;
  float u, r, turn;
  float sag = 0.0;
  float body = 0.05 + 0.95 * sqrt(sd.x);
  // sealed: the lit way pulls into three thin layers, each turning against the next
  float layer = floor(sd.y * 3.0);
  float seal = u_seal * lit;
  float tight = mix(1.0, 0.16 + 0.2 * layer, seal);
  float spin = mix(1.0, (mod(layer, 2.0) * 2.0 - 1.0) * 4.0, seal);
  if (s < ${AT_KEY}) {
    // from you to your key; a team comes in from several people at once
    u = s / ${AT_KEY};
    vec3 S = u_src.xyz + vec3(0.0, (a_lane.z - 2.0) * u_src.w, (sd.z - 0.5) * 0.4) * u_spread;
    float L = distance(S, K);
    p0 = S; p1 = S + u_dir * L * 0.42; p2 = K - u_dir * L * 0.36; p3 = K;
    r = (0.03 + 0.12 * bulge(u) * (1.0 - 0.6 * u_spread)) * body * tight + u_ring * near(u);
    turn = sd.y * TAU + (u - 1.0) * (2.6 + 1.6 * sd.z) + t * 0.12 * spin + t * 0.35 * near(u);
  } else if (s < ${AT_NODE}) {
    // from your key out to a node; a node that fails snaps, and its line hangs
    u = (s - ${AT_KEY}) / ${AT_NODE - AT_KEY};
    vec3 P = u_node[j].xyz;
    float L = max(distance(P, K), 1e-3);
    vec3 D = (P - K) / L;
    float cut = u_ns[j].x;
    float hang = u < 0.5 ? u * 2.0 : (1.0 - u) * 2.0;
    sag = cut * hang * hang * (0.24 + 0.1 * L);
    p0 = K; p1 = K + u_dir * L * 0.16; p2 = P - normalize(D + u_dir) * L * 0.34; p3 = P;
    r = (0.03 + 0.035 * L) * bulge(u) * body * tight * (1.0 + cut * hang) + u_ring * near(1.0 - u);
    turn = sd.y * TAU + u * (2.3 + 1.7 * sd.z) + t * 0.09 * spin + t * 0.35 * near(1.0 - u);
  } else {
    // from the node to a model; the lit way opens out to every model when they are all shown
    u = (s - ${AT_NODE}) / ${1 - AT_NODE};
    vec3 P = u_node[j].xyz;
    int m = int(mix(a_lane.y, a_lane.w, step(0.5, u_fan * lit)) + 0.5);
    vec3 E = mix(u_end[int(a_lane.y + 0.5)].xyz, u_end[int(a_lane.w + 0.5)].xyz, u_fan * lit);
    float L = max(distance(E, P), 1e-3);
    p0 = P; p1 = P + u_dir * L * 0.3; p2 = E - u_dir * L * 0.3; p3 = E;
    r = (0.02 + 0.03 * L) * bulge(u) * body * tight;
    turn = sd.y * TAU + u * (2.0 + 1.5 * sd.z) + t * 0.08 * spin;
    v_end = u_end[m].w;
  }
  vec3 c = bez(p0, p1, p2, p3, u);
  vec3 T = normalize(bezT(p0, p1, p2, p3, u) + vec3(1e-6, 0.0, 0.0));
  vec3 n1 = cross(T, vec3(0.0, 0.0, 1.0));
  float l = length(n1);
  n1 = l > 1e-5 ? n1 / l : vec3(0.0, 1.0, 0.0);
  vec3 n2 = cross(T, n1);
  c += r * (cos(turn) * n1 + sin(turn) * n2);
  c += 0.01 * (1.0 - seal) * (sin(s * 11.0 + sd.w * 30.0 + t * 0.7) * n1 + cos(s * 9.0 + sd.z * 30.0 + t * 0.6) * n2);
  c.y -= sag;
  return c;
}

void main() {
  v_end = 0.0;
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
  float width = u_width * (0.55 + 0.95 * a_seed.x) * clamp(5.6 / here.w, 0.5, 2.4) * spread;
  here.xy += vec2(-dir.y, dir.x) * a_side * width / u_res * 2.0 * here.w;
  gl_Position = here;

  v_side = a_side;
  v_s = a_s;
  v_depth = here.w;
  v_soft = 1.0 / spread;
  v_seed = a_seed;
  v_node = int(a_lane.x + 0.5);
  v_lit = u_ns[v_node].y;
}`;

const FIBRE_FRAG = `#version 300 es
precision highp float;
precision highp int;
in float v_side;
in float v_s;
in float v_depth;
in float v_soft;
in float v_lit;
in float v_end;
in vec4 v_seed;
flat in int v_node;
uniform float u_flow, u_gain, u_in, u_any, u_seal, u_pay, u_sell, u_spread;
uniform vec3 u_fill;
uniform vec4 u_node[${NODES}];
uniform vec4 u_ns[${NODES}];
out vec4 o;

float blip(float phase) { return smoothstep(0.0, 0.012, phase) * smoothstep(0.075, 0.012, phase); }

void main() {
  float edge = 1.0 - smoothstep(0.3 * v_soft, 1.0, abs(v_side));
  vec4 sd = v_seed;
  vec4 st = u_ns[v_node];
  float lit = v_lit;
  vec3 cool = mix(vec3(0.56, 0.68, 1.0), vec3(0.88, 0.93, 1.0), sd.z);
  vec3 gold = vec3(1.0, 0.68, 0.26);
  vec3 col = cool * (0.03 + 0.26 * sd.x * sd.x);
  float show = 1.0;
  float bright = 1.0;
  // which part of the way this is, and how far along it
  float part = v_s < ${AT_KEY} ? 0.0 : v_s < ${AT_NODE} ? 1.0 : 2.0;
  float u = part == 0.0 ? v_s / ${AT_KEY} : part == 1.0 ? (v_s - ${AT_KEY}) / ${AT_NODE - AT_KEY} : (v_s - ${AT_NODE}) / ${1 - AT_NODE};
  // from you up to your node, and from your key on: the stretches money travels
  float toNode = part < 2.0 ? v_s / ${AT_NODE} : 1.0;

  // requests run out along the way in use, from you to the model
  float req = blip(fract(v_s * (1.0 + floor(sd.x * 2.0)) - u_flow * (0.06 + 0.05 * sd.z) + sd.w)) * step(0.62, sd.y);
  col += cool * req * (0.25 + 1.1 * lit) * (1.0 - u_seal * lit);

  // the cable comes in first, then each node's line grows out, then its models
  float grow = u_node[v_node].w;
  if (part == 0.0) {
    // it starts from nothing, beside the words, and every fibre of it runs here: keep it soft
    show = (1.0 - smoothstep(u_in - 0.03, u_in + 0.001, u)) * smoothstep(0.0, 0.12, u);
    bright = 0.45;
    col += cool * exp(-abs(u - u_in) * 40.0) * (1.0 - smoothstep(0.9, 1.0, u_in)) * 2.0;
  } else {
    float reach = part == 1.0 ? clamp(grow * 2.0, 0.0, 1.0) : clamp(grow * 2.0 - 1.0, 0.0, 1.0);
    show = (1.0 - smoothstep(reach - 0.03, reach + 0.001, u)) * step(0.0005, reach);
    col += cool * exp(-abs(u - reach) * 45.0) * (1.0 - smoothstep(0.96, 1.0, reach)) * step(0.0005, reach) * 2.2;
  }

  // a key out of sats: gold runs in from you, and your key lights up as it lands
  if (part == 0.0) {
    float filled = (1.0 - smoothstep(u_fill.x - 0.05, u_fill.x, u)) * u_fill.y;
    col = mix(col, gold * (0.12 + 0.9 * sd.x * sd.x), 0.9 * filled);
    col = mix(col, gold * 2.4, step(sd.x, 0.1) * filled);
    col += gold * exp(-abs(u - u_fill.x) * 30.0) * step(u_fill.x, 0.99) * u_fill.y * 1.6;
  }
  col += gold * exp(-abs(v_s - ${AT_KEY}) * 40.0) * u_fill.z * 2.0;

  // paying as you go: sats ride out with the request, and the change rides back
  float sent = blip(fract(toNode * 2.0 - u_flow * (0.09 + 0.05 * sd.z) + sd.w)) * step(0.4, sd.y) * step(part, 1.5);
  float back = blip(fract(toNode * 3.0 + u_flow * (0.07 + 0.04 * sd.z) + sd.w * 1.7)) * step(sd.y, 0.25) * step(part, 1.5);
  col += gold * (sent * 3.2 + back * 2.0) * u_pay * lit;

  // selling: sats run to every node, and fill each one back from its end
  float sold = blip(fract(toNode * 2.5 - u_flow * (0.08 + 0.05 * sd.z) + sd.w)) * step(0.5, sd.y) * step(part, 1.5);
  col += gold * sold * u_sell * 2.4;
  if (part == 1.0) {
    float full = smoothstep(1.0 - st.z - 0.04, 1.0 - st.z, u) * step(0.002, st.z);
    col = mix(col, gold * (0.15 + 0.85 * sd.x * sd.x), 0.9 * full);
    col = mix(col, gold * 2.2, step(sd.x, 0.12) * full);
  }

  // every model the lit way reaches lights up in turn
  if (part == 2.0) col += mix(cool, vec3(1.0), 0.4) * v_end * lit * (0.25 + 0.75 * u) * 0.9;

  // a node that fails: a flash runs away from the break, and a gap stays where it broke
  if (part == 1.0) {
    float apart = abs(u - 0.5);
    float age = st.w;
    float gone = 0.5 * (1.0 - exp(-2.6 * age));
    float burst = (1.0 - smoothstep(gone, gone + 0.015, apart)) * exp(-(gone - apart) * 10.0) * exp(-age * 0.9);
    col += gold * burst * st.x * 4.0;
    show *= mix(1.0, smoothstep(0.07, 0.13, apart), smoothstep(0.0, 0.25, st.x));
    bright *= mix(1.0, 0.3, st.x);
  }

  // sealed: the way goes dark and violet; only the answer shows, where it comes out
  vec3 sealed = vec3(0.42, 0.36, 1.0) * (0.05 + 0.35 * sd.x * sd.x);
  float hid = u_seal * lit;
  col = mix(col, sealed, hid * 0.9);
  col += vec3(0.75, 0.72, 1.0) * hid * blip(fract(v_s * 1.0 - u_flow * 0.05 + sd.w)) * step(0.85, sd.y) * smoothstep(0.7, 1.0, v_s) * 2.0;

  // the way in use steps forward; the rest steps back
  bright *= mix(1.0, mix(0.16, 1.6, lit), u_any);
  // where every fibre meets, at your key and at a node, the light would only burn white: thin it
  bright *= 1.0 - 0.6 * exp(-abs(v_s - ${AT_KEY}) * 16.0);
  bright *= 1.0 - 0.45 * exp(-abs(v_s - ${AT_NODE}) * 22.0);
  float fog = mix(1.0, 0.3, smoothstep(4.6, 8.6, v_depth));
  o = vec4(col * edge * fog * v_soft * show * bright * u_gain, 1.0);
}`;

const UNIFORMS = (
  "u_time u_width u_blur u_ring u_spread u_fan u_seal u_mvp u_res u_touch u_src u_key u_dir u_node u_ns u_end " +
  "u_flow u_gain u_in u_any u_pay u_sell u_fill"
).split(" ");

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

/* Where everything sits, for this size of canvas. The light starts at `from` (the capability
   picked, in its list) or, with no list beside it, off the left edge, and runs right: your key,
   the nodes in an arc, the models down the far side. Positions are worked out on the page's
   plane, before the scene is turned. */
function layout(w: number, h: number, left: number, from: Spot | null) {
  const H = Math.tan(FOV / 2) * CAMERA;
  const W = H * (w / h);
  const X = (px: number) => ((px / w) * 2 - 1) * W;
  const Y = (py: number) => (1 - (py / h) * 2) * H;
  const span = w - left;
  const nodes = Array.from({ length: NODES }, (_, j): Vec => {
    const t = (2 * j) / (NODES - 1) - 1;
    return [X(left + span * (0.5 - 0.05 * t * t)), -t * H * 0.56, 0.3 * Math.sin(j * 1.7 + 0.4)];
  });
  const ends = Array.from({ length: ENDS }, (_, m): Vec => {
    const t = (2 * m) / (ENDS - 1) - 1;
    return [X(w - span * (0.05 + 0.04 * t * t)), -t * H * 0.72, 0.25 * Math.sin(m * 2.3 + 1.1)];
  });
  return {
    source: (from ? [X(from.x), Y(from.y), 0] : [X(-0.06 * w), 0, 0]) as Vec,
    key: [X(left + span * 0.2), 0, 0] as Vec,
    /** How far apart a team's people start. */
    apart: H * 0.13,
    nodes,
    ends,
  };
}

export class Network {
  private gl: WebGL2RenderingContext | null;
  private fibre: Program | null = null;
  private glow: Glow | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private count = 0;
  private quality = 1;
  /** Drawn on the CPU: a few frames a second, at fewer pixels. */
  private frugal = false;
  private still: boolean;
  private slow = 0;
  private age = 0;
  private frame = 0;
  private w = 1;
  private h = 1;
  private left = 0;
  private from: Spot | null = null;
  private lay = layout(1, 1, 0, null);
  private source: Vec | null = null;
  private mvp: Mat = new Float32Array(16);

  private clock = 0;
  private time = 0;
  private flow = 0;
  private act: Act | null = null;
  /** Seconds into the act playing. */
  private phase = 0;
  // what each node, model and the whole light is doing now, eased toward what the act wants
  private grow = new Float32Array(NODES);
  private lit = new Float32Array(NODES);
  private cut = new Float32Array(NODES);
  private gold = new Float32Array(NODES);
  private broke = new Float32Array(NODES).fill(9);
  private shown = new Float32Array(ENDS);
  private now = { spread: 0, fan: 0, seal: 0, pay: 0, sell: 0, any: 0, fill: 0, filled: 0, key: 0 };
  private pointer = [0, 0];
  private lean = [0, 0];
  private touch = [-9, -9];
  private touchTo = [-9, -9];
  readonly dead: boolean;

  constructor(private canvas: HTMLCanvasElement) {
    this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    this.dead = !this.gl;
    if (!this.gl) return;
    const gl = this.gl;
    this.frugal = software(gl);
    if (this.frugal) this.quality = 0.5;
    this.fibre = program(gl, FIBRE_VERT, FIBRE_FRAG, UNIFORMS);
    // a GPU that cannot run the light leaves the list alone, as with no WebGL at all
    if (!gl.getProgramParameter(this.fibre.p, gl.LINK_STATUS)) {
      this.dead = true;
      return;
    }
    this.glow = new Glow(gl);
    const strong = (navigator.hardwareConcurrency ?? 4) >= 8 && window.innerWidth >= 1100;
    this.count = window.innerWidth < 760 ? 320 : strong ? 720 : 540;
    this.build();
    this.resize();
  }

  /** One ribbon per fibre, each with its node, its model (and the one it opens to), and its person. */
  private build() {
    const gl = this.gl!;
    const random = seeded(2121);
    const rows = SEG + 1;
    const data = new Float32Array(this.count * rows * 2 * 10);
    const index = new Uint32Array(this.count * SEG * 6);
    let d = 0;
    let n = 0;
    for (let f = 0; f < this.count; f++) {
      const seed = [random(), random(), random(), random()];
      const node = f % NODES;
      // a node sells the models across from it, and now and then one further off
      const band = Math.round((node / (NODES - 1)) * (ENDS - 1) + (random() - 0.5) * 1.6);
      const model = random() < 0.12 ? Math.floor(random() * ENDS) : clamp(band, 0, ENDS - 1);
      const lane = [node, model, Math.floor(random() * MEMBERS), Math.floor(random() * ENDS)];
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
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
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
    this.lay = layout(this.w, this.h, this.left, this.from);
    this.glow.resize(this.w, this.h, this.quality);
    this.draw();
  }

  /* ── what it shows ───────────────────────────────────────────────────── */

  /** The act to play (null: just the network). */
  play(act: Act | null) {
    if (act === this.act) return;
    this.act = act;
    this.phase = 0;
  }
  /** Where the light starts, in pixels on the canvas (null: off its left edge), and where the
   *  free room to its right begins. */
  place(from: Spot | null, left: number) {
    this.from = from;
    this.left = left;
    this.lay = layout(this.w, this.h, left, from);
  }

  /** The pointer, as a share of the canvas from its middle (-0.5..0.5). */
  point(x: number, y: number) {
    this.pointer = [x, y];
    this.touchTo = [x * 2, -y * 2];
    if (this.touch[0] < -8) this.touch = [...this.touchTo];
  }
  leave() {
    this.touchTo = [-9, -9];
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
  /** For good, when its page is left: stop, and hand the context back. */
  dispose() {
    this.stop();
    release(this.gl);
  }

  /** What the act wants at this moment of it: each node's line, each model, and the whole light. */
  private want(act: Act | null, p: number) {
    const grow = new Array<number>(NODES).fill(1);
    const lit = new Array<number>(NODES).fill(0);
    const cut = new Array<number>(NODES).fill(0);
    const gold = new Array<number>(NODES).fill(0);
    const shown = new Array<number>(ENDS).fill(0);
    const all = { spread: 0, fan: 0, seal: 0, pay: 0, sell: 0, any: 0, fill: 0, filled: 0, key: 0 };
    switch (act) {
      case "key":
        // sats run in from you; as they land your key lights, and the request goes out
        all.any = 0.8;
        all.fill = ease(clamp(p / 1.3, 0, 1));
        all.filled = p < 3.8 ? 1 : 0;
        all.key = p > 1.25 && p < 2.1 ? 1 : 0;
        lit[LEAD] = p > 1.6 && p < 4.1 ? 1 : 0.15;
        break;
      case "pay":
        all.any = 0.8;
        all.pay = 1;
        lit[LEAD] = 1;
        break;
      case "api":
        // the way in use opens out to every model, and they light up one after another
        all.any = 0.7;
        all.fan = 1;
        lit[LEAD] = 1;
        for (let m = 0; m < ENDS; m++) shown[m] = p > 0.8 + 0.28 * m && p < 5 ? 1 : 0;
        break;
      case "route":
        // in use, then it snaps; the next node takes over; the broken line heals and rests
        all.any = 0.75;
        cut[LEAD] = p > 1.4 && p < 4.6 ? 1 : 0;
        lit[LEAD] = p < 1.4 || p > 5.7 ? 1 : 0;
        lit[NEXT] = p > 1.75 && p < 5.7 ? 1 : 0;
        break;
      case "private":
        all.any = 0.9;
        all.seal = 1;
        lit[LEAD] = 1;
        break;
      case "found":
        // the nodes announce themselves one by one, and fade to do it again
        for (let j = 0; j < NODES; j++) grow[j] = p > 0.5 + 0.45 * j && p < 6.6 ? 1 : 0;
        break;
      case "teams":
        all.any = 0.4;
        all.spread = 1;
        all.key = 0.45;
        lit[LEAD] = 1;
        break;
      case "sell":
        // sats run to every node and fill it, then it starts over
        all.any = 0.3;
        all.sell = 1;
        lit.fill(0.45);
        gold.fill(p < 4.4 ? ease(clamp((p - 0.4) / 3.6, 0, 1)) : 0);
        break;
    }
    return { grow, lit, cut, gold, shown, all };
  }

  private update(dt: number) {
    if (!this.still) {
      this.time += dt;
      this.flow += dt;
    }
    // with no motion wanted, the film is over before it starts, and each act holds its best moment
    this.clock += this.still ? 99 : dt;
    const act = this.act;
    if (act) {
      const loop = LOOP[act];
      this.phase = this.still ? STILL[act] : loop ? (this.phase + dt) % loop : this.phase + dt;
    }
    const opened = this.clock - IN;
    const want = this.want(opened > OPEN ? act : null, this.phase);
    const pace = this.still ? 99 : 1;
    const to = (v: number, goal: number, rate: number) => v + (goal - v) * (1 - Math.exp(-dt * pace * rate));
    for (let j = 0; j < NODES; j++) {
      // at the start every line grows out in turn
      const first = ease(clamp((opened - 0.12 * j) / (OPEN - 0.12 * (NODES - 1)), 0, 1));
      const goal = opened > OPEN ? want.grow[j] : first;
      this.grow[j] = opened > OPEN ? to(this.grow[j], goal, goal ? 1.6 : 2.4) : first;
      this.lit[j] = to(this.lit[j], want.lit[j], 3.2);
      this.gold[j] = to(this.gold[j], want.gold[j], 4);
      if (want.cut[j] && this.cut[j] < 0.5 && this.broke[j] > 1) this.broke[j] = 0;
      this.broke[j] += dt * pace;
      this.cut[j] = to(this.cut[j], want.cut[j], want.cut[j] ? 14 : 1.8);
    }
    for (let m = 0; m < ENDS; m++) this.shown[m] = to(this.shown[m], want.shown[m], 5);
    const now = this.now;
    (Object.keys(now) as (keyof typeof now)[]).forEach((name) => {
      // the gold front runs at its own pace; everything else eases
      now[name] = name === "fill" ? want.all.fill : to(now[name], want.all[name], name === "key" ? 6 : 2.6);
    });
    const src = this.lay.source;
    this.source = this.source ? (this.source.map((v, i) => to(v, src[i], 5)) as Vec) : src;
    this.lean[0] += (this.pointer[0] - this.lean[0]) * 0.05;
    this.lean[1] += (this.pointer[1] - this.lean[1]) * 0.05;
    this.touch[0] += (this.touchTo[0] - this.touch[0]) * 0.12;
    this.touch[1] += (this.touchTo[1] - this.touch[1]) * 0.12;
  }

  private draw() {
    const gl = this.gl;
    const scene = this.glow?.scene;
    if (!gl || !this.glow || !this.fibre || !scene) return;
    const lay = this.lay;
    const aspect = this.w / this.h;
    const model = multiply(
      rotate(1, TURN + Math.sin(this.time * 0.11) * SWAY + this.lean[0] * LEAN),
      rotate(0, 0.05 + this.lean[1] * 0.1)
    );
    this.mvp = multiply(multiply(perspective(FOV, aspect, 0.1, 60), translate(0, 0, -CAMERA)), model);
    const now = this.now;
    const source = this.source ?? lay.source;

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
    gl.uniform1f(u.u_ring, 0.05);
    gl.uniform1f(u.u_in, ease(clamp(this.clock / IN, 0, 1)));
    gl.uniformMatrix4fv(u.u_mvp, false, this.mvp);
    gl.uniform2f(u.u_res, scene.w, scene.h);
    gl.uniform2f(u.u_touch, this.touch[0], this.touch[1]);
    gl.uniform4f(u.u_src, source[0], source[1], source[2], lay.apart);
    gl.uniform3fv(u.u_key, lay.key);
    gl.uniform3f(u.u_dir, 1, 0, 0);
    gl.uniform4fv(u.u_node, new Float32Array(lay.nodes.flatMap((P, j) => [...P, this.grow[j]])));
    gl.uniform4fv(
      u.u_ns,
      new Float32Array(lay.nodes.flatMap((_, j) => [this.cut[j], this.lit[j], this.gold[j], this.broke[j]]))
    );
    gl.uniform4fv(u.u_end, new Float32Array(lay.ends.flatMap((P, m) => [...P, this.shown[m]])));
    gl.uniform1f(u.u_spread, now.spread);
    gl.uniform1f(u.u_fan, now.fan);
    gl.uniform1f(u.u_seal, now.seal);
    gl.uniform1f(u.u_any, now.any);
    gl.uniform1f(u.u_pay, now.pay);
    gl.uniform1f(u.u_sell, now.sell);
    gl.uniform3f(u.u_fill, now.fill, now.filled, now.key);
    // the same light whether there are few fibres or many
    gl.uniform1f(u.u_gain, 0.5 * Math.sqrt(640 / this.count));
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND);

    this.glow.finish(this.time, aspect);
  }

  /** For checking frames one at a time: run the clock on by this many seconds, then draw. */
  run(seconds: number, fps = 30) {
    for (let i = 0; i < seconds * fps; i++) this.update(1 / fps);
    this.draw();
  }
}
