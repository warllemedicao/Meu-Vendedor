const standalonePublicRoutes = new Set(["/", "/politica-de-privacidade"]);

export function isStandalonePublicRoute(pathname: string | null): boolean {
  return pathname !== null && standalonePublicRoutes.has(pathname);
}
