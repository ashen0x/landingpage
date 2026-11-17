/**
 * A model's description as the nodes give it, ready to show. The list they copy it from hands
 * out only a preview, cut mid-sentence and ended with "...". Such a text is taken back to its
 * last whole sentence. One with no whole sentence, or one that is not cut, is left as it is.
 */
export function wholeSentences(text: string): string {
  const trimmed = text.trim();
  if (!/(\.\.\.|…)$/.test(trimmed)) return trimmed;
  const body = trimmed.replace(/(\.\.\.|…)$/, "");
  // the end of a sentence: a full stop, "!" or "?" with a space after it
  const ends = Array.from(body.matchAll(/[.!?](?=\s)/g));
  const last = ends.at(-1);
  return last?.index === undefined ? trimmed : body.slice(0, last.index + 1);
}
