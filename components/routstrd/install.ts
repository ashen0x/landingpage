/** The installer the page shows and the light types. */
export const INSTALL_SH = "https://github.com/Routstr/routstrd/releases/latest/download/install.sh";

/** The agents routstrd sets up, with their `routstrd onboard` flag. */
export const AGENTS = [
  ["Claude Code", "--claude-code"],
  ["OpenCode", "--opencode"],
  ["Pi", "--pi-agent"],
  ["OpenClaw", "--openclaw"],
  ["Hermes", "--hermes"],
] as const;
