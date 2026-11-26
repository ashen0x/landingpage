/** A price with its unit beside it: "129 sats" or "$0.081". A dash, for no price, stays bare. */
export function Money({ sats, children }: { sats: boolean; children: string }) {
  if (children === "—") return <>{children}</>;
  if (!sats) return <>{children.startsWith("<") ? `<$${children.slice(1)}` : `$${children}`}</>;
  return (
    <>
      {children}
      <small className="pg-unit">{" sats"}</small>
    </>
  );
}
