/**
 * Tells React that `act()` is available, so mount tests do not warn on every
 * render. Without it React assumes it is in production and prints a warning
 * that buries genuine failures in the output.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export {}
