import type { Identity, Job } from "@openshift-migration-advisor/planner-sdk";
import { JobStatus } from "@openshift-migration-advisor/planner-sdk";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobsStoreState } from "../../../../data/stores/JobsStore";
import { useAssessmentPageViewModel } from "../useAssessmentPageViewModel";

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
  cancelRVToolsJob: ReturnType<typeof vi.fn>;
  clearCreateError: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  startPolling: ReturnType<typeof vi.fn>;
  stopPolling: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
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

describe("useAssessmentPageViewModel", () => {
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

    mockJobsStore = {
      createRVToolsJob: vi.fn().mockResolvedValue(makeJob()),
      cancelRVToolsJob: vi.fn().mockResolvedValue(null),
      clearCreateError: vi.fn(),
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

  // -- Initial state --------------------------------------------------------

  it("exposes job state from the store", () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());

    expect(result.current.currentJob).toBeNull();
    expect(result.current.isCreatingJob).toBe(false);
    expect(result.current.jobCreateError).toBeUndefined();
    expect(result.current.isJobProcessing).toBe(false);
    expect(result.current.jobProgressValue).toBe(0);
    expect(result.current.jobProgressLabel).toBe("");
    expect(result.current.jobError).toBeNull();
    expect(result.current.isDeletingAssessment).toBe(false);
    expect(result.current.deleteError).toBeUndefined();
    expect(result.current.isUpdatingAssessment).toBe(false);
    expect(result.current.updateError).toBeUndefined();
  });

  it("exposes identity for a regular user", () => {
    const regularUser: Identity = {
      username: "user-1",
      kind: "regular",
      groupId: "group-regular-1",
      partnerId: null,
    };
    accountStoreState = regularUser;

    const { result } = renderHook(() => useAssessmentPageViewModel());

    expect(result.current.identity).toEqual(regularUser);
  });

  // -- createRVToolsJob -----------------------------------------------------

  it("delegates createRVToolsJob to the JobsStore and starts polling", async () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());
    const file = new File([], "test.xlsx");

    await act(async () => {
      await result.current.createRVToolsJob("My Assessment", file);
    });

    expect(mockJobsStore.createRVToolsJob).toHaveBeenCalledWith(
      "My Assessment",
      file,
    );
    expect(mockJobsStore.startPolling).toHaveBeenCalledWith(1000);
  });

  it("does NOT start polling when createRVToolsJob returns undefined", async () => {
    mockJobsStore.createRVToolsJob.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssessmentPageViewModel());

    await act(async () => {
      await result.current.createRVToolsJob("test", new File([], "f.xlsx"));
    });

    expect(mockJobsStore.startPolling).not.toHaveBeenCalled();
  });

  // -- clearJobCreateError ---------------------------------------------------

  it("delegates clearJobCreateError to jobsStore.clearCreateError", () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());

    act(() => {
      result.current.clearJobCreateError();
    });

    expect(mockJobsStore.clearCreateError).toHaveBeenCalledOnce();
  });

  // -- cancelRVToolsJob -----------------------------------------------------

  it("stops polling and delegates cancelRVToolsJob to the JobsStore", async () => {
    mockJobsStore.cancelRVToolsJob.mockResolvedValue(null);
    const { result } = renderHook(() => useAssessmentPageViewModel());

    await act(async () => {
      await result.current.cancelRVToolsJob();
    });

    expect(mockJobsStore.stopPolling).toHaveBeenCalled();
    expect(mockJobsStore.cancelRVToolsJob).toHaveBeenCalled();
  });

  it("deletes assessment when cancelling a completed job", async () => {
    const completedJob = makeJob({
      status: JobStatus.Completed,
      assessmentId: "a-1",
    });
    mockJobsStore.cancelRVToolsJob.mockResolvedValue(completedJob);

    const { result } = renderHook(() => useAssessmentPageViewModel());

    await act(async () => {
      await result.current.cancelRVToolsJob();
    });

    expect(mockAssessmentsStore.remove).toHaveBeenCalledWith("a-1");
  });

  it("does NOT delete assessment when cancelling a failed job", async () => {
    const failedJob = makeJob({ status: JobStatus.Failed });
    mockJobsStore.cancelRVToolsJob.mockResolvedValue(failedJob);

    const { result } = renderHook(() => useAssessmentPageViewModel());

    await act(async () => {
      await result.current.cancelRVToolsJob();
    });

    expect(mockAssessmentsStore.remove).not.toHaveBeenCalled();
  });

  // -- updateAssessment -----------------------------------------------------

  it("delegates updateAssessment to the AssessmentsStore", async () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());

    await act(async () => {
      await result.current.updateAssessment("a-1", "New Name");
    });

    expect(mockAssessmentsStore.update).toHaveBeenCalledWith("a-1", {
      name: "New Name",
    });
  });

  // -- deleteAssessment -----------------------------------------------------

  it("delegates deleteAssessment to the AssessmentsStore", async () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());

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

    const { result } = renderHook(() => useAssessmentPageViewModel());

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

  // -- Job completion detection ---------------------------------------------

  it("sets isNavigatingToReport immediately when job transitions to Completed", () => {
    const { result } = renderHook(() => useAssessmentPageViewModel());

    act(() => {
      setJobsState({
        currentJob: makeJob({ status: JobStatus.Parsing }),
      });
    });

    expect(result.current.isNavigatingToReport).toBe(false);

    act(() => {
      setJobsState({
        currentJob: makeJob({
          status: JobStatus.Completed,
          assessmentId: "a-42",
        }),
      });
    });

    expect(result.current.isNavigatingToReport).toBe(true);
  });

  it("stops polling, resets, and navigates to report on job completion", async () => {
    renderHook(() => useAssessmentPageViewModel());

    // Simulate job transitioning from Running → Completed
    act(() => {
      setJobsState({
        currentJob: makeJob({ status: JobStatus.Parsing }),
      });
    });

    await act(async () => {
      setJobsState({
        currentJob: makeJob({
          status: JobStatus.Completed,
          assessmentId: "a-42",
        }),
      });
      // Wait for get() promise to resolve
      await Promise.resolve();
    });

    expect(mockJobsStore.stopPolling).toHaveBeenCalled();
    expect(mockJobsStore.reset).toHaveBeenCalled();
    expect(mockAssessmentsStore.get).toHaveBeenCalledWith("a-42");
    expect(mockNavigate).toHaveBeenCalledWith("/assessments/a-42/report");
  });

  it("does NOT navigate when job fails", () => {
    renderHook(() => useAssessmentPageViewModel());

    act(() => {
      setJobsState({
        currentJob: makeJob({ status: JobStatus.Parsing }),
      });
    });

    act(() => {
      setJobsState({
        currentJob: makeJob({ status: JobStatus.Failed }),
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockJobsStore.reset).not.toHaveBeenCalled();
  });
});
