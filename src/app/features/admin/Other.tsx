import { useEffect, useState } from "react";
import {
  AudioLines,
  ArrowUpRight,
  Loader2,
  Rss,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { api } from "./api";
import { siteConfig } from "../../site";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
export function Episodes() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    api(`/episodes?page=${page}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">播客</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          已经公开的节目、章节与音频。
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!data ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          读取中…
        </p>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.items.map((e: any) => (
              <Card key={e.id} className="gap-4">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-base leading-relaxed">
                      {e.data.title}
                    </CardTitle>
                    <Badge variant="secondary">已公开</Badge>
                  </div>
                  <CardDescription>
                    {e.data.date} · {Math.round(e.data.duration)} 秒
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-5 flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={e.url}>
                        节目页面
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={e.data.audio.url}>
                        <AudioLines className="size-3.5" />
                        音频
                      </a>
                    </Button>
                  </div>
                  <Separator />
                  <ol className="mt-4 grid gap-3">
                    {e.data.chapters.map((c: any, i: number) => (
                      <li
                        key={c.start}
                        className="flex items-start gap-3 text-sm"
                      >
                        <span className="font-mono text-xs text-muted-foreground pt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1">{c.title}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {c.start} 秒
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
          {!data.items.length && (
            <Card>
              <CardContent className="grid place-items-center gap-2 py-8 text-muted-foreground">
                <AudioLines className="size-8" />
                暂无公开节目。
              </CardContent>
            </Card>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              disabled={page * data.limit >= data.total}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function Settings() {
  const [mode, setMode] = useState(() =>
    typeof document === "undefined"
      ? "system"
      : document.documentElement.dataset.mode || "system",
  );
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          站点配置、订阅与审核会话。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" />
            站点外观
          </CardTitle>
          <CardDescription>当前站点构建配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-[100px_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">站点</dt>
            <dd>{siteConfig.title}</dd>
            <dt className="text-muted-foreground">语言</dt>
            <dd>{siteConfig.language}</dd>
            <dt className="text-muted-foreground">Theme</dt>
            <dd>
              <Badge variant="outline">{siteConfig.theme}</Badge>
            </dd>
          </dl>
          <Separator />
          <label className="grid gap-2 text-sm font-medium">
            当前浏览器外观
            <select
              className="h-9 max-w-64 rounded-md border bg-background px-3"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                if (e.target.value === "system")
                  delete document.documentElement.dataset.mode;
                else document.documentElement.dataset.mode = e.target.value;
              }}
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            此控制仅调整当前浏览器显示。主题由站点构建配置管理，应用更新后生效。
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rss className="size-4" />
            订阅入口
          </CardTitle>
          <CardDescription>公开内容的两种 RSS 订阅</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/agent-blog/rss.xml">
              全部内容 RSS
              <ArrowUpRight />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/agent-blog/early-coffee/rss.xml">
              播客 RSS
              <ArrowUpRight />
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            审核会话
          </CardTitle>
          <CardDescription>Agent Operator · 已登录</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            通过侧栏的操作者菜单退出登录。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
