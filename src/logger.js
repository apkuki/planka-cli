let VERBOSE = false;
let SILENT = false;

export function setVerbose(v = true) {
  VERBOSE = !!v;
}

export function setSilent(s = true) {
  SILENT = !!s;
}

export function debug(...args) {
  if (SILENT) return;
  if (VERBOSE) console.debug('[debug]', ...args);
}

export function info(...args) {
  if (SILENT) return;
  console.info(...args);
}

export function warn(...args) {
  if (SILENT) return;
  console.warn(...args);
}

export function error(...args) {
  if (SILENT) return;
  console.error(...args);
}

export default { setVerbose, debug, info, warn, error };
