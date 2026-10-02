import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { useEffect, useState, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Article } from "../../components/Article";
import { api, AdminError } from "./api";
import { Input } from "./ui/input";
const fieldLabels: Record<string, string> = {
  title: "标题",
  summary: "摘要",
  source: "来源",
  date: "日期",
  platforms: "平台",
  highlights: "重要进展数量",
  language: "语言",
};

export function ReviewDetail({ id }: { id: string }) {
  const [review, setReview] = useState<any>(null),
    [draft, setDraft] = useState<any>(null),
    [audit, setAudit] = useState<any[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [tab, setTab] = useState("preview"),
    [editing, setEditing] = useState(false),
    [stale, setStale] = useState(false),
    [success, setSuccess] = useState<any>(null);
  const dirty =
    !!review &&
    JSON.stringify(draft) !==
      JSON.stringify({ data: review.data, body: review.body });
  async function load() {
    setError("");
    try {
      const r = await api(`/reviews/${id}`);
      setReview(r);
      setDraft({ data: r.data, body: r.body });
      setStale(false);
      setEditing(false);
      setAudit((await api(`/reviews/${id}/audit`)).items);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });
  const discardDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (blocker.status === "blocked") discardDialog.current?.showModal();
  }, [blocker.status]);

  async function mutate(action: "save" | "publish") {
    setPending(true);
    setError("");
    setSuccess(null);
    try {
      const r = await api(
        `/reviews/${id}${action === "publish" ? "/publish" : ""}`,
        {
          method: action === "publish" ? "POST" : "PUT",
          body: JSON.stringify(
            action === "publish"
              ? { revision: review.revision }
              : { ...draft, expectedRevision: review.draftRevision },
          ),
        },
      );
      if (action === "publish") setSuccess(r);
      await load();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof AdminError && e.status === 409) setStale(true);
    } finally {
      setPending(false);
    }
  }
  if (!review)
    return (
      <>
        <p role="alert" className="text-destructive mb-4">
          {error}
        </p>
        <p>读取完整预览…</p>
      </>
    );
  return (
    <>
      {blocker.status === "blocked" && (
        <dialog
          ref={discardDialog}
          role="alertdialog"
          aria-labelledby="unsaved-title"
          className="unsaved-dialog"
          onCancel={(e) => {
            e.preventDefault();
            blocker.reset();
          }}
        >
          <h2 id="unsaved-title">有未保存的修改</h2>
          <p>离开会丢弃当前编辑。</p>
          <Button autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </Button>
          <Button onClick={() => blocker.proceed()}>丢弃修改并离开</Button>
        </dialog>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">审核工作日志</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          完整预览与当前保存版本的发布确认
        </p>
      </div>
      <p role="alert" className="text-destructive mb-4">
        {error}
      </p>
      {stale && (
        <Button
          onClick={() => {
            if (!dirty || window.confirm("刷新将丢弃本地修改，继续？")) load();
          }}
        >
          刷新并重新审核
        </Button>
      )}
      {success && (
        <p role="status">
          已发布 · {success.publishedAt} ·{" "}
          <a href={success.url}>查看公开工作日志</a>
        </p>
      )}
      <div className="admin-tabs" role="tablist" aria-label="审核内容">
        <Button
          role="tab"
          variant={tab === "preview" ? "default" : "outline"}
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          预览
        </Button>
        <Button
          role="tab"
          variant={tab === "info" ? "default" : "outline"}
          aria-selected={tab === "info"}
          onClick={() => setTab("info")}
        >
          信息与修订
        </Button>
      </div>
      <div className="review-grid">
        <section
          className={
            "review-preview " + (tab === "preview" ? "mobile-active" : "")
          }
        >
          <Article
            {...review.data}
            date={review.data.date}
            html={review.html}
            preview
          />
          {editing && (
            <form className="admin-editor" onSubmit={(e) => e.preventDefault()}>
              <h2>编辑私密草稿</h2>
              {(["title", "summary", "source", "date"] as const).map((key) => (
                <label key={key}>
                  {
                    {
                      title: "标题",
                      summary: "摘要",
                      source: "来源",
                      date: "日期",
                    }[key]
                  }
                  <Input
                    value={draft.data[key]}
                    type={key === "date" ? "date" : "text"}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        data: { ...draft.data, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
              <label>
                正文 Markdown
                <Textarea
                  className="font-mono text-sm"
                  rows={20}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
            </form>
          )}
        </section>
        <aside
          className={"review-info " + (tab === "info" ? "mobile-active" : "")}
        >
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>发布确认</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-foreground">确认会公开的内容</p>
              <p>{review.data.title}</p>
              <p>{review.data.date}</p>
              <a href={review.url}>{review.url}</a>
              <Badge variant="outline">
                {dirty
                  ? "未保存"
                  : stale
                    ? "版本已变化"
                    : review.publishedRevision === review.revision
                      ? "已发布"
                      : "待确认"}
              </Badge>
              <p className="revision">当前版本 {review.revision}</p>
              <p>
                {dirty
                  ? "有未保存修改；保存后重新查看完整预览"
                  : stale
                    ? "草稿已更新，请重新查看"
                    : review.publishedRevision === review.revision
                      ? "此版本已发布"
                      : "当前保存草稿，等待人工确认"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(!editing);
                  setTab("preview");
                }}
              >
                {editing ? "结束编辑" : "编辑草稿"}
              </Button>
            </CardContent>
          </Card>
          <h2>素材来源</h2>
          <p>
            {review.data.source} · {review.data.platforms.join(" + ")}
          </p>
          <h2>与已发布版本比较</h2>
          {review.published ? (
            <>
              <p>已公开版本 {review.published.revision}</p>
              {[
                "title",
                "summary",
                "source",
                "date",
                "platforms",
                "highlights",
                "language",
              ].map((k) => (
                <div key={k}>
                  <strong>{fieldLabels[k]}</strong>
                  <p>
                    已发布：{JSON.stringify(review.published.data[k] ?? null)}
                  </p>
                  <p>当前：{JSON.stringify(review.data[k] ?? null)}</p>
                </div>
              ))}
              <details>
                <summary>正文对比</summary>
                <h3>已发布正文</h3>
                <pre>{review.published.body}</pre>
                <h3>当前草稿正文</h3>
                <pre>{review.body}</pre>
              </details>
            </>
          ) : (
            <p>初次发布，尚无公开版本。</p>
          )}
          <h2>真实确认记录</h2>
          {audit.length ? (
            audit.map((a) => (
              <p key={a.revision} className="revision">
                {a.approved_at} · {a.actor} · {a.revision}
              </p>
            ))
          ) : (
            <p>暂无确认记录。</p>
          )}
        </aside>
      </div>
      <div className="review-actions">
        <Button
          variant="outline"
          disabled={!dirty || pending || stale}
          onClick={() => mutate("save")}
        >
          {pending ? "请求中…" : "保存草稿"}
        </Button>
        <Button
          disabled={
            pending ||
            dirty ||
            stale ||
            !review.html ||
            review.revision !== review.draftRevision ||
            review.revision === review.publishedRevision
          }
          onClick={() => mutate("publish")}
        >
          {pending ? "请求中…" : "我已检查完整内容，确认并发布"}
        </Button>
      </div>
    </>
  );
}
