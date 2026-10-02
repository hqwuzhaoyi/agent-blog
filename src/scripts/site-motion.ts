import { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from "astro:transitions/client";

export function initSiteMotion() {
  let navigation = 0;
  function placeIndicator(snap = false) {
    const nav = document.querySelector<HTMLElement>(".site-nav");
    const indicator = nav?.querySelector<HTMLElement>(".nav-indicator");
    const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !indicator || !active) return;
    const parent = nav.getBoundingClientRect();
    const bounds = active.getBoundingClientRect();
    if (snap) indicator.style.transition = "none";
    indicator.style.width = `${bounds.width + 16}px`;
    indicator.style.transform = `translateX(${bounds.left - parent.left}px)`;
    indicator.dataset.visible = "true";
    if (snap) { void indicator.offsetWidth; indicator.style.removeProperty("transition"); }
  }
  document.addEventListener("astro:before-preparation", (event) => {
    const current = ++navigation;
    const timer = setTimeout(() => { if (navigation === current) document.documentElement.dataset.navigating = "true"; }, 120);
    if (event instanceof TransitionBeforePreparationEvent) event.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      if (navigation === current) delete document.documentElement.dataset.navigating;
    }, { once: true });
  });
  document.addEventListener("astro:after-preparation", () => { navigation++; delete document.documentElement.dataset.navigating; });
  document.addEventListener("astro:before-swap", (event) => {
    if (event instanceof TransitionBeforeSwapEvent) event.newDocument.documentElement.dataset.clientNavigation = "true";
  });
  document.addEventListener("astro:after-swap", () => placeIndicator(true));
  document.addEventListener("astro:page-load", () => { navigation++; delete document.documentElement.dataset.navigating; placeIndicator(); });
  addEventListener("resize", () => placeIndicator());
  void document.fonts.ready.then(() => placeIndicator());
  placeIndicator();
}
