import { useEffect, useState } from "react";
import { api } from "./api";
import { siteConfig } from "../../site";
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
    <>
      <h1>播客</h1>
      <p role="alert">{error}</p>
      {!data ? (
        <p>读取中…</p>
      ) : (
        <>
          {data.items.map((e: any) => (
            <section className="approval-card" key={e.id}>
              <h2>{e.data.title}</h2>
              <p>
                {e.data.date} · {Math.round(e.data.duration)} 秒 · 已公开
              </p>
              <a href={e.url}>节目页面</a> · <a href={e.data.audio.url}>音频</a>
              <ol>
                {e.data.chapters.map((c: any) => (
                  <li key={c.start}>
                    {c.start} 秒 · {c.title}
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {!data.items.length && <p>暂无公开节目。</p>}
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <button
            disabled={page * data.limit >= data.total}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </>
      )}
    </>
  );
}
export function Settings() {
  const [mode, setMode] = useState("system");
  return (
    <>
      <h1>设置</h1>
      <h2>站点外观</h2>
      <p>
        {siteConfig.title} · 语言 {siteConfig.language} · Theme{" "}
        {siteConfig.theme}
      </p>
      <label>
        当前浏览器外观
        <select
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
      <p>此控制仅调整当前浏览器显示。</p>
      <p>主题由站点构建配置管理；应用更新后生效。</p>
      <h2>订阅入口</h2>
      <p>
        <a href="/agent-blog/rss.xml">全部内容 RSS</a>
      </p>
      <p>
        <a href="/agent-blog/early-coffee/rss.xml">播客 RSS</a>
      </p>
      <h2>审核会话</h2>
      <p>已登录。通过侧栏退出登录。</p>
    </>
  );
}
