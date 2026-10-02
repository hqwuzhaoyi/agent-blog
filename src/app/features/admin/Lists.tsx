// Table/filter/pagination structure adapted from shadcn-admin TasksTable; no bulk actions.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { api } from "./api";
import { Input } from "./ui/input";
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
    [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api(
      `/reviews?status=${published ? "published" : "pending"}&page=${page}&q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`,
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
  }, [published, q, source, page]);
  return (
    <>
      <h1>{published ? "已发布" : "待确认"}</h1>
      <p>查看完整内容后确认当前保存版本。</p>
      <div className="admin-filters">
        <label>
          搜索
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="标题或摘要"
          />
        </label>
        <label>
          来源
          <Input
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            placeholder="来源名称"
          />
        </label>
      </div>
      <p role="alert">{error}</p>
      {!data && !error ? (
        <p>读取中…</p>
      ) : (
        data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {["标题", "来源", "日期", "状态", "更新时间"].map((x) => (
                    <TableHead key={x}>{x}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to="/agent-blog/admin/reviews/$id"
                        params={{ id: r.id }}
                      >
                        {r.data.title} · 查看完整预览
                      </Link>
                    </TableCell>
                    <TableCell>{r.data.source}</TableCell>
                    <TableCell>{r.data.date}</TableCell>
                    <TableCell>
                      {r.status === "published" ? "已发布" : "待确认"}
                    </TableCell>
                    <TableCell>{r.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.items.length && <p>没有符合条件的工作日志。</p>}
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </button>
              <span>
                第 {page} 页 · 共 {data.total} 条
              </span>
              <button
                disabled={page * data.limit >= data.total}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </button>
            </div>
          </>
        )
      )}
    </>
  );
}
