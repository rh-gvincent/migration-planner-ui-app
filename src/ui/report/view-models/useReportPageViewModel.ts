import { useInjection } from "@openshift-migration-advisor/ioc";
import type {
  AssessmentSubsetInventory,
  ClusterRequirementsResponse,
  Infra,
  InventoryData,
  VMs,
} from "@openshift-migration-advisor/planner-sdk";
import type { PdfTextPage } from "@openshift-migration-advisor/shared-components";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAsyncFn } from "react-use";

import { Symbols } from "../../../config/Dependencies";
import type { IAssessmentsStore } from "../../../data/stores/interfaces/IAssessmentsStore";
import type { IJobsStore } from "../../../data/stores/interfaces/IJobsStore";
import type { ISourcesStore } from "../../../data/stores/interfaces/ISourcesStore";
import type { RvtoolsUploadState } from "../../../data/stores/JobsStore";
import type { RvtoolsPendingUploadBatch } from "../../../data/stores/rvtoolsLocalPersistence";
import { useIsPartner } from "../../../hooks/useIdentity";
import { formatAssessmentDateTime } from "../../../lib/common/Time";
import type { AssessmentModel } from "../../../models/AssessmentModel";
import {
  getAssessmentDataCollectedMs,
  getAssessmentImportedMs,
} from "../../../models/assessmentTimestamps";
import type { SourceModel } from "../../../models/SourceModel";
import { routes } from "../../../routing/Routes";
import type { SnapshotLike } from "../../../services/html-export/types";
import { isUploadedFileSourceType } from "../../assessment/helpers/assessmentSource";
import { MAX_RVTOOLS_FILES } from "../../assessment/rvtools";
import { HOME_TAB_LABELS } from "../../home/constants";
import {
  ALL_CLUSTERS_ID,
  buildClusterViewModel,
  type ClusterViewModel,
  resolveSelectedClusterId,
} from "../helpers/clusterViewModel";
import {
  extractScopedInventoryData,
  type ReportInventorySource,
} from "../helpers/groupInventoryFilter";
import {
  ALL_VMS_GROUP_ID,
  buildGroupViewModel,
  computeClusterSelectDisabled,
  type GroupViewModel,
} from "../helpers/groupViewModel";
import {
  canExportAssessmentReport,
  hasClusterResourcesForExport,
} from "../helpers/reportExportEligibility";
import {
  buildInventoryScopeCounts,
  buildViewingScopeCounts,
  formatReportScopeCounts,
} from "../helpers/reportScopeSummary";
import {
  isControlPlaneOnlyClusterMode,
  type SizingFormValues,
} from "../views/cluster-sizer/types";
import {
  getOptimizationStatusMessage,
  hasUtilizationComparison,
} from "../views/cluster-sizer/UtilizationSizing";
import { isRecommendationToolAvailable } from "../views/migration-recommendations/constants";
import {
  type RecommendationToolId,
  type ReportContentTab,
  reportTabFromSearch,
} from "../views/migration-recommendations/types";
import {
  formatNumber,
  formatRatio,
  getCpuOvercommitLabel,
  getMemoryOvercommitLabel,
} from "./ClusterSizingHelpers";
import { useGroupInventoryFilter } from "./useGroupInventoryFilter";
import { useReportRvtoolsPersistence } from "./useReportRvtoolsPersistence";
import { useReportRvtoolsUploadJob } from "./useReportRvtoolsUploadJob";
import { useReportRvtoolsVcenterFilter } from "./useReportRvtoolsVcenterFilter";
import { useReportV2InventoryScope } from "./useReportV2InventoryScope";
import {
  countEmbeddedClustersAcrossSubsets,
  useRvtoolsAllVcentersClusterCount,
} from "./useRvtoolsAllVcentersClusterCount";

// ---------------------------------------------------------------------------
// Sizing → PDF page builder
// ---------------------------------------------------------------------------

/**
 * Build the "Cluster sizing recommendations" PDF page for one calculated
 * cluster. Mirrors the fields shown in `SizingResult` so the exported PDF
 * matches what the user sees on screen (including the utilization-optimized
 * sizing when available).
 *
 * @see OMA-2414 - PDF export was dropping this section entirely after the
 * report moved to the shared chart-export component, because the chart
 * registry only captures registered chart/card elements, not the sizing
 * wizard's result panel.
 */
const buildClusterSizingPdfPage = (data: SizingPdfData): PdfTextPage => {
  const { result, formValues, clusterName } = data;
  const isSNO = isControlPlaneOnlyClusterMode(formValues.clusterMode);
  const isOptimized = hasUtilizationComparison(result);
  const displaySizing =
    isOptimized && result.optimizedSizing
      ? result.optimizedSizing
      : result.clusterSizing;
  const hasControlPlane = displaySizing.controlPlaneNodes > 0;

  const cpuOverCommitRatio =
    result.resourceConsumption.overCommitRatio?.cpu ?? 0;
  const memoryOverCommitRatio =
    result.resourceConsumption.overCommitRatio?.memory ?? 0;
  const cpuLimits = result.resourceConsumption.limits?.cpu ?? 0;
  const memoryLimits = result.resourceConsumption.limits?.memory ?? 0;

  const items: PdfTextPage["items"] = [
    { label: "Cluster name", value: clusterName },
    { label: "Target platform", value: "Bare metal" },
  ];

  if (isSNO) {
    items.push(
      {
        label: "Total nodes",
        value: String(displaySizing.totalNodes),
      },
      {
        label: "Node size",
        value: `${formValues.controlPlaneCpu} CPU, ${formValues.controlPlaneMemoryGb} GB memory`,
      },
      {
        label: "VMs to migrate",
        value: formatNumber(result.inventoryTotals.totalVMs),
      },
      {
        label: "VM resources (request)",
        value: `${formatNumber(result.inventoryTotals.totalCPU)} CPU, ${formatNumber(result.inventoryTotals.totalMemory)} GB memory`,
      },
    );
  } else {
    items.push(
      {
        label: "Total nodes",
        value: `${displaySizing.totalNodes} (${displaySizing.workerNodes} workers + ${displaySizing.controlPlaneNodes} control plane)`,
      },
      {
        label: "Failover capacity",
        value: `${displaySizing.failoverNodes} failover nodes`,
      },
    );

    if (hasControlPlane) {
      items.push(
        {
          label: "Worker node size",
          value: `${formValues.customCpu} CPU, ${formValues.customMemoryGb} GB memory`,
        },
        {
          label: "Control plane node size",
          value: `${formValues.controlPlaneCpu} CPU, ${formValues.controlPlaneMemoryGb} GB memory`,
        },
      );
    } else {
      items.push({
        label: "Node size",
        value: `${formValues.customCpu} CPU, ${formValues.customMemoryGb} GB memory`,
      });
    }

    items.push(
      {
        label: "Overcommitment",
        value: `CPU ${getCpuOvercommitLabel(formValues.cpuOvercommitRatio)}, Memory ${getMemoryOvercommitLabel(formValues.memoryOvercommitRatio)}`,
      },
      {
        label: "VMs to migrate",
        value: formatNumber(result.inventoryTotals.totalVMs),
      },
      {
        label: "CPU over-commit ratio",
        value: formatRatio(cpuOverCommitRatio),
      },
      {
        label: "Memory over-commit ratio",
        value: formatRatio(memoryOverCommitRatio),
      },
      {
        label: "VM resources (request)",
        value: `${formatNumber(result.inventoryTotals.totalCPU)} CPU, ${formatNumber(result.inventoryTotals.totalMemory)} GB memory`,
      },
      {
        label: "With over-commit (limits)",
        value: `${formatNumber(cpuLimits)} CPU, ${formatNumber(memoryLimits)} GB memory`,
      },
      {
        label: "Physical capacity",
        value: `${formatNumber(displaySizing.totalCPU)} CPU, ${formatNumber(displaySizing.totalMemory)} GB memory`,
      },
    );
  }

  if (isOptimized) {
    items.push({
      label: "Sizing basis",
      value: "Based on actual utilization (right-sized)",
    });
  } else {
    const optimizationNote = getOptimizationStatusMessage(result);
    if (optimizationNote) {
      items.push({ label: "Note", value: optimizationNote });
    }
  }

  return {
    title: `Cluster sizing recommendations — ${clusterName}`,
    items,
    footer:
      "Note: Resource requirements are estimates based on current workloads. Please verify this architecture with your SME team to ensure optimal performance.",
  };
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Sizing result cached for inclusion in the PDF export. */
export interface SizingPdfData {
  result: ClusterRequirementsResponse;
  formValues: SizingFormValues;
  clusterName: string;
  clusterId: string;
}

export interface ReportPageViewModel {
  // Route param
  assessmentId: string | undefined;

  // Data (reactive from stores)
  assessment: AssessmentLike | undefined;
  source: SourceModel | undefined;
  isInitialLoading: boolean;
  /** True while scoped v2 inventory is loading after filter changes (not full-page). */
  isReportInventoryLoading: boolean;

  // Cluster view
  clusterView: ClusterViewModel;
  selectedClusterId: string;
  selectCluster: (clusterId: string) => void;
  isClusterSelectOpen: boolean;
  setClusterSelectOpen: (open: boolean) => void;
  clusterSelectDisabled: boolean;

  // VM group filter (subset inventories; independent from vCenter scope)
  viewingGroupView: GroupViewModel;
  selectedGroupId: string;
  selectGroup: (groupId: string) => void;
  isGroupSelectOpen: boolean;
  setGroupSelectOpen: (open: boolean) => void;

  // vCenter filter (multi-vCenter RVTools assessments)
  vcenterFilterView: GroupViewModel;
  selectedVcenterScopeId: string;
  selectVcenterScope: (subsetId: string) => void;
  isVcenterSelectOpen: boolean;
  setVcenterSelectOpen: (open: boolean) => void;

  inventoryScopeSummary?: string;
  viewingScopeSummary?: string;

  /** @deprecated Use viewingGroupView or vcenterFilterView */
  groupView: GroupViewModel;

  // Computed data from latest snapshot
  infra: Infra | undefined;
  vms: VMs | undefined;
  clusters: { [key: string]: InventoryData } | undefined;
  latestSnapshot: SnapshotLike;
  dataCollectedText: string;
  importedToConsoleText: string;
  clusterCount: number;
  reportSummaryVms: VMs | undefined;
  vcenterId: string | undefined;
  vcenterVersion: string | undefined;

  // Scoped cluster view (typed with required fields for Dashboard rendering)
  scopedClusterView: ClusterScopedView | undefined;
  canExportReport: boolean;
  canShowClusterRecommendations: boolean;
  canUseRecommendationTools: boolean;
  isPartner: boolean;

  // Missing metrics (old inventories lacking CPU/Memory data)
  missingMetrics: string[];
  hasMissingMetrics: boolean;

  /** RVTools v2 scoped inventory API failures (when a vCenter/cluster is selected). */
  vcenterInventoryLoadError?: Error;
  clusterInventoryLoadError?: Error;

  // Export
  exportDocumentTitle: string;
  /**
   * Native-text PDF pages for calculated cluster sizing recommendations,
   * scoped to the active cluster/group selection. Passed through to
   * `useChartExport().downloadPdf` so the PDF export includes this data
   * even though it is not rendered as a chart/card.
   */
  pdfExtraPages: PdfTextPage[];

  // Report tabs + recommendation tools
  activeReportTab: ReportContentTab;
  setActiveReportTab: (tab: ReportContentTab) => void;
  selectedRecommendationTool: RecommendationToolId | null;
  openRecommendationTool: (toolId: RecommendationToolId) => void;
  closeRecommendationTool: () => void;
  /**
   * All sizing results calculated in this session, keyed by clusterId.
   */
  savedSizingDataMap: Record<string, SizingPdfData>;
  onSizingCalculated: (data: SizingPdfData) => void;

  // RVTools modals (create new assessment or append to this report)
  rvtoolsModalMode: "create" | "append";
  isRvtoolsModalOpen: boolean;
  openRvtoolsModal: () => void;
  openAppendRvtoolsModal: () => void;
  closeRvtoolsModal: () => void;
  createRVToolsJob: (name: string, files: File[]) => Promise<void>;
  appendRvtoolsFiles: (files: File[]) => Promise<void>;
  cancelRVToolsJob: () => Promise<void>;
  isCreatingJob: boolean;
  jobCreateError?: Error;
  isJobProcessing: boolean;
  jobProgressValue: number;
  jobProgressLabel: string;
  jobError: Error | null;
  rvtoolsUpload?: RvtoolsUploadState;
  isNavigatingToReport: boolean;
  rvtoolsAppendSuccessMessage: string | null;
  dismissRvtoolsAppendSuccess: () => void;
  rvtoolsAppendNotice: {
    variant: "success" | "warning";
    message: string;
  } | null;
  dismissRvtoolsAppendNotice: () => void;
  removeRvtoolsUploadResult: (fileName: string, fileSize: number) => void;
  canAppendRvtoolsFiles: boolean;
  rvtoolsPendingUploadBatches: RvtoolsPendingUploadBatch[];
  isRvtoolsUploadWarningDismissed: (batchId: string) => boolean;
  dismissRvtoolsUploadWarning: (batchId: string) => void;
  openAppendRvtoolsFromErrorReview: () => void;
  rvtoolsRemainingFileSlots: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type AssessmentLike = {
  id: string | number;
  sourceId?: string;
  name?: string;
  sourceType?: string;
  snapshots?: SnapshotLike[];
};

type ClusterScopedView = ClusterViewModel &
  Required<
    Pick<ClusterViewModel, "viewInfra" | "viewVms" | "cpuCores" | "ramGB">
  >;

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export const useReportPageViewModel = (): ReportPageViewModel => {
  // ---- Route params --------------------------------------------------------
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReportTab = reportTabFromSearch(searchParams.get("tab"));
  const setActiveReportTab = useCallback(
    (tab: ReportContentTab) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (tab === "report") {
            next.delete("tab");
          } else {
            next.set("tab", tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ---- Stores --------------------------------------------------------------
  const assessmentsStore = useInjection<IAssessmentsStore>(
    Symbols.AssessmentsStore,
  );
  const sourcesStore = useInjection<ISourcesStore>(Symbols.SourcesStore);
  const jobsStore = useInjection<IJobsStore>(Symbols.JobsStore);

  // ---- Reactive store data -------------------------------------------------
  const assessments = useSyncExternalStore(
    assessmentsStore.subscribe.bind(assessmentsStore),
    assessmentsStore.getSnapshot.bind(assessmentsStore),
  );

  const sources = useSyncExternalStore(
    sourcesStore.subscribe.bind(sourcesStore),
    sourcesStore.getSnapshot.bind(sourcesStore),
  );

  const jobState = useSyncExternalStore(
    jobsStore.subscribe.bind(jobsStore),
    jobsStore.getSnapshot.bind(jobsStore),
  );

  const isPartner = useIsPartner();

  // ---- Initial data fetch (always GET assessment for subset inventory data) --
  const [fetchState, doFetchData] = useAsyncFn(async () => {
    const sourcesPromise = sourcesStore.list();

    if (id) {
      // LIST responses omit subset inventories. The SDK also normalizes a missing
      // field to `subsetInventories: undefined`, so cache heuristics cannot tell
      // list data apart from a GET response with no groups — always fetch by ID.
      await Promise.all([assessmentsStore.get(id), sourcesPromise]);
      return;
    }

    await Promise.all([assessmentsStore.list(), sourcesPromise]);
  }, [assessmentsStore, sourcesStore, id]);

  useEffect(() => {
    void doFetchData();
  }, [doFetchData]);

  // ---- Assessment lookup ---------------------------------------------------
  const assessment = useMemo(
    () =>
      assessments?.find((a: AssessmentModel) => String(a.id) === String(id)),
    [assessments, id],
  );

  // ---- Source lookup -------------------------------------------------------
  const source = useMemo(
    () =>
      assessment?.sourceId
        ? sources.find((entry) => entry.id === assessment.sourceId)
        : undefined,
    [assessment, sources],
  );

  // ---- Local UI state ------------------------------------------------------
  const [userSelectedClusterId, setUserSelectedClusterId] = useState<
    string | null
  >(null);
  const [isClusterSelectOpen, setIsClusterSelectOpen] = useState(false);
  const [selectedRecommendationTool, setSelectedRecommendationTool] =
    useState<RecommendationToolId | null>(null);
  const [savedSizingDataMap, setSavedSizingDataMap] = useState<
    Record<string, SizingPdfData>
  >({});

  const onSizingCalculated = useCallback((data: SizingPdfData): void => {
    setSavedSizingDataMap((prev) => ({ ...prev, [data.clusterId]: data }));
  }, []);

  // ---- Snapshot data -------------------------------------------------------
  const latestSnapshot = useMemo((): SnapshotLike => {
    if (assessment?.snapshotsSorted?.length) {
      return assessment.snapshotsSorted[0];
    }

    const snapshots = assessment?.snapshots ?? [];
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : {};
  }, [assessment]);

  const subsetInventories = useMemo((): AssessmentSubsetInventory[] => {
    const fromSnapshot = latestSnapshot.subsetInventories ?? [];
    // VM group filter applies to discovery OVA assessments only (see isUploadedFileSourceType).
    if (
      !assessment?.sourceType ||
      isUploadedFileSourceType(String(assessment.sourceType))
    ) {
      return [];
    }
    return fromSnapshot;
  }, [assessment, latestSnapshot.subsetInventories]);

  const fullInventory = useMemo(
    () => latestSnapshot.inventory as ReportInventorySource | undefined,
    [latestSnapshot.inventory],
  );

  const resetClusterSelection = useCallback(() => {
    setUserSelectedClusterId(null);
    setSelectedRecommendationTool(null);
  }, []);

  const {
    selectedGroupId,
    groupView,
    activeInventory: groupFilterInventory,
    isGroupSelectOpen,
    setIsGroupSelectOpen,
    selectGroup,
  } = useGroupInventoryFilter({
    subsetInventories,
    fullInventory,
    onGroupChange: resetClusterSelection,
  });

  const {
    rvtoolsSubsetInventories,
    rvtoolsEffectiveVcenterSubsetId,
    scopedVcenterApiId,
    rvtoolsVcenterFilterView,
    selectRvtoolsVcenterSubset,
    isVcenterSelectOpen,
    setVcenterSelectOpen,
  } = useReportRvtoolsVcenterFilter({
    assessmentId: id,
    assessmentSourceType: assessment?.sourceType,
    subsetInventoriesFromSnapshot:
      latestSnapshot.subsetInventories ?? undefined,
    resetClusterSelection,
  });

  const {
    persistenceStore,
    rvtoolsPendingUploadBatches,
    isRvtoolsUploadWarningDismissed,
    dismissRvtoolsUploadWarning,
  } = useReportRvtoolsPersistence({
    assessmentId: id,
    sourceType: assessment?.sourceType,
    subsetInventories,
  });

  const rvtoolsUploadJob = useReportRvtoolsUploadJob({
    assessmentId: id,
    canAppendRvtoolsFiles: assessment?.sourceType === "rvtools",
    jobsStore,
    assessmentsStore,
    persistenceStore,
    jobState,
  });

  const useV2ReportInventory = assessment?.sourceType === "rvtools";

  const scopedRvtoolsSubsetInventory = useMemo(():
    ReportInventorySource | undefined => {
    if (!useV2ReportInventory) {
      return undefined;
    }
    if (rvtoolsEffectiveVcenterSubsetId === ALL_VMS_GROUP_ID) {
      return undefined;
    }
    const subset = rvtoolsSubsetInventories.find(
      (entry) => entry.id === rvtoolsEffectiveVcenterSubsetId,
    );
    return subset?.inventory;
  }, [
    rvtoolsEffectiveVcenterSubsetId,
    rvtoolsSubsetInventories,
    useV2ReportInventory,
  ]);

  const {
    activeInventory: v2ScopedInventory,
    inventoryLoading,
    vcenterLoadError: vcenterInventoryLoadError,
    clusterLoadError: clusterInventoryLoadError,
  } = useReportV2InventoryScope({
    enabled: useV2ReportInventory,
    assessmentId: id,
    userSelectedClusterId,
    scopedVcenterApiId,
    scopedSubsetInventory: scopedRvtoolsSubsetInventory,
    aggregateInventory: fullInventory,
    allowAggregateClusterFallback: rvtoolsSubsetInventories.length <= 1,
    assessmentsStore,
  });

  const activeInventory = useV2ReportInventory
    ? v2ScopedInventory
    : groupFilterInventory;

  const { infra, vms, clusters, vcenterId, vcenterVersion } = useMemo(
    () => extractScopedInventoryData(activeInventory, latestSnapshot),
    [activeInventory, latestSnapshot],
  );

  const reportSummaryVms = useMemo(
    () =>
      (latestSnapshot.vms ||
        latestSnapshot.inventory?.vms ||
        latestSnapshot.inventory?.vcenter?.vms) as VMs | undefined,
    [latestSnapshot],
  );

  const snapshotClusterCount = useMemo(() => {
    const summaryClusters = latestSnapshot.inventory?.clusters as
      { [key: string]: InventoryData } | undefined;
    return summaryClusters ? Object.keys(summaryClusters).length : 0;
  }, [latestSnapshot.inventory?.clusters]);

  const totalVcenterCount = useMemo(() => {
    if (rvtoolsSubsetInventories.length > 0) {
      return rvtoolsSubsetInventories.length;
    }
    return 1;
  }, [rvtoolsSubsetInventories.length]);

  const showVcenterFilter =
    useV2ReportInventory && rvtoolsSubsetInventories.length > 1;

  const allVcentersClusterCount = useRvtoolsAllVcentersClusterCount({
    enabled: showVcenterFilter,
    assessmentId: id,
    subsets: rvtoolsSubsetInventories,
    assessmentsStore,
  });

  const reportSummaryClusterCount = useMemo(() => {
    if (snapshotClusterCount > 0) {
      return snapshotClusterCount;
    }
    if (allVcentersClusterCount != null && allVcentersClusterCount > 0) {
      return allVcentersClusterCount;
    }
    return countEmbeddedClustersAcrossSubsets(rvtoolsSubsetInventories);
  }, [allVcentersClusterCount, rvtoolsSubsetInventories, snapshotClusterCount]);

  const vcenterFilterView = useMemo(() => {
    if (!showVcenterFilter) {
      return buildGroupViewModel({ subsetInventories: [] });
    }
    return rvtoolsVcenterFilterView;
  }, [rvtoolsVcenterFilterView, showVcenterFilter]);

  // ---- Cluster selection ---------------------------------------------------
  const selectedClusterId = useMemo(
    () => resolveSelectedClusterId(userSelectedClusterId, clusters),
    [userSelectedClusterId, clusters],
  );

  const hasClusterResources = useCallback(
    (viewInfra?: Infra, viewVms?: VMs) =>
      hasClusterResourcesForExport(viewInfra, viewVms),
    [],
  );

  const selectCluster = useCallback(
    (clusterId: string) => {
      setUserSelectedClusterId(clusterId);
      setSelectedRecommendationTool((current) => {
        if (current == null) {
          return current;
        }
        const isAggregate = clusterId === ALL_CLUSTERS_ID;
        if (
          !isRecommendationToolAvailable(current, {
            isAggregateView: isAggregate,
            isPartner,
          })
        ) {
          return null;
        }
        if (current === "architecture") {
          const targetInfra = isAggregate
            ? infra
            : clusters?.[clusterId]?.infra;
          const targetVms = isAggregate ? vms : clusters?.[clusterId]?.vms;
          return hasClusterResources(targetInfra, targetVms) ? current : null;
        }
        return current;
      });
    },
    [clusters, hasClusterResources, infra, isPartner, vms],
  );

  const openRecommendationTool = useCallback((toolId: RecommendationToolId) => {
    setSelectedRecommendationTool(toolId);
  }, []);

  const closeRecommendationTool = useCallback(() => {
    setSelectedRecommendationTool(null);
  }, []);

  // ---- Cluster view model --------------------------------------------------
  const clusterView = useMemo(
    () =>
      buildClusterViewModel({
        infra,
        vms,
        clusters,
        selectedClusterId,
      }),
    [infra, vms, clusters, selectedClusterId],
  );

  const clusterSelectDisabled = computeClusterSelectDisabled(
    clusterView.clusterOptions.length,
    showVcenterFilter,
    rvtoolsEffectiveVcenterSubsetId,
  );

  const inventoryScopeSummary = useMemo(() => {
    const counts = buildInventoryScopeCounts({
      vmTotal: reportSummaryVms?.total,
      vcenterCount: totalVcenterCount,
      clusterCount: reportSummaryClusterCount,
    });
    return counts ? formatReportScopeCounts(counts) : undefined;
  }, [reportSummaryClusterCount, reportSummaryVms?.total, totalVcenterCount]);

  // ---- Scoped cluster view -------------------------------------------------
  const isClusterScopedData = useCallback(
    (view: ClusterViewModel): view is ClusterScopedView =>
      Boolean(view.viewInfra && view.viewVms && view.cpuCores && view.ramGB),
    [],
  );

  const scopedClusterView = isClusterScopedData(clusterView)
    ? clusterView
    : undefined;

  const viewingScopeSummary = useMemo(() => {
    const vmTotal = scopedClusterView?.viewVms?.total ?? vms?.total ?? 0;
    const counts = buildViewingScopeCounts({
      vmTotal,
      showVcenterFilter,
      selectedVcenterScopeId: rvtoolsEffectiveVcenterSubsetId,
      allVmsGroupId: ALL_VMS_GROUP_ID,
      totalVcenterCount,
      selectedClusterId,
      allClustersId: ALL_CLUSTERS_ID,
      clustersInScope: clusters,
    });
    const clusterCount =
      showVcenterFilter &&
      rvtoolsEffectiveVcenterSubsetId === ALL_VMS_GROUP_ID &&
      counts.clusterCount === 0 &&
      reportSummaryClusterCount > 0
        ? reportSummaryClusterCount
        : counts.clusterCount;
    return formatReportScopeCounts({ ...counts, clusterCount });
  }, [
    clusters,
    reportSummaryClusterCount,
    rvtoolsEffectiveVcenterSubsetId,
    scopedClusterView?.viewVms?.total,
    selectedClusterId,
    showVcenterFilter,
    totalVcenterCount,
    vms?.total,
  ]);

  // ---- Resource checks -----------------------------------------------------
  const canShowClusterRecommendations = hasClusterResources(
    clusterView.viewInfra,
    clusterView.viewVms,
  );

  const canUseRecommendationTools = (clusterView.viewVms?.total ?? 0) > 0;

  const canExportReport = useMemo((): boolean => {
    const embeddedClusterMaps: Array<
      Record<string, InventoryData> | undefined
    > = [scopedRvtoolsSubsetInventory?.clusters];
    if (rvtoolsSubsetInventories.length <= 1) {
      embeddedClusterMaps.push(fullInventory?.clusters);
    }
    return canExportAssessmentReport({
      viewInfra: clusterView.viewInfra,
      viewVms: clusterView.viewVms,
      scopedClusters: clusters,
      embeddedClusterMaps,
    });
  }, [
    clusterView.viewInfra,
    clusterView.viewVms,
    clusters,
    fullInventory?.clusters,
    rvtoolsSubsetInventories.length,
    scopedRvtoolsSubsetInventory?.clusters,
  ]);

  // ---- Assessment timestamp captions ---------------------------------------
  const dataCollectedText = useMemo((): string => {
    if (!assessment) {
      return "-";
    }
    const ms = getAssessmentDataCollectedMs(assessment);
    return ms !== undefined ? formatAssessmentDateTime(ms) : "-";
  }, [assessment]);

  const importedToConsoleText = useMemo((): string => {
    if (!assessment) {
      return "-";
    }
    const ms = getAssessmentImportedMs(assessment);
    return ms !== undefined ? formatAssessmentDateTime(ms) : "-";
  }, [assessment]);

  // ---- Missing metrics detection -------------------------------------------
  // Uses the scoped (cluster-level) data that the Dashboard actually renders,
  // falling back to the aggregate snapshot data when no scoped view exists.
  const missingMetrics = useMemo((): string[] => {
    const activeVms = scopedClusterView?.viewVms ?? vms;
    const activeInfra = scopedClusterView?.viewInfra ?? infra;
    if (!activeVms || activeVms.total === 0) return [];

    const missing: string[] = [];

    const isEmpty = (
      obj: Record<string, unknown> | undefined | null,
    ): boolean => !obj || Object.keys(obj).length === 0;

    const isCpuMissing =
      !activeVms.cpuCores ||
      activeVms.cpuCores.total === 0 ||
      isEmpty(activeVms.distributionByCpuTier);
    if (isCpuMissing) missing.push("CPU");

    const isMemoryMissing =
      !activeVms.ramGB ||
      activeVms.ramGB.total === 0 ||
      isEmpty(activeVms.distributionByMemoryTier);
    if (isMemoryMissing) missing.push("Memory");

    if (isEmpty(activeVms.osInfo) && isEmpty(activeVms.os))
      missing.push("Operating systems");
    if (isEmpty(activeVms.diskSizeTier)) missing.push("Disk size tiers");
    if (isEmpty(activeVms.diskTypes)) missing.push("Disk types");
    if (!activeInfra?.hosts || activeInfra.hosts.length === 0)
      missing.push("Hosts");
    if (!activeInfra?.networks || activeInfra.networks.length === 0)
      missing.push("Networks");
    if (
      isEmpty(activeVms.distributionByNicCount) &&
      (!activeVms.nicCount || !activeVms.nicCount.total)
    )
      missing.push("NIC count");

    return missing;
  }, [scopedClusterView, vms, infra]);

  // ---- Export title (live chart capture is owned by ChartExportProvider) ---
  const exportDocumentTitle = useMemo((): string => {
    const groupSuffix =
      selectedGroupId !== ALL_VMS_GROUP_ID
        ? ` - ${groupView.selectionLabel}`
        : "";
    return `${assessment?.name || `Assessment ${id}`} - vCenter report${groupSuffix}`;
  }, [assessment?.name, id, selectedGroupId, groupView.selectionLabel]);

  // Scope sizing results to what's currently in view:
  // - Single cluster view → only that cluster (if calculated)
  // - All-clusters view → every sized cluster within the active group inventory
  const pdfExtraPages = useMemo((): PdfTextPage[] => {
    const scopedClusterIds = new Set(clusters ? Object.keys(clusters) : []);
    const sizingEntries =
      selectedClusterId === ALL_CLUSTERS_ID
        ? Object.values(savedSizingDataMap).filter((entry) =>
            scopedClusterIds.has(entry.clusterId),
          )
        : savedSizingDataMap[selectedClusterId]
          ? [savedSizingDataMap[selectedClusterId]]
          : [];

    return sizingEntries.map(buildClusterSizingPdfPage);
  }, [clusters, savedSizingDataMap, selectedClusterId]);

  const rvtoolsRemainingFileSlots = useMemo(
    () => Math.max(0, MAX_RVTOOLS_FILES - subsetInventories.length),
    [subsetInventories.length],
  );

  // ---- Return --------------------------------------------------------------
  return {
    assessmentId: id,

    assessment,
    source,
    isInitialLoading: fetchState.loading && !assessment,
    isReportInventoryLoading: useV2ReportInventory && inventoryLoading,

    clusterView,
    selectedClusterId,
    selectCluster,
    isClusterSelectOpen,
    setClusterSelectOpen: setIsClusterSelectOpen,
    clusterSelectDisabled,

    viewingGroupView: groupView,
    selectedGroupId,
    selectGroup,
    isGroupSelectOpen,
    setGroupSelectOpen: setIsGroupSelectOpen,

    vcenterFilterView,
    selectedVcenterScopeId: rvtoolsEffectiveVcenterSubsetId,
    selectVcenterScope: selectRvtoolsVcenterSubset,
    isVcenterSelectOpen,
    setVcenterSelectOpen,

    inventoryScopeSummary,
    viewingScopeSummary,

    groupView: groupView.showGroupFilter ? groupView : vcenterFilterView,

    infra,
    vms,
    clusters,
    latestSnapshot,
    dataCollectedText,
    importedToConsoleText,
    clusterCount: reportSummaryClusterCount,
    reportSummaryVms,
    vcenterId,
    vcenterVersion,

    scopedClusterView,
    canExportReport,
    canShowClusterRecommendations,
    canUseRecommendationTools,
    isPartner,

    missingMetrics,
    hasMissingMetrics: missingMetrics.length > 0,

    vcenterInventoryLoadError,
    clusterInventoryLoadError,

    exportDocumentTitle,
    pdfExtraPages,

    activeReportTab,
    setActiveReportTab,
    selectedRecommendationTool,
    openRecommendationTool,
    closeRecommendationTool,
    savedSizingDataMap,
    onSizingCalculated,

    rvtoolsModalMode: rvtoolsUploadJob.rvtoolsModalMode,
    isRvtoolsModalOpen: rvtoolsUploadJob.isRvtoolsModalOpen,
    openRvtoolsModal: rvtoolsUploadJob.openRvtoolsModal,
    openAppendRvtoolsModal: rvtoolsUploadJob.openAppendRvtoolsModal,
    closeRvtoolsModal: rvtoolsUploadJob.closeRvtoolsModal,
    createRVToolsJob: rvtoolsUploadJob.createRVToolsJob,
    appendRvtoolsFiles: rvtoolsUploadJob.appendRvtoolsFiles,
    cancelRVToolsJob: rvtoolsUploadJob.cancelRVToolsJob,
    isCreatingJob: jobState.isCreating,
    jobCreateError: jobState.createError,
    isJobProcessing: rvtoolsUploadJob.isJobProcessing,
    jobProgressValue: rvtoolsUploadJob.jobProgressValue,
    jobProgressLabel: rvtoolsUploadJob.jobProgressLabel,
    jobError: rvtoolsUploadJob.jobError,
    rvtoolsUpload: jobState.rvtoolsUpload,
    isNavigatingToReport: rvtoolsUploadJob.isNavigatingToReport,
    rvtoolsAppendSuccessMessage: rvtoolsUploadJob.rvtoolsAppendSuccessMessage,
    dismissRvtoolsAppendSuccess: rvtoolsUploadJob.dismissRvtoolsAppendSuccess,
    rvtoolsAppendNotice: rvtoolsUploadJob.rvtoolsAppendNotice,
    dismissRvtoolsAppendNotice: rvtoolsUploadJob.dismissRvtoolsAppendNotice,
    removeRvtoolsUploadResult: rvtoolsUploadJob.removeRvtoolsUploadResult,
    canAppendRvtoolsFiles: rvtoolsUploadJob.canAppendRvtoolsFiles,
    rvtoolsPendingUploadBatches,
    isRvtoolsUploadWarningDismissed,
    dismissRvtoolsUploadWarning,
    openAppendRvtoolsFromErrorReview:
      rvtoolsUploadJob.openAppendRvtoolsFromErrorReview,
    rvtoolsRemainingFileSlots,
  };
};
