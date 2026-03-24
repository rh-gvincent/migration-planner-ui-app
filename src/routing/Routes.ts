/**
 * Known app slugs used by the Console Chrome to mount this microfrontend.
 * Both serve the same RootApp module (see deploy/frontend.yaml).
 */
const APP_SLUG = "/openshift/migration-advisor-dev";

/**
 * Compute the mount-path prefix once and cache it.
 *
 * Resolution order (first defined value wins):
 *
 * 1. **Build-time injection** — Webpack's DefinePlugin (fec.config.js) sets
 *    `process.env.MIGRATION_PLANNER_APP_BASENAME` to `"/openshift/migration-advisor"`.
 *    Vite (dev/vite.config.ts) sets it to `""` for standalone mode.
 *
 * 2. **Lazy runtime detection** — if the build pipeline did not inject the
 *    constant, we read window.location.pathname the first time a routes.*
 *    getter is accessed. This is safe because routes.* is only accessed inside
 *    React renders, and the Chrome shell only renders this federated module
 *    after navigating to its URL — so pathname is already correct at that point.
 *
 * The result is cached permanently after the first call. Subsequent calls
 * return the cached value without touching window.location again, so Chrome's
 * synchronous window.location update during Back/Forward navigation (which
 * occurs before React's render cycle) cannot corrupt the value.
 *
 * This is intentionally NOT computed at module-load time. Webpack Module
 * Federation pre-loads federated modules in the background while the user is
 * still on a different page (e.g. the Console home or search). At pre-load
 * time window.location.pathname is not the app's URL, so a module-level
 * constant would be set to "" and all routes would lose their prefix.
 */
let _cachedBasename: string | null = null;

function getAppBasename(): string {
  if (_cachedBasename !== null) return _cachedBasename;

  // Build-time injection (primary path)
  const buildTime = process.env.MIGRATION_PLANNER_APP_BASENAME;
  if (buildTime !== undefined) {
    return (_cachedBasename = buildTime);
  }

  // Runtime detection fallback
  try {
    const pathname = window.location.pathname.replace(/^\/(preview|beta)/, "");
    if (pathname.startsWith(APP_SLUG)) return (_cachedBasename = APP_SLUG);
  } catch {
    // SSR / test environment without window
  }

  return (_cachedBasename = "");
}

/**
 * Centralized route map.
 *
 * Every path includes the mount-path prefix so that navigate() and <Link to>
 * calls work correctly in both standalone and microfrontend mode.
 * All getters call getAppBasename() which caches on first access.
 */
export const routes = {
  get root() {
    return getAppBasename() || "/";
  },
  get assessments() {
    return `${getAppBasename()}/assessments`;
  },
  assessmentById: (id: string) => `${getAppBasename()}/assessments/${id}`,
  assessmentReport: (id: string) =>
    `${getAppBasename()}/assessments/${id}/report`,
  get assessmentCreate() {
    return `${getAppBasename()}/assessments/create`;
  },
  get exampleReport() {
    return `${getAppBasename()}/assessments/example-report`;
  },
  get discoveryOvaExampleReport() {
    return `${getAppBasename()}/assessments/discovery-ova-example-report`;
  },
  get environments() {
    return `${getAppBasename()}/environments`;
  },
  get tools() {
    return `${getAppBasename()}/tools`;
  },
  get partners() {
    return `${getAppBasename()}/partners`;
  },
  get myPartner() {
    return `${getAppBasename()}/partners/my`;
  },
  get customers() {
    return `${getAppBasename()}/partners/customers`;
  },
  get adminGroups() {
    return `${getAppBasename()}/partners/groups`;
  },
  adminGroupById: (id: string) => `${getAppBasename()}/partners/groups/${id}`,
} as const;
