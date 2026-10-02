// Adapted from satnaing/shadcn-admin components/layout/header, main and app-sidebar (MIT).
import { useEffect, useState, useRef } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { api, AdminError } from "./api";
import { Input } from "./ui/input";
import "./admin.css";
export function AdminLayout() {
  const navigate = useNavigate();
  const menu = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);

  const [session, setSession] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [key, setKey] = useState(""),
    [pending, setPending] = useState(false),
    [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!open) return;
    const links = Array.from(
      menu.current?.querySelectorAll<HTMLElement>("a,button") || [],
    );
    links[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (e.key === "Tab") {
        const first = links[0],
          last = links[links.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  useEffect(() => {
    api("/session")
      .then(() => setSession(true))
      .catch((e) => {
        setSession(false);
        if (!(e instanceof AdminError && e.status === 401)) setError(e.message);
      });
    const onScroll = () => setOffset(document.documentElement.scrollTop);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);
  if (session === null)
    return <main className="admin-main">正在检查审核会话…</main>;
  if (!session)
    return (
      <main className="admin-main admin-login">
        <h1>工作日志审核</h1>
        <p>登录后查看完整草稿并确认发布。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              await api("/login", {
                method: "POST",
                body: JSON.stringify({ key }),
              });
              setKey("");
              setSession(true);
              setOpen(false);
              await navigate({ to: "/agent-blog/admin" });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            审核密钥
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button disabled={pending}>{pending ? "登录中…" : "登录"}</button>
          <p role="alert">{error}</p>
        </form>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside ref={menu} className={"admin-sidebar " + (open ? "is-open" : "")}>
        <Link to="/agent-blog" className="admin-brand">
          Agent 工作日志
        </Link>
        <nav aria-label="审核导航">
          {(
            [
              ["待确认", "/agent-blog/admin"],
              ["已发布", "/agent-blog/admin/published"],
              ["播客", "/agent-blog/admin/episodes"],
              ["设置", "/agent-blog/admin/settings"],
            ] as const
          ).map(([name, to]) => (
            <Link
              key={name}
              to={to}
              onClick={() => setOpen(false)}
              activeProps={{ "aria-current": "page" }}
            >
              {name}
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => {
            await api("/logout", { method: "POST" });
            setOpen(false);
            setSession(false);
          }}
        >
          退出登录
        </button>
      </aside>
      <div className="admin-content">
        <header className={"admin-header " + (offset > 10 ? "has-shadow" : "")}>
          <button
            ref={trigger}
            aria-label="切换审核导航"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
          <span>人工确认工作台</span>
          <Link to="/agent-blog">公开站点</Link>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
