const UPPER = new Set(["gpt", "glm", "ai", "oss", "xl", "hd", "tts"]);
const NAMES: Record<string, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  minimax: "MiniMax",
  qwen: "Qwen",
};

/** claude-opus-5.5 -> Claude Opus 5.5, gpt-6.1-sol -> GPT-6.1 Sol. */
export function prettyModel(id: string): string {
  const parts = id.slice(id.lastIndexOf("/") + 1).split("-").filter(Boolean);
  const words = parts.map((part) => {
    const lower = part.toLowerCase();
    if (UPPER.has(lower)) return lower.toUpperCase();
    if (NAMES[lower]) return NAMES[lower];
    return part.charAt(0).toUpperCase() + part.slice(1);
  });
  // GPT keeps the dash before its version, as OpenAI writes it.
  if (words[0] === "GPT" && words.length > 1) {
    return [`GPT-${words[1]}`, ...words.slice(2)].join(" ");
  }
  return words.join(" ");
}

/** Sats for a price row: whole numbers from 100, then one or two decimals. */
export function formatSats(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString("en-US");
  return value.toFixed(value >= 10 ? 1 : 2);
}

/** 306234 -> 306K, 6712000000 -> 6.7B. */
export function compact(value: number): string {
  for (const [limit, unit] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as const) {
    if (value >= limit) {
      const scaled = value / limit;
      return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}${unit}`;
    }
  }
  return Math.round(value).toLocaleString("en-US");
}
