import { useInjection } from "@openshift-migration-advisor/ioc";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useAsyncFn } from "react-use";

import { Symbols } from "../../../config/Dependencies";
import type { IAssessmentsStore } from "../../../data/stores/interfaces/IAssessmentsStore";
import type { ISourcesStore } from "../../../data/stores/interfaces/ISourcesStore";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type { SourceModel } from "../../../models/SourceModel";
import type { ColumnKey, SortableColumn } from "../views/AssessmentsTable";
import {
  DEFAULT_VISIBLE_COLUMNS,
  MANDATORY_COLUMNS,
} from "../views/AssessmentsTable";
import type { AssessmentModel } from "../../../models/AssessmentModel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISIBLE_COLUMNS_KEY = "migration-advisor:visible-columns";

const getSelectedSourcesFromLocationState = (state: unknown): string[] => {
  if (
    typeof state !== "object" ||
    state === null ||
    !("selectedSources" in state) ||
    !Array.isArray(state.selectedSources)
  ) {
    return [];
  }

  return state.selectedSources.filter(
    (source: unknown): source is string => typeof source === "string",
  );
};

// ---------------------------------------------------------------------------
// View-model interface
// ---------------------------------------------------------------------------

export interface AssessmentsScreenViewModel {
  /** Available assessments */
  assessments: AssessmentModel[];
  /** Available appliances used to label and populate the appliance filter. */
  sources?: SourceModel[];
  /** `true` while a update-assessment request is in flight. */
  isUpdatingAssessment: boolean;
  /** `true` while a delete-assessment request is in flight. */
  isDeletingAssessment: boolean;

  // -- Column visibility & sorting -------------------------------------------
  /** Whether the column management modal is open. */
  isColumnModalOpen: boolean;
  /** Toggle the column management modal. */
  setIsColumnModalOpen: (open: boolean) => void;
  /** Visible columns (includes mandatory columns). */
  visibleColumns: ColumnKey[];
  /** Set visible columns (bulk update). */
  setVisibleColumns: (columns: ColumnKey[]) => void;
  /** Current sort state. */
  sortBy: { columnKey: SortableColumn; direction: "asc" | "desc" } | undefined;
  /** Update the sort state. */
  setSortBy: (
    sort: { columnKey: SortableColumn; direction: "asc" | "desc" } | undefined,
  ) => void;

  // -- Actions ---------------------------------------------------------------
  /** Update an existing assessment's name. */
  updateAssessment: (id: string, name: string) => Promise<void>;

  /** Delete an assessment by id. */
  deleteAssessment: (id: string) => Promise<void>;

  /** Share assessment with partner. */
  shareAssessment: (id: string) => Promise<void>;
  isSharingAssessment: boolean;

  /** Revoke an assessment share with the partner. */
  unshareAssessment: (id: string) => Promise<void>;
  isUnsharingAssessment: boolean;

  // -- Filters ---------------------------------------------------------------
  selectedSources: string[];
  setSelectedSources: (sources: string[]) => void;
  selectedOwners: string[];
  setSelectedOwners: (owners: string[]) => void;
  nameFilter: string;
  setNameFilter: (name: string) => void;
  clearAllFilters: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAssessmentsScreenViewModel = (): AssessmentsScreenViewModel => {
  const location = useLocation();
  const [selectedSources, setSelectedSources] = useState<string[]>(() =>
    getSelectedSourcesFromLocationState(location.state),
  );
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState("");

  const clearAllFilters = useCallback(() => {
    setNameFilter("");
    setSelectedOwners([]);
    setSelectedSources([]);
  }, [setNameFilter, setSelectedOwners, setSelectedSources]);

  const assessmentsStore = useInjection<IAssessmentsStore>(
    Symbols.AssessmentsStore,
  );
  const assessments = useSyncExternalStore(
    assessmentsStore.subscribe.bind(assessmentsStore),
    assessmentsStore.getSnapshot.bind(assessmentsStore),
  );

  const sourcesStore = useInjection<ISourcesStore>(Symbols.SourcesStore);
  const sources = useSyncExternalStore(
    sourcesStore.subscribe.bind(sourcesStore),
    sourcesStore.getSnapshot.bind(sourcesStore),
  );

  // ---- Column visibility and sorting --------------------------------------
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const userSelectedColumnsVersion = 4;
  const [userSelectedColumns, setUserSelectedColumns] = useLocalStorage<
    ColumnKey[]
  >(VISIBLE_COLUMNS_KEY, DEFAULT_VISIBLE_COLUMNS, userSelectedColumnsVersion);

  const [internalSortBy, setInternalSortBy] = useState<
    { columnKey: SortableColumn; direction: "asc" | "desc" } | undefined
  >({
    columnKey: "Name",
    direction: "asc",
  });

  // Ensure mandatory columns are always included
  const visibleColumns = useMemo(() => {
    const legacyKeyMap: Record<string, ColumnKey> = {
      LastUpdated: "ImportedToConsole",
    };
    const normalized = userSelectedColumns
      .map((key) => legacyKeyMap[key] ?? key)
      .filter((key): key is ColumnKey => DEFAULT_VISIBLE_COLUMNS.includes(key));
    const columns =
      normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE_COLUMNS];
    return Array.from(new Set([...columns, ...MANDATORY_COLUMNS]));
  }, [userSelectedColumns]);

  // Reset sort to Name column if the currently sorted column becomes hidden
  const sortBy = useMemo(() => {
    if (internalSortBy) {
      const sortedColumn = internalSortBy.columnKey;
      const sortedColumnNotInVisibleColumns =
        !visibleColumns.includes(sortedColumn);
      if (sortedColumn && sortedColumnNotInVisibleColumns) {
        return { columnKey: "Name" as const, direction: "asc" as const };
      }
    }
    return internalSortBy;
  }, [internalSortBy, visibleColumns]);

  const setVisibleColumns = useCallback(
    (columns: ColumnKey[]) => {
      setUserSelectedColumns(columns);
    },
    [setUserSelectedColumns],
  );

  // ---- Actions ------------------------------------------------------------
  const [updateState, doUpdateAssessment] = useAsyncFn(
    async (id: string, name: string): Promise<void> => {
      await assessmentsStore.update(id, { name });
    },
    [assessmentsStore],
  );

  const [shareState, doShareAssessment] = useAsyncFn(
    async (id: string): Promise<void> => {
      await assessmentsStore.share(id);
    },
    [assessmentsStore],
  );

  const [unshareState, doUnshareAssessment] = useAsyncFn(
    async (id: string): Promise<void> => {
      await assessmentsStore.unshare(id);
    },
    [assessmentsStore],
  );

  const [deleteState, doDeleteAssessment] = useAsyncFn(
    async (id: string): Promise<void> => {
      await assessmentsStore.remove(id);
    },
    [assessmentsStore],
  );

  // ---- Return -------------------------------------------------------------
  return {
    assessments,
    sources,
    selectedSources,
    setSelectedSources,
    selectedOwners,
    setSelectedOwners,
    nameFilter,
    setNameFilter,
    clearAllFilters,
    isUpdatingAssessment: updateState.loading,
    isDeletingAssessment: deleteState.loading,
    isColumnModalOpen,
    setIsColumnModalOpen,
    visibleColumns,
    setVisibleColumns,
    sortBy,
    setSortBy: setInternalSortBy,
    updateAssessment: doUpdateAssessment,
    deleteAssessment: doDeleteAssessment,
    shareAssessment: doShareAssessment,
    isSharingAssessment: shareState.loading,
    unshareAssessment: doUnshareAssessment,
    isUnsharingAssessment: unshareState.loading,
  };
};
