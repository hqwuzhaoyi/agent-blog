export class AdminError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch("/agent-blog/admin/api" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result: any = await response.json();
  if (!response.ok)
    throw new AdminError(result.error || "请求失败", response.status);
  return result;
}
