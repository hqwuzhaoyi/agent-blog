import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, NotebookPen, Loader2, LogIn } from "lucide-react";
import { AdminRequestState } from "./request-state";
import { api, AdminError } from "./api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import { AppSidebar } from "./layout/app-sidebar";
import { Header } from "./layout/header";
import { Main } from "./layout/main";
import { siteConfig } from "../../site";
import "./admin.css";
export function AdminLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [key, setKey] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    api("/session")
      .then(() => setSession(true))
      .catch((e) => {
        setSession(false);
        if (!(e instanceof AdminError && e.status === 401)) setError(e.message);
      });
  }, []);
  async function logout() {
    setPending(true);
    setError("");
    try {
      await api("/logout", { method: "POST" });
      setSession(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  if (session === null)
    return (
      <div className="admin-scope grid min-h-svh place-items-center">
        <AdminRequestState status="loading" loadingLabel="正在检查审核会话…" />
      </div>
    );
  if (!session)
    return (
      <div className="admin-scope admin-auth">
        <div className="admin-auth-content">
          <Link
            to="/"
            className="mb-8 flex items-center justify-center gap-2 font-semibold text-xl"
          >
            <NotebookPen className="size-6" />
            {siteConfig.title}
          </Link>
          <Card className="w-full max-w-sm gap-4">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight">
                登录审核工作台
              </CardTitle>
              <CardDescription>
                查看完整草稿，确认当前保存版本。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
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
                    await navigate({ to: "/admin" });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <div className="grid gap-2">
                  <label htmlFor="review-key" className="text-sm font-medium">
                    审核密钥
                  </label>
                  <Input
                    id="review-key"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="输入审核密钥"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
                  {pending ? "登录中…" : "登录"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center border-t pt-4">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:underline"
              >
                返回公开站点
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  return (
    <div className="admin-scope admin-shell">
      <SidebarProvider>
        <AppSidebar onLogout={logout} pending={pending} />
        <SidebarInset className="admin-inset">
          <Header fixed className="border-b bg-background">
            <span className="text-sm font-medium">审核工作台</span>
            <Button asChild variant="ghost" size="sm" className="ms-auto">
              <Link to="/">
                公开站点
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </Header>
          <Main className="admin-main @container/content" fluid>
            {error && (
              <p role="alert" className="mb-4 text-destructive">
                {error}
              </p>
            )}
            <Outlet />
          </Main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
