# App Architecture

This document defines the architecture patterns used in this project. All new
code **must** follow these patterns to maintain consistency and testability.

The architecture is inspired by the
[Flutter MVVM guide](https://docs.flutter.dev/app-architecture/guide#repositories)
adapted for React + TypeScript.

---

## Layer overview

```
┌─────────────────────────────────────────────┐
│  UI Layer                                   │
│  ┌─────────────┐      ┌──────────────────┐  │
│  │   Views     │─────▶│  View Models     │  │
│  │  (React FC) │      │ (custom hooks)   │  │
│  └─────────────┘      └──────┬───────────┘  │
│                              │              │
├──────────────────────────────┼──────────────┤
│  Data Layer                  │              │
│                    ┌─────────▼───────────┐  │
│                    │      Stores         │  │
│                    │ (ExternalStoreBase) │  │
│                    └─────────┬───────────┘  │
│                              │              │
│                    ┌─────────▼───────────┐  │
│                    │  API Clients        │  │
│                    │ (generated OpenAPI) │  │
│                    └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

| Layer           | Responsibility                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Views**       | Pure rendering. Receive data from the view model and render PatternFly components. No business logic.                                                                                                                                                                        |
| **View Models** | Custom hooks (`use<Feature>ViewModel`). Combine store data with local UI state. Control store polling lifecycle.                                                                                                                                                             |
| **Stores**      | Source of truth for server data. Extend `ExternalStoreBase` or `PollableStoreBase`. Encapsulate API calls, caching, polling, error handling. **All model mapping happens here** — stores transform API models (data-models) into models suitable for the UI, and vice-versa. |
| **API Clients** | Auto-generated OpenAPI clients from `@openshift-migration-advisor/planner-sdk`. Stateless.                                                                                                                                                                                   |

---

## Dependency Injection

All singletons are registered in `src/config/di.ts` using the
`@y0n1/react-ioc` container with Symbol-based keys.

```typescript
// Register
c.register(Symbols.AssessmentsStore, new AssessmentsStore(assessmentApi));

// Consume (in a hook or component)
const store = useInjection<AssessmentsStore>(Symbols.AssessmentsStore);
```

### Rules

1. **Define symbols** in `src/config/di.ts` → `Symbols` object.
2. **Register instances** in `createContainer()`.
3. **Consume** via `useInjection<T>(Symbols.X)` — never construct
   stores/services directly in components or hooks.

---

## Stores (Data Layer)

Stores live in `src/data/stores/` and are the **single source of truth** for
server data. Each store wraps one API client.

### Base classes

| Class                  | File                            | Purpose                                                                                                       |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ExternalStoreBase<T>` | `src/lib/mvvm/ExternalStore.ts` | Minimal store with `subscribe` / `getSnapshot` / `notify()` for `useSyncExternalStore`.                       |
| `PollableStoreBase<T>` | `src/lib/mvvm/PollableStore.ts` | Extends `ExternalStoreBase`. Adds `startPolling(ms)`, `stopPolling()`, and an abstract `poll(signal)` method. |

### When to use which base class

- Use `PollableStoreBase` when the store manages a **list of entities** that
  should be periodically refreshed (e.g. `AssessmentsStore`, `SourcesStore`,
  `JobsStore` with conditional polling).
- Use `ExternalStoreBase` when polling is not needed (e.g. `ImagesStore`,
  `VersionsStore`).

### Store conventions

1. Store class name: `<Entity>Store` (e.g. `AssessmentsStore`).
2. One store per entity / API resource.
3. Stores **must not** import other stores or hold cross-store references.
4. Stores **must not** import React. They are plain TypeScript classes.
5. CRUD methods mutate internal state then call `this.notify()`.
6. For `PollableStoreBase`, implement `protected override poll(signal): Promise<void>`.

### Existing stores

| Store              | Base                | Snapshot type            | Notes                                                                             |
| ------------------ | ------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `AssessmentsStore` | `PollableStoreBase` | `AssessmentModel[]`      | CRUD + cluster sizing. Maps API `Assessment` → `AssessmentModel`.                 |
| `SourcesStore`     | `PollableStoreBase` | `SourceModel[]`          | CRUD + inventory. Maps API `Source` → `SourceModel`.                              |
| `JobsStore`        | `PollableStoreBase` | `JobsStoreState`         | RVTools job lifecycle, conditional polling. UI-unaware — no navigation callbacks. |
| `ImagesStore`      | `ExternalStoreBase` | `Record<string, string>` | OVA download URLs                                                                 |
| `VersionsStore`    | `ExternalStoreBase` | `VersionInfo`            | UI + API version info                                                             |
| `ReportStore`      | `ExternalStoreBase` | `ReportStoreState`       | Export lifecycle, wraps `PdfExportService` + `HtmlExportService`                  |

---

## Domain Models

Domain models live in `src/models/` and wrap raw API types with pre-computed
derived properties. They are **intersection types** (`ApiType & { ...computed }`)
created by factory functions.

### Why domain models?

- **Centralise** computed properties (e.g. `ownerFullName`, `isReady`) that were
  previously duplicated across view models and views.
- **Zero breaking changes** — because the model extends the API type, existing
  code that reads raw properties (`model.id`, `model.name`) keeps working.
- **Computed once** — factory functions are called in the store's write paths
  (`list`, `create`, `update`), so derived data is fresh whenever the store
  updates.

### Existing domain models

| Model             | Wraps (API type) | Computed properties                                                   | Factory                   |
| ----------------- | ---------------- | --------------------------------------------------------------------- | ------------------------- |
| `AssessmentModel` | `Assessment`     | `ownerFullName`, `latestSnapshot`, `hasUsefulData`, `snapshotsSorted` | `createAssessmentModel()` |
| `SourceModel`     | `Source`         | `isReady`, `isConnected`, `displayStatus`                             | `createSourceModel()`     |

### Conventions

1. File name: `src/models/<EntityName>Model.ts`.
2. Export a **type** (intersection with the API type) and a **factory function**.
3. Factory functions are **pure** — no side effects, no React imports.
4. Stores are responsible for calling the factory in every write path.
5. View models and views import the domain model type, not the raw API type.

---

## View Models (UI Logic Layer)

View models live in `src/ui/<feature>/view-models/` and are **custom React
hooks** that encapsulate all logic for a single view.

### Conventions

1. File name: `use<Feature>ViewModel.ts`.
2. **Export an interface** for the return type: `<Feature>ViewModel`.
3. Hook signature: `(): <Feature>ViewModel`.
4. One view model per view — 1:1 relationship.
5. View models get stores from IoC via `useInjection`.
6. Subscribe to stores via `useSyncExternalStore(store.subscribe.bind(store), store.getSnapshot.bind(store))`.
7. **Control polling lifecycle** with `store.startPolling()` in `useMount`
   and `store.stopPolling()` in `useUnmount`.
8. View models may hold local UI state (`useState`) that is not persisted
   (e.g. loading flags, modal open state).
9. View models **must not** render JSX.

### Existing view models

| View model                      | Feature     | Stores consumed                                                                                                               |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `useAssessmentsScreenViewModel` | assessment  | `AssessmentsStore` (list + polling)                                                                                           |
| `useAssessmentsScreenViewModel` | assessment  | `AssessmentsStore` (CRUD) + `JobsStore` (RVTools jobs)                                                                        |
| `useAssessmentDetailsViewModel` | assessment  | `AssessmentsStore` + `SourcesStore` (detail view, source/agent lookup, snapshot parsing)                                      |
| `useCreateFromOvaViewModel`     | assessment  | `AssessmentsStore` + `EnvironmentPageViewModel` (form state, draft persistence, assessment creation)                          |
| `useEnvironmentPageViewModel`   | environment | `SourcesStore` + `AssessmentsStore` + `ImagesStore` (full CRUD, download URL flow, polling)                                   |
| `useReportPageViewModel`        | report      | `AssessmentsStore` + `SourcesStore` + `ReportStore` (assessment lookup, cluster selection, cluster VM building, export state) |
| `useHomeScreenViewModel`        | home        | None (local UI state only)                                                                                                    |
| `useVersionInfoViewModel`       | view-info   | `VersionsStore`                                                                                                               |

### Example — data fetching + polling

```typescript
export const useAssessmentsScreenViewModel = (): AssessmentsScreenViewModel => {
  const store = useInjection<AssessmentsStore>(Symbols.AssessmentsStore);
  const assessments = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
  );

  const hasInitialLoadRef = useRef(false);
  const [fetchState, fetchAssessments] = useAsyncFn(async () => {
    try {
      return await store.list();
    } finally {
      hasInitialLoadRef.current = true;
    }
  }, [store]);

  useMount(() => {
    void fetchAssessments();
    store.startPolling(DEFAULT_POLLING_DELAY);
  });

  useUnmount(() => {
    store.stopPolling();
  });

  return {
    assessments,
    isLoading: fetchState.loading,
    hasInitialLoad: hasInitialLoadRef.current,
  };
};
```

### Example — view model distribution via context

When deeply nested children need the same view model, use a thin React
context to avoid prop-drilling. The context holds no logic — it merely
distributes the VM's return value:

```typescript
// EnvironmentPageContext.tsx — thin context provider
const Ctx = createContext<EnvironmentPageViewModel | null>(null);

export const EnvironmentPageProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const vm = useEnvironmentPageViewModel();
  return <Ctx.Provider value={vm}>{children}</Ctx.Provider>;
};

export const useEnvironmentPage = (): EnvironmentPageViewModel => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Must be inside <EnvironmentPageProvider>");
  return ctx;
};

// Environment.tsx — top-level view
export const Environment: React.FC = () => (
  <EnvironmentPageProvider>
    <EnvironmentContent />
  </EnvironmentPageProvider>
);

// Any nested child (SourcesTable, EmptyState, etc.)
const vm = useEnvironmentPage();
```

### Example — cross-store orchestration

When a view model needs to coordinate between multiple stores, it observes
state from both and orchestrates actions between them:

```typescript
export const useAssessmentsScreenViewModel = (): AssessmentsScreenViewModel => {
  const assessmentsStore = useInjection<AssessmentsStore>(
    Symbols.AssessmentsStore,
  );
  const jobsStore = useInjection<JobsStore>(Symbols.JobsStore);

  const jobState = useSyncExternalStore(
    jobsStore.subscribe.bind(jobsStore),
    jobsStore.getSnapshot.bind(jobsStore),
  );

  // React to job completion: navigate + refresh assessments
  useEffect(() => {
    /* watch jobState transitions */
  }, [jobState]);

  // Cancel: orchestrate across stores
  const cancelRVToolsJob = useCallback(async () => {
    const latestJob = await jobsStore.cancelRVToolsJob();
    if (latestJob?.status === JobStatus.Completed && latestJob.assessmentId) {
      await assessmentsStore.remove(latestJob.assessmentId);
    }
  }, [jobsStore, assessmentsStore]);

  return { currentJob: jobState.currentJob, cancelRVToolsJob /* ... */ };
};
```

---

## Views (Presentation Layer)

Views live in `src/ui/<feature>/views/` and are **React functional
components** that render UI using data from a view model.

### Conventions

1. File name: `<Feature>.tsx` or `<Feature>Screen.tsx`.
2. Call the view model hook at the top: `const vm = use<Feature>ViewModel()`.
3. Destructure what you need from `vm`.
4. **No business logic** — only conditional rendering, layout, and event
   handlers that delegate to `vm` callbacks.
5. Use PatternFly 6 components.
6. Set `displayName` on every exported component.

### Styling

- **CSS-in-JS only** — use `@emotion/css` for all component styles.
  Do **not** create plain `.css` files. Emotion keeps styles co-located with
  the components that use them and avoids global class-name collisions.

```typescript
import { css } from "@emotion/css";

const wrapper = css`
  display: flex;
  gap: var(--pf-t--global--spacer--md);
`;

// Use in JSX
<div className={wrapper}>…</div>
```

- For keyframe animations, use `keyframes` from `@emotion/css`.

---

## Routing

Routes are defined in `src/routing/AppRoutes.tsx` using `react-router-dom` v6.

| File            | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `AppRoutes.tsx` | Flat route definitions using `<Routes>` / `<Route>`.                 |
| `Routes.ts`     | Centralised route map — all navigable paths live here (no basename). |

The `HomeScreen` view is a **layout route** that renders a shell (tabs,
breadcrumbs) with an `<Outlet />` for child routes (`AssessmentsScreen`,
`Environment`).

### Route map (`Routes.ts`) and the basename rule

The app runs in two modes with different routing contexts:

| Mode                      | Who provides `<BrowserRouter>` | Router `basename` | App mount path                   |
| ------------------------- | ------------------------------ | ----------------- | -------------------------------- |
| **Standalone (dev)**      | `dev/src/AppShell.tsx`         | `"/"`             | `/` (root)                       |
| **Microfrontend (stage)** | Host chrome                    | `"/"`             | `/openshift/migration-advisor/*` |

In **standalone mode**, the BrowserRouter's `basename` is `"/"` and the app
occupies the root. Basename-free absolute paths like `/assessments/123` work
because they resolve from `"/"`.

In **microfrontend (stage) mode**, the Chrome's `BrowserRouter` also has
`basename="/"`, but the app is mounted inside a nested `<Route>` at
`/openshift/migration-advisor/*`. An absolute `navigate("/assessments/123")`
resolves from the router root (`"/"`), producing the URL `/assessments/123` —
which is _outside_ the app's mount point. Navigation paths must therefore
include the full mount prefix.

`src/routing/Routes.ts` handles this transparently through **dynamic runtime
detection**. Each time a route is accessed, it checks `window.location.pathname`
to determine whether the app slug (`/openshift/migration-advisor`) is present:

- Dev mode → basename = `""`
- Stage mode → basename = `"/openshift/migration-advisor"`

Every entry in the `routes` object uses getters that compute the basename
dynamically, ensuring correctness even during hot-module reloading or federated
module initialization timing edge cases:

```typescript
// src/routing/Routes.ts (simplified)
function getAppBasename(): string {
  const pathname = window.location.pathname.replace(/^\/(preview|beta)/, "");
  return pathname.startsWith("/openshift/migration-advisor")
    ? "/openshift/migration-advisor"
    : "";
}

export const routes = {
  get assessments() {
    return `${getAppBasename()}/assessments`;
  },
  assessmentReport: (id: string) =>
    `${getAppBasename()}/assessments/${id}/report`,
  // ... other routes with dynamic basename resolution
} as const;
```

The routes module logs basename detection at `console.info` level whenever
the detected mode changes, helping diagnose production routing issues.

### How to add a new route

Follow these steps when adding a navigable page to the application.

#### 1. Add the path to the route map

Open `src/routing/Routes.ts` and add the new entry. Use a template literal
with `APP_BASENAME` for static paths and a function for parameterised paths:

```typescript
export const routes = {
  // ... existing entries ...
  migrationPlans: `${APP_BASENAME}/migration-plans`,
  migrationPlanById: (id: string) => `${APP_BASENAME}/migration-plans/${id}`,
} as const;
```

**Do NOT hardcode `/openshift/migration-advisor`** — `APP_BASENAME` handles
mode detection at runtime.

#### 2. Create the view and view model

Follow the standard MVVM pattern:

- **View model**: `src/ui/<feature>/view-models/use<Feature>ViewModel.ts`
- **View**: `src/ui/<feature>/views/<Feature>.tsx`

See the "View Models" and "Views" sections above for conventions.

#### 3. Register the `<Route>` in `AppRoutes.tsx`

Open `src/routing/AppRoutes.tsx` and add the route. Use `lazy()` for
code-splitting:

```typescript
const MigrationPlans = lazy(
  () => import(/* webpackChunkName: "MigrationPlans" */ "../ui/migration-plans/views/MigrationPlans"),
);

// Inside <Routes>:
// As a child of the HomeScreen layout route (renders inside tabs):
<Route path="migration-plans" element={<MigrationPlans />} />

// OR as an independent route (own page layout):
<Route path="migration-plans/:id" element={<MigrationPlanDetail />} />
```

Route `path` values are **relative** (no leading `/`) — they are resolved
relative to the parent `<Routes>` element, which itself sits under the
`basename`.

#### 4. Navigate using the route map

Always import from `Routes.ts` — never hardcode path strings:

```typescript
// In a view model (navigate):
import { routes } from "../../../routing/Routes";
navigate(routes.migrationPlans);
navigate(routes.migrationPlanById(plan.id));

// In a view (Link / breadcrumb):
<Link to={routes.migrationPlans}>Back to plans</Link>

// Breadcrumb:
breadcrumbs={[
  { key: 1, to: routes.root, children: "Migration assessment" },
  { key: 2, to: routes.migrationPlans, children: "migration plans" },
  { key: 3, isActive: true, children: plan.name },
]}
```

#### 5. Update tests

If the view model calls `navigate()`, assert against the `routes` object.
In the jsdom test environment, `APP_BASENAME` resolves to `""`, so routes
are basename-free:

```typescript
import { routes } from "../../../../routing/Routes";

expect(mockNavigate).toHaveBeenCalledWith(routes.migrationPlanById("p-1"));
// In tests this equals "/migration-plans/p-1"
```

#### Common mistakes to avoid

- **Hardcoding the basename** in `navigate()` / `<Link>` — e.g.
  `navigate("/openshift/migration-advisor/foo")`. This breaks standalone
  mode and bypasses the runtime detection.
- **Using string literals** instead of `routes.*` — this bypasses the
  centralised route map and makes future path changes error-prone.
- **Comparing `location.pathname`** against hardcoded strings — use
  `routes.*` for `startsWith()` / equality checks so they work in both modes.
- **Adding a leading `/` to `<Route path>`** — route paths in `AppRoutes.tsx`
  are relative. A leading `/` makes them absolute, which can cause matching
  issues under nested `<Routes>` elements.

#### Debugging production routing issues

If you see incorrect URLs in production (e.g. missing the
`/openshift/migration-advisor` prefix), check the browser console for
`[Routes] Basename detected:` log entries. This will show:

- Which mode was detected (`microfrontend` or `standalone`)
- The detected basename value
- The current pathname at detection time
- Whether the basename changed during the session

The routes module uses dynamic getters to resolve the basename fresh on each
access, preventing stale values from module-load timing issues in federated
module environments.

---

## Entry Points

| File                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `src/entry.ts`         | Dynamic import of `MainApp` (Webpack entry).                      |
| `src/MainApp.tsx`      | Creates DI container, wraps app in `DependencyInjectionProvider`. |
| `dev/src/AppShell.tsx` | Standalone dev server shell with mocked chrome.                   |

---

## Services

Stateless service classes that provide capabilities unrelated to API data.
Services are consumed by stores, **not** directly by view models or views.

The `report-export` service is grouped by output format:

```
src/services/report-export/
├── pdf/
│   └── PdfExportService.ts
└── html/
    ├── types.ts               ← HTML pipeline types + service input contract
    ├── HtmlExportService.ts
    ├── HtmlTemplateBuilder.ts
    ├── ChartDataTransformer.ts
    └── __tests__/
```

External consumers import directly from the concrete file that defines each
service or type (no barrel). Store-level types (`LoadingState`, `ExportError`)
are defined in `src/data/stores/interfaces/IReportStore.ts`.

| Service             | Subfolder | Purpose                                   |
| ------------------- | --------- | ----------------------------------------- |
| `PdfExportService`  | `pdf/`    | Generates PDF from React component        |
| `HtmlExportService` | `html/`   | Generates HTML report from inventory data |

---

## Models

- Domain models come from `@openshift-migration-advisor/planner-sdk`.
- App-specific models live in `src/models/` (e.g. `VersionInfo`).

---

## Testing

- **Framework**: Vitest + `@testing-library/react` + jsdom.
- **Setup**: `src/__tests__/vitest.setup.ts`.
- **Convention**: Test files in `__tests__/` directories adjacent to source.
- **Style**: Unit tests with `vi.mock()` for dependencies. Stores and view
  models should be tested independently of React components.

### Store tests

- Instantiate the concrete store with a mocked API (e.g.
  `createMockApi(): XxxApiInterface`).
- Use `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()` for polling.
- Verify: initial snapshot, CRUD operations, subscriber notification, polling
  lifecycle (`startPolling` / `stopPolling`).

### View-model tests

- Mock `@y0n1/react-ioc` — `useInjection` dispatches on
  `symbol.description`.
- Mock `react-router-dom` (`useNavigate`, `useParams`, `useLocation`,
  `useOutletContext`) as needed.
- Mock `react-use` (`useMount`, `useUnmount`, `useAsyncFn`) when fine-grained
  lifecycle control is needed.
- Use `renderHook()` + `act()` from `@testing-library/react`.
- Use `createAssessmentModel` / `createSourceModel` for typed test data.

---

## Shared Utilities

| Module | Path                         | Purpose                                               |
| ------ | ---------------------------- | ----------------------------------------------------- |
| `Time` | `src/lib/common/Time.ts`     | Time constants (`Time.Second`, etc.) and `sleep()`.   |
| `auth` | `src/lib/middleware/auth.ts` | API middleware that injects `X-Authorization` header. |

---

## Legacy: DiscoverySourcesProvider (Deleted)

> **Status**: **Deleted** in Phase 4. The Provider, its context, and its type
> definition have been removed from the codebase. The raw API client DI
> symbols (`SourceApi`, `ImageApi`, `AssessmentApi`) that existed solely for
> the Provider have also been removed.

The `DiscoverySourcesProvider` was a large React context provider that
combined API calls, polling, and UI state into a single "god object". It was
progressively replaced across four phases:

| Phase | What was migrated                                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `Assessment.tsx` — CRUD + RVTools job orchestration moved to `useAssessmentsScreenViewModel` + `JobsStore`.                                                                                                                                   |
| 1     | `AssessmentsScreen.tsx` — listing + polling moved to `useAssessmentsScreenViewModel` + `AssessmentsStore`.                                                                                                                                    |
| 2     | `Environment.tsx` + all children — source management, download URL flow, polling moved to `useEnvironmentPageViewModel` + `SourcesStore` / `ImagesStore` / `AssessmentsStore`.                                                                |
| 2     | Provider removed from `AppRouter.tsx`. No active route consumes it.                                                                                                                                                                           |
| 3     | `Report.tsx` + `ExampleReport.tsx` + `assessment-report/` + `cluster-sizer/` — moved from `src/pages/report/` to `src/ui/report/views/`. `useReportPageViewModel` replaces the nested `<DiscoverySourcesProvider>`. Report routes re-enabled. |
| 4     | Provider, Context, and type definition **deleted**. Raw API client symbols removed from DI.                                                                                                                                                   |

One commented-out routes `AssessmentDetails` still contain stale references.
When re-enabled, they must be migrated to stores + view models first — **do NOT recreate the Provider**.

---

## Adding a new feature — checklist

1. **Store**: Create `src/data/stores/<Entity>Store.ts` extending
   `PollableStoreBase` (or `ExternalStoreBase`). Register in `src/config/di.ts`.
2. **View model**: Create `src/ui/<feature>/view-models/use<Feature>ViewModel.ts`.
   Define the return interface. Inject stores, subscribe, control polling.
3. **View**: Create `src/ui/<feature>/views/<Feature>.tsx`. Call the view model
   hook. Render using PatternFly.
4. **Route map**: Add the path to `src/routing/Routes.ts`.
5. **Route definition**: Add a `<Route>` in `src/routing/AppRoutes.tsx`.
6. **Navigation**: Use `routes.*` from `Routes.ts` in all `navigate()`,
   `<Link to>`, and breadcrumb `to` props. Never hardcode the basename.
7. **Tests**: Add `__tests__/` directories with unit tests for the store, view
   model, and view.
