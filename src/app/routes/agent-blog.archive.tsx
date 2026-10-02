import { createFileRoute } from "@tanstack/react-router";
import { getPublicContent } from "../server/public-data";
import { Tabs } from "../features/public/beui/tabs";
import { EpisodeRow, ReviewRow } from "../features/public/content";
import { siteConfig } from "../site";
type Search = {
  type: "all" | "episodes" | "reviews";
  q: string;
  month: string;
};
export const Route = createFileRoute("/agent-blog/archive")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    type:
      search.type === "episodes" || search.type === "reviews"
        ? search.type
        : "all",
    q: typeof search.q === "string" ? search.q : "",
    month:
      typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month)
        ? search.month
        : "",
  }),
  loader: () => getPublicContent(),
  pendingComponent: () => (
    <p role="status" className="py-12">
      {siteConfig.language === "zh-CN"
        ? "正在加载公开内容…"
        : "Loading published content…"}
    </p>
  ),
  errorComponent: ({ reset }) => (
    <section className="py-12">
      <p role="alert">
        {siteConfig.language === "zh-CN"
          ? "公开内容暂时无法加载。"
          : "Published content could not be loaded."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 min-h-11 rounded-lg border border-border px-4"
      >
        {siteConfig.language === "zh-CN" ? "重试" : "Try again"}
      </button>
    </section>
  ),
  head: () => ({
    meta: [{ title: `${siteConfig.archive.title} · ${siteConfig.title}` }],
  }),
  component: Archive,
});
function Archive() {
  const { episodes, reviews } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const update = (next: Partial<Search>) => {
    void navigate({
      search: (previous) => ({ ...previous, ...next }),
      resetScroll: false,
    });
  };
  const items = [
    ...episodes.map((entry) => ({ type: "episodes" as const, entry })),
    ...reviews.map((entry) => ({ type: "reviews" as const, entry })),
  ].sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf());
  const months = Array.from(
    new Set(
      items.map((item) => item.entry.data.date.toISOString().slice(0, 7)),
    ),
  );
  const filtered = items.filter(
    ({ type, entry }) =>
      (search.type === "all" || search.type === type) &&
      (!search.month ||
        entry.data.date.toISOString().startsWith(search.month)) &&
      (!search.q ||
        `${entry.data.title}\n${entry.data.summary}\n${entry.body}`
          .toLocaleLowerCase()
          .includes(search.q.toLocaleLowerCase().trim())),
  );
  return (
    <section className="mx-auto max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-semibold">
        {siteConfig.archive.title}
      </h1>
      <Tabs
        label={siteConfig.language === "zh-CN" ? "内容类型" : "Content type"}
        value={search.type}
        onValueChange={(value) => update({ type: value as Search["type"] })}
        items={[
          {
            value: "all",
            label: siteConfig.language === "zh-CN" ? "全部" : "All",
          },
          { value: "episodes", label: siteConfig.episodes.title },
          { value: "reviews", label: siteConfig.nav.latest },
        ]}
      />
      <form
        className="my-6 flex flex-wrap gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="min-w-0 flex-1">
          {siteConfig.language === "zh-CN" ? "关键词" : "Keyword"}
          <input
            type="search"
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2"
            value={search.q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder={
              siteConfig.language === "zh-CN"
                ? "搜索公开内容"
                : "Search published content"
            }
          />
        </label>
        <label>
          {siteConfig.language === "zh-CN" ? "月份" : "Month"}
          <select
            className="mt-1 block rounded-lg border border-border bg-card px-3 py-2"
            value={search.month}
            onChange={(event) => update({ month: event.target.value })}
          >
            <option value="">
              {siteConfig.language === "zh-CN" ? "全部月份" : "All months"}
            </option>
            {months.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </select>
        </label>
      </form>
      <p role="status" className="text-sm text-muted-foreground">
        {filtered.length}{" "}
        {siteConfig.language === "zh-CN" ? "条公开内容" : "published entries"}
      </p>
      <ul>
        {filtered.map((item) =>
          item.type === "episodes" ? (
            <EpisodeRow key={`episode-${item.entry.id}`} episode={item.entry} />
          ) : (
            <ReviewRow key={`review-${item.entry.id}`} review={item.entry} />
          ),
        )}
      </ul>
      {!filtered.length && (
        <p className="py-8">
          {siteConfig.language === "zh-CN"
            ? "没有符合条件的公开内容，请调整筛选。"
            : "No published content matches these filters."}
        </p>
      )}
    </section>
  );
}
