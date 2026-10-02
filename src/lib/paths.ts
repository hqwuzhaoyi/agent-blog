export function sitePath(path = "") {
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, "")}`;
}

export function reviewPath(id: string) {
  return sitePath(`reviews/${id}/`);
}

export function episodePath(id: string) {
  return sitePath(`episodes/${id}/`);
}
