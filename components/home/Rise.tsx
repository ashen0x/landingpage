"use client";

import { useEffect } from "react";

/** Marks every [data-rise] element on the home page the first time it is seen. */
export function RiseWatcher() {
  useEffect(() => {
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.seen = "";
          watch.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    document.querySelectorAll(".rm [data-rise]").forEach((element) => watch.observe(element));
    return () => watch.disconnect();
  }, []);
  return null;
}
