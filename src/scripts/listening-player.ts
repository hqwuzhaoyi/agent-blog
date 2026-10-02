import { TransitionBeforePreparationEvent } from "astro:transitions/client";
import { chapterIndexAt, displayTime, progressWithin, type ListeningEpisode } from "../lib/listening";

export function initListeningPlayer() {
  const player = document.querySelector<HTMLElement>("#listening-player");
  const audio = player?.querySelector<HTMLAudioElement>("audio");
  if (!player || !audio) return;
  const shell = player;
  const media = audio;
  const surface = shell.querySelector<HTMLElement>(".player-surface")!;
  const toggle = shell.querySelector<HTMLButtonElement>(".player-toggle")!;
  const mute = shell.querySelector<HTMLButtonElement>(".player-mute")!;
  const range = shell.querySelector<HTMLInputElement>(".player-range")!;
  const fill = shell.querySelector<HTMLElement>(".player-range-fill")!;
  const title = shell.querySelector<HTMLAnchorElement>(".player-title")!;
  const chapterLabel = shell.querySelector<HTMLElement>(".player-chapter")!;
  const errorLabel = shell.querySelector<HTMLElement>(".player-error")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
  let episode: ListeningEpisode | undefined;
  let pageEpisode: ListeningEpisode | undefined;
  let started = false;
  let dismissed = false;
  let pendingSeek: number | undefined;
  let frame = 0;
  let movement: Animation | undefined;
  let navigating = false;
  let navigationSignal: AbortSignal | undefined;
  let lastChapter = "";

  function readPage() {
    const data = document.querySelector("#listening-episode")?.textContent;
    pageEpisode = data ? JSON.parse(data) as ListeningEpisode : undefined;
    if (pageEpisode && (!episode || (!started && (episode.id !== pageEpisode.id || episode.audio.url !== pageEpisode.audio.url)))) loadEpisode(pageEpisode);
    sync();
    position(false);
  }
  function loadEpisode(next: ListeningEpisode) {
    if (episode?.id === next.id && episode.audio.url === next.audio.url) { dismissed = false; return; }
    media.pause();
    episode = next;
    started = false;
    dismissed = false;
    pendingSeek = undefined;
    lastChapter = "";
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
      shell.hidden = true;
      document.body.classList.remove("has-docked-player");
      document.querySelector<HTMLButtonElement>("[data-play-episode]")?.removeAttribute("hidden");
      return;
    }
    const slot = document.querySelector<HTMLElement>("[data-player-slot]");
    const onEpisode = slot?.dataset.playerSlot === episode.id && pageEpisode?.audio.url === episode.audio.url;
    const rect = onEpisode ? slot!.getBoundingClientRect() : undefined;
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    const viewportBottom = (window.visualViewport?.height ?? innerHeight) + (window.visualViewport?.offsetTop ?? 0);
    const expanded = !!rect && rect.top >= headerBottom + 12 && rect.bottom <= viewportBottom - 16;
    const visible = expanded || started;
    const trigger = document.querySelector<HTMLButtonElement>("[data-play-episode]");
    if (trigger) trigger.hidden = onEpisode && visible;
    if (!visible) {
      shell.hidden = true;
      document.body.classList.remove("has-docked-player");
      return;
    }
    const old = shell.hidden ? undefined : surface.getBoundingClientRect();
    const mode = expanded ? "expanded" : "docked";
    const changed = shell.dataset.mode !== mode;
    if (changed) movement?.cancel();
    shell.hidden = false;
    shell.dataset.mode = mode;
    const width = expanded ? rect!.width : Math.min(680, innerWidth - 32);
    const x = expanded ? rect!.left : (innerWidth - width) / 2;
    shell.style.width = `${width}px`;
    const y = expanded ? rect!.top : viewportBottom - shell.offsetHeight - 16;
    const finalTransform = `translate3d(${x}px, ${y}px, 0)`;
    shell.style.transform = finalTransform;
    document.body.classList.toggle("has-docked-player", !expanded);
    if (old && changed && animate && !navigating && !reduced.matches) {
      const next = surface.getBoundingClientRect();
      movement = surface.animate([
        { transform: `translate(${old.left - next.left}px, ${old.top - next.top}px) scale(${old.width / next.width}, ${old.height / next.height})` },
        { transform: "translate(0, 0) scale(1)" },
      ], { duration: 250, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
    }
  }
  function queuePosition() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }
  function sync() {
    if (!episode) return;
    const duration = Number.isFinite(media.duration) ? media.duration : episode.duration;
    const time = media.currentTime;
    range.max = String(duration);
    range.value = String(time);
    range.setAttribute("aria-valuetext", `${displayTime(time)} / ${displayTime(duration)}`);
    fill.style.transform = `scaleX(${progressWithin(0, duration, time)})`;
    shell.querySelector(".player-elapsed")!.textContent = displayTime(time);
    shell.dataset.playing = String(!media.paused);
    shell.dataset.muted = String(media.muted);
    mute.setAttribute("aria-label", media.muted ? shell.dataset.unmuteLabel! : shell.dataset.muteLabel!);
    mute.setAttribute("aria-pressed", String(media.muted));
    toggle.setAttribute("aria-label", media.paused ? shell.dataset.playLabel! : shell.dataset.pauseLabel!);
    const index = chapterIndexAt(episode.chapters, time);
    const chapter = episode.chapters[index];
    const caption = chapter?.title ?? shell.dataset.introLabel!;
    if (caption !== lastChapter) {
      lastChapter = caption;
      chapterLabel.textContent = caption;
      if (!reduced.matches) chapterLabel.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: ease });
    }
    if (pageEpisode?.id !== episode.id || pageEpisode.audio.url !== episode.audio.url) return;
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".coffee-chapters a[data-start]"));
    const marker = document.querySelector<HTMLElement>(".coffee-chapter-marker");
    links.forEach((link, i) => {
      const current = i === index;
      link.classList.toggle("is-current", current);
      if (current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
      const progress = link.querySelector<HTMLElement>(".coffee-chapter-progress");
      if (progress) progress.style.transform = `scaleX(${current ? progressWithin(episode!.chapters[i].start, episode!.chapters[i + 1]?.start ?? duration, time) : 0})`;
      if (current && marker) {
        marker.style.height = `${link.offsetHeight}px`;
        marker.style.transform = `translateY(${link.parentElement!.offsetTop}px)`;
      }
    });
    if (marker) marker.dataset.visible = String(index >= 0);
  }
  function seek(seconds: number) {
    if (!episode) return;
    const next = Math.min(episode.duration, Math.max(0, seconds));
    if (media.readyState > 0) { media.currentTime = next; sync(); }
    else pendingSeek = next;
  }
  async function play() {
    dismissed = false;
    errorLabel.hidden = true;
    if (media.error) { pendingSeek ??= media.currentTime; media.load(); }
    try { await media.play(); started = true; position(); }
    catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      errorLabel.textContent = shell.dataset.errorLabel!;
      errorLabel.hidden = false;
    }
    sync();
  }
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
  media.addEventListener("error", () => { if (episode) { errorLabel.textContent = shell.dataset.errorLabel!; errorLabel.hidden = false; } });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-play-episode]") && pageEpisode) {
      loadEpisode(pageEpisode); void play();
    }
    const chapter = target?.closest<HTMLAnchorElement>(".coffee-chapters a[data-start]");
    if (chapter && pageEpisode) {
      loadEpisode(pageEpisode); seek(Number(chapter.dataset.start)); void play();
    }
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
  addEventListener("scroll", queuePosition, { passive: true });
  addEventListener("resize", () => { sync(); queuePosition(); });
  window.visualViewport?.addEventListener("resize", queuePosition);
  reduced.addEventListener("change", () => { movement?.cancel(); position(false); });
  document.addEventListener("animationend", (event) => {
    if (event.target instanceof Element && event.target.matches(".coffee-player")) queuePosition();
  });
  void document.fonts.ready.then(() => { sync(); queuePosition(); });
  readPage();
}
