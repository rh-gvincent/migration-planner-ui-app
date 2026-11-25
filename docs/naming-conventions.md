# Naming Conventions

This document defines the naming rules for files and directories inside `src/`.
These rules apply to **all new code** and should be enforced during code review.

## Files

| Category           | Case                                     | Examples                                             |
| ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| React components   | **PascalCase**                           | `Assessment.tsx`, `ConfirmationModal.tsx`            |
| View-model hooks   | **camelCase** (starting with `use`)      | `useAssessmentsScreenViewModel.ts`                   |
| Stores             | **PascalCase**                           | `AssessmentsStore.ts`, `ReportStore.ts`              |
| Store interfaces   | **PascalCase** (prefixed with `I`)       | `IAssessmentsStore.ts`                               |
| Models & factories | **PascalCase**                           | `AssessmentModel.ts`, `SnapshotParser.ts`            |
| Services           | **PascalCase**                           | `PdfExportService.ts`, `HtmlTemplateBuilder.ts`      |
| Context providers  | **PascalCase**                           | `EnvironmentPageContext.tsx`                         |
| Config modules     | **PascalCase**                           | `Di.ts`, `Auth.ts`                                   |
| Test files         | **Same case as source** + `.test` suffix | `SnapshotParser.test.ts`, `ClusterView.test.ts`      |
| Mock files         | **PascalCase** + `.mock` suffix          | `ClusterRequirementsRequest.mock.ts`, `Data.mock.ts` |

### All-lowercase reserved names

The following file base-names are **always lowercase**, regardless of context:

| Name                       | Reason                                                   |
| -------------------------- | -------------------------------------------------------- |
| `index.ts`                 | Node.js / bundler module resolution                      |
| `constants.ts`             | Shared constants module — kept lowercase by convention   |
| `types.ts`                 | Type-only module — kept lowercase by convention          |
| `styles.ts`                | Style (CSS-in-JS) module — kept lowercase by convention  |
| `entry.ts`                 | Red Hat Cloud Services `fec` build toolchain entry point |
| `*.d.ts` (e.g. `env.d.ts`) | TypeScript ambient declaration convention                |

### Hooks (`use*`) are camelCase

Files whose name starts with `use` follow **camelCase**, not PascalCase.
The `use` prefix signals a React hook and the rest of the name is camelCase:

```
useAssessmentsScreenViewModel.ts   ✓  (camelCase)
UseAssessmentsScreenViewModel.ts   ✗  (PascalCase — wrong)
use-assessments-screen.ts          ✗  (kebab-case — wrong)
```

## Directories

All directories use **kebab-case**.

| Good                 | Bad                 |
| -------------------- | ------------------- |
| `view-models/`       | `viewModels/`       |
| `assessment-report/` | `assessmentReport/` |
| `cluster-sizer/`     | `clusterSizer/`     |
| `html-export/`       | `htmlExport/`       |
| `version-info/`      | `versionInfo/`      |

### Special directories

| Directory    | Naming                                   |
| ------------ | ---------------------------------------- |
| `__tests__/` | Double-underscore convention (unchanged) |
| `@types/`    | Scoped TypeScript convention (unchanged) |

## Quick decision tree

```
Is it a directory?
  └─ Yes → kebab-case

Is it index, constants, types, styles, entry, or *.d.ts?
  └─ Yes → all-lowercase

Does the filename start with "use"?
  └─ Yes → camelCase  (e.g. useMyViewModel.ts)

Everything else (components, stores, models, services, tests, mocks, config)
  └─ PascalCase  (e.g. MyComponent.tsx)
```
