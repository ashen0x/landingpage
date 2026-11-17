import { Box } from "lucide-react";
import type { companyIn } from "@/components/stats/model-company-icon";

/** A maker's mark in a soft square, or a plain box for a maker without one. */
export function Mark({ company }: { company: ReturnType<typeof companyIn> }) {
  return (
    <span className="pg-mark" data-none={!company || undefined}>
      {company ? <company.icon aria-hidden="true" /> : <Box aria-hidden="true" strokeWidth={1.5} />}
    </span>
  );
}
