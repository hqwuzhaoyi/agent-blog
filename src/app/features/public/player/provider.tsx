import { cn } from "../beui/lib/utils";
import { Play, Pause, Volume2, VolumeX, X, AudioLines } from "lucide-react";
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
import { RangeSlider } from "../beui/range-slider";
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
const PlaybackContext = createContext<{
  episodeId: string | null;
  playing: boolean;
  toggleEpisode: (episode: Episode) => void;
  play: Controller["play"];
} | null>(null);
export function usePlayback() {
  const playback = useContext(PlaybackContext);
  if (!playback) throw new Error("Player provider missing");
  return playback;
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
    void node.play().catch(() =>
      setState((current) => ({
        ...current,
        playing: false,
        error: siteConfig.player.error,
      })),
    );
  }, []);
  const toggleEpisode = useCallback(
    (episode: Episode) => {
      if (
        episodeRef.current?.id === episode.id &&
        audio.current &&
        !audio.current.paused
      )
        audio.current.pause();
      else play(episode);
    },
    [play],
  );
  // Cards subscribe to playback changes, never to the progress clock.
  const playback = useMemo(
    () => ({
      episodeId: state.episode?.id ?? null,
      playing: state.playing,
      toggleEpisode,
      play,
    }),
    [state.episode?.id, state.playing, toggleEpisode, play],
  );
  const controller = useMemo<Controller>(
    () => ({
      audio,
      state,
      play,
      toggle() {
        const node = audio.current;
        if (!node) return;
        if (node.paused)
          void node.play().catch(() =>
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
    <PlaybackContext.Provider value={playback}>
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
    </PlaybackContext.Provider>
  );
}
export function timestamp(time: number) {
  const seconds = Math.max(0, Math.floor(time));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function PlayerControls({ className }: { className?: string }) {
  const { state, toggle, seek, setVolume } = usePlayer();
  const chapter = state.episode?.data.chapters.findLast(
    (item) => item.start <= state.time,
  );
  return (
    <div
      className={cn("player-control-group max-w-[600px] space-y-3", className)}
    >
      {chapter && (
        <p className="mt-0 text-[11px] text-muted-foreground">
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
        <Button onClick={toggle} size="lg">
          {state.playing ? (
            <Pause size={18} aria-hidden="true" />
          ) : (
            <Play size={18} fill="currentColor" aria-hidden="true" />
          )}
          {state.playing ? siteConfig.player.pause : siteConfig.player.play}
        </Button>
        <Button
          variant="ghost"
          onClick={() => seek(state.time + 10)}
          aria-label={siteConfig.player.forward}
        >
          +10
        </Button>
      </div>
      <div className="player-seek-control block text-[11px] text-muted-foreground">
        <div className="player-control-heading flex items-center justify-between gap-4 text-[12px] font-semibold text-foreground">
          <span>{siteConfig.player.seek}</span>
          <span className="player-time-readout tabular-nums font-mono whitespace-nowrap text-primary [&>span]:text-muted-foreground [&>span]:font-normal">
            {timestamp(state.time)} <span>/ {timestamp(state.duration)}</span>
          </span>
        </div>
        <RangeSlider
          className="player-seek-slider mt-2 bg-[color-mix(in_srgb,var(--primary)_9%,var(--background))] [&>[aria-hidden]>div]:bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] [&_[role=slider]]:bg-primary min-h-11"
          min={0}
          max={state.duration || 1}
          step={0.1}
          value={Math.min(state.time, state.duration || 1)}
          onValueChange={seek}
          aria-label={siteConfig.player.seek}
          formatValueText={(time) =>
            `${timestamp(time)} / ${timestamp(state.duration)}`
          }
          showTicks={false}
        />
      </div>
      <div className="player-volume-row mt-5 flex items-center gap-3 border-t border-border pt-4">
        <Button
          variant="ghost"
          size="icon"
          className="player-mute size-11 min-h-11 p-0 mobile:text-[10px]"
          onClick={() => setVolume(state.volume ? 0 : 1)}
          aria-label={
            state.volume ? siteConfig.player.mute : siteConfig.player.unmute
          }
          title={
            state.volume ? siteConfig.player.mute : siteConfig.player.unmute
          }
        >
          {state.volume ? (
            <Volume2 size={18} aria-hidden="true" />
          ) : (
            <VolumeX size={18} aria-hidden="true" />
          )}
        </Button>
        <div className="player-volume-control grid w-45 min-w-0 max-w-[calc(100%_-_56px)] gap-[5px] text-[11px] text-muted-foreground mobile:text-[10px]">
          <div className="player-control-heading flex items-center justify-between gap-4 text-[11px] font-medium text-muted-foreground">
            <span>{siteConfig.language === "zh-CN" ? "音量" : "Volume"}</span>
            <span className="player-volume-value tabular-nums font-mono whitespace-nowrap">
              {Math.round(state.volume * 100)}%
            </span>
          </div>
          <RangeSlider
            min={0}
            max={1}
            step={0.05}
            value={state.volume}
            onValueChange={setVolume}
            aria-label={siteConfig.language === "zh-CN" ? "音量" : "Volume"}
            formatValueText={(volume) => `${Math.round(volume * 100)}%`}
            className="player-volume-slider w-full min-w-0 border border-border min-h-11"
            showTicks={false}
          />
        </div>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
    </div>
  );
}
export function Chapters({
  episode,
  variant = "default",
}: {
  episode: Episode;
  variant?: "default" | "detail" | "sheet";
}) {
  const { state, play } = usePlayer();
  const activeIndex =
    state.episode?.id === episode.id
      ? episode.data.chapters.findLastIndex(
          (chapter) => chapter.start <= state.time,
        )
      : -1;
  return (
    <ol className="divide-y divide-border">
      {episode.data.chapters.map((chapter, index) => (
        <li key={`${index}-${chapter.start}`}>
          <button
            type="button"
            className={cn(
              "chapter-button relative flex min-h-12 w-full gap-4 rounded-md px-2.5 py-3 text-left aria-[current=true]:bg-primary/8 aria-[current=true]:text-primary aria-[current=true]:shadow-[inset_2px_0_var(--primary)] active:bg-primary/12 pointer-hover:hover:bg-card",
              variant === "detail" && "min-h-11 gap-3 py-2.5 text-[12px]",
              variant === "sheet" && "text-[13px]",
            )}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => play(episode, chapter.start)}
          >
            <span
              className={cn(
                "shrink-0 whitespace-nowrap font-mono",
                index === activeIndex
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {timestamp(chapter.start)}
            </span>
            <span className="min-w-0 wrap-anywhere">{chapter.title}</span>
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
      className="episode-inline-player mt-[25px] mx-0 mb-7.5 border border-border rounded-[18px] p-[23px] bg-card mobile:p-4.5"
      aria-label={siteConfig.player.label}
    >
      {active ? (
        <PlayerControls />
      ) : (
        <Button onClick={() => play(episode)} size="lg">
          <Play size={18} fill="currentColor" aria-hidden="true" />
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
  useEffect(() => {
    if (!state.episode) setOpen(false);
  }, [state.episode]);
  if (!state.episode) return null;
  return (
    <>
      <div
        hidden={state.inlineVisible && !open}
        className="persistent-player fixed bottom-4.5 left-1/2 z-40 w-[min(760px,calc(100%_-_32px))] -translate-x-1/2 rounded-[18px] border border-border bg-card px-3.5 py-2.5 shadow-[0_12px_40px_-18px_#13282055] [&[hidden]]:hidden mobile:bottom-[max(10px,env(safe-area-inset-bottom))] mobile:w-[calc(100%_-_24px)] mobile:rounded-[15px] mobile:px-2.5 mobile:py-[9px]"
      >
        <div className="persistent-player-inner flex gap-[15px] items-center mobile:gap-2.5">
          <span
            className="persistent-cover grid place-items-center shrink-0 w-10.5 h-10.5 rounded-[10px] bg-primary text-background mobile:w-[35px] mobile:h-[35px] mobile:rounded-[9px]"
            aria-hidden="true"
          >
            <AudioLines size={20} />
          </span>
          <button
            type="button"
            className="persistent-player-title min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-foreground"
            onClick={() => setOpen(true)}
            aria-label={siteConfig.player.expand}
          >
            <span className="block truncate text-[12px] font-semibold mobile:text-[11px]">
              {state.episode.data.title}
            </span>
            <span className="mt-0.5 flex items-center gap-[7px] text-[10px] text-muted-foreground tabular-nums mobile:text-[9px]">
              {timestamp(state.time)} / {timestamp(state.duration)} ·{" "}
              {siteConfig.player.expand}
            </span>
          </button>
          <Button
            onClick={toggle}
            className="persistent-toggle touch:min-h-11 touch:min-w-11 h-9.5 min-h-9.5 px-4 py-0 text-[12px] mobile:[&_svg]:w-3.5 mobile:[&_span]:hidden"
            aria-label={
              state.playing ? siteConfig.player.pause : siteConfig.player.play
            }
          >
            {state.playing ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} fill="currentColor" aria-hidden="true" />
            )}
            <span>
              {state.playing ? siteConfig.player.pause : siteConfig.player.play}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="persistent-dismiss touch:min-h-11 touch:min-w-11 size-8 p-0 mobile:w-[25px] mobile:h-7.5"
            onClick={dismiss}
            aria-label={siteConfig.player.close}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={state.episode.data.title}
        snapPoints={[0.72, 0.92]}
        className="public-site public-player-sheet text-[15px]"
      >
        <PlayerControls className="pt-3.5" />
        <h3 className="mt-6 text-[13px] font-semibold">
          {siteConfig.episodes.chapters}
        </h3>
        <Chapters episode={state.episode} variant="sheet" />
        <Link
          to="/episodes/$id"
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
