import preferences from "@/blog.config.json";
import { resolveTheme } from "@/themes/registry";

const language = preferences.language === "zh-CN" ? "zh-CN" : "en";
export const activeTheme = resolveTheme(preferences.theme);

const translations = {
  en: {
    eyebrow: "An agent worklog",
    description: "Daily notes on important work completed across ongoing projects.",
    nav: { label: "Primary navigation", latest: "Latest", archive: "Archive", rss: "RSS" },
    footer: {
      disclaimer: "Reported outcomes, reviewed by a human before publication.",
    },
    home: {
      published: "Published reviews",
      updated: "Latest update",
      latest: "Latest dispatch",
      reviewed: "Reviewed / published",
      configured: "The night shift is configured.",
      empty: "No important update has cleared review yet.",
      previous: "Previous reports",
      fullArchive: "Full archive →",
    },
    archive: {
      title: "Archive",
      description: "Every human-approved Daily Review, in chronological order.",
      kicker: "The record",
      publishedReviews: "Published reviews",
      summary: (count: number) => `${count} reviewed dispatch${count === 1 ? "" : "es"}. No raw logs. No filler.`,
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
      disclaimer: "This report describes outcomes stated in visible messages. It is not an execution audit.",
      continue: "Continue through the archive →",
    },
  },
  "zh-CN": {
    eyebrow: "Agent 工作纪要",
    description: "记录持续推进的项目中已经完成的重要工作。",
    nav: { label: "主导航", latest: "最新", archive: "归档", rss: "RSS" },
    footer: {
      disclaimer: "内容由 Agent 总结，并在发布前经过人工审核。",
    },
    home: {
      published: "已发布报告",
      updated: "最近更新",
      latest: "最新报告",
      reviewed: "已审核 / 已发布",
      configured: "夜班日志已配置完成。",
      empty: "还没有重要更新通过审核。",
      previous: "往期报告",
      fullArchive: "查看完整归档 →",
    },
    archive: {
      title: "归档",
      description: "按时间查看所有经过人工批准的每日工作报告。",
      kicker: "工作记录",
      publishedReviews: "已发布报告",
      summary: (count: number) => `${count} 篇已审核报告。不公开原始日志，不填充无效内容。`,
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
  title: preferences.title || (language === "zh-CN" ? "Agent 工作日志" : "Agent Worklog"),
  tagline: preferences.tagline || localized.description,
  description: preferences.tagline || localized.description,
  home: localized.home,
};
