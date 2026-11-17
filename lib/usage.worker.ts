import { loadUsage } from "@/lib/usage-count";

/* The usage reports are fetched and checked here, off the thread that draws the page. */
void loadUsage((counted) => postMessage({ counted }))
  .catch(() => undefined)
  .finally(() => postMessage({ done: true }));
