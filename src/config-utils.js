import path from 'path';

/**
 * Find the best matching project config entry for the given cwd.
 * Chooses the longest-path prefix match from cfg.projects keys.
 * Returns the PLANKA_BOARD_ID string or undefined.
 */
export function findMatchingProjectBoard(cfg, cwd) {
  if (!cfg || !cfg.projects) return undefined;
  const entries = Object.entries(cfg.projects || {});
  const normalized = entries.map(([k, v]) => [path.resolve(k), v]);
  const matches = normalized.filter(([k]) => cwd.startsWith(k));
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b[0].length - a[0].length);
  return matches[0][1] && matches[0][1].PLANKA_BOARD_ID ? matches[0][1].PLANKA_BOARD_ID : undefined;
}

export default {
  findMatchingProjectBoard
};
