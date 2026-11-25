import type { Identity, Job } from "@openshift-migration-advisor/planner-sdk";
import { JobStatus } from "@openshift-migration-advisor/planner-sdk";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobsStoreState } from "../../../../data/stores/JobsStore";
import { useAssessmentsScreenViewModel } from "../useAssessmentsScreenViewModel";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock stores that will be injected
let mockAccountStore: {
  getIdentity: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
};

let mockAssessmentsStore: {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
};

let mockJobsStore: {
  createRVToolsJob: ReturnType<typeof vi.fn>;
  appendRvtoolsToAssessment: ReturnType<typeof vi.fn>;
  cancelRVToolsJob: ReturnType<typeof vi.fn>;
  clearCreateError: ReturnType<typeof vi.fn>;
  clearRvtoolsUploadResults: ReturnType<typeof vi.fn>;
  removeRvtoolsUploadResult: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  startPolling: ReturnType<typeof vi.fn>;
  stopPolling: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
};

let mockRvtoolsReportPersistenceStore: {
  applyUploadOutcome: ReturnType<typeof vi.fn>;
};

let jobsStoreState: JobsStoreState;
let jobsListeners: Set<() => void>;
let accountStoreState: Identity | null;

vi.mock("@openshift-migration-advisor/ioc", () => ({
  useInjection: (symbol: symbol) => {
    const key = symbol.description;
    if (key === "AccountStore") return mockAccountStore;
    if (key === "AssessmentsStore") return mockAssessmentsStore;
    if (key === "JobsStore") return mockJobsStore;
    if (key === "RvtoolsReportPersistenceStore") {
      return mockRvtoolsReportPersistenceStore;
    }
    throw new Error(`Unexpected symbol: ${String(symbol)}`);
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 1,
  status: JobStatus.Pending,
  assessmentId: undefined,
  ...overrides,
});

const setJobsState = (partial: Partial<JobsStoreState>): void => {
  jobsStoreState = { ...jobsStoreState, ...partial };
  // Notify all subscribers (triggers useSyncExternalStore update)
  jobsListeners.forEach((fn) => fn());
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAssessmentsScreenViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    accountStoreState = null;
    jobsStoreState = {
      currentJob: null,
      isCreating: false,
      createError: undefined,
    };
    jobsListeners = new Set();

    mockAccountStore = {
      getIdentity: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn((_fn: () => void) => {
        // no-op for account store in these tests
        return () => {};
      }),
      getSnapshot: vi.fn(() => accountStoreState),
    };

    mockAssessmentsStore = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
      subscribe: vi.fn((_fn: () => void) => {
        // no-op for assessments store in these tests
        return () => {};
      }),
      getSnapshot: vi.fn(() => []),
    };

    mockRvtoolsReportPersistenceStore = {
      applyUploadOutcome: vi.fn(),
    };

    mockJobsStore = {
      createRVToolsJob: vi.fn().mockResolvedValue(makeJob()),
      appendRvtoolsToAssessment: vi.fn().mockResolvedValue(makeJob()),
      cancelRVToolsJob: vi.fn().mockResolvedValue(null),
      clearCreateError: vi.fn(),
      clearRvtoolsUploadResults: vi.fn(),
      removeRvtoolsUploadResult: vi.fn(),
      reset: vi.fn(),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      subscribe: vi.fn((fn: () => void) => {
        jobsListeners.add(fn);
        return () => {
          jobsListeners.delete(fn);
        };
      }),
      getSnapshot: vi.fn(() => jobsStoreState),
    };
  });

  // -- updateAssessment -----------------------------------------------------

  it("delegates updateAssessment to the AssessmentsStore", async () => {
    const { result } = renderHook(() => useAssessmentsScreenViewModel());

    await act(async () => {
      await result.current.updateAssessment("a-1", "New Name");
    });

    expect(mockAssessmentsStore.update).toHaveBeenCalledWith("a-1", {
      name: "New Name",
    });
  });

  // -- deleteAssessment -----------------------------------------------------

  it("delegates deleteAssessment to the AssessmentsStore", async () => {
    const { result } = renderHook(() => useAssessmentsScreenViewModel());

    await act(async () => {
      await result.current.deleteAssessment("a-1");
    });

    expect(mockAssessmentsStore.remove).toHaveBeenCalledWith("a-1");
  });

  it("tracks isDeletingAssessment loading state", async () => {
    let resolveDelete!: () => void;
    mockAssessmentsStore.remove.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    const { result } = renderHook(() => useAssessmentsScreenViewModel());

    let deletePromise: Promise<void>;
    act(() => {
      deletePromise = result.current.deleteAssessment("a-1");
    });

    expect(result.current.isDeletingAssessment).toBe(true);

    await act(async () => {
      resolveDelete();
      await deletePromise!;
    });

    expect(result.current.isDeletingAssessment).toBe(false);
  });
});
