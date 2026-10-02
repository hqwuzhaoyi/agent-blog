import {
  resolveThemeDefinition,
  themeDefinitions,
  type ArticleProps,
  type PreparedArticleProps,
} from "../themes";
import { siteConfig } from "../site";
export function DefaultReviewArticle({
  title,
  summary,
  html,
  date,
  source,
  platforms = [],
  preview,
  locale,
  labels,
}: PreparedArticleProps) {
  return (
    <article className="reading-article">
      {preview && <p role="status">{labels.preview}</p>}
      <header>
        <p className="article-kicker">{labels.daily}</p>
        <h1>{title}</h1>
        <p className="article-meta">
          <time dateTime={date}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
              timeZone: "UTC",
            }).format(new Date(date))}
          </time>
          {source && <> · {source}</>}
          {platforms.length > 0 && <> · {platforms.join(" + ")}</>}
        </p>
        <p className="article-summary">{summary}</p>
      </header>
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <footer className="article-disclaimer">{labels.disclaimer}</footer>
    </article>
  );
}

export function Article(props: ArticleProps) {
  const Slot = resolveThemeDefinition(siteConfig.theme, themeDefinitions, {
    ReviewArticle: DefaultReviewArticle,
  }).slots.ReviewArticle;
  return (
    <Slot
      {...props}
      locale={siteConfig.locale}
      labels={{
        daily: siteConfig.review.daily,
        disclaimer: siteConfig.review.disclaimer,
        preview: siteConfig.language === "zh-CN" ? "草稿预览" : "Draft preview",
      }}
    />
  );
}
