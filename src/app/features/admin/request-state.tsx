import { AlertCircle, FileSearch } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

type RequestStateProps = {
  status: "loading" | "error" | "empty";
  loadingLabel?: string;
  error?: string;
  emptyLabel?: string;
  emptyDescription?: string;
  onRetry?: () => void;
};

/** Present one request outcome. Fetching, auth and publication remain page-owned. */
export function AdminRequestState({
  status,
  loadingLabel = "读取中…",
  error,
  emptyLabel = "暂无内容",
  emptyDescription,
  onRetry,
}: RequestStateProps) {
  if (status === "loading")
    return (
      <div role="status" aria-live="polite" className="grid justify-items-center gap-3 px-4 py-8 text-muted-foreground">
        <span>{loadingLabel}</span>
        <div aria-hidden="true" className="grid w-40 gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4 justify-self-center" />
        </div>
      </div>
    );
  if (status === "error")
    return (
      <div className="grid justify-items-center gap-3 px-4 py-8">
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {error || "读取失败，请重试。"}
        </p>
        {onRetry && <Button variant="outline" onClick={onRetry}>重新读取</Button>}
      </div>
    );
  return (
    <div role="status" className="grid justify-items-center gap-2 px-4 py-8 text-muted-foreground">
      <FileSearch aria-hidden="true" className="size-8 opacity-60" />
      <p className="font-medium text-foreground">{emptyLabel}</p>
      {emptyDescription && <p className="text-sm">{emptyDescription}</p>}
    </div>
  );
}
