let VERBOSE = false;

export function setVerbose(v = true) {
  VERBOSE = !!v;
}

export function debug(...args) {
  if (VERBOSE) console.debug('[debug]', ...args);
}

export function info(...args) {
  console.info(...args);
}

export function warn(...args) {
  console.warn(...args);
}

export function error(...args) {
  console.error(...args);
}

export default { setVerbose, debug, info, warn, error };
