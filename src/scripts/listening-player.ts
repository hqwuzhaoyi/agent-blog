import { animate as animateMotion } from "motion/mini";
import { spring } from "motion";
import { navigate, TransitionBeforePreparationEvent } from "astro:transitions/client";
import { canExpandPlayer, chapterIndexAt, displayTime, progressWithin, type ListeningEpisode } from "../lib/listening";

export function initListeningPlayer() {
  const player = document.querySelector<HTMLElement>("#listening-player");
  const audio = player?.querySelector<HTMLAudioElement>("audio");
  if (!player || !audio) return;
  const shell = player;
  const media = audio;
  const surface = shell.querySelector<HTMLElement>(".player-surface")!;
  const toggle = shell.querySelector<HTMLButtonElement>(".player-toggle")!;
  const modeToggle = shell.querySelector<HTMLButtonElement>(".player-mode-toggle")!;
  const mute = shell.querySelector<HTMLButtonElement>(".player-mute")!;
  const range = shell.querySelector<HTMLInputElement>(".player-range")!;
  const fill = shell.querySelector<HTMLElement>(".player-range-fill")!;
  const title = shell.querySelector<HTMLAnchorElement>(".player-title")!;
  const chapterLabel = shell.querySelector<HTMLElement>(".player-chapter")!;
  const elapsed = shell.querySelector<HTMLElement>(".player-elapsed")!;
  const errorLabel = shell.querySelector<HTMLElement>(".player-error")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
  let episode: ListeningEpisode | undefined;
  let pageEpisode: ListeningEpisode | undefined;
  let started = false;
  let dismissed = false;
  let pendingSeek: number | undefined;
  let frame = 0;
  let scrollFrame = false;
  let movement: ReturnType<typeof animateMotion> | undefined;
  let markerMovement: ReturnType<typeof animateMotion> | undefined;
  let markerTarget = "";
  let compactRequested = false;
  let navigating = false;
  let navigationSignal: AbortSignal | undefined;
  let lastChapter = "";
  let slot: HTMLElement | null = null;
  let trigger: HTMLButtonElement | null = null;
  let marker: HTMLElement | null = null;
  let links: Array<{ element: HTMLAnchorElement; progress: HTMLElement | null; top: number; height: number }> = [];
  let lastIndex: number | undefined;
  let lastWidth = 0;
  let lastX: number | undefined;
  let lastY: number | undefined;
  let playerHeight = 0;
  let geometryDirty = true;
  let geometry: { top: number; left: number; width: number; height: number; headerBottom: number; viewportBottom: number; viewportWidth: number } | undefined;
  const measuredSizes = new WeakMap<Element, { width: number; height: number }>();
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const size = entry.borderBoxSize?.[0];
      const previous = measuredSizes.get(entry.target);
      if (!size || !previous || Math.abs(size.inlineSize - previous.width) > .1 || Math.abs(size.blockSize - previous.height) > .1) invalidateGeometry();
    }
  });
  function invalidateGeometry() { geometryDirty = true; queuePosition(); }
  function measureGeometry() {
    const rect = slot?.getBoundingClientRect();
    const header = document.querySelector(".site-header");
    const headerRect = header?.getBoundingClientRect();
    if (header && headerRect) measuredSizes.set(header, { width: headerRect.width, height: headerRect.height });
    const articleHeader = document.querySelector(".coffee-article-header");
    const articleRect = articleHeader?.getBoundingClientRect();
    if (articleHeader && articleRect) measuredSizes.set(articleHeader, { width: articleRect.width, height: articleRect.height });
    if (slot && rect) measuredSizes.set(slot, { width: rect.width, height: rect.height });
    geometry = {
      top: (rect?.top ?? 0) + scrollY, left: (rect?.left ?? 0) + scrollX, width: rect?.width ?? 0, height: rect?.height ?? 0,
      headerBottom: headerRect?.bottom ?? 0,
      viewportBottom: (window.visualViewport?.height ?? innerHeight) + (window.visualViewport?.offsetTop ?? 0), viewportWidth: innerWidth,
    };
    for (const link of links) { link.height = link.element.offsetHeight; link.top = link.element.parentElement!.offsetTop; }
    playerHeight = 0;
    geometryDirty = false;
  }
  function cachePageElements() {
    slot = document.querySelector<HTMLElement>("[data-player-slot]");
    trigger = document.querySelector<HTMLButtonElement>("[data-play-episode]");
    markerMovement?.stop();
    markerMovement = undefined;
    markerTarget = "";
    marker = document.querySelector<HTMLElement>(".coffee-chapter-marker");
    links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".coffee-chapters a[data-start]")).map(element => ({ element, progress: element.querySelector<HTMLElement>(".coffee-chapter-progress"), top: 0, height: 0 }));
    lastIndex = undefined;
    resizeObserver.disconnect();
    for (const target of [slot, document.querySelector(".site-header"), document.querySelector(".coffee-article-header")]) if (target) resizeObserver.observe(target);
    geometryDirty = true;
    measureGeometry();
  }

  function readPage() {
    const data = document.querySelector("#listening-episode")?.textContent;
    pageEpisode = data ? JSON.parse(data) as ListeningEpisode : undefined;
    if (pageEpisode && (!episode || (!started && (episode.id !== pageEpisode.id || episode.audio.url !== pageEpisode.audio.url)))) loadEpisode(pageEpisode);
    cachePageElements();
    sync();
    position(false);
  }
  function loadEpisode(next: ListeningEpisode) {
    if (episode?.id === next.id && episode.audio.url === next.audio.url) { dismissed = false; return; }
    media.pause();
    episode = next;
    started = false;
    compactRequested = false;
    dismissed = false;
    pendingSeek = undefined;
    lastChapter = "";
    lastIndex = undefined;
    playerHeight = 0;
    title.textContent = next.title;
    title.href = next.url;
    range.max = String(next.duration);
    shell.querySelector(".player-duration")!.textContent = displayTime(next.duration);
    errorLabel.hidden = true;
    media.src = next.audio.url;
    media.load();
  }
  function position(animate = true) {
    if (!episode || dismissed) {
      stopPositionAnimation();
      if (!shell.hidden) shell.hidden = true;
      if (document.body.classList.contains("has-docked-player")) document.body.classList.remove("has-docked-player");
      if (trigger?.hidden) trigger.hidden = false;
      return;
    }
    if (geometryDirty || !geometry) measureGeometry();
    const bounds = geometry!;
    const onEpisode = slot?.dataset.playerSlot === episode.id && pageEpisode?.audio.url === episode.audio.url;
    const top = bounds.top - scrollY;
    const expanded = !compactRequested && !!onEpisode && canExpandPlayer(top, top + bounds.height, bounds.headerBottom, bounds.viewportBottom, shell.dataset.mode === "expanded" || Boolean(shell.hidden));
    const visible = expanded || started || (compactRequested && onEpisode);
    if (trigger && trigger.hidden !== (onEpisode && visible)) trigger.hidden = !!(onEpisode && visible);
    if (!visible) {
      if (!shell.hidden) shell.hidden = true;
      if (document.body.classList.contains("has-docked-player")) document.body.classList.remove("has-docked-player");
      return;
    }
    const mode = expanded ? "expanded" : "docked";
    const changed = shell.dataset.mode !== mode;
    const old = changed && !shell.hidden ? surface.getBoundingClientRect() : undefined;
    if (changed) stopPositionAnimation();
    if (shell.hidden) shell.hidden = false;
    if (changed) shell.dataset.mode = mode;
    const modeLabel = expanded ? shell.dataset.collapseLabel! : shell.dataset.expandLabel!;
    if (modeToggle.getAttribute("aria-label") !== modeLabel) modeToggle.setAttribute("aria-label", modeLabel);
    if (modeToggle.getAttribute("aria-expanded") !== String(expanded)) modeToggle.setAttribute("aria-expanded", String(expanded));
    const width = expanded ? bounds.width : Math.min(680, bounds.viewportWidth - 32);
    const widthChanged = lastWidth !== width;
    if (widthChanged) { shell.style.width = `${width}px`; lastWidth = width; }
    // A layout measurement is needed only for a resize or an actual mode change.
    if (changed || widthChanged || !playerHeight) playerHeight = shell.offsetHeight;
    const x = expanded ? bounds.left : (bounds.viewportWidth - width) / 2;
    const y = expanded ? bounds.top : bounds.viewportBottom - playerHeight - 16;
    const finalTransform = `translate3d(${x}px, ${y}px, 0)`;
    if (lastX !== x || lastY !== y) { shell.style.transform = finalTransform; lastX = x; lastY = y; }
    if (document.body.classList.contains("has-docked-player") !== !expanded) document.body.classList.toggle("has-docked-player", !expanded);
    if (old && changed && animate && !navigating && !reduced.matches) {
      const viewportX = expanded ? x - scrollX : x;
      const viewportY = expanded ? y - scrollY : y;
      // Preserve the currently displayed rectangle when an in-flight switch reverses.
      // Full transform strings let Motion use native, compositor-driven animation.
      const control = animateMotion(surface, {
        transform: [
          `translate(${old.left - viewportX}px, ${old.top - viewportY}px) scale(${old.width / width}, ${old.height / playerHeight})`,
          "translate(0, 0) scale(1)",
        ],
      }, { type: spring, duration: .25, bounce: 0 });
      movement = control;
      void control.then(() => {
        if (movement === control) { movement = undefined; surface.style.removeProperty("transform"); }
      });
    }
  }
  function stopPositionAnimation() {
    movement?.stop();
    movement = undefined;
    // Scrolling must immediately return to native document positioning.
    surface.style.removeProperty("transform");
  }
  function queuePosition(fromScroll = false) {
    if (fromScroll) { scrollFrame = true; stopPositionAnimation(); }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (geometryDirty) { measureGeometry(); sync(); }
      const followGesture = scrollFrame;
      scrollFrame = false;
      position(!followGesture);
    });
  }
  function sync() {
    if (!episode) return;
    const duration = Number.isFinite(media.duration) ? media.duration : episode.duration;
    const time = media.currentTime;
    if (range.max !== String(duration)) range.max = String(duration);
    range.value = String(time);
    const clock = displayTime(time);
    if (elapsed.textContent !== clock) { elapsed.textContent = clock; range.setAttribute("aria-valuetext", `${clock} / ${displayTime(duration)}`); }
    fill.style.transform = `scaleX(${progressWithin(0, duration, time)})`;
    if (shell.dataset.playing !== String(!media.paused)) {
      shell.dataset.playing = String(!media.paused);
      toggle.setAttribute("aria-label", media.paused ? shell.dataset.playLabel! : shell.dataset.pauseLabel!);
    }
    if (shell.dataset.muted !== String(media.muted)) {
      shell.dataset.muted = String(media.muted);
      mute.setAttribute("aria-label", media.muted ? shell.dataset.unmuteLabel! : shell.dataset.muteLabel!);
      mute.setAttribute("aria-pressed", String(media.muted));
    }
    const index = chapterIndexAt(episode.chapters, time);
    const chapter = episode.chapters[index];
    const caption = chapter?.title ?? shell.dataset.introLabel!;
    if (caption !== lastChapter) {
      lastChapter = caption;
      chapterLabel.textContent = caption;
      if (!reduced.matches) chapterLabel.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: ease });
    }
    if (pageEpisode?.id !== episode.id || pageEpisode.audio.url !== episode.audio.url) return;
    if (index !== lastIndex) {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const current = i === index;
        link.element.classList.toggle("is-current", current);
        if (current) link.element.setAttribute("aria-current", "true");
        else link.element.removeAttribute("aria-current");
        if (!current && link.progress) link.progress.style.transform = "scaleX(0)";
      }
      lastIndex = index;
      if (marker) marker.dataset.visible = String(index >= 0);
    }
    const active = links[index];
    if (active?.progress) active.progress.style.transform = `scaleX(${progressWithin(episode.chapters[index].start, episode.chapters[index + 1]?.start ?? duration, time)})`;
    if (active && marker) {
      const height = `${active.height}px`;
      const transform = `translateY(${active.top}px)`;
      if (marker.style.height !== height) marker.style.height = height;
      if (markerTarget !== transform) {
        const hasPreviousPosition = markerTarget !== "";
        markerTarget = transform;
        markerMovement?.stop();
        markerMovement = undefined;
        if (hasPreviousPosition && !reduced.matches && !geometryDirty) {
          markerMovement = animateMotion(marker, { transform }, { type: spring, duration: .25, bounce: 0 });
        } else marker.style.transform = transform;
      }
    }
  }
  function seek(seconds: number) {
    if (!episode) return;
    const next = Math.min(episode.duration, Math.max(0, seconds));
    if (media.readyState > 0) { media.currentTime = next; sync(); }
    else pendingSeek = next;
  }
  async function play() {
    dismissed = false;
    if (!errorLabel.hidden) playerHeight = 0;
    errorLabel.hidden = true;
    if (media.error) { pendingSeek ??= media.currentTime; media.load(); }
    try { await media.play(); started = true; position(); }
    catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      errorLabel.textContent = shell.dataset.errorLabel!;
      errorLabel.hidden = false;
      playerHeight = 0;
      queuePosition();
    }
    sync();
  }
  modeToggle.addEventListener("click", () => {
    if (shell.dataset.mode === "expanded") {
      compactRequested = true;
      position();
      return;
    }
    compactRequested = false;
    position();
    if (shell.dataset.mode === "expanded") return;
    if (slot && slot.dataset.playerSlot === episode?.id && pageEpisode?.audio.url === episode?.audio.url) {
      slot.scrollIntoView({ behavior: reduced.matches ? "instant" : "smooth", block: "center" });
    } else if (episode) void navigate(`${episode.url}#listen`);
  });
  toggle.addEventListener("click", () => { if (media.paused) void play(); else media.pause(); });
  shell.querySelectorAll<HTMLButtonElement>("[data-skip]").forEach((button) => button.addEventListener("click", () => seek(media.currentTime + Number(button.dataset.skip))));
  shell.querySelector(".player-dismiss")!.addEventListener("click", () => { media.pause(); dismissed = true; position(); });
  mute.addEventListener("click", () => { media.muted = !media.muted; sync(); });
  range.addEventListener("input", () => seek(Number(range.value)));
  media.addEventListener("loadedmetadata", () => {
    if (pendingSeek !== undefined) { media.currentTime = pendingSeek; pendingSeek = undefined; }
    sync();
  });
  for (const event of ["timeupdate", "play", "pause", "seeked", "ended", "volumechange"]) media.addEventListener(event, sync);
  media.addEventListener("error", () => { if (episode) { errorLabel.textContent = shell.dataset.errorLabel!; errorLabel.hidden = false; playerHeight = 0; queuePosition(); } });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const start = target?.closest("[data-play-episode]");
    const chapter = target?.closest<HTMLAnchorElement>(".coffee-chapters a[data-start]");
    if (!start && !chapter) return;
    // A fast history navigation can expose the new DOM before page-load runs.
    // Refresh from that DOM before responding to an immediate listener action.
    if (slot !== document.querySelector("[data-player-slot]")) readPage();
    if (!pageEpisode) return;
    loadEpisode(pageEpisode);
    if (chapter) seek(Number(chapter.dataset.start));
    void play();
  });
  document.addEventListener("astro:before-preparation", (event) => {
    navigating = true;
    if (event instanceof TransitionBeforePreparationEvent) {
      navigationSignal = event.signal;
      event.signal.addEventListener("abort", () => {
        if (navigationSignal === event.signal) { navigating = false; queuePosition(); }
      }, { once: true });
    }
  });
  document.addEventListener("astro:after-swap", () => { readPage(); });
  document.addEventListener("astro:page-load", () => { navigating = false; navigationSignal = undefined; readPage(); });
  addEventListener("scroll", () => queuePosition(true), { passive: true });
  addEventListener("wheel", stopPositionAnimation, { passive: true });
  addEventListener("touchmove", stopPositionAnimation, { passive: true });
  addEventListener("resize", invalidateGeometry);
  window.visualViewport?.addEventListener("resize", invalidateGeometry);
  reduced.addEventListener("change", () => {
    stopPositionAnimation();
    markerMovement?.stop();
    markerMovement = undefined;
    if (marker && markerTarget) marker.style.transform = markerTarget;
    position(false);
  });
  document.addEventListener("animationend", (event) => {
    if (event.target instanceof Element && event.target.matches(".coffee-player")) invalidateGeometry();
  });
  void document.fonts.ready.then(invalidateGeometry);
  readPage();
}
