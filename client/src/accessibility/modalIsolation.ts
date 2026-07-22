export function isolateAppForModal(appRoot: HTMLElement | null = document.getElementById("root")) {
  if (!appRoot) return () => undefined;

  const previousAriaHidden = appRoot.getAttribute("aria-hidden");
  const previouslyInert = appRoot.hasAttribute("inert");
  appRoot.setAttribute("aria-hidden", "true");
  appRoot.setAttribute("inert", "");

  return () => {
    if (previousAriaHidden === null) appRoot.removeAttribute("aria-hidden");
    else appRoot.setAttribute("aria-hidden", previousAriaHidden);

    if (!previouslyInert) appRoot.removeAttribute("inert");
  };
}
