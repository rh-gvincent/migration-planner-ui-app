import type {
  Assessment,
  Host,
  Infra,
  InventoryData,
  Source,
  VMResourceBreakdown,
  VMs,
} from "@openshift-migration-advisor/planner-sdk";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityView } from "../../../../data/stores/interfaces/IAccountStore";
import {
  createSourceModel,
  type SourceModel,
} from "../../../../models/SourceModel";
import { ALL_CLUSTERS_ID } from "../../helpers/clusterViewModel";
import { ALL_VMS_GROUP_ID } from "../../helpers/groupViewModel";
import { mockClusterRequirementsResponse } from "../../views/cluster-sizer/__tests__/mocks/ClusterRequirementsResponse.mock";
import { EXAMPLE_FORM_VALUES } from "../../views/example-data/clusterSizingFixture";
import type { SizingPdfData } from "../useReportPageViewModel";
import { useReportPageViewModel } from "../useReportPageViewModel";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock react-router-dom
let mockRouteId = "assessment-1";
let mockReportSearch = "";
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: mockRouteId }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [
    new URLSearchParams(mockReportSearch),
    mockSetSearchParams,
  ],
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-use
const mountCallbacks: (() => void)[] = [];
vi.mock("react-use", () => ({
  useMount: vi.fn((cb: () => void) => {
    mountCallbacks.push(cb);
    cb();
  }),
  useAsyncFn: vi.fn(
    (
      fn: (...args: unknown[]) => Promise<unknown>,
      _deps: unknown[],
    ): [
      { loading: boolean; error?: Error; value?: unknown },
      (...args: unknown[]) => Promise<unknown>,
    ] => {
      // Simple implementation: return initial state and the function itself
      const state = { loading: false, error: undefined, value: undefined };
      return [state, fn];
    },
  ),
}));

// Mock DI
const mockAssessmentsStore = {
  subscribe: vi.fn(() => () => {}),
  getSnapshot: vi.fn((): Assessment[] => []),
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  getById: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
};

const mockSourcesStore = {
  subscribe: vi.fn(() => () => {}),
  getSnapshot: vi.fn((): SourceModel[] => []),
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
};

const idleJobState = {
  currentJob: null,
  isCreating: false,
  createError: undefined,
};

const mockJobsStore = {
  subscribe: vi.fn(() => () => {}),
  getSnapshot: vi.fn(() => idleJobState),
  createRVToolsJob: vi.fn().mockResolvedValue(undefined),
  cancelRVToolsJob: vi.fn().mockResolvedValue(null),
  reset: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
};

const mockAccountStore = {
  subscribe: vi.fn(() => () => {}),
  getSnapshot: vi.fn((): IdentityView | null => null),
};

vi.mock("@openshift-migration-advisor/ioc", () => ({
  useInjection: vi.fn((symbol: symbol) => {
    const key = symbol.description;
    if (key === "AssessmentsStore") return mockAssessmentsStore;
    if (key === "SourcesStore") return mockSourcesStore;
    if (key === "JobsStore") return mockJobsStore;
    if (key === "AccountStore") return mockAccountStore;
    throw new Error(`Unknown symbol: ${String(symbol)}`);
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyBreakdown: VMResourceBreakdown = {
  total: 0,
  totalForMigratable: 0,
  totalForMigratableWithWarnings: 0,
  totalForNotMigratable: 0,
};

const createInfra = (totalHosts: number, hostsCount = 0): Infra => ({
  clustersPerDatacenter: [],
  hosts: Array(hostsCount).fill({}) as Host[],
  totalHosts,
  hostPowerStates: {},
  networks: [],
  datastores: [],
});

const createVMs = (total: number): VMs => ({
  os: { Linux: total },
  total,
  totalMigratable: total,
  cpuCores: { ...emptyBreakdown, total },
  ramGB: { ...emptyBreakdown, total: total * 4 },
  diskGB: emptyBreakdown,
  diskCount: emptyBreakdown,
  diskSizeTier: {},
  diskTypes: {},
  nicCount: emptyBreakdown,
  migrationWarnings: [],
  notMigratableReasons: [],
  powerStates: {},
  distributionByCpuTier: {},
  distributionByMemoryTier: {},
});

const createAssessment = (
  id: string,
  clusterData?: { [key: string]: InventoryData },
): Assessment => {
  const aggregateInfra = clusterData
    ? Object.values(clusterData).reduce(
        (acc, cluster) => {
          const ci = cluster.infra as Infra | undefined;
          if (ci) {
            acc.totalHosts += ci.totalHosts || 0;
            acc.hosts = [...acc.hosts, ...(ci.hosts || [])];
          }
          return acc;
        },
        { ...createInfra(0, 0), hosts: [] as Host[] },
      )
    : createInfra(5, 5);

  const aggregateVms = clusterData
    ? Object.values(clusterData).reduce((acc, cluster) => {
        const cv = cluster.vms as VMs | undefined;
        if (cv) {
          acc.total += cv.total || 0;
          acc.totalMigratable += cv.totalMigratable || 0;
        }
        return acc;
      }, createVMs(0))
    : createVMs(10);

  return {
    id,
    name: `Assessment ${id}`,
    sourceId: "source-1",
    sourceType: "vcenter" as unknown as Assessment["sourceType"],
    createdAt: new Date(),
    snapshots: [
      {
        createdAt: new Date(),
        inventory: {
          vcenterId: "vcenter-1",
          clusters: clusterData ?? {},
          vcenter: {
            infra: aggregateInfra,
            vms: aggregateVms,
          },
        },
      },
    ],
  };
};

const mockSource = createSourceModel({
  id: "source-1",
  name: "Test Source",
  createdAt: new Date(),
  updatedAt: new Date(),
  onPremises: false,
  agent: {
    id: "agent-1",
    status: "up-to-date" as unknown as NonNullable<Source["agent"]>["status"],
    statusInfo: "",
    credentialUrl: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    version: "",
  },
});

const createSizingPdfData = (
  clusterId: string,
  clusterName: string,
): SizingPdfData => ({
  clusterId,
  clusterName,
  formValues: EXAMPLE_FORM_VALUES,
  result: mockClusterRequirementsResponse,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useReportPageViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountCallbacks.length = 0;
    mockRouteId = "assessment-1";
    mockReportSearch = "";
    mockAssessmentsStore.getSnapshot.mockReturnValue([]);
    mockSourcesStore.getSnapshot.mockReturnValue([]);
    mockSourcesStore.getById.mockReturnValue(undefined);
    mockAccountStore.getSnapshot.mockReturnValue(null);
  });

  it("exposes the route assessment ID", () => {
    const { result } = renderHook(() => useReportPageViewModel());
    expect(result.current.assessmentId).toBe("assessment-1");
  });

  it("returns undefined assessment when store has no matching assessment", () => {
    mockAssessmentsStore.getSnapshot.mockReturnValue([]);
    const { result } = renderHook(() => useReportPageViewModel());
    expect(result.current.assessment).toBeUndefined();
  });

  it("finds assessment by ID from the store snapshot", () => {
    const assessment = createAssessment("assessment-1");
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

    const { result } = renderHook(() => useReportPageViewModel());
    expect(result.current.assessment).toBeDefined();
    expect(result.current.assessment?.name).toBe("Assessment assessment-1");
  });

  it("always fetches assessment by ID and sources on mount", () => {
    const assessment = createAssessment("assessment-1", {
      "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
    });
    assessment.snapshots = [
      {
        createdAt: new Date(),
        inventory: assessment.snapshots?.[0]?.inventory ?? {
          vcenterId: "vcenter-1",
          clusters: {},
        },
        subsetInventories: [
          {
            id: "group-1",
            name: "Group 1",
            vcenterId: "vcenter-1",
            vmsCount: 5,
            createdAt: new Date(),
            inventory: assessment.snapshots?.[0]?.inventory ?? {
              vcenterId: "vcenter-1",
              clusters: {},
            },
          },
        ],
      },
    ];
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);
    mockAssessmentsStore.getById.mockReturnValue(assessment);

    renderHook(() => useReportPageViewModel());

    expect(mockAssessmentsStore.get).toHaveBeenCalledWith("assessment-1");
    expect(mockSourcesStore.list).toHaveBeenCalled();
  });

  it("refetches when the route assessment id changes", () => {
    mockRouteId = "assessment-1";
    const assessmentOne = createAssessment("assessment-1");
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessmentOne]);
    mockAssessmentsStore.get.mockClear();

    const { rerender } = renderHook(() => useReportPageViewModel());
    expect(mockAssessmentsStore.get).toHaveBeenCalledWith("assessment-1");

    mockRouteId = "assessment-2";
    const assessmentTwo = createAssessment("assessment-2");
    mockAssessmentsStore.getSnapshot.mockReturnValue([
      assessmentOne,
      assessmentTwo,
    ]);
    mockAssessmentsStore.get.mockClear();

    rerender();

    expect(mockAssessmentsStore.get).toHaveBeenCalledWith("assessment-2");
  });

  it("resolves source from the assessment's sourceId", () => {
    const assessment = createAssessment("assessment-1");
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);
    mockSourcesStore.getSnapshot.mockReturnValue([mockSource]);

    const { result } = renderHook(() => useReportPageViewModel());
    expect(result.current.source).toBe(mockSource);
  });

  it("updates source when sources finish loading after mount", () => {
    const assessment = createAssessment("assessment-1");
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);
    mockSourcesStore.getSnapshot.mockReturnValue([]);

    const { result, rerender } = renderHook(() => useReportPageViewModel());
    expect(result.current.source).toBeUndefined();

    mockSourcesStore.getSnapshot.mockReturnValue([mockSource]);
    rerender();

    expect(result.current.source).toBe(mockSource);
  });

  it("returns undefined source when assessment has no sourceId", () => {
    const assessment = {
      ...createAssessment("assessment-1"),
      sourceId: undefined,
    };
    mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

    const { result } = renderHook(() => useReportPageViewModel());
    expect(result.current.source).toBeUndefined();
  });

  describe("cluster selection", () => {
    it("auto-selects largest cluster by VM count when clusters are present", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.selectedClusterId).toBe("Cluster-B");
    });

    it("defaults to 'all' when no clusters exist", () => {
      const assessment = createAssessment("assessment-1");
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.selectedClusterId).toBe(ALL_CLUSTERS_ID);
    });

    it("allows selecting a different cluster", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.selectedClusterId).toBe("Cluster-B");

      act(() => {
        result.current.selectCluster("Cluster-A");
      });

      expect(result.current.selectedClusterId).toBe("Cluster-A");
    });
  });

  describe("cluster view model", () => {
    it("builds aggregate view when selectedClusterId is 'all'", () => {
      const assessment = createAssessment("assessment-1");
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.clusterView.isAggregateView).toBe(true);
      expect(result.current.clusterView.selectionId).toBe(ALL_CLUSTERS_ID);
    });

    it("builds per-cluster view when a specific cluster is selected", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      // Auto-selects first cluster
      expect(result.current.clusterView.isAggregateView).toBe(false);
      expect(result.current.clusterView.selectionId).toBe("Cluster-A");
    });
  });

  describe("scoped cluster view", () => {
    it("returns undefined when data is missing (no infra/vms)", () => {
      mockAssessmentsStore.getSnapshot.mockReturnValue([]);
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.scopedClusterView).toBeUndefined();
    });

    it("returns scoped view when cluster has infra, vms, cpuCores, ramGB", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.scopedClusterView).toBeDefined();
      expect(result.current.scopedClusterView?.viewInfra).toBeDefined();
      expect(result.current.scopedClusterView?.viewVms).toBeDefined();
    });
  });

  describe("resource checks", () => {
    it("canShowClusterRecommendations is true when cluster has hosts and VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.canShowClusterRecommendations).toBe(true);
    });

    it("canShowClusterRecommendations is true on aggregate view when hosts and VMs exist", () => {
      const assessment = createAssessment("assessment-1");
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.canShowClusterRecommendations).toBe(true);
    });

    it("canShowClusterRecommendations is false on aggregate view without hosts or VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(0, 0), vms: createVMs(0) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });

      expect(result.current.canShowClusterRecommendations).toBe(false);
    });

    it("canUseRecommendationTools is true when the view has VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.canUseRecommendationTools).toBe(true);
    });

    it("canUseRecommendationTools is true on aggregate view when VMs exist", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      act(() => {
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });
      expect(result.current.canUseRecommendationTools).toBe(true);
    });

    it("canExportReport is true when cluster has hosts and VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.canExportReport).toBe(true);
    });

    it("canExportReport is false when cluster has no hosts", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(0, 0), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.canExportReport).toBe(false);
    });
  });

  describe("export", () => {
    it("builds a document title from the assessment name", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.exportDocumentTitle).toBe(
        "Assessment assessment-1 - vCenter report",
      );
    });

    it("appends the selected group name to the export title", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(10) },
      });
      assessment.snapshots = [
        {
          createdAt: new Date(),
          inventory: assessment.snapshots?.[0]?.inventory ?? {
            vcenterId: "vcenter-1",
            clusters: {},
          },
          subsetInventories: [
            {
              id: "group-1",
              name: "Group 1",
              vcenterId: "vcenter-1",
              vmsCount: 3,
              createdAt: new Date(),
              inventory: {
                vcenterId: "vcenter-1",
                clusters: {
                  "Cluster-A": {
                    infra: createInfra(1, 1),
                    vms: createVMs(3),
                  },
                },
                vcenter: {
                  infra: createInfra(1, 1),
                  vms: createVMs(3),
                },
              },
            },
          ],
        },
      ];
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.selectGroup("group-1");
      });

      expect(result.current.exportDocumentTitle).toContain("Group 1");
    });

    it("stores sizing results by cluster id", () => {
      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.onSizingCalculated(
          createSizingPdfData("Cluster-A", "Cluster A"),
        );
      });

      expect(result.current.savedSizingDataMap["Cluster-A"]?.clusterName).toBe(
        "Cluster A",
      );
    });

    // @see OMA-2414 - cluster sizing recommendations were silently dropped
    // from the PDF export after the report moved to the shared chart-export
    // component. pdfExtraPages is how that data is re-threaded into the PDF.
    describe("pdfExtraPages (cluster sizing recommendations)", () => {
      it("is empty when no cluster has been sized", () => {
        const assessment = createAssessment("assessment-1", {
          "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        });
        mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

        const { result } = renderHook(() => useReportPageViewModel());

        expect(result.current.pdfExtraPages).toEqual([]);
      });

      it("includes a page for the selected cluster once sizing is calculated", () => {
        const assessment = createAssessment("assessment-1", {
          "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
          "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
        });
        mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

        const { result } = renderHook(() => useReportPageViewModel());

        act(() => {
          result.current.selectCluster("Cluster-A");
          result.current.onSizingCalculated(
            createSizingPdfData("Cluster-A", "Cluster A"),
          );
        });

        expect(result.current.pdfExtraPages).toHaveLength(1);
        expect(result.current.pdfExtraPages[0].title).toContain("Cluster A");
        expect(result.current.pdfExtraPages[0].items).toEqual(
          expect.arrayContaining([
            { label: "Cluster name", value: "Cluster A" },
            { label: "Target platform", value: "Bare metal" },
          ]),
        );
      });

      it("excludes sizing data for clusters other than the one selected", () => {
        const assessment = createAssessment("assessment-1", {
          "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
          "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
        });
        mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

        const { result } = renderHook(() => useReportPageViewModel());

        act(() => {
          result.current.onSizingCalculated(
            createSizingPdfData("Cluster-A", "Cluster A"),
          );
          result.current.onSizingCalculated(
            createSizingPdfData("Cluster-B", "Cluster B"),
          );
          result.current.selectCluster("Cluster-A");
        });

        expect(result.current.pdfExtraPages).toHaveLength(1);
        expect(result.current.pdfExtraPages[0].title).toContain("Cluster A");
      });

      it("includes every sized cluster when viewing all clusters", () => {
        const assessment = createAssessment("assessment-1", {
          "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
          "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
        });
        mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

        const { result } = renderHook(() => useReportPageViewModel());

        act(() => {
          result.current.onSizingCalculated(
            createSizingPdfData("Cluster-A", "Cluster A"),
          );
          result.current.onSizingCalculated(
            createSizingPdfData("Cluster-B", "Cluster B"),
          );
          result.current.selectCluster(ALL_CLUSTERS_ID);
        });

        expect(result.current.pdfExtraPages).toHaveLength(2);
        expect(result.current.pdfExtraPages.map((page) => page.title)).toEqual(
          expect.arrayContaining([
            expect.stringContaining("Cluster A"),
            expect.stringContaining("Cluster B"),
          ]),
        );
      });
    });
  });

  describe("recommendation tools", () => {
    it("starts on the Migration report tab with no tool selected", () => {
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.activeReportTab).toBe("report");
      expect(result.current.selectedRecommendationTool).toBeNull();
    });

    it("opens the manual environment tab from the query string", () => {
      mockReportSearch = "tab=manual-details";
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.activeReportTab).toBe("manual-details");
    });

    it("stores the selected report tab in the query string", () => {
      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.setActiveReportTab("manual-details");
      });

      const updater = mockSetSearchParams.mock.calls[0][0] as (
        current: URLSearchParams,
      ) => URLSearchParams;
      expect(
        updater(new URLSearchParams("tab=recommendations")).get("tab"),
      ).toBe("manual-details");
      expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });

      act(() => {
        result.current.setActiveReportTab("report");
      });
      const clearTab = mockSetSearchParams.mock.calls[1][0] as (
        current: URLSearchParams,
      ) => URLSearchParams;
      expect(
        clearTab(new URLSearchParams("tab=manual-details")).has("tab"),
      ).toBe(false);
    });

    it("opens and closes a recommendation tool", () => {
      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.openRecommendationTool("time-estimation");
      });
      expect(result.current.selectedRecommendationTool).toBe("time-estimation");

      act(() => {
        result.current.closeRecommendationTool();
      });
      expect(result.current.selectedRecommendationTool).toBeNull();
    });

    it("keeps architecture open when switching to the aggregate cluster view", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.openRecommendationTool("architecture");
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });

      expect(result.current.selectedRecommendationTool).toBe("architecture");
    });

    it("closes architecture when switching to an aggregate view without hosts or VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(0, 0), vms: createVMs(0) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.openRecommendationTool("architecture");
      });
      expect(result.current.selectedRecommendationTool).toBe("architecture");

      act(() => {
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });

      expect(result.current.selectedRecommendationTool).toBeNull();
    });

    it("keeps time estimation open when switching to the aggregate cluster view", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.openRecommendationTool("time-estimation");
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });

      expect(result.current.selectedRecommendationTool).toBe("time-estimation");
    });

    it("isPartner is false when the account is not a partner", () => {
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.isPartner).toBe(false);
    });

    it("keeps cost estimation open for partners when switching to the aggregate view", () => {
      mockAccountStore.getSnapshot.mockReturnValue({
        username: "partner-user",
        kind: "partner",
        groupId: "group-1",
        partnerId: null,
        isPartner: true,
      });
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.isPartner).toBe(true);

      act(() => {
        result.current.selectCluster("Cluster-A");
        result.current.openRecommendationTool("cost-estimation");
        result.current.selectCluster(ALL_CLUSTERS_ID);
      });

      expect(result.current.selectedRecommendationTool).toBe("cost-estimation");
    });

    it("keeps time estimation open when switching to a cluster without hosts or VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(0, 0), vms: createVMs(0) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.selectCluster("Cluster-A");
        result.current.openRecommendationTool("time-estimation");
        result.current.selectCluster("Cluster-B");
      });

      expect(result.current.selectedRecommendationTool).toBe("time-estimation");
    });

    it("closes architecture when switching to a cluster without hosts or VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(0, 0), vms: createVMs(0) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.selectCluster("Cluster-A");
        result.current.openRecommendationTool("architecture");
      });
      expect(result.current.selectedRecommendationTool).toBe("architecture");

      act(() => {
        result.current.selectCluster("Cluster-B");
      });

      expect(result.current.selectedRecommendationTool).toBeNull();
    });

    it("keeps architecture open when switching to a cluster with hosts and VMs", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.selectCluster("Cluster-A");
        result.current.openRecommendationTool("architecture");
        result.current.selectCluster("Cluster-B");
      });

      expect(result.current.selectedRecommendationTool).toBe("architecture");
    });

    it("clears the recommendation tool when group selection resets the cluster", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(10) },
      });
      assessment.snapshots = [
        {
          createdAt: new Date(),
          inventory: assessment.snapshots?.[0]?.inventory ?? {
            vcenterId: "vcenter-1",
            clusters: {},
          },
          subsetInventories: [
            {
              id: "group-1",
              name: "Group 1",
              vcenterId: "vcenter-1",
              vmsCount: 3,
              createdAt: new Date(),
              inventory: {
                vcenterId: "vcenter-1",
                clusters: {
                  "Cluster-A": {
                    infra: createInfra(1, 1),
                    vms: createVMs(3),
                  },
                },
                vcenter: {
                  infra: createInfra(1, 1),
                  vms: createVMs(3),
                },
              },
            },
          ],
        },
      ];
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.openRecommendationTool("architecture");
        result.current.selectGroup("group-1");
      });

      expect(result.current.selectedRecommendationTool).toBeNull();
    });
  });

  describe("cluster select open state", () => {
    it("starts with isClusterSelectOpen = false", () => {
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.isClusterSelectOpen).toBe(false);
    });

    it("toggles cluster select", () => {
      const { result } = renderHook(() => useReportPageViewModel());

      act(() => {
        result.current.setClusterSelectOpen(true);
      });
      expect(result.current.isClusterSelectOpen).toBe(true);
    });
  });

  describe("clusterSelectDisabled", () => {
    it("returns true when there is 1 or fewer cluster options", () => {
      // No clusters → only the all-clusters option → length 1
      const assessment = createAssessment("assessment-1");
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.clusterSelectDisabled).toBe(true);
    });

    it("returns false when there are multiple cluster options", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.clusterSelectDisabled).toBe(false);
    });
  });

  describe("group selection", () => {
    it("hides group filter when no subset inventories are present", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.groupView.showGroupFilter).toBe(false);
      expect(result.current.selectedGroupId).toBe(ALL_VMS_GROUP_ID);
    });

    it("shows group options from subset inventories and scopes dashboard data", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(10) },
      });
      assessment.snapshots = [
        {
          createdAt: new Date(),
          inventory: assessment.snapshots?.[0]?.inventory ?? {
            vcenterId: "vcenter-1",
            clusters: {},
          },
          subsetInventories: [
            {
              id: "group-1",
              name: "Group 1",
              vcenterId: "vcenter-1",
              vmsCount: 3,
              createdAt: new Date(),
              inventory: {
                vcenterId: "vcenter-1",
                clusters: {
                  "Cluster-A": {
                    infra: createInfra(1, 1),
                    vms: createVMs(3),
                  },
                },
                vcenter: {
                  infra: createInfra(1, 1),
                  vms: createVMs(3),
                },
              },
            },
          ],
        },
      ];
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.groupView.showGroupFilter).toBe(true);
      expect(result.current.groupView.groupOptions).toHaveLength(2);
      expect(result.current.groupView.groupOptions[1].label).toBe(
        "Group 1 (3 VMs)",
      );

      act(() => {
        result.current.selectGroup("group-1");
      });

      expect(result.current.selectedGroupId).toBe("group-1");
      expect(result.current.clusterView.viewVms?.total).toBe(3);
      expect(result.current.reportSummaryVms?.total).toBe(10);
    });

    it("hides group filter for RVTools assessments even when subset inventories exist", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(10) },
      });
      assessment.sourceType = "rvtools";
      assessment.snapshots = [
        {
          createdAt: new Date(),
          inventory: assessment.snapshots?.[0]?.inventory ?? {
            vcenterId: "vcenter-1",
            clusters: {},
          },
          subsetInventories: [
            {
              id: "group-1",
              name: "My RVTools assessment",
              vcenterId: "vcenter-1",
              vmsCount: 10,
              createdAt: new Date(),
              inventory: assessment.snapshots?.[0]?.inventory,
            },
          ],
        },
      ];
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.groupView.showGroupFilter).toBe(false);
      expect(result.current.clusterView.viewVms?.total).toBe(10);
    });
  });

  describe("computed data", () => {
    it("extracts infra and vms from latest snapshot", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      // Per-cluster selection extracts cluster-level infra/vms
      expect(result.current.infra).toBeDefined();
      expect(result.current.vms).toBeDefined();
    });

    it("computes clusterCount from clusters map", () => {
      const assessment = createAssessment("assessment-1", {
        "Cluster-A": { infra: createInfra(2, 2), vms: createVMs(5) },
        "Cluster-B": { infra: createInfra(3, 3), vms: createVMs(7) },
      });
      mockAssessmentsStore.getSnapshot.mockReturnValue([assessment]);

      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.clusterCount).toBe(2);
    });

    it("returns clusterCount 0 when no clusters", () => {
      mockAssessmentsStore.getSnapshot.mockReturnValue([]);
      const { result } = renderHook(() => useReportPageViewModel());
      expect(result.current.clusterCount).toBe(0);
    });
  });
});
