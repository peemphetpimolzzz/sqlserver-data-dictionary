/* Minimal leveled logger — keeps output readable without pulling in a dependency. */
export const logger = {
  info: (message: string) => console.log(`[info] ${message}`),
  warn: (message: string) => console.warn(`[warn] ${message}`),
  error: (message: string) => console.error(`[error] ${message}`),
};
