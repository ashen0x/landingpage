(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[4821],{1511:(e,t,s)=>{"use strict";s.d(t,{Capabilities:()=>j});var a=s(5787),o=s(5339),n=s(288),i=s.n(n),r=s(4802),l=s(7406),u=s(7866),h=s(2618);let d="https://node.example.com",c="https://docs.routstr.com",p=e=>JSON.stringify(e).replace(/'/g,"'\\''"),f=(e,t,s,a="")=>[["$",`curl ${a}${e} \\`],...t.map(e=>["",`    -H "${e}" \\`]),["",`    -d '${s}'`]],m=(e,t)=>`${e} of ${t}`,y=[{key:"key",name:"No account",title:"No account. Just sats.",line:"Hand a node a Cashu token or pay its Lightning invoice, and it gives you a key. No email, no card, no name.",stat:e=>e&&`${m(e.nodes,e.nodes)} nodes give a key for a Cashu token. ${m(e.lightning,e.nodes)} for a Lightning invoice.`,examples:()=>[{tab:"Cashu",lines:[...f(`${d}/v1/balance/create`,["Content-Type: application/json"],'{ "initial_balance_token": "cashuB..." }'),["",""],[u.I,'{ "api_key": "sk-...", "balance": 1000000 }',"1,000 sats, in millisats"]]},{tab:"Lightning",lines:[...f(`${d}/v1/balance/lightning/invoice`,["Content-Type: application/json"],'{ "amount_sats": 1000, "purpose": "create" }'),["",""],["$",`curl ${d}/v1/balance/lightning/invoice/ID/status`,"once it is paid, the key"]]}],link:{href:"/topup",text:"Get a key on Top-up"}},{key:"pay",name:"Pay per request",title:"Pay for each request. Get the change.",line:"Put a Cashu token on the request and the change comes back with the answer. Or take what is left on a key out to Lightning.",stat:e=>e&&`${m(e.takeOut,e.nodes)} nodes pay what is left on a key to a Lightning address.`,examples:e=>[{tab:"Token on the request",lines:[...f(`${d}/v1/chat/completions`,["X-Cashu: cashuB...","Content-Type: application/json"],`{ "model": ${p(e)}, "messages": [{ "role": "user", "content": "Hello" }] }`,"-i "),["",""],[u.I,"x-cashu: cashuB...","the change, back with the answer"]]},{tab:"Take it out",lines:f(`${d}/v1/balance/refund`,["Authorization: Bearer sk-...","Content-Type: application/json"],'{ "lightning_address": "you@wallet.com" }')}],link:{href:`${c}/client/payments/`,text:"How paying works"}},{key:"api",name:"One API",title:"Every model. One API.",line:"Every node speaks the OpenAI API and Anthropic's. Point any SDK, app or agent at a node and it already works.",stat:e=>e&&`${e.models.toLocaleString("en-US")} models on ${e.nodes} nodes, from chat to pictures to embeddings.`,examples:e=>[{tab:"OpenAI",lines:[["","from openai import OpenAI"],["",""],["",`client = OpenAI(base_url="${d}/v1", api_key="sk-...")`],["",`r = client.chat.completions.create(model=${JSON.stringify(e)}, messages=[`],["",'    { "role": "user", "content": "Hello" },'],["","])"]]},{tab:"Anthropic",lines:f(`${d}/v1/messages`,["Authorization: Bearer sk-...","Content-Type: application/json"],`{ "model": ${p(e)}, "max_tokens": 1024, "messages": [{ "role": "user", "content": "Hello" }] }`)},{tab:"Any app",lines:[["$",`export OPENAI_BASE_URL=${d}/v1`],["$","export OPENAI_API_KEY=sk-...","most apps that speak OpenAI read these two"]]}],link:{href:"/models",text:"Every model"}},{key:"route",name:"Never stuck",title:"The cheapest node. Then the next.",line:"routstrd on your machine sends each request to the cheapest node you approved for that model, and to the next one if it fails.",stat:e=>e&&`${e.backed.toLocaleString("en-US")} models are sold by two nodes or more, so there is always another.`,examples:()=>[{tab:"routstrd",lines:[["$",`curl -fsSL ${h.O} | sh`],["$","routstrd onboard --claude-code","or --opencode, --pi-agent, --openclaw, --hermes"]]}],link:{href:"/routstrd",text:"More on routstrd"}},{key:"private",name:"Private",title:"Nothing to tie it to you.",line:"No account means no name on a request. Reach a node over Tor, or pick a sealed model that not even the node can read.",stat:e=>e&&`${m(e.tor,e.nodes)} nodes answer over Tor. ${e.sealed} models on ${e.sealedNodes} nodes run in a sealed enclave.`,examples:e=>[{tab:"Over Tor",lines:f("http://nodeaddress.onion/v1/chat/completions",["Authorization: Bearer sk-...","Content-Type: application/json"],`{ "model": ${p(e)}, "messages": [{ "role": "user", "content": "Hello" }] }`,"--socks5-hostname 127.0.0.1:9050 ")}],link:{href:"/providers",text:"Nodes on Tor"}},{key:"found",name:"Found over Nostr",title:"No list anyone can shut down.",line:"Each node announces itself on Nostr relays, and curators vouch for the ones they trust. Apps find them there, with no server in between.",stat:e=>e&&(null===e.found?"Asking the relays…":0===e.found?"The relays did not answer this time. Try again in a moment.":`Just now this page found ${e.found} nodes${e.relays?` on ${e.relays} relays`:""}. ${e.nodes} of them answered.`),examples:()=>[{tab:"A node says",lines:[["","{"],["",'  "kind": 38421,',"a node announcing itself"],["",'  "tags": ['],["",'    ["d", "my-node"],'],["",'    ["u", "https://node.example.com"],'],["",'    ["u", "http://nodeaddress.onion"],'],["",'    ["mint", "https://mint.example.com"]'],["","  ]"],["","}"]]},{tab:"A curator says",lines:[["","{"],["",'  "kind": 38000,',"vouching for a node"],["",'  "tags": ['],["",'    ["k", "38421"],'],["",'    ["u", "https://node.example.com"],'],["",'    ["a", "38421:<node pubkey>:my-node"]'],["","  ]"],["","}"]]}],link:{href:"https://github.com/Routstr/protocol",text:"The protocol"}},{key:"teams",name:"Teams",title:"One wallet for the whole team.",line:"Run routstrd on a server. Everyone signs in with their own Nostr key and gets their own keys; one wallet pays, and you see who spent what.",stat:()=>"On any server, or in one click on Cloudron.",examples:()=>[{tab:"Join a team",lines:[["$","routstrd remote https://team.example.com"],["$","routstrd clients add --claude-code","a key of your own, set up in Claude Code"]]}],link:{href:`${c}/teams/`,text:"Set up a team"}},{key:"sell",name:"Sell",title:"Sell what you have.",line:"Put Routstr Core in front of any model API or your own GPU, set a price in sats, and get paid for every request.",stat:e=>e&&`${e.nodes} nodes are selling right now.`,examples:()=>[{tab:"Start a node",lines:[["$","git clone https://github.com/Routstr/routstr-core.git && cd routstr-core"],["$","python3 scripts/node_setup.py start \\"],["","    --public-url https://node.example.com \\"],["","    --ln-address you@wallet.com","where your sats go"]]}],link:{href:`${c}/provider/quickstart/`,text:"Run a node"}}];var v=s(1018);let w={key:4.6,pay:0,api:5.6,route:6.4,private:0,found:7.2,teams:0,sell:5.2},_={key:2.4,pay:1,api:4.2,route:2.6,private:1,found:5.6,teams:1,sell:3.6},g=`#version 300 es
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
uniform vec4 u_node[6];
uniform vec4 u_ns[6];
uniform vec4 u_end[7];
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
  if (s < 0.3) {
    // from you to your key; a team comes in from several people at once
    u = s / 0.3;
    vec3 S = u_src.xyz + vec3(0.0, (a_lane.z - 2.0) * u_src.w, (sd.z - 0.5) * 0.4) * u_spread;
    float L = distance(S, K);
    p0 = S; p1 = S + u_dir * L * 0.42; p2 = K - u_dir * L * 0.36; p3 = K;
    r = (0.03 + 0.12 * bulge(u) * (1.0 - 0.6 * u_spread)) * body * tight + u_ring * near(u);
    turn = sd.y * TAU + (u - 1.0) * (2.6 + 1.6 * sd.z) + t * 0.12 * spin + t * 0.35 * near(u);
  } else if (s < 0.62) {
    // from your key out to a node; a node that fails snaps, and its line hangs
    u = (s - 0.3) / 0.32;
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
    u = (s - 0.62) / 0.38;
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
  vec4 next = u_mvp * vec4(at(a_s + 1.0 / 128.0), 1.0);
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
}`,b=`#version 300 es
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
uniform vec4 u_node[6];
uniform vec4 u_ns[6];
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
  float part = v_s < 0.3 ? 0.0 : v_s < 0.62 ? 1.0 : 2.0;
  float u = part == 0.0 ? v_s / 0.3 : part == 1.0 ? (v_s - 0.3) / 0.32 : (v_s - 0.62) / 0.38;
  // from you up to your node, and from your key on: the stretches money travels
  float toNode = part < 2.0 ? v_s / 0.62 : 1.0;

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
  col += gold * exp(-abs(v_s - 0.3) * 40.0) * u_fill.z * 2.0;

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
  bright *= 1.0 - 0.6 * exp(-abs(v_s - 0.3) * 16.0);
  bright *= 1.0 - 0.45 * exp(-abs(v_s - 0.62) * 22.0);
  float fog = mix(1.0, 0.3, smoothstep(4.6, 8.6, v_depth));
  o = vec4(col * edge * fog * v_soft * show * bright * u_gain, 1.0);
}`,x="u_time u_width u_blur u_ring u_spread u_fan u_seal u_mvp u_res u_touch u_src u_key u_dir u_node u_ns u_end u_flow u_gain u_in u_any u_pay u_sell u_fill".split(" ");function k(e,t,s,a){let o=Math.tan(v.Wo/2)*v._P,n=e/t*o,i=t=>(t/e*2-1)*n,r=e-s,l=Array.from({length:6},(e,t)=>{let a=2*t/5-1;return[i(s+r*(.5-.05*a*a)),-a*o*.56,.3*Math.sin(1.7*t+.4)]}),u=Array.from({length:7},(t,s)=>{let a=2*s/6-1;return[i(e-r*(.05+.04*a*a)),-a*o*.72,.25*Math.sin(2.3*s+1.1)]});return{source:a?[i(a.x),(1-a.y/t*2)*o,0]:[i(-.06*e),0,0],key:[i(s+.2*r),0,0],apart:.13*o,nodes:l,ends:u}}class A{constructor(e){if(this.canvas=e,this.fibre=null,this.glow=null,this.vao=null,this.indexCount=0,this.count=0,this.quality=1,this.frugal=!1,this.slow=0,this.age=0,this.frame=0,this.w=1,this.h=1,this.left=0,this.from=null,this.lay=k(1,1,0,null),this.source=null,this.mvp=new Float32Array(16),this.clock=0,this.time=0,this.flow=0,this.act=null,this.phase=0,this.grow=new Float32Array(6),this.lit=new Float32Array(6),this.cut=new Float32Array(6),this.gold=new Float32Array(6),this.broke=new Float32Array(6).fill(9),this.shown=new Float32Array(7),this.now={spread:0,fan:0,seal:0,pay:0,sell:0,any:0,fill:0,filled:0,key:0},this.pointer=[0,0],this.lean=[0,0],this.touch=[-9,-9],this.touchTo=[-9,-9],this.still=window.matchMedia("(prefers-reduced-motion: reduce)").matches,this.gl=e.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"}),this.dead=!this.gl,!this.gl)return;const t=this.gl;if(this.frugal=(0,v.MN)(t),this.frugal&&(this.quality=.5),this.fibre=(0,v.DM)(t,g,b,x),!t.getProgramParameter(this.fibre.p,t.LINK_STATUS)){this.dead=!0;return}this.glow=new v._4(t);const s=(navigator.hardwareConcurrency??4)>=8&&window.innerWidth>=1100;this.count=window.innerWidth<760?320:s?720:540,this.build(),this.resize()}build(){let e,t=this.gl,s=(e=2121,()=>{let t=Math.imul((e=e+0x6d2b79f5|0)^e>>>15,1|e);return(((t=t+Math.imul(t^t>>>7,61|t)^t)^t>>>14)>>>0)/0x100000000}),a=new Float32Array(129*this.count*20),o=new Uint32Array(128*this.count*6),n=0,i=0;for(let e=0;e<this.count;e++){let t=[s(),s(),s(),s()],r=e%6,l=Math.round(r/5*6+(s()-.5)*1.6),u=[r,.12>s()?Math.floor(7*s()):(0,v.qE)(l,0,6),Math.floor(5*s()),Math.floor(7*s())];for(let s=0;s<129;s++){for(let e of[-1,1])a.set([s/128,e,...t,...u],n),n+=10;if(s<128){let t=(129*e+s)*2;o.set([t,t+1,t+2,t+1,t+3,t+2],i),i+=6}}}this.indexCount=o.length,this.vao=t.createVertexArray(),t.bindVertexArray(this.vao),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,a,t.STATIC_DRAW),[[0,1,0],[1,1,4],[2,4,8],[3,4,24]].forEach(([e,s,a])=>{t.enableVertexAttribArray(e),t.vertexAttribPointer(e,s,t.FLOAT,!1,40,a)}),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindVertexArray(null)}resize(){this.glow&&(this.w=Math.max(1,this.canvas.clientWidth),this.h=Math.max(1,this.canvas.clientHeight),this.lay=k(this.w,this.h,this.left,this.from),this.glow.resize(this.w,this.h,this.quality),this.draw())}play(e){e!==this.act&&(this.act=e,this.phase=0)}place(e,t){this.from=e,this.left=t,this.lay=k(this.w,this.h,t,e)}point(e,t){this.pointer=[e,t],this.touchTo=[2*e,-(2*t)],this.touch[0]<-8&&(this.touch=[...this.touchTo])}leave(){this.touchTo=[-9,-9]}start(){if(cancelAnimationFrame(this.frame),this.dead||document.hidden)return;let e=this.frugal||this.still,t=performance.now(),s=!0,a=o=>{if(this.frame=requestAnimationFrame(a),e&&!s&&o-t<140)return;let n=Math.min(e?.3:.05,(o-t)/1e3);t=o,s=!1,this.age+=n,this.slow=n>.03&&this.age>4?this.slow+1:Math.max(0,this.slow-1),!e&&this.slow>24&&this.quality>.5&&(this.slow=0,this.quality*=.78,this.resize()),this.update(n),this.draw()};this.frame=requestAnimationFrame(a)}stop(){cancelAnimationFrame(this.frame)}dispose(){this.stop(),(0,v._r)(this.gl)}want(e,t){let s=Array(6).fill(1),a=Array(6).fill(0),o=Array(6).fill(0),n=Array(6).fill(0),i=Array(7).fill(0),r={spread:0,fan:0,seal:0,pay:0,sell:0,any:0,fill:0,filled:0,key:0};switch(e){case"key":r.any=.8,r.fill=(0,v.Rl)((0,v.qE)(t/1.3,0,1)),r.filled=+(t<3.8),r.key=+(t>1.25&&t<2.1),a[2]=t>1.6&&t<4.1?1:.15;break;case"pay":r.any=.8,r.pay=1,a[2]=1;break;case"api":r.any=.7,r.fan=1,a[2]=1;for(let e=0;e<7;e++)i[e]=+(t>.8+.28*e&&t<5);break;case"route":r.any=.75,o[2]=+(t>1.4&&t<4.6),a[2]=+(t<1.4||t>5.7),a[3]=+(t>1.75&&t<5.7);break;case"private":r.any=.9,r.seal=1,a[2]=1;break;case"found":for(let e=0;e<6;e++)s[e]=+(t>.5+.45*e&&t<6.6);break;case"teams":r.any=.4,r.spread=1,r.key=.45,a[2]=1;break;case"sell":r.any=.3,r.sell=1,a.fill(.45),n.fill(t<4.4?(0,v.Rl)((0,v.qE)((t-.4)/3.6,0,1)):0)}return{grow:s,lit:a,cut:o,gold:n,shown:i,all:r}}update(e){this.still||(this.time+=e,this.flow+=e),this.clock+=this.still?99:e;let t=this.act;if(t){let s=w[t];this.phase=this.still?_[t]:s?(this.phase+e)%s:this.phase+e}let s=this.clock-.9,a=this.want(s>1.3?t:null,this.phase),o=this.still?99:1,n=(t,s,a)=>t+(s-t)*(1-Math.exp(-e*o*a));for(let t=0;t<6;t++){let i=(0,v.Rl)((0,v.qE)((s-.12*t)/.7000000000000001,0,1)),r=s>1.3?a.grow[t]:i;this.grow[t]=s>1.3?n(this.grow[t],r,r?1.6:2.4):i,this.lit[t]=n(this.lit[t],a.lit[t],3.2),this.gold[t]=n(this.gold[t],a.gold[t],4),a.cut[t]&&this.cut[t]<.5&&this.broke[t]>1&&(this.broke[t]=0),this.broke[t]+=e*o,this.cut[t]=n(this.cut[t],a.cut[t],a.cut[t]?14:1.8)}for(let e=0;e<7;e++)this.shown[e]=n(this.shown[e],a.shown[e],5);let i=this.now;Object.keys(i).forEach(e=>{i[e]="fill"===e?a.all.fill:n(i[e],a.all[e],"key"===e?6:2.6)});let r=this.lay.source;this.source=this.source?this.source.map((e,t)=>n(e,r[t],5)):r,this.lean[0]+=(this.pointer[0]-this.lean[0])*.05,this.lean[1]+=(this.pointer[1]-this.lean[1])*.05,this.touch[0]+=(this.touchTo[0]-this.touch[0])*.12,this.touch[1]+=(this.touchTo[1]-this.touch[1])*.12}draw(){let e=this.gl,t=this.glow?.scene;if(!e||!this.glow||!this.fibre||!t)return;let s=this.lay,a=this.w/this.h,o=(0,v.lw)((0,v.e$)(1,-.1+.05*Math.sin(.11*this.time)+.16*this.lean[0]),(0,v.e$)(0,.05+.1*this.lean[1]));this.mvp=(0,v.lw)((0,v.lw)((0,v.fN)(v.Wo,a,.1,60),(0,v.Tl)(0,0,-v._P)),o);let n=this.now,i=this.source??s.source,r=this.fibre,l=r.u;e.bindFramebuffer(e.FRAMEBUFFER,t.fbo),e.viewport(0,0,t.w,t.h),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.useProgram(r.p),e.uniform1f(l.u_time,this.time),e.uniform1f(l.u_flow,this.flow),e.uniform1f(l.u_width,1.15*(t.w/this.w)),e.uniform1f(l.u_blur,.4),e.uniform1f(l.u_ring,.05),e.uniform1f(l.u_in,(0,v.Rl)((0,v.qE)(this.clock/.9,0,1))),e.uniformMatrix4fv(l.u_mvp,!1,this.mvp),e.uniform2f(l.u_res,t.w,t.h),e.uniform2f(l.u_touch,this.touch[0],this.touch[1]),e.uniform4f(l.u_src,i[0],i[1],i[2],s.apart),e.uniform3fv(l.u_key,s.key),e.uniform3f(l.u_dir,1,0,0),e.uniform4fv(l.u_node,new Float32Array(s.nodes.flatMap((e,t)=>[...e,this.grow[t]]))),e.uniform4fv(l.u_ns,new Float32Array(s.nodes.flatMap((e,t)=>[this.cut[t],this.lit[t],this.gold[t],this.broke[t]]))),e.uniform4fv(l.u_end,new Float32Array(s.ends.flatMap((e,t)=>[...e,this.shown[t]]))),e.uniform1f(l.u_spread,n.spread),e.uniform1f(l.u_fan,n.fan),e.uniform1f(l.u_seal,n.seal),e.uniform1f(l.u_any,n.any),e.uniform1f(l.u_pay,n.pay),e.uniform1f(l.u_sell,n.sell),e.uniform3f(l.u_fill,n.fill,n.filled,n.key),e.uniform1f(l.u_gain,.5*Math.sqrt(640/this.count)),e.bindVertexArray(this.vao),e.drawElements(e.TRIANGLES,this.indexCount,e.UNSIGNED_INT,0),e.disable(e.BLEND),this.glow.finish(this.time,a)}run(e,t=30){for(let s=0;s<e*t;s++)this.update(1/t);this.draw()}}let E=(e,t)=>{let s=(e??"").match(/\d+/g)?.map(Number);if(!s)return!1;for(let e=0;e<t.length;e++)if((s[e]??0)!==t[e])return(s[e]??0)>t[e];return!0},T=e=>e.toLowerCase().split("/").pop().replace(/:free$/,""),N=/tinfoil|\bTEE\b|E2EE/i;function $(){return(0,a.jsx)("svg",{viewBox:"0 0 16 16","aria-hidden":"true",children:(0,a.jsx)("path",{d:"M3 8h9.5M8.5 3.5 13 8l-4.5 4.5"})})}function j(){let{market:e,loading:t}=function(){let{nodes:e,loading:t,discovery:s}=(0,l.z)(),a=(0,o.useMemo)(()=>{let t=new Map;for(let s of e){let e=(0,r.kE)(s.provider);if(!e||0===s.models.length||!(0,r.Aq)(s.provider))continue;let a=t.get(e);(!a||a.provider.created_at<s.provider.created_at)&&t.set(e,s)}return Array.from(t.values())},[e]),n=(0,o.useMemo)(()=>{if(0===a.length)return null;let e=new Map,t=new Set,s=new Set;a.forEach(({models:a},o)=>{let n=new Set;for(let i of a){let a=T(i.id);N.test(`${i.id} ${i.name}`)&&(s.add(a),t.add(o));let r=e.get(a)??{nodes:0,spellings:new Map};r.spellings.set(i.id,(r.spellings.get(i.id)??0)+1),!n.has(a)&&r.nodes++,n.add(a),e.set(a,r)}});let o={nodes:0,id:"model-name"};for(let{nodes:t,spellings:s}of Array.from(e.values()))t<=o.nodes||(o={nodes:t,id:Array.from(s).sort(([e,t],[s,a])=>a-t||e.length-s.length||e.localeCompare(s))[0][0]});let n=a.map(({provider:e})=>e);return{nodes:a.length,models:e.size,backed:Array.from(e.values()).filter(e=>e.nodes>1).length,lightning:n.filter(e=>E(e.version,[0,4,2])).length,takeOut:n.filter(e=>E(e.version,[0,5,0])).length,tor:n.filter(e=>e.endpoint_urls.some(r.BP)).length,sealed:s.size,sealedNodes:t.size,model:o.id}},[a]),i=Object.values(s.relays).filter(e=>"received"===e).length;return{market:n&&{...n,found:s.nodes,relays:i},loading:t}}(),s=(0,o.useRef)(null),n=(0,o.useRef)(null),h=(0,o.useRef)(null),d=(0,o.useRef)(null),[c,p]=(0,o.useState)(0),[f,m]=(0,o.useState)(!0),[v,_]=(0,o.useState)(!1),[g,b]=(0,o.useState)(!1),x=y[c],k=e?.model??"model-name",j=(0,o.useMemo)(()=>x.examples(k),[x,k]);(0,o.useLayoutEffect)(()=>{let e=h.current,t=n.current,a=s.current;if(!e||!t||!a)return;let o=new A(e);if(o.dead)return void b(!0);d.current=o;let i=()=>o.place(window.matchMedia("(min-width: 1000px)").matches?{x:.1*e.clientWidth,y:.42*e.clientHeight}:null,0);i();let r=t=>{let s=e.getBoundingClientRect();o.point((t.clientX-s.left)/s.width-.5,(t.clientY-s.top)/s.height-.5)},l=()=>o.leave(),u=new ResizeObserver(()=>{i(),o.resize()});u.observe(t);let c=!1,p=()=>{let e=c&&!document.hidden;a.toggleAttribute("data-away",!e),e?o.start():o.stop()},f=new IntersectionObserver(([e])=>{c=e.isIntersecting,p()});return f.observe(t),t.addEventListener("pointermove",r),t.addEventListener("pointerleave",l),document.addEventListener("visibilitychange",p),()=>{o.dispose(),u.disconnect(),f.disconnect(),t.removeEventListener("pointermove",r),t.removeEventListener("pointerleave",l),document.removeEventListener("visibilitychange",p),d.current=null}},[]),(0,o.useLayoutEffect)(()=>{d.current?.play(x.key)},[x]);let P=()=>{_(!0),p(e=>(e+1)%y.length)},C=e=>{m(!1),p(e)};return(0,a.jsxs)("div",{ref:s,className:"cp-body","data-dead":g||void 0,children:[(0,a.jsx)("div",{className:"cp-list",role:"radiogroup","aria-label":"Capability","aria-describedby":"cp-about",onKeyDown:e=>{let t={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];if(!t)return;e.preventDefault();let s=(c+t+y.length)%y.length;C(s),e.currentTarget.querySelectorAll(".cp-pick")[s]?.focus()},children:y.map((e,t)=>{let s=t===c;return(0,a.jsxs)("button",{type:"button",role:"radio","aria-checked":s,tabIndex:s?0:-1,className:"cp-pick",onClick:()=>C(t),children:[(0,a.jsx)("span",{children:e.name}),f&&s&&(0,a.jsx)("i",{className:"cp-bar",style:{animationDuration:`${Math.max(w[e.key],5)+.8+2.2*!v}s`},onAnimationEnd:P})]},e.key)})}),(0,a.jsxs)("div",{className:"cp-text",children:[(0,a.jsx)("div",{className:"cp-words",children:y.map((s,o)=>{let n=o===c;return(0,a.jsxs)("div",{id:n?"cp-about":void 0,className:"cp-about","data-on":n||void 0,inert:!n,children:[(0,a.jsx)("h2",{children:s.title}),(0,a.jsx)("p",{className:"cp-line",children:s.line}),(0,a.jsx)("p",{className:"cp-stat",children:s.stat(e)??(t?"Asking the nodes…":"No node has answered. Try again in a moment.")}),(0,a.jsxs)(i(),{href:s.link.href,className:"cp-go",children:[s.link.text," ",(0,a.jsx)($,{})]})]},s.key)})}),(0,a.jsx)(u.CodePanel,{label:"Example",examples:j},`code-${x.key}`)]}),(0,a.jsx)("section",{ref:n,className:"cp-stage","aria-label":"Routstr drawn in light: you, your key, the nodes and the models, acting out the capability picked.",children:(0,a.jsx)("canvas",{ref:h,"aria-hidden":"true"})})]})}},2618:(e,t,s)=>{"use strict";s.d(t,{O:()=>a,j:()=>o});let a="https://github.com/Routstr/routstrd/releases/latest/download/install.sh",o=[["Claude Code","--claude-code"],["OpenCode","--opencode"],["Pi","--pi-agent"],["OpenClaw","--openclaw"],["Hermes","--hermes"]]},3731:(e,t,s)=>{Promise.resolve().then(s.bind(s,1511)),Promise.resolve().then(s.bind(s,5154)),Promise.resolve().then(s.bind(s,5243)),Promise.resolve().then(s.t.bind(s,7530,23)),Promise.resolve().then(s.t.bind(s,6104,23)),Promise.resolve().then(s.t.bind(s,9771,23)),Promise.resolve().then(s.t.bind(s,288,23))},7406:(e,t,s)=>{"use strict";s.d(t,{z:()=>h});var a=s(5339),o=s(4163),n=s(4802);let i="lists";function r(){return new Promise((e,t)=>{let s=indexedDB.open("routstr-node-lists",1);s.onupgradeneeded=()=>s.result.createObjectStore(i),s.onsuccess=()=>e(s.result),s.onerror=()=>t(s.error)})}async function l(){try{let e=await r(),t=await new Promise((t,s)=>{let a=e.transaction(i).objectStore(i).get("latest");a.onsuccess=()=>t(a.result),a.onerror=()=>s(a.error)});return e.close(),t&&Date.now()-t.at<6048e5&&t.nodes.length>0?t.nodes:null}catch{return null}}async function u(e){try{let t=await r();t.transaction(i,"readwrite").objectStore(i).put({at:Date.now(),nodes:e},"latest"),t.close()}catch{}}function h(){let[e,t]=(0,a.useState)([]),[s,i]=(0,a.useState)(!0),[r,h]=(0,a.useState)(n.KC);return(0,a.useEffect)(()=>{let e=!0,s=0;return(async()=>{let a=await l();if(!e)return;a&&(t(a),i(!1));let n=[],r=[],d=()=>{s=0;let a=r;r=[],e&&0!==a.length&&t(e=>{let t=new Set(a.map(e=>e.provider.pubkey));return[...e.filter(e=>!t.has(e.provider.pubkey)),...a]})};await (0,o.ZC)((e,t)=>{let o={provider:e,models:t};n.push(o),!a&&(r=[...r.filter(t=>t.provider.pubkey!==e.pubkey),o],s||(s=window.setTimeout(d,500)))},t=>{e&&h(t)}),window.clearTimeout(s),d();let c=Array.from(new Map(n.map(e=>[e.provider.pubkey,e])).values()),p=c.some(e=>e.models.length>0);e&&a&&p&&t(c),e&&i(!1),p&&u(c)})(),()=>{e=!1,window.clearTimeout(s)}},[]),{nodes:e,loading:s,discovery:r}}},7866:(e,t,s)=>{"use strict";s.d(t,{CodePanel:()=>i,I:()=>n});var a=s(5787),o=s(5339);s(8991);let n="back";function i({label:e,examples:t,under:s}){let[r,l]=(0,o.useState)(0),[u,h]=(0,o.useState)(null),d=(0,o.useRef)(0),c=t[r],p=async()=>{try{await navigator.clipboard.writeText(c.lines.filter(([e])=>e!==n).map(([,e])=>e).join("\n").trimEnd()),h(c),window.clearTimeout(d.current),d.current=window.setTimeout(()=>h(null),1500)}catch{}};return(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"rd-code",children:[(0,a.jsxs)("div",{className:"rd-bar",children:[(0,a.jsx)("div",{role:"tablist","aria-label":e,onKeyDown:e=>{let s={ArrowRight:1,ArrowLeft:-1}[e.key];if(!s||e.altKey||e.metaKey||e.ctrlKey)return;e.preventDefault();let a=(r+s+t.length)%t.length;l(a),e.currentTarget.children[a]?.focus()},children:t.map((e,t)=>(0,a.jsx)("button",{type:"button",role:"tab","aria-selected":t===r,tabIndex:t===r?0:-1,onClick:()=>l(t),children:e.tab},e.tab))}),(0,a.jsx)("button",{type:"button",className:"rd-copy",onClick:p,children:u===c?"Copied":"Copy"})]}),(0,a.jsx)("div",{className:"rd-code-body",children:t.map((e,t)=>(0,a.jsx)("pre",{role:"tabpanel","data-on":t===r||void 0,"aria-hidden":t!==r||void 0,children:e.lines.map(([e,t,s],o)=>(0,a.jsxs)("span",{className:e===n?"rd-back":void 0,children:[e&&e!==n&&(0,a.jsxs)("i",{children:[e," "]}),t,s&&(0,a.jsx)("em",{children:`  # ${s}`}),"\n"]},o))},e.tab))})]}),s&&(0,a.jsx)("p",{className:"rd-under",children:s})]})}},8991:()=>{},9771:()=>{}},e=>{e.O(0,[1846,7995,633,2490,5492,7441,541,2248,2988,7232,1522,7358],()=>e(e.s=3731)),_N_E=e.O()}]);