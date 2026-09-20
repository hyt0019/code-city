export function pageRoute(pathname: string) {
  const match = /\/repos\/([a-z0-9-]+)(?:\/index\.html)?\/?$/.exec(pathname);
  return match ? { slug: match[1], root: pathname.slice(0, match.index + 1) } : null;
}

export function sitePath(path: string): string {
  const root = pageRoute(location.pathname)?.root ?? new URL('./', location.href).pathname;
  return `${root}${path}`;
}
