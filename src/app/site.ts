import preferences from "../blog.config.json";
import { resolveTheme } from "./themes";

const language = preferences.language === "zh-CN" ? "zh-CN" : "en";
export const activeTheme = resolveTheme(preferences.theme);

const translations = {
  en: {
    eyebrow: "An agent worklog",
    description:
      "Daily notes on important work completed across ongoing projects.",
    nav: {
      label: "Primary navigation",
      latest: "Worklog",
      archive: "Archive",
      episodes: "Morning Coffee",
      rss: "RSS",
    },
    episodes: {
      title: "Morning Coffee",
      description:
        "A few minutes of AI builder stories, sources, and editorial perspective.",
      kicker: "Listen / think / start the day",
      latest: "Latest episode",
      archive: "All episodes",
      listen: "Listen",
      chapters: "Chapters",
      notes: "Show notes",
      subscribe: "Subscribe to the podcast",
      back: "All episodes",
      empty: "The first episode is brewing.",
      draft: "Preview draft",
      download: "Download audio",
      disclosure:
        "AI-narrated, independently written. Sources and commentary are identified below.",
      footer: "Morning Coffee · A few minutes of new ideas.",
    },
    player: {
      label: "Podcast player",
      play: "Play",
      pause: "Pause",
      rewind: "Back ten seconds",
      forward: "Forward ten seconds",
      mute: "Mute",
      unmute: "Unmute",
      close: "Close player",
      collapse: "Minimize player",
      expand: "Expand player",
      seek: "Playback position",
      intro: "Intro",
      start: "Listen to this episode",
      error: "Audio could not play. Please try again.",
    },
    footer: {
      disclaimer: "Reported outcomes, reviewed by a human before publication.",
    },
    home: {
      published: "Published reviews",
      updated: "Latest update",
      latest: "Latest dispatch",
      reviewed: "Reviewed / published",
      configured: "Worklog",
      empty: "New notes are on their way.",
      previous: "Previous reports",
      fullArchive: "Full archive →",
    },
    archive: {
      title: "Archive",
      description: "Every human-approved Daily Review, in chronological order.",
      kicker: "The record",
      publishedReviews: "Published reviews",
      summary: (count: number) =>
        `${count} worklog ${count === 1 ? "entry" : "entries"}, in chronological order.`,
    },
    review: {
      read: "Read",
      signals: "signals",
      open: "Open report",
      back: "Back to latest reviews",
      latest: "Latest",
      daily: "Daily review",
      report: "REPORT",
      day: "Review day",
      source: "Source",
      disclaimer:
        "This report describes outcomes stated in visible messages. It is not an execution audit.",
      continue: "Continue through the archive →",
    },
  },
  "zh-CN": {
    eyebrow: "Agent 工作纪要",
    description: "记录持续推进的项目中已经完成的重要工作。",
    nav: {
      label: "主导航",
      latest: "工作日志",
      archive: "归档",
      episodes: "早咖啡",
      rss: "RSS",
    },
    episodes: {
      title: "早咖啡",
      description: "用几分钟，听听 AI 构建者的新想法，以及它们与你的关系。",
      kicker: "听见新想法，带着问题开始一天",
      latest: "最新一期",
      archive: "往期节目",
      listen: "收听",
      chapters: "本期章节",
      notes: "节目笔记",
      subscribe: "订阅播客",
      back: "全部节目",
      empty: "第一杯早咖啡正在准备。",
      draft: "预览草稿",
      download: "下载音频",
      disclosure: "AI 配音，独立编稿。来源与编辑观点见下文。",
      footer: "早咖啡 · 几分钟，听见新想法。",
    },
    player: {
      label: "播客播放器",
      play: "播放",
      pause: "暂停",
      rewind: "后退十秒",
      forward: "前进十秒",
      mute: "静音",
      unmute: "取消静音",
      close: "关闭播放器",
      collapse: "收起播放器",
      expand: "展开播放器",
      seek: "播放进度",
      intro: "片头",
      start: "收听本期",
      error: "音频暂时无法播放，请重试。",
    },
    footer: {
      disclaimer: "内容由 Agent 总结，并在发布前经过人工审核。",
    },
    home: {
      published: "已发布报告",
      updated: "最近更新",
      latest: "最新报告",
      reviewed: "已审核 / 已发布",
      configured: "工作日志",
      empty: "新的工作日志正在准备。",
      previous: "往期报告",
      fullArchive: "查看完整归档 →",
    },
    archive: {
      title: "归档",
      description: "按时间查看所有经过人工批准的每日工作报告。",
      kicker: "工作记录",
      publishedReviews: "已发布报告",
      summary: (count: number) => `${count} 篇工作日志，按时间归档。`,
    },
    review: {
      read: "阅读",
      signals: "项进展",
      open: "打开报告",
      back: "返回最新报告",
      latest: "最新",
      daily: "每日报告",
      report: "报告",
      day: "报告日期",
      source: "来源",
      disclaimer: "本报告描述可见消息中陈述的结果，不构成完整的执行审计。",
      continue: "继续浏览归档 →",
    },
  },
} as const;

const localized = translations[language];

export const siteConfig = {
  theme: activeTheme.id,
  language,
  locale: language,
  ...localized,
  title:
    preferences.title ||
    (language === "zh-CN" ? "早咖啡" : "Morning Coffee"),
  tagline: preferences.tagline || localized.description,
  description: preferences.tagline || localized.description,
  home: localized.home,
};
