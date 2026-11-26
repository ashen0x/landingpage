(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[2248],{1018:(e,t,s)=>{"use strict";s.d(t,{DM:()=>o,MN:()=>n,Rl:()=>v,Tl:()=>c,Wo:()=>g,_4:()=>l,_P:()=>p,_r:()=>x,e$:()=>d,fN:()=>f,hs:()=>_,lw:()=>u,qE:()=>m});let i=`#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,r=`#version 300 es
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
}`,a=`#version 300 es
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
}`;function o(e,t,s,i){let r=e.createProgram();for(let[i,a]of[[e.VERTEX_SHADER,t],[e.FRAGMENT_SHADER,s]]){let t=e.createShader(i);e.shaderSource(t,a),e.compileShader(t),e.getShaderParameter(t,e.COMPILE_STATUS)||console.warn(e.getShaderInfoLog(t)),e.attachShader(r,t)}e.linkProgram(r);let a={};for(let t of i)a[t]=e.getUniformLocation(r,t);return{p:r,u:a}}function n(e){let t=e.getExtension("WEBGL_debug_renderer_info");return/swiftshader|llvmpipe|software|basic render/i.test(String(e.getParameter(t?t.UNMASKED_RENDERER_WEBGL:e.RENDERER)))}class l{constructor(e){this.gl=e,this.targets=[],this.float=!!e.getExtension("EXT_color_buffer_float")||!!e.getExtension("EXT_color_buffer_half_float"),this.blur=o(e,i,r,["u_tex","u_step"]),this.final=o(e,i,a,["u_scene","u_glow","u_haze","u_time","u_aspect"]),this.quad=e.createVertexArray(),e.bindVertexArray(this.quad),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}get scene(){return this.targets[0]}resize(e,t,s){let i=this.gl,r=i.canvas,a=Math.min(window.devicePixelRatio||1,2,Math.sqrt(37e5/(e*t)))*s;for(let s of(r.width=Math.max(2,Math.round(e*a)),r.height=Math.max(2,Math.round(t*a)),this.targets))i.deleteFramebuffer(s.fbo),i.deleteTexture(s.tex);let[o,n]=[r.width,r.height],l=[Math.ceil(o/2),Math.ceil(n/2)],h=[Math.ceil(o/6),Math.ceil(n/6)];this.targets=[this.target(o,n),this.target(...l),this.target(...l),this.target(...h),this.target(...h)]}target(e,t){let s=this.gl,i=s.createTexture();s.bindTexture(s.TEXTURE_2D,i),this.float?s.texImage2D(s.TEXTURE_2D,0,s.RGBA16F,e,t,0,s.RGBA,s.HALF_FLOAT,null):s.texImage2D(s.TEXTURE_2D,0,s.RGBA8,e,t,0,s.RGBA,s.UNSIGNED_BYTE,null),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE);let r=s.createFramebuffer();return s.bindFramebuffer(s.FRAMEBUFFER,r),s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,i,0),{fbo:r,tex:i,w:e,h:t}}finish(e,t){let s=this.gl,[i,r,a,o,n]=this.targets;s.bindVertexArray(this.quad),s.useProgram(this.blur.p),s.uniform1i(this.blur.u.u_tex,0),s.activeTexture(s.TEXTURE0);let l=(e,t,i,r)=>{s.bindFramebuffer(s.FRAMEBUFFER,t.fbo),s.viewport(0,0,t.w,t.h),s.bindTexture(s.TEXTURE_2D,e.tex),s.uniform2f(this.blur.u.u_step,i/t.w,r/t.h),s.drawArrays(s.TRIANGLES,0,3)};l(i,r,1,0),l(r,a,0,1),l(a,o,1.6,0),l(o,n,0,1.6),l(n,o,1.6,0),l(o,n,0,1.6);let h=this.final;s.bindFramebuffer(s.FRAMEBUFFER,null),s.viewport(0,0,s.drawingBufferWidth,s.drawingBufferHeight),s.useProgram(h.p),[i,a,n].forEach((e,t)=>{s.activeTexture(s.TEXTURE0+t),s.bindTexture(s.TEXTURE_2D,e.tex)}),s.uniform1i(h.u.u_scene,0),s.uniform1i(h.u.u_glow,1),s.uniform1i(h.u.u_haze,2),s.uniform1f(h.u.u_time,e),s.uniform1f(h.u.u_aspect,t),s.drawArrays(s.TRIANGLES,0,3),s.activeTexture(s.TEXTURE0)}}let h=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function u(e,t){let s=new Float32Array(16);for(let i=0;i<4;i++)for(let r=0;r<4;r++)s[4*i+r]=e[r]*t[4*i]+e[4+r]*t[4*i+1]+e[8+r]*t[4*i+2]+e[12+r]*t[4*i+3];return s}function f(e,t,s,i){let r=1/Math.tan(e/2),a=new Float32Array(16);return a[0]=r/t,a[5]=r,a[10]=(i+s)/(s-i),a[11]=-1,a[14]=2*i*s/(s-i),a}function c(e,t,s){let i=h();return i[12]=e,i[13]=t,i[14]=s,i}function d(e,t){let s=h(),i=Math.cos(t),r=Math.sin(t),[a,o]=0===e?[1,2]:1===e?[2,0]:[0,1];return s[4*a+a]=i,s[4*o+o]=i,s[4*a+o]=r,s[4*o+a]=-r,s}function _(e){let t=h();return t[0]=t[5]=t[10]=e,t}let m=(e,t,s)=>Math.min(s,Math.max(t,e)),v=e=>e*e*(3-2*e),p=6,g=.6;function x(e){if(!e)return;let t=e.canvas;window.setTimeout(()=>{t.isConnected||e.getExtension("WEBGL_lose_context")?.loseContext()},0)}},1251:(e,t,s)=>{"use strict";s.d(t,{N:()=>a});var i=s(5787),r=s(5329);function a({className:e}){return(0,i.jsx)("svg",{viewBox:`${r.sH} ${r.sH} ${r.t_} ${r.t_}`,className:e,fill:"currentColor","aria-hidden":"true",children:(0,i.jsx)("path",{d:r.cF})})}},4989:(e,t,s)=>{"use strict";s.d(t,{D:()=>h,ThemeProvider:()=>l});var i=s(5787),r=s(5339);let a="routstr-theme",o=(0,r.createContext)(void 0);function n(){let e=null;try{e=window.localStorage.getItem(a)}catch{}return"dark"===e||"light"===e?e:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function l({children:e}){let[t,s]=(0,r.useState)("dark");(0,r.useEffect)(()=>{let e=e=>{document.documentElement.classList.toggle("dark","dark"===e),s(e)},t=()=>{let t=null;try{t=window.localStorage.getItem(a)}catch{}"dark"!==t&&"light"!==t&&e(n())};e(n());let i=window.matchMedia("(prefers-color-scheme: dark)");return"addEventListener"in i?i.addEventListener("change",t):i.addListener(t),()=>{"removeEventListener"in i?i.removeEventListener("change",t):i.removeListener(t)}},[]);let h=(0,r.useCallback)(()=>{s(e=>{let t="dark"===e?"light":"dark";document.documentElement.classList.toggle("dark","dark"===t);try{window.localStorage.setItem(a,t)}catch{}return t})},[]);return(0,i.jsx)(o.Provider,{value:{theme:t,toggleTheme:h},children:e})}function h(){let e=(0,r.useContext)(o);if(!e)throw Error("useTheme must be used within a ThemeProvider");return e}},5154:(e,t,s)=>{"use strict";s.d(t,{default:()=>x});var i=s(5787),r=s(288),a=s.n(r),o=s(7717),n=s(5339),l=s(311),h=s(6810),u=s(6296),f=s(1421),c=s(255),d=s(1686),_=s(1251),m=s(4989);s(7530);let v=[{title:"Models",href:"/models"},{title:"Providers",href:"/providers"},{title:"Prices",href:"/prices"},{title:"Stats",href:"/stats"},{title:"Docs",href:"https://docs.routstr.com",external:!0}],p=[{title:"Hosted Daemon",href:"https://github.com/Routstr/routstrd-remote",note:"One daemon for a team",external:!0},{title:"Top-Up",href:"/topup",note:"Fund an API key"},{title:"Capabilities",href:"/capabilities",note:"What Routstr can do"},{title:"Blog",href:"/blog",note:"Guides and release notes"},{title:"Roadmap",href:"/roadmap",note:"What comes next"}];function g({link:e,className:t,current:s,onClick:r}){let o=(0,i.jsxs)(i.Fragment,{children:[e.title,e.note&&(0,i.jsx)("span",{children:e.note})]});return e.external?(0,i.jsx)("a",{href:e.href,className:t,onClick:r,children:o}):(0,i.jsx)(a(),{href:e.href,className:t,"aria-current":s?"page":void 0,onClick:r,children:o})}function x(){let e=(0,o.usePathname)(),{theme:t,toggleTheme:s}=(0,m.D)(),[r,x]=(0,n.useState)(!1),[w,E]=(0,n.useState)(!1),b=(0,n.useRef)(null),T=(0,n.useRef)(null),k=()=>x(!1);return(0,n.useEffect)(()=>{let e=()=>E(window.scrollY>24);return e(),window.addEventListener("scroll",e,{passive:!0}),()=>window.removeEventListener("scroll",e)},[]),(0,n.useEffect)(()=>{if(!r)return;T.current&&b.current?.style.setProperty("--more",`${T.current.offsetLeft-18}px`);let e=e=>"Escape"===e.key&&x(!1),t=e=>{b.current?.contains(e.target)||x(!1)};return window.addEventListener("keydown",e),window.addEventListener("pointerdown",t),()=>{window.removeEventListener("keydown",e),window.removeEventListener("pointerdown",t)}},[r]),(0,i.jsxs)("header",{ref:b,className:"hd","data-scrolled":w||void 0,"data-open":r||void 0,children:[(0,i.jsxs)("div",{className:"hd-bar",children:[(0,i.jsxs)(a(),{href:"/",className:"hd-brand",onClick:k,children:[(0,i.jsx)(_.N,{}),"routstr"]}),(0,i.jsxs)("nav",{className:"hd-nav","aria-label":"Main",children:[v.map(t=>(0,i.jsx)(g,{link:t,className:"hd-link",current:e.startsWith(t.href)},t.href)),(0,i.jsxs)("button",{ref:T,type:"button",className:"hd-link","aria-expanded":r,onClick:()=>x(e=>!e),children:["More ",(0,i.jsx)(l.A,{})]})]}),(0,i.jsx)("a",{href:"https://github.com/Routstr",className:"hd-link hd-quiet",children:"GitHub"}),(0,i.jsx)("button",{type:"button",className:"hd-icon hd-theme",onClick:s,"aria-label":"dark"===t?"Switch to the light theme":"Switch to the dark theme",children:"dark"===t?(0,i.jsx)(h.A,{}):(0,i.jsx)(u.A,{})}),(0,i.jsxs)(a(),{href:"/routstrd",className:"hd-pill",onClick:k,children:["Get routstrd ",(0,i.jsx)(f.A,{strokeWidth:1.5})]}),(0,i.jsx)("button",{type:"button",className:"hd-icon hd-menu","aria-expanded":r,"aria-label":r?"Close the menu":"Open the menu",onClick:()=>x(e=>!e),children:r?(0,i.jsx)(c.A,{}):(0,i.jsx)(d.A,{})})]}),r&&(0,i.jsxs)("div",{className:"hd-panel",children:[(0,i.jsx)("div",{className:"hd-panel-phone",children:v.map(e=>(0,i.jsx)(g,{link:e,onClick:k},e.href))}),p.map(e=>(0,i.jsx)(g,{link:e,onClick:k},e.href)),(0,i.jsx)("div",{className:"hd-panel-phone",children:(0,i.jsx)("button",{type:"button",onClick:s,children:"dark"===t?"Light theme":"Dark theme"})})]})]})}},5329:(e,t,s)=>{"use strict";s.d(t,{cF:()=>a,sH:()=>i,t_:()=>r});let i=160,r=704,a="M639.1 281.7c-4.4 2.2-7.1 6.7-7.1 12.1 0 5.1 2.2 9.3 6 11.6 2.4 1.4 6.8 1.6 31.9 1.6 19.1 0 29.1.3 29.1 1 0 2.2-20.6 23.3-103.2 105.7-73.6 73.5-85.8 85.3-89.3 86.2-2.4.7-15.8 1.1-33.9 1.1h-30l-47.3-47.3-47.3-47.2 2-6.3c2.5-7.8 2.6-19.7.4-27.3-.9-3-2.9-7.7-4.5-10.6-3.3-5.8-12.2-14.4-18-17.4-5.3-2.7-14.4-4.9-20.2-4.9-8.1 0-18.1 2.8-24.4 6.9-7.3 4.7-12.4 10.4-16.1 17.8-5.2 10.4-6.5 21-3.7 31.8 4.3 16.4 18.6 29.4 36 32.6 7.2 1.3 14.9.6 23-2.2l6-2.1 44.5 44.6c24.5 24.6 44.6 45 44.7 45.4s-19.2 20.4-43 44.5l-43.2 43.8-5.5-2.5c-7.9-3.6-18.2-5-26.2-3.6-8.9 1.6-17.9 6.2-24.2 12.4-11.1 10.8-15.8 27-12.5 42.8 3.8 18 19.3 32.8 37.7 36 9.1 1.5 17.1.1 26.9-4.7 13-6.4 22.1-19.4 24.4-34.8.9-6.2.8-8.9-.4-14.9-.8-4-1.8-8-2.2-8.9-.4-1.2 12-14.3 46.6-49.3l47.1-47.6h31.4c19.2 0 33.4-.4 36.6-1.1 13.4-2.8 8.8 1.3 112.6-102.3l96.2-96.1.1 4.5c0 2.5 0 14.2-.1 26.1-.1 24 .3 26.5 5.9 31.2 2.5 2.1 4.3 2.7 7.8 2.7 5.7 0 10.5-2.8 12.7-7.4 1.4-3 1.6-9.3 1.6-50.1 0-40.3-.2-47-1.6-49.6-3-5.8-3.7-5.9-56.1-5.9-42.5 0-48.2.2-51.2 1.7m77.3 172.2c-3.2 1.9-6.4 7.4-6.4 10.9 0 4.5 2.7 8.3 15.2 21 7.9 8 12.7 13.7 12.2 14.2s-25.8 1-58.9 1.2l-58 .3-6 2.4c-5.5 2.2-8.9 5.3-38.9 35-18.1 17.9-36.4 36.6-40.8 41.6-4.3 4.9-9 11.2-10.3 13.9-3.5 6.9-3.4 13.8.3 20.5 1.9 3.5 12.6 15.1 35.1 37.7 31.2 31.5 32.3 32.7 31.6 35.8-.3 1.7-.9 6-1.2 9.6-.6 7.7 1.4 17.6 5.3 25.2 3.9 7.7 12 15.2 21.1 19.6 7.6 3.6 8.1 3.7 19.3 3.7 10.9 0 11.9-.2 18.3-3.2 9.5-4.5 17.8-12.7 22.5-22.2 3.6-7.3 3.7-7.7 3.7-19s-.1-11.8-3.7-19.4c-6.8-14.1-18.8-23.2-34.5-25.9-8.8-1.5-17.9-.1-26.7 4l-6.3 3-29.7-29.7C563.3 617.8 550 604 550 603.5c0-.6 16.1-17.1 35.8-36.7 24.1-24.2 36.9-36.2 39.4-37.3 3.2-1.3 11.6-1.5 58.8-1.5 30.2 0 55 .3 55 .8 0 .4-5.2 5.9-11.6 12.2s-12.9 13.5-14.5 15.9c-1.6 2.5-2.9 5.9-2.9 7.5 0 9.8 11.3 16.7 19.8 12.2 1.5-.8 14.5-13.3 29-27.8 19.7-19.8 26.6-27.4 27.6-30.2 2.7-7.8 2.1-8.6-26.6-37.3-14.5-14.6-27.5-27.1-29-27.9-3.8-2-10.7-1.8-14.4.5"},7530:()=>{},9899:(e,t,s)=>{"use strict";s.d(t,{O:()=>l,g:()=>n});var i=s(5329),r=s(1018);let a=`#version 300 es
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
  vec4 next = u_mvp * vec4(at(a_s + 1.0 / 132.0, m), 1.0);
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
}`,o=`#version 300 es
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
}`,n=e=>Math.tan(r.Wo/2)*r._P*e;class l{constructor(e,t,s,n){if(this.canvas=e,this.poses=t,this.onStage=s,this.fibre=null,this.glow=null,this.fibreVao=null,this.logo=null,this.indexCount=0,this.count=560,this.frame=0,this.time=0,this.flow=0,this.stage=0,this.rush=0,this.pointer=[0,0],this.lean=[0,0],this.touch=[-9,-9],this.touchTarget=[-9,-9],this.rings=new Float32Array([0,0,9,0,0,9,0,0,9,0,0,9]),this.sparks=new Float32Array(4),this.sparkTargets=new Float32Array(4),this.quality=1,this.slow=0,this.age=0,this.plucked=0,this.pluckWant=0,this.w=1,this.h=1,this.lifted=0,this.frugal=!1,this.target=0,this.lift=0,this.gl=e.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"}),this.dead=!this.gl,!this.gl)return;const l=this.gl;this.frugal=(0,r.MN)(l),this.frugal&&(this.quality=.5),this.fibre=(0,r.DM)(l,a,o,["u_time","u_flow","u_from","u_to","u_mix","u_width","u_chosen","u_sparks","u_rush","u_blur","u_pluck","u_mvp","u_res","u_touch","u_gain","u_pulse","u_mark","u_ring","u_calm","u_logo"]),this.glow=new r._4(l);const h=(navigator.hardwareConcurrency??4)>=8&&window.innerWidth>=1100;this.count=n??(window.innerWidth<760?260:h?760:560),this.build(this.count),this.logo=l.createTexture(),l.bindTexture(l.TEXTURE_2D,this.logo),l.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,!0),l.texImage2D(l.TEXTURE_2D,0,l.RGBA,l.RGBA,l.UNSIGNED_BYTE,function(){let e=document.createElement("canvas");e.width=e.height=512;let t=e.getContext("2d"),s=512/i.t_;return t.fillStyle="#000",t.fillRect(0,0,512,512),t.filter="blur(1.2px)",t.setTransform(s,0,0,s,-i.sH*s,-i.sH*s),t.fillStyle="#fff",t.fill(new Path2D(i.cF)),e}()),l.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,!1),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MIN_FILTER,l.LINEAR),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MAG_FILTER,l.LINEAR),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_S,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_T,l.CLAMP_TO_EDGE),this.resize()}build(e){let t=this.gl,s=new Float32Array(133*e*14),i=new Uint32Array(132*e*6),r=0,a=0;for(let t=0;t<e;t++){let o=[Math.random(),Math.random(),Math.random(),Math.random()];for(let n=0;n<133;n++){for(let i of[-1,1])s.set([n/132,i,...o,t/(e-1)],r),r+=7;if(n<132){let e=(133*t+n)*2;i.set([e,e+1,e+2,e+1,e+3,e+2],a),a+=6}}}this.indexCount=i.length,this.fibreVao=t.createVertexArray(),t.bindVertexArray(this.fibreVao),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),[[0,1,0],[1,1,4],[2,4,8],[3,1,24]].forEach(([e,s,i])=>{t.enableVertexAttribArray(e),t.vertexAttribPointer(e,s,t.FLOAT,!1,28,i)}),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindVertexArray(null)}resize(){this.glow&&(this.w=this.canvas.clientWidth,this.h=this.canvas.clientHeight,this.glow.resize(this.w,this.h,this.quality),this.draw(0))}point(e,t){this.pointer=[e,t],this.touchTarget=[2*e,-(2*t)],this.touch[0]<-8&&(this.touch=[2*e,-(2*t)])}tap(e,t){let s=0;for(let e=1;e<4;e++)this.rings[3*e+2]>this.rings[3*s+2]&&(s=e);this.rings[3*s+2]<1.6||this.rings.set([2*e,-(2*t),0],3*s)}choose(e){for(let t=0;t<4;t++)this.sparkTargets[t]=+(t===e)}pluck(){this.pluckWant=1}start(){if(cancelAnimationFrame(this.frame),this.dead||document.hidden)return;let e=this.frugal||window.matchMedia("(prefers-reduced-motion: reduce)").matches,t=performance.now(),s=!0,i=r=>{if(this.frame=requestAnimationFrame(i),this.frugal){let e=Math.abs(this.target-this.stage)>.002||Math.abs(this.lift-this.lifted)>.002;if(!s&&(!e||r-t<140))return}let a=Math.min(this.frugal?.3:.05,(r-t)/1e3);t=r,s=!1,this.draw(a,e)};this.frame=requestAnimationFrame(i)}stop(){cancelAnimationFrame(this.frame)}dispose(){this.stop(),(0,r._r)(this.gl)}draw(e,t=!1){let s,i,a,o=this.gl,n=this.glow?.scene;if(!o||!this.glow||!this.fibre||!n)return;if(this.age+=e,this.slow=e>.03&&this.age>4?this.slow+1:Math.max(0,this.slow-1),!this.frugal&&this.slow>24&&this.quality>.5){this.slow=0,this.quality*=.78,this.resize();return}let l=this.stage;this.stage+=(this.target-this.stage)*(e?1-Math.exp(-(5*e)):1);let h=e?(0,r.qE)((this.stage-l)/e*.55,-1,1):0;this.rush+=(h-this.rush)*.08,t||(this.time+=e,this.flow+=e*(1+7*Math.abs(this.rush)));for(let t=2;t<12;t+=3)this.rings[t]=Math.min(9,this.rings[t]+e);this.pluckWant*=Math.exp(-(1.5*e)),this.plucked+=(this.pluckWant-this.plucked)*(e?1-Math.exp(-(4.5*e)):1);for(let t=0;t<4;t++)this.sparks[t]+=(this.sparkTargets[t]-this.sparks[t])*(e?1-Math.exp(-(4.5*e)):1);this.lean[0]+=(this.pointer[0]-this.lean[0])*.05,this.lean[1]+=(this.pointer[1]-this.lean[1])*.05,this.touch[0]+=(this.touchTarget[0]-this.touch[0])*.12,this.touch[1]+=(this.touchTarget[1]-this.touch[1])*.12,this.onStage?.(this.stage),this.lifted+=(this.lift-this.lifted)*(e?1-Math.exp(-(22*e)):1);let{opening:u,list:f}=this.poses(this.w,this.h),c=1,d=t?1:Math.min(1,this.time/2.6);if(d<1&&this.stage<.25)s=u,i=f[0],a=(0,r.Rl)((0,r.qE)((d-.22)/.78,0,1)),c=Math.min(1,6*d)*(1+.9*Math.exp(-Math.pow((d-.4)/.16,2)));else{let e=Math.min(f.length-1,Math.floor(this.stage));s=f[e],i=f[Math.min(f.length-1,e+1)],a=(0,r.Rl)((0,r.qE)((this.stage-e-.22)/.56,0,1))}let _=e=>s[e]+(i[e]-s[e])*a,m=this.w/this.h,v=[(0,r.Tl)(_("x"),_("y"),0),(0,r.e$)(1,_("yaw")+.1*Math.sin(.11*this.time)+.22*this.lean[0]),(0,r.e$)(0,_("pitch")+.14*this.lean[1]),(0,r.e$)(2,_("roll")),(0,r.hs)(_("scale"))].reduce(r.lw),p=(0,r.lw)((0,r.fN)(r.Wo,m,.1,60),(0,r.Tl)(0,0,-r._P)),g=(0,r.lw)((0,r.Tl)(0,2*this.lifted,0),(0,r.lw)(p,v)),x=this.fibre;o.bindFramebuffer(o.FRAMEBUFFER,n.fbo),o.viewport(0,0,n.w,n.h),o.clearColor(0,0,0,1),o.clear(o.COLOR_BUFFER_BIT),o.enable(o.BLEND),o.blendFunc(o.ONE,o.ONE),o.useProgram(x.p),o.uniform1f(x.u.u_time,this.time),o.uniform1f(x.u.u_flow,this.flow),o.uniform1f(x.u.u_from,s.form),o.uniform1f(x.u.u_to,i.form),o.uniform1f(x.u.u_mix,a),o.uniform1f(x.u.u_width,1.15*(n.w/this.w)),o.uniform1f(x.u.u_chosen,_("chosen")),o.uniform4fv(x.u.u_sparks,this.sparks),o.uniform1f(x.u.u_rush,this.rush),o.uniform1f(x.u.u_blur,_("blur")),o.uniform1f(x.u.u_pluck,this.plucked),o.uniform1f(x.u.u_mark,_("mark")),o.uniform1f(x.u.u_gain,_("gain")*c*(560/this.count)*(1+.5*Math.abs(this.rush))),o.uniform1f(x.u.u_pulse,_("pulse")*(1+1.5*Math.abs(this.rush))),o.uniformMatrix4fv(x.u.u_mvp,!1,g),o.uniform2f(x.u.u_res,n.w,n.h),o.uniform2f(x.u.u_touch,this.touch[0],this.touch[1]),o.uniform3fv(x.u.u_ring,this.rings);let w=0;for(let e=2;e<12;e+=3)this.rings[e]<1.6&&w++;o.uniform1f(x.u.u_calm,1/Math.sqrt(Math.max(1,w))),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,this.logo),o.uniform1i(x.u.u_logo,0),o.bindVertexArray(this.fibreVao),o.drawElements(o.TRIANGLES,this.indexCount,o.UNSIGNED_INT,0),o.disable(o.BLEND),this.glow.finish(this.time,m)}}}}]);