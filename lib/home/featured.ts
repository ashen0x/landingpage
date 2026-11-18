import type { RadarRow } from "@/lib/price-radar";

// One model per family, the one most nodes sell.
const FAMILIES = [/claude-(opus|fable|sonnet)/, /^gpt-\d/, /deepseek/, /gemini/, /kimi/, /glm/];

export const approvedCount = (row: RadarRow) => row.entries.filter((entry) => entry.approved).length;

/** The models to show off, read from the live market: a family's best-sold model, when more than one approved node sells it. */
export function pickFeatured(rows: readonly RadarRow[]): RadarRow[] {
  return FAMILIES.flatMap((family) => {
    const best = rows
      .filter((row) => family.test(row.modelId) && !row.modelId.includes("/"))
      .sort((a, b) => approvedCount(b) - approvedCount(a) || b.modelId.localeCompare(a.modelId))[0];
    return best && approvedCount(best) > 1 ? [best] : [];
  });
}
