// Server pagination adaptation of shadcn-admin TasksTable/DataTableToolbar/DataTablePagination.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpRight,
  FilterX,
} from "lucide-react";
import { api } from "./api";
import { AdminRequestState } from "./request-state";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
export function ReviewList({ published = false }: { published?: boolean }) {
  const [q, setQ] = useState(""),
    [source, setSource] = useState(""),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(10),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api(
      `/reviews?status=${published ? "published" : "pending"}&page=${page}&limit=${limit}&q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`,
    )
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [published, q, source, page, limit, retry]);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / limit));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {published ? "已发布" : "待确认"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {published
              ? "查看已公开的工作日志与确认记录。"
              : "查看完整内容后，确认当前保存版本。"}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {data ? `${data.total} 条工作日志` : "工作日志"}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="flex items-center justify-between gap-2 flex-wrap"
          role="toolbar"
          aria-label="工作日志筛选"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search
                className="absolute start-2.5 top-2.5 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="搜索"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索标题或摘要…"
                className="h-9 w-[200px] lg:w-[280px] ps-8"
              />
            </div>
            <Input
              aria-label="来源"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              placeholder="筛选来源"
              className="h-9 w-[140px] lg:w-[180px]"
            />
            {(q || source) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setSource("");
                  setPage(1);
                }}
              >
                <FilterX className="size-4" />
                重置
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <Table className={data?.items?.length ? "min-w-[720px]" : "w-full"}>
            <TableHeader
              className={!data?.items?.length ? "hidden" : undefined}
            >
              <TableRow>
                {["标题", "来源", "日期", "状态", "更新时间", ""].map(
                  (x, i) => (
                    <TableHead
                      key={i}
                      className={i === 0 ? "w-[36%]" : undefined}
                    >
                      {x || <span className="sr-only">预览操作</span>}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center">
                  <AdminRequestState status={error ? "error" : "loading"} error={error} onRetry={() => setRetry(retry + 1)} />
                </TableCell></TableRow>
              ) : data?.items?.length ? (
                data.items.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[340px] whitespace-normal">
                      <Link
                        to="/agent-blog/admin/reviews/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:underline"
                      >
                        {r.data.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.data.source}
                    </TableCell>
                    <TableCell>{r.data.date}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "published" ? "secondary" : "outline"
                        }
                        className="gap-1.5"
                      >
                        <span
                          className={`size-1.5 rounded-full ${r.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`}
                          aria-hidden
                        />
                        {r.status === "published" ? "已发布" : "待确认"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Intl.DateTimeFormat("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(r.createdAt))}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to="/agent-blog/admin/reviews/$id"
                          params={{ id: r.id }}
                        >
                          完整预览
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-44 text-center">
                    <AdminRequestState status="empty" emptyLabel="没有符合条件的工作日志" emptyDescription="调整关键词或来源筛选。" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap px-1">
          <p className="text-sm text-muted-foreground">
            {data ? `共 ${data.total} 条 · 第 ${page} / ${pages} 页` : ""}
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              每页
              <select
                aria-label="每页条数"
                className="h-9 rounded-md border bg-background px-2"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                aria-label="第一页"
                disabled={page <= 1 || !data}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="上一页"
                disabled={page <= 1 || !data}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="下一页"
                disabled={page >= pages || !data}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden size-8 lg:flex"
                aria-label="最后一页"
                disabled={page >= pages || !data}
                onClick={() => setPage(pages)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
