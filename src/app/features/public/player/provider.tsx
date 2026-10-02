import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import type { PublishedEntry } from "../../../../../cloudflare/content-models";
import { siteConfig } from "../../../site";
import { Button } from "../beui/button";
import { BottomSheet } from "../beui/bottom-sheet";
type Episode = PublishedEntry<"episodes">;
type State = {
  episode: Episode | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  error: string;
  inlineVisible: boolean;
};
type Controller = {
  audio: React.RefObject<HTMLAudioElement | null>;
  state: State;
  play: (episode: Episode, start?: number) => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  dismiss: () => void;
  setInlineVisible: (visible: boolean) => void;
};
const Context = createContext<Controller | null>(null);
const ActionsContext = createContext<Pick<Controller, "play"> | null>(null);
export function usePlayerActions() {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("Player provider missing");
  return actions;
}
export function usePlayer() {
  const controller = useContext(Context);
  if (!controller) throw new Error("Player provider missing");
  return controller;
}
export function PublicPlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const episodeRef = useRef<Episode | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const [state, setState] = useState<State>({
    episode: null,
    playing: false,
    time: 0,
    duration: 0,
    volume: 1,
    error: "",
    inlineVisible: false,
  });
  const setInlineVisible = useCallback((inlineVisible: boolean) => {
    setState((current) =>
      current.inlineVisible === inlineVisible
        ? current
        : { ...current, inlineVisible },
    );
  }, []);
  const play = useCallback((episode: Episode, start?: number) => {
    const node = audio.current;
    if (!node) return;
    if (
      episodeRef.current?.id !== episode.id ||
      episodeRef.current?.data.audio.url !== episode.data.audio.url
    ) {
      episodeRef.current = episode;
      node.src = episode.data.audio.url;
      pendingSeek.current = start ?? 0;
      setState((current) => ({
        ...current,
        episode,
        time: start ?? 0,
        duration: episode.data.duration,
        error: "",
      }));
    } else if (start !== undefined) {
      if (node.readyState < 1) pendingSeek.current = start;
      else {
        pendingSeek.current = null;
        node.currentTime = start;
      }
      setState((current) => ({ ...current, time: start }));
    }
    void node
      .play()
      .catch(() =>
        setState((current) => ({
          ...current,
          playing: false,
          error: siteConfig.player.error,
        })),
      );
  }, []);
  const actions = useMemo(() => ({ play }), [play]);
  const controller = useMemo<Controller>(
    () => ({
      audio,
      state,
      play,
      toggle() {
        const node = audio.current;
        if (!node) return;
        if (node.paused)
          void node
            .play()
            .catch(() =>
              setState((current) => ({
                ...current,
                error: siteConfig.player.error,
              })),
            );
        else node.pause();
      },
      seek(time) {
        const node = audio.current;
        if (node) {
          const next = Math.max(
            0,
            Math.min(
              Number.isFinite(node.duration) ? node.duration : state.duration,
              time,
            ),
          );
          node.currentTime = next;
          setState((current) => ({ ...current, time: next }));
        }
      },
      dismiss() {
        audio.current?.pause();
        episodeRef.current = null;
        setState((current) => ({
          ...current,
          episode: null,
          playing: false,
          time: 0,
          inlineVisible: false,
        }));
      },
      setVolume(volume) {
        if (audio.current) audio.current.volume = volume;
        setState((current) => ({ ...current, volume }));
      },
      setInlineVisible,
    }),
    [state, play, setInlineVisible],
  );
  return (
    <ActionsContext.Provider value={actions}>
      <Context.Provider value={controller}>
        <audio
          ref={audio}
          preload="none"
          data-persistent-audio
          onLoadedMetadata={() => {
            const node = audio.current!;
            if (pendingSeek.current !== null) {
              node.currentTime = pendingSeek.current;
              pendingSeek.current = null;
            }
            setState((current) => ({
              ...current,
              duration: Number.isFinite(node.duration)
                ? node.duration
                : current.duration,
            }));
          }}
          onTimeUpdate={() =>
            setState((current) => ({
              ...current,
              time: audio.current!.currentTime,
            }))
          }
          onPlay={() =>
            setState((current) => ({ ...current, playing: true, error: "" }))
          }
          onPause={() =>
            setState((current) => ({ ...current, playing: false }))
          }
          onEnded={() =>
            setState((current) => ({ ...current, playing: false }))
          }
          onError={() =>
            setState((current) => ({
              ...current,
              playing: false,
              error: siteConfig.player.error,
            }))
          }
        />
        {children}
      </Context.Provider>
    </ActionsContext.Provider>
  );
}
export function timestamp(time: number) {
  const seconds = Math.max(0, Math.floor(time));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function PlayerControls() {
  const { state, toggle, seek, setVolume } = usePlayer();
  const chapter = state.episode?.data.chapters.findLast(
    (item) => item.start <= state.time,
  );
  return (
    <div className="space-y-3">
      {chapter && (
        <p className="text-sm text-muted-foreground">
          {siteConfig.language === "zh-CN" ? "当前章节：" : "Current chapter: "}
          {chapter.title}
        </p>
      )}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          onClick={() => seek(state.time - 10)}
          aria-label={siteConfig.player.rewind}
        >
          −10
        </Button>
        <Button onClick={toggle} size="lg" ripple>
          {state.playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}{state.playing ? siteConfig.player.pause : siteConfig.player.play}
        </Button>
        <Button
          variant="ghost"
          onClick={() => seek(state.time + 10)}
          aria-label={siteConfig.player.forward}
        >
          +10
        </Button>
      </div>
      <label className="block text-sm">
        {siteConfig.player.seek}
        <input
          className="block w-full accent-primary"
          type="range"
          min={0}
          max={state.duration || 1}
          step={0.1}
          value={Math.min(state.time, state.duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </label>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{timestamp(state.time)}</span>
        <span>{timestamp(state.duration)}</span>
      </div>
      <Button variant="ghost" onClick={() => setVolume(state.volume ? 0 : 1)}>{state.volume ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
        {state.volume ? siteConfig.player.mute : siteConfig.player.unmute}
      </Button>
      <label className="flex items-center gap-3 text-sm">
        {siteConfig.language === "zh-CN" ? "音量" : "Volume"}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="accent-primary"
        />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
    </div>
  );
}
export function Chapters({ episode }: { episode: Episode }) {
  const { play } = usePlayerActions();
  return (
    <ol className="divide-y divide-border">
      {episode.data.chapters.map((chapter, index) => (
        <li key={`${index}-${chapter.start}`}>
          <button
            type="button"
            className="flex min-h-12 w-full gap-4 py-3 text-left hover:text-primary"
            onClick={() => play(episode, chapter.start)}
          >
            <span className="font-mono text-muted-foreground">
              {timestamp(chapter.start)}
            </span>
            <span>{chapter.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
export function EpisodePlayer({ episode }: { episode: Episode }) {
  const { state, play, setInlineVisible } = usePlayer();
  const ref = useRef<HTMLDivElement>(null);
  const active = state.episode?.id === episode.id;
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => setInlineVisible(entries[0].isIntersecting && active),
      { threshold: 0.15 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      setInlineVisible(false);
    };
  }, [active, setInlineVisible]);
  return (
    <section
      ref={ref}
      className="my-8 rounded-2xl border border-border bg-card p-5"
      aria-label={siteConfig.player.label}
    >
      {active ? (
        <PlayerControls />
      ) : (
        <Button onClick={() => play(episode)} size="lg" ripple><Play size={18} fill="currentColor" aria-hidden="true" />
          {siteConfig.language === "zh-CN" ? "播放本期" : "Play episode"} ·{" "}
          {timestamp(episode.data.duration)}
        </Button>
      )}
    </section>
  );
}
export function PersistentPlayer() {
  const { state, toggle, dismiss } = usePlayer();
  const [open, setOpen] = useState(false);
  if (!state.episode) return null;
  return (
    <>
      <div
        hidden={state.inlineVisible && !open}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 p-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setOpen(true)}
            aria-label={siteConfig.player.expand}
          >
            <span className="block truncate font-medium">
              {state.episode.data.title}
            </span>
            <span className="text-sm text-muted-foreground">
              {timestamp(state.time)} / {timestamp(state.duration)} ·{" "}
              {siteConfig.player.expand}
            </span>
          </button>
          <Button onClick={toggle} size="lg" ripple>
            {state.playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}{state.playing ? siteConfig.player.pause : siteConfig.player.play}
          </Button>
          <Button
            variant="ghost"
            onClick={dismiss}
            aria-label={siteConfig.player.close}
          >
            {siteConfig.player.close}
          </Button>
        </div>
      </div>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={state.episode.data.title}
        snapPoints={[0.72, 0.92]}
      >
        <PlayerControls />
        <h3 className="mt-6 font-semibold">{siteConfig.episodes.chapters}</h3>
        <Chapters episode={state.episode} />
        <Link
          to="/agent-blog/episodes/$id"
          params={{ id: state.episode.id }}
          onClick={() => setOpen(false)}
          className="block py-4 text-primary"
        >
          {siteConfig.episodes.notes}
        </Link>
      </BottomSheet>
    </>
  );
}
