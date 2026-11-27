/* The word of the headline that changes is spun out of the light. The spindle gathers all its
   fibres in one point; the word's threads run out of that same point, each along one smooth line
   to its own place in a letter, and lie down there. When the word's time is up they are drawn back
   into the point the same way. The threads are drawn on a canvas laid over the headline. While
   nothing moves the real word stands in the page and the canvas is empty. */

/** One thread: where it lies in its word (a stroke along one row of a letter), how late it moves,
    and a number of its own, so it sways unlike its neighbours. */
type Thread = { x0: number; x1: number; y: number; wait: number; own: number };
/** A word taken apart: its threads, measured from its top left corner, and its face, the word
    drawn as the page sets it. A thread that lies still shows the piece of the face it covers. */
type Word = { threads: Thread[]; face: HTMLCanvasElement };

/** A word's threads being drawn back into the light. */
const OUT_MS = 1250;
/** The next word's threads set out this long after the old ones start to go. */
const LAG_MS = 520;
/** Threads running out of the light and lying down. */
const IN_MS = 1650;
/** The real word takes the place of the threads that lie still. */
const SET_MS = 320;
/** How far through its time the last thread of a word starts to move: the first letter leads. */
const STAGGER = 0.5;
/** A thread on its way is drawn at one of this many strengths, and one that lies in its letter,
    showing its piece of it, at one of this many. */
const STEPS = 6;
const SLABS = 5;
/** The share of a word's threads that are seen in the air. */
const FLY = 0.34;

const woven = new Map<string, Word>();
/** Room left around a word's box for letters that reach out of it. */
const edgeOf = (size: number) => Math.ceil(size * 0.25);

/** Take a word apart: draw it as the page has it (each letter where the page puts it, so spacing
    and kerning are the page's own), then cut every row of it, `gap` apart, into the strokes it
    crosses. */
function weave(word: HTMLElement, gap: number, dense: number): Word | null {
  const style = getComputedStyle(word);
  const text = word.textContent ?? "";
  const box = word.getBoundingClientRect();
  const key = [text, style.fontWeight, style.fontSize, style.fontFamily, Math.round(box.width), dense].join(" ");
  const kept = woven.get(key);
  if (kept) return kept;

  const letters = word.firstChild;
  const face = document.createElement("canvas");
  const pen = face.getContext("2d", { willReadFrequently: true });
  if (!letters || !pen || box.width === 0) return null;
  // an empty inline block stands on the baseline of the line it is put in
  const foot = document.createElement("i");
  foot.style.cssText = "display:inline-block;width:0;height:0";
  word.append(foot);
  const base = foot.getBoundingClientRect().bottom - box.top;
  foot.remove();

  const edge = edgeOf(parseFloat(style.fontSize));
  face.width = Math.ceil((box.width + edge * 2) * dense);
  face.height = Math.ceil((box.height + edge * 2) * dense);
  pen.scale(dense, dense);
  pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const span = document.createRange();
  for (let i = 0; i < text.length; i++) {
    span.setStart(letters, i);
    span.setEnd(letters, i + 1);
    pen.fillText(text[i], span.getBoundingClientRect().left - box.left + edge, base + edge);
  }

  const { data, width, height } = pen.getImageData(0, 0, face.width, face.height);
  const threads: Thread[] = [];
  for (let y = gap / 2 - edge; y < box.height + edge; y += gap) {
    // a thread stands for its whole row, so a stroke counts wherever any line of the row has ink
    const top = Math.max(0, Math.round((y - gap / 2 + edge) * dense));
    const end = Math.min(height, Math.max(top + 1, Math.round((y + gap / 2 + edge) * dense)));
    let from = -1;
    for (let x = 0; x <= width; x++) {
      let inked = false;
      for (let line = top; line < end && !inked && x < width; line++) inked = data[(line * width + x) * 4 + 3] > 20;
      if (inked && from < 0) from = x;
      if (!inked && from >= 0) {
        const x0 = from / dense - edge;
        const x1 = x / dense - edge;
        const along = Math.min(1, Math.max(0, (x0 + x1) / 2 / box.width));
        threads.push({
          x0,
          x1,
          y,
          wait: (along * 0.86 + Math.random() * 0.14) * STAGGER,
          own: Math.random(),
        });
        from = -1;
      }
    }
  }
  if (woven.size > 8) woven.clear();
  const made = { threads, face };
  woven.set(key, made);
  return made;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const paths = (count: number) => Array.from({ length: count }, () => new Path2D());

const ease = (x: number) => x * x * (3 - 2 * x);

/** Draw the word that stands back into the light and spin the next one out of it. `ends` says
    where the light gathers its fibres, in pixels of the screen: it has two such points, one at
    each end (none when there is no light: the threads then come from beyond the right edge).
    `landed` is called when the next word's threads lie still, so the page can show the real word
    under them. Returns a way to stop at once, which also lands the word if it has not landed yet. */
export function blow(
  air: HTMLCanvasElement,
  from: HTMLElement,
  to: HTMLElement,
  ends: () => [number, number][],
  landed: () => void
): () => void {
  const draw = air.getContext("2d");
  const host = air.parentElement;
  const plate = document.createElement("canvas");
  const press = plate.getContext("2d");
  const size = parseFloat(getComputedStyle(from).fontSize);
  const gap = Math.max(1.25, size / 46);
  const dense = Math.min(2, window.devicePixelRatio || 1);
  const leaving = weave(from, gap, dense);
  const coming = weave(to, gap, dense);
  if (!draw || !press || !host || !leaving || !coming) {
    landed();
    return () => {};
  }
  const around = host.getBoundingClientRect();
  const word = from.getBoundingClientRect();
  const ink = getComputedStyle(from).color;
  const edge = edgeOf(size);
  const screen = document.documentElement;
  const nowhere: [number, number] = [screen.clientWidth + size, word.top + word.height / 2];
  // The threads run to the nearer end of the light, unless that end stands over the word, where
  // they would have to cross the line above it: then to the other, if that one is more level.
  const middle = [word.left + word.width / 2, word.top + word.height / 2];
  const steep = (end: [number, number]) => Math.abs(end[1] - middle[1]) / (Math.abs(end[0] - middle[0]) || 1);
  const far = (end: [number, number]) => Math.hypot(end[0] - middle[0], end[1] - middle[1]);
  const found = ends();
  const order = found.map((_, i) => i).sort((a, b) => far(found[a]) - far(found[b]));
  const which = order.find((i) => steep(found[i]) < 1.2) ?? order[0];
  const first = found[which] ?? nowhere;
  // The canvas: as wide as the page, and tall enough to hold the word and the point the threads
  // run to. It starts a whole number of pixels up and left of the word. The browser sets both on
  // whole pixels of the screen by the same rounding, so a word drawn at that whole offset stands
  // exactly where the page stands the real one.
  const room = Math.ceil(size * 0.5);
  const up = Math.ceil(Math.min(word.top, Math.max(room, word.top - first[1] + room)));
  const under = Math.ceil(Math.min(screen.clientHeight - word.bottom, Math.max(room, first[1] - word.bottom + room)));
  const lead = Math.ceil(word.left);
  const wide = screen.clientWidth + 1;
  const tall = up + Math.ceil(word.height) + Math.max(0, under);
  air.style.left = `${word.left - lead - around.left}px`;
  air.style.top = `${word.top - up - around.top}px`;
  air.style.width = `${wide}px`;
  air.style.height = `${tall}px`;
  air.width = Math.round(wide * dense);
  air.height = Math.round(tall * dense);
  plate.width = leaving.face.width;
  plate.height = leaving.face.height;

  const thin = Math.max(0.8, Math.min(1.1, size / 110));
  // Which way the threads leave the point, and from which side they reach their rows. With the
  // light beside the word they leave it level and come along the rows from that side; with the
  // light over the word they drop from it first and turn into the rows.
  const over = steep(first) >= 1.2;
  const side = first[0] > middle[0] ? 1 : -1;

  /** Add one thread to the paths. `gone` runs from 0, lying in its letter, to 1, drawn wholly into
      the point. Every thread fades out of its letter on the way; one in three is also seen in the
      air, or there would be a cloud, not threads. Its near end runs ahead along the thread's line
      to the point, so for a moment it spans the whole way, and then its far end follows. */
  const lay = (thread: Thread, gone: number, at: [number, number], time: number, slabs: Path2D[], strands: Path2D[]) => {
    const lies = 1 - ease(clamp(gone / 0.42));
    if (lies > 0) {
      const slab = slabs[Math.min(SLABS - 1, Math.floor(lies * SLABS))];
      slab.moveTo(thread.x0 - 0.5, thread.y);
      slab.lineTo(thread.x1 + 0.5, thread.y);
    }
    if (gone <= 0 || thread.own > FLY) return;
    // the line from the thread's place (0) to the point (1), and the stretch of it the thread covers
    const head = ease(clamp(gone / 0.6));
    const tail = ease(clamp((gone - 0.4) / 0.6));
    const strand = strands[Math.min(STEPS - 1, Math.floor(Math.min(1, gone / 0.14, (1 - gone) / 0.14) * STEPS))];
    const own = (thread.own / FLY) % 1;
    const x0 = side > 0 ? thread.x1 : thread.x0;
    const y0 = thread.y;
    const [x3, y3] = at;
    const dx = x3 - x0;
    const dy = y3 - y0;
    const length = Math.hypot(dx, dy) || 1;
    let x1: number, y1: number, x2: number, y2: number;
    if (over) {
      x1 = x0 + side * (Math.abs(dx) * 0.5 + 6);
      y1 = y0;
      x2 = x3;
      y2 = y3 - dy * 0.55;
    } else {
      // far from the point a thread leaves its row level and comes in level, a long slow bend;
      // close under it there is no room to bend, and it runs nearly straight
      const straight = clamp((1.5 * Math.abs(dy)) / (Math.abs(dx) + Math.abs(dy)) - 0.25);
      const reach = length * (0.32 + 0.2 * own);
      const ax = side * (1 - straight) + (dx / length) * straight;
      const ay = (dy / length) * straight;
      const a = Math.hypot(ax, ay) || 1;
      x1 = x0 + (ax / a) * reach;
      y1 = y0 + (ay / a) * reach;
      const bx = -side * (1 - straight) - (dx / length) * straight;
      const by = -(dy / length) * straight;
      const b = Math.hypot(bx, by) || 1;
      x2 = x3 + (bx / b) * reach;
      y2 = y3 + (by / b) * reach;
    }
    const pieces = Math.min(40, Math.max(3, Math.ceil(((head - tail) * length) / 11)));
    for (let i = 0; i <= pieces; i++) {
      const t = tail + ((head - tail) * i) / pieces;
      const u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      // a thread in the air sways a little, most where it is furthest from both its ends
      const sway = size * 0.03 * Math.sin(Math.PI * t) * Math.sin(time * 2.3 + own * 6.28 + t * 2.6);
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 + sway;
      if (i === 0) strand.moveTo(x, y);
      else strand.lineTo(x, y);
    }
  };

  /** Show the threads that lie in their letters: each covers its row, and the word's face cuts
      the rows to the true edge of the letters. */
  const ground = (slabs: Path2D[], face: HTMLCanvasElement) => {
    press.globalCompositeOperation = "source-over";
    press.setTransform(1, 0, 0, 1, 0, 0);
    press.clearRect(0, 0, plate.width, plate.height);
    press.setTransform(dense, 0, 0, dense, edge * dense, edge * dense);
    press.strokeStyle = ink;
    press.lineWidth = gap + 0.8;
    for (let i = 0; i < SLABS; i++) {
      press.globalAlpha = (i + 1) / SLABS;
      press.stroke(slabs[i]);
    }
    press.globalAlpha = 1;
    press.globalCompositeOperation = "destination-in";
    press.setTransform(1, 0, 0, 1, 0, 0);
    press.drawImage(face, 0, 0);
    draw.globalAlpha = 1;
    draw.drawImage(plate, -edge, -edge, plate.width / dense, plate.height / dense);
  };

  /** One word's threads, each as far gone as `gone` says. */
  const show = (threads: Thread[], face: HTMLCanvasElement, gone: (thread: Thread) => number, at: [number, number], time: number) => {
    const slabs = paths(SLABS);
    const strands = paths(STEPS);
    for (const thread of threads) {
      const far = gone(thread);
      if (far < 1) lay(thread, far, at, time, slabs, strands);
    }
    ground(slabs, face);
    for (let step = 0; step < STEPS; step++) {
      draw.globalAlpha = (0.6 * (step + 1)) / STEPS;
      draw.stroke(strands[step]);
    }
  };

  let frame = 0;
  let down = false;
  let done = false;
  const start = performance.now();
  const land = () => {
    if (down) return;
    down = true;
    landed();
  };
  const end = () => {
    done = true;
    cancelAnimationFrame(frame);
    draw.setTransform(1, 0, 0, 1, 0, 0);
    draw.clearRect(0, 0, air.width, air.height);
    land();
  };

  const tick = (now: number) => {
    if (done) return;
    const ms = now - start;
    const out = ms / OUT_MS;
    const into = (ms - LAG_MS) / IN_MS;
    // once every thread lies still the real word fades in under them, then they are taken away
    const settled = ms - LAG_MS - IN_MS;
    if (settled >= 0) land();
    if (settled >= SET_MS) return end();

    draw.setTransform(1, 0, 0, 1, 0, 0);
    draw.clearRect(0, 0, air.width, air.height);
    draw.setTransform(dense, 0, 0, dense, lead * dense, up * dense);
    draw.strokeStyle = ink;
    draw.lineWidth = thin;
    draw.lineJoin = "round";
    // the point, which drifts a little as the light turns, measured from the word's corner
    const point = ends()[which] ?? first;
    const at: [number, number] = [point[0] - word.left, point[1] - word.top];
    // the word that goes is taken from the end nearest the point; the one that comes is laid from its first letter
    if (out < 1) show(leaving.threads, leaving.face, (thread) => clamp((out - (side > 0 ? STAGGER - thread.wait : thread.wait)) / (1 - STAGGER)), at, ms / 1000);
    if (into > 0) show(coming.threads, coming.face, (thread) => 1 - clamp((into - thread.wait) / (1 - STAGGER)), at, ms / 1000);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    if (!done) end();
  };
}
