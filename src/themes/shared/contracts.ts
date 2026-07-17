import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export interface ThemeComponent<Props> {
  (
    result: Parameters<AstroComponentFactory>[0],
    props: Props,
    slots: Parameters<AstroComponentFactory>[2],
  ): ReturnType<AstroComponentFactory>;
  isAstroComponentFactory?: boolean;
  moduleId?: string;
  propagation?: AstroComponentFactory["propagation"];
}

export interface NavigationItem {
  label: string;
  url: string;
}

export interface ReviewPresentation {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  dateTime: string;
  displayDate: string;
  compactDate: string;
  shortYear: string;
  highlights: number;
  platforms: string;
}

export interface HeaderProps {
  title: string;
  eyebrow: string;
  homeUrl: string;
  navigationLabel: string;
  navigation: NavigationItem[];
}

export interface FooterProps {
  disclaimer: string;
}

export interface BlogIntroProps {
  eyebrow: string;
  title: string;
  tagline: string;
  publishedCount: number;
  latestDate?: string;
  labels: {
    published: string;
    updated: string;
  };
}

export interface ReviewListProps {
  latest?: ReviewPresentation;
  previous: ReviewPresentation[];
  labels: {
    latest: string;
    reviewed: string;
    configured: string;
    empty: string;
    previous: string;
    fullArchive: string;
    read: string;
    open: string;
    signals: string;
  };
  archiveUrl: string;
}

export interface ArchiveListProps {
  reviews: ReviewPresentation[];
  labels: {
    kicker: string;
    title: string;
    summary: string;
    publishedReviews: string;
    signals: string;
  };
}

export interface ReviewArticleProps {
  review: ReviewPresentation;
  Content: AstroComponentFactory;
  labels: {
    back: string;
    latest: string;
    daily: string;
    signals: string;
    report: string;
    day: string;
    source: string;
    disclaimer: string;
    continue: string;
  };
  homeUrl: string;
  archiveUrl: string;
}

export interface ThemeSlots {
  Header: ThemeComponent<HeaderProps>;
  BlogIntro: ThemeComponent<BlogIntroProps>;
  ReviewList: ThemeComponent<ReviewListProps>;
  ReviewArticle: ThemeComponent<ReviewArticleProps>;
  ArchiveList: ThemeComponent<ArchiveListProps>;
  Footer: ThemeComponent<FooterProps>;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  stylesheet: string;
  themeColor: string;
  slots?: Partial<ThemeSlots>;
}

export interface ResolvedTheme extends Omit<ThemeDefinition, "slots"> {
  slots: ThemeSlots;
}
