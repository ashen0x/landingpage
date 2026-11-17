import { AudioLines, Image as ImageIcon, Paperclip, Type, Video } from "lucide-react";

/* Each kind has a picture that cannot be taken for another: a letter for text, a
   paperclip for a file (a sheet of paper would read as text). */
const PICTURES = { text: Type, image: ImageIcon, file: Paperclip, audio: AudioLines, video: Video } as const;
const ORDER = Object.keys(PICTURES);

/**
 * What a model takes in, or gives back, as small pictures in one fixed order.
 * Each is named for a pointer that rests on it and for a screen reader. A kind
 * with no clear picture (an embedding) is written out.
 */
export function Kinds({ list }: { list: readonly string[] }) {
  const place = (kind: string) => (ORDER.includes(kind) ? ORDER.indexOf(kind) : ORDER.length);
  return (
    <span className="pg-kinds">
      {[...list]
        .sort((a, b) => place(a) - place(b))
        .map((kind) => {
          const Picture = PICTURES[kind as keyof typeof PICTURES];
          return Picture ? (
            <span key={kind} role="img" aria-label={kind} title={kind}>
              <Picture aria-hidden="true" strokeWidth={1.5} />
            </span>
          ) : (
            <span key={kind}>{kind}</span>
          );
        })}
    </span>
  );
}
