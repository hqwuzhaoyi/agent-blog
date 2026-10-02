/** Stable public content URLs, independent of the rendering framework. */
export function sitePath(path = '') {
  return `/${path.replace(/^\//, '')}`;
}
export function reviewPath(id: string) { return sitePath(`reviews/${id}/`); }
export function episodePath(id: string) { return sitePath(`episodes/${id}/`); }
