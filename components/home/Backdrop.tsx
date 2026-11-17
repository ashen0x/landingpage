"use client";

import { useEffect, useRef } from "react";

/* The room's backdrop, the same two shaders the chat app draws behind its
   panels: slow daylight on paper fibre, and ink in deep water at night. The
   colours come from the --sh-* tokens in globals.css, so the light and dark
   themes need nothing here. Drawn small and upscaled, 20 frames a second. */

const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

const HEAD = `precision highp float;
uniform vec2 u_res;uniform float u_t,u_speed,u_int,u_scale,u_grain,u_alpha;
uniform vec3 u_c0,u_c1,u_c2,u_c3;
float h21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 float a=h21(i),b=h21(i+vec2(1.,0.)),c=h21(i+vec2(0.,1.)),d=h21(i+vec2(1.,1.));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(11.3,7.7);a*=.5;}return s;}
`;

const CURRENT = `${HEAD}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y*u_scale;
 float t=u_t*u_speed*.055;
 vec2 q=vec2(fbm(p*1.35+vec2(.0,t)),fbm(p*1.35+vec2(5.2,1.3)-t*.76));
 vec2 r=vec2(fbm(p*2.05+2.9*q+vec2(1.7,9.2)+t*.42),fbm(p*2.05+2.7*q+vec2(8.3,2.8)-t*.3));
 float f=fbm(p*1.05+2.3*r);
 float band=f*.78+.22*fbm(p*vec2(.55,2.1)+vec2(t*.35,-t*.18));
 vec3 col=mix(u_c0,u_c1,smoothstep(.22,.78,band));
 col=mix(col,u_c2,smoothstep(.46,.98,band)*.9*u_int);
 vec2 key=vec2(-.17,.43);
 float lite=smoothstep(1.52,.0,length((p-key)*vec2(.66,1.22)));
 col=mix(col,u_c3,lite*lite*.32*u_int*(.55+.45*f));
 float haze=smoothstep(.8,.0,length((p-vec2(.55,-.5))*vec2(.7,1.)));
 col=mix(col,u_c2,haze*.08*u_int);
 col*=1.-.22*smoothstep(.55,1.45,length(p*vec2(.7,1.)));
 col+=(h21(gl_FragCoord.xy)-.5)*u_grain;
 gl_FragColor=vec4(col,u_alpha);
}`;

const FIBRE = `${HEAD}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y*u_scale;
 float t=u_t*u_speed*.05;
 float ang=t*.34+.7;
 vec2 dir=vec2(cos(ang),sin(ang));
 float day=smoothstep(-1.15,1.15,dot(p,dir));
 vec3 col=mix(u_c0,u_c2,day*.70+.16);
 float cloud=fbm(p*2.4+vec2(t*.22,-t*.09));
 col=mix(col,u_c3,smoothstep(.34,.74,cloud)*.50*u_int);
 col=mix(col,u_c1,smoothstep(.20,.80,fbm(p*4.6-vec2(t*.17,t*.05)))*.34*u_int);
 float fib=vn(gl_FragCoord.xy*vec2(.85,.20))*.5+vn(gl_FragCoord.xy*vec2(.20,.85))*.5;
 col+=(fib-.5)*.030;
 col*=1.-.075*smoothstep(.5,1.35,length(p*vec2(.78,1.)));
 col+=(h21(gl_FragCoord.xy)-.5)*u_grain;
 gl_FragColor=vec4(col,u_alpha);
}`;

const SOURCES: Record<string, string> = { current: CURRENT, fibre: FIBRE };
const UNIFORMS = [
  "u_res", "u_t", "u_speed", "u_int", "u_scale", "u_grain", "u_alpha",
  "u_c0", "u_c1", "u_c2", "u_c3",
] as const;

type Vec3 = [number, number, number];
type Look = { id: string; c: Vec3[]; speed: number; int: number; scale: number; grain: number };
type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

const QUALITY = 0.3;
const FRAME_MS = 50;
const FADE_MS = 900;

function hex(value: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readLook(): Look {
  const cs = getComputedStyle(document.documentElement);
  const g = (name: string) => cs.getPropertyValue(name).trim();
  return {
    id: g("--sh-id") || "current",
    c: [hex(g("--sh-c0")), hex(g("--sh-c1")), hex(g("--sh-c2")), hex(g("--sh-c3"))],
    speed: parseFloat(g("--sh-speed")) || 0.4,
    int: parseFloat(g("--sh-intensity")) || 1,
    scale: parseFloat(g("--sh-scale")) || 1,
    grain: parseFloat(g("--sh-grain")) || 0.03,
  };
}

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: "low-power",
    });
    // No WebGL: the flat room colour behind the canvas is the fallback.
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const programs: Record<string, Program | null> = {};
    const program = (id: string) => {
      if (id in programs) return programs[id];
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
      };
      const vert = compile(gl.VERTEX_SHADER, VERT);
      const frag = compile(gl.FRAGMENT_SHADER, SOURCES[id] ?? CURRENT);
      if (!vert || !frag) return (programs[id] = null);
      const p = gl.createProgram()!;
      gl.attachShader(p, vert);
      gl.attachShader(p, frag);
      gl.bindAttribLocation(p, 0, "a");
      gl.linkProgram(p);
      const u: Program["u"] = {};
      for (const name of UNIFORMS) u[name] = gl.getUniformLocation(p, name);
      return (programs[id] = { p, u });
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let look = readLook();
    let previous: Look | null = null;
    let fadeStart = 0;
    let time = 0;
    let last = 0;
    let frame = 0;

    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth * QUALITY));
      const h = Math.max(2, Math.round(canvas.clientHeight * QUALITY));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };

    const paint = (l: Look, alpha: number) => {
      const prog = program(l.id);
      if (!prog) return;
      gl.useProgram(prog.p);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(prog.u.u_res, canvas.width, canvas.height);
      gl.uniform1f(prog.u.u_t, time);
      gl.uniform1f(prog.u.u_speed, l.speed);
      gl.uniform1f(prog.u.u_int, l.int);
      gl.uniform1f(prog.u.u_scale, l.scale);
      gl.uniform1f(prog.u.u_grain, l.grain);
      gl.uniform1f(prog.u.u_alpha, alpha);
      l.c.forEach((c, i) => gl.uniform3f(prog.u[`u_c${i}`], c[0], c[1], c[2]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const draw = (now: number) => {
      const fade = previous ? Math.min(1, (now - fadeStart) / FADE_MS) : 1;
      if (previous && fade < 1) {
        paint(previous, 1);
        paint(look, fade * fade * (3 - 2 * fade));
      } else {
        previous = null;
        paint(look, 1);
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      time += Math.min(0.1, (now - last) / 1000);
      last = now;
      draw(now);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (document.hidden) return;
      if (reduced.matches) {
        draw(performance.now() + FADE_MS);
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onTheme = () => {
      previous = look;
      look = readLook();
      fadeStart = performance.now();
      start();
    };
    const onResize = () => {
      resize();
      draw(performance.now());
    };

    resize();
    draw(performance.now());
    start();

    const themeWatch = new MutationObserver(onTheme);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      themeWatch.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={ref} className="rm-backdrop" aria-hidden="true" />;
}
