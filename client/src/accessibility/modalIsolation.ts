type Isolation = { count: number; ariaHidden: string | null; inert: boolean };
const isolatedRoots = new WeakMap<HTMLElement, Isolation>();

export function isolateAppForModal(appRoot: HTMLElement | null = document.getElementById("root")) {
  if (!appRoot) return () => undefined;
  let state = isolatedRoots.get(appRoot);
  if (!state) {
    state = { count: 0, ariaHidden: appRoot.getAttribute("aria-hidden"), inert: appRoot.hasAttribute("inert") };
    isolatedRoots.set(appRoot, state);
  }
  state.count += 1;
  appRoot.setAttribute("aria-hidden", "true");
  appRoot.setAttribute("inert", "");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count > 0) return;
    if (state.ariaHidden === null) appRoot.removeAttribute("aria-hidden");
    else appRoot.setAttribute("aria-hidden", state.ariaHidden);
    if (!state.inert) appRoot.removeAttribute("inert");
    isolatedRoots.delete(appRoot);
  };
}

let bodyLockCount = 0;
let previousOverflow = "";
export function lockModalBody() {
  if (bodyLockCount++ === 0) previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--bodyLockCount === 0) document.body.style.overflow = previousOverflow;
  };
}
