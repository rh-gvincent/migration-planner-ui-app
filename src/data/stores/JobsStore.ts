import type { Job, JobApi } from "@openshift-migration-advisor/planner-sdk";
import { JobStatus } from "@openshift-migration-advisor/planner-sdk";

import { isNameError, parseApiError } from "../../lib/common/ErrorParser";
import { PollableStoreBase } from "../../lib/mvvm/PollableStore";
import type { IJobsStore } from "./interfaces/IJobsStore";

/** Polling interval in milliseconds for active job status checks. */
export const JOB_POLLING_INTERVAL = 1000;

/** Job statuses that indicate the job has reached a final state. */
export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  JobStatus.Completed,
  JobStatus.Failed,
  JobStatus.Cancelled,
];

export type RvtoolsFileUploadResultStatus =
  "pending" | "processing" | "valid" | "invalid";

export type RvtoolsFileUploadResult = {
  fileName: string;
  fileSize: number;
  status: RvtoolsFileUploadResultStatus;
  errorMessage?: string;
};

export type RvtoolsUploadState = {
  results: RvtoolsFileUploadResult[];
};

export type JobsStoreState = {
  currentJob: Job | null;
  isCreating: boolean;
  createError?: Error;
  rvtoolsUpload?: RvtoolsUploadState;
  /**
   * When a multi-file create fails after the assessment exists, remaining files
   * should be appended to this assessment instead of starting a new create.
   */
  rvtoolsPartialAssessmentId?: string;
};

type RvtoolsUploadFlow = "create" | "append";

export class JobsStore
  extends PollableStoreBase<JobsStoreState>
  implements IJobsStore
{
  private state: JobsStoreState = {
    currentJob: null,
    isCreating: false,
    createError: undefined,
  };
  private abortController: AbortController | null = null;
  private cancelInProgress = false;
  private api: JobApi;
  /** Remaining files after the in-flight job (one file per v2 API call). */
  private pendingRvtoolsFiles: File[] = [];
  /** Full ordered list for the active multi-file upload session. */
  private rvtoolsAllFiles: File[] = [];
  /** Assessment receiving uploads (create: from first job; append: known upfront). */
  private rvtoolsAssessmentId: string | undefined;
  private rvtoolsFlow: RvtoolsUploadFlow | undefined;
  /** Name for the active create flow (used when retrying create with the next file). */
  private rvtoolsCreateName: string | undefined;

  constructor(api: JobApi) {
    super();
    this.api = api;
  }

  override getSnapshot(): JobsStoreState {
    return this.state;
  }

  /**
   * Create an RVTools assessment: POST the first file, then PUT each additional
   * file to the same assessment when each job completes (v2 aggregation).
   */
  async createRVToolsJob(
    name: string,
    files: File[],
  ): Promise<Job | undefined> {
    if (files.length === 0) {
      return undefined;
    }

    this.rvtoolsCreateName = name;
    this.beginRvtoolsUploadQueue(files, {
      flow: "create",
      assessmentId: undefined,
    });

    return this.startRvtoolsJob((signal) =>
      this.api.createRVToolsAssessmentV2({ name, file: files[0] }, { signal }),
    );
  }

  /**
   * Append RVTools files: one PUT per file, sequentially after each job completes.
   */
  async appendRvtoolsToAssessment(
    assessmentId: string,
    files: File[],
  ): Promise<Job | undefined> {
    if (files.length === 0) {
      return undefined;
    }

    this.beginRvtoolsUploadQueue(files, {
      flow: "append",
      assessmentId,
    });

    return this.startRvtoolsJob((signal) =>
      this.api.uploadRvtoolsToAssessment(
        { id: assessmentId, file: files[0] },
        { signal },
      ),
    );
  }

  private beginRvtoolsUploadQueue(
    files: File[],
    options: { flow: RvtoolsUploadFlow; assessmentId?: string },
  ): void {
    this.rvtoolsAllFiles = [...files];
    this.pendingRvtoolsFiles = files.slice(1);
    this.rvtoolsFlow = options.flow;
    this.rvtoolsAssessmentId = options.assessmentId;
    const results: RvtoolsFileUploadResult[] = files.map((file) => ({
      fileName: file.name,
      fileSize: file.size,
      status: "pending",
    }));
    if (results.length > 0) {
      results[0].status = "processing";
    }
    this.setState({ rvtoolsUpload: { results } });
  }

  private getActiveFileIndex(): number {
    return this.rvtoolsAllFiles.length - this.pendingRvtoolsFiles.length - 1;
  }

  private updateRvtoolsFileResult(
    index: number,
    update: Partial<RvtoolsFileUploadResult>,
  ): void {
    const upload = this.state.rvtoolsUpload;
    if (!upload || index < 0 || index >= upload.results.length) {
      return;
    }
    const results = upload.results.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...update } : entry,
    );
    this.setState({ rvtoolsUpload: { results } });
  }

  private markRvtoolsFileValid(index: number): void {
    this.updateRvtoolsFileResult(index, {
      status: "valid",
      errorMessage: undefined,
    });
  }

  private markRvtoolsFileInvalid(index: number, errorMessage: string): void {
    this.updateRvtoolsFileResult(index, {
      status: "invalid",
      errorMessage,
    });
  }

  private markRvtoolsFileProcessing(index: number): void {
    this.updateRvtoolsFileResult(index, { status: "processing" });
  }

  private clearRvtoolsUploadQueue(): void {
    this.pendingRvtoolsFiles = [];
    this.rvtoolsAllFiles = [];
    this.rvtoolsAssessmentId = undefined;
    this.rvtoolsFlow = undefined;
    this.rvtoolsCreateName = undefined;
  }

  private countRvtoolsUploadResults(
    status: RvtoolsFileUploadResult["status"],
  ): number {
    return (
      this.state.rvtoolsUpload?.results.filter(
        (entry) => entry.status === status,
      ).length ?? 0
    );
  }

  private finalizeRvtoolsUploadSession(completedJob?: Job): void {
    const validCount = this.countRvtoolsUploadResults("valid");
    const invalidCount = this.countRvtoolsUploadResults("invalid");
    const assessmentId =
      this.rvtoolsAssessmentId ??
      completedJob?.assessmentId ??
      this.state.currentJob?.assessmentId ??
      undefined;
    const lastJobId = completedJob?.id ?? this.state.currentJob?.id ?? 0;

    this.clearRvtoolsUploadQueue();

    if (validCount > 0 && assessmentId) {
      const updates: Partial<JobsStoreState> = {
        currentJob: {
          id: lastJobId,
          status: JobStatus.Completed,
          assessmentId,
        },
      };
      if (invalidCount > 0) {
        updates.rvtoolsPartialAssessmentId = assessmentId;
      } else {
        updates.rvtoolsPartialAssessmentId = undefined;
      }
      this.setState(updates);
      return;
    }

    if (invalidCount > 0) {
      this.setState({
        currentJob: {
          id: lastJobId,
          status: JobStatus.Failed,
          assessmentId: undefined,
          error: "One or more files could not be processed",
        },
      });
      return;
    }

    if (completedJob) {
      this.setState({ currentJob: completedJob });
    }
  }

  private async startNextRvtoolsUpload(
    assessmentId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const nextFile = this.pendingRvtoolsFiles.shift()!;
    const nextIndex = this.getActiveFileIndex();
    this.markRvtoolsFileProcessing(nextIndex);

    const nextJob = await this.api.uploadRvtoolsToAssessment(
      { id: assessmentId, file: nextFile },
      { signal },
    );
    this.setState({ currentJob: nextJob });
  }

  private async startNextRvtoolsCreate(signal: AbortSignal): Promise<void> {
    const name = this.rvtoolsCreateName;
    if (!name || this.pendingRvtoolsFiles.length === 0) {
      this.finalizeRvtoolsUploadSession();
      return;
    }

    const nextFile = this.pendingRvtoolsFiles.shift()!;
    const nextIndex = this.getActiveFileIndex();
    this.markRvtoolsFileProcessing(nextIndex);

    const nextJob = await this.api.createRVToolsAssessmentV2(
      { name, file: nextFile },
      { signal },
    );
    this.setState({ currentJob: nextJob });
  }

  private async advanceAfterRvtoolsFileFailure(
    failedIndex: number,
    errorMessage: string,
    signal: AbortSignal,
    lastJob: Job,
  ): Promise<void> {
    // Name validation applies to the assessment, so another file cannot fix it.
    if (
      this.rvtoolsFlow === "create" &&
      isNameError(new Error(errorMessage))
    ) {
      this.preservePartialAssessmentIfNeeded();
      this.clearRvtoolsUploadQueue();
      this.setState({
        currentJob: lastJob,
        createError: new Error(errorMessage),
        isCreating: false,
      });
      return;
    }

    this.markRvtoolsFileInvalid(failedIndex, errorMessage);
    this.preservePartialAssessmentIfNeeded();

    const assessmentId =
      this.rvtoolsAssessmentId ?? lastJob.assessmentId ?? undefined;
    if (assessmentId) {
      this.rvtoolsAssessmentId = assessmentId;
    }

    if (assessmentId && this.pendingRvtoolsFiles.length > 0) {
      try {
        await this.startNextRvtoolsUpload(assessmentId, signal);
      } catch (err) {
        if (!signal.aborted) {
          const errorToStore = await parseApiError(
            err,
            "Failed to upload RVTools file",
          );
          const nextIndex = this.getActiveFileIndex();
          await this.advanceAfterRvtoolsFileFailure(
            nextIndex,
            errorToStore.message,
            signal,
            lastJob,
          );
        }
      }
      return;
    }

    if (
      !assessmentId &&
      this.rvtoolsFlow === "create" &&
      this.pendingRvtoolsFiles.length > 0
    ) {
      try {
        await this.startNextRvtoolsCreate(signal);
      } catch (err) {
        if (!signal.aborted) {
          const errorToStore = await parseApiError(
            err,
            "Failed to create RVTools assessment",
          );
          const nextIndex = this.getActiveFileIndex();
          await this.advanceAfterRvtoolsFileFailure(
            nextIndex,
            errorToStore.message,
            signal,
            lastJob,
          );
        }
      }
      return;
    }

    this.finalizeRvtoolsUploadSession(lastJob);
  }

  private preservePartialAssessmentIfNeeded(): void {
    if (this.rvtoolsFlow !== "create") {
      return;
    }
    const assessmentId =
      this.rvtoolsAssessmentId ??
      this.state.currentJob?.assessmentId ??
      undefined;
    if (assessmentId) {
      this.setState({ rvtoolsPartialAssessmentId: assessmentId });
    }
  }

  private async startRvtoolsJob(
    request: (signal: AbortSignal) => Promise<Job>,
  ): Promise<Job | undefined> {
    this.cancelInProgress = false;

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const controller = this.abortController;

    this.setState({
      isCreating: true,
      createError: undefined,
      currentJob: null,
    });

    try {
      const job = await request(controller.signal);

      if (controller.signal.aborted) {
        if (job?.id && !TERMINAL_JOB_STATUSES.includes(job.status)) {
          this.api.cancelJob({ id: job.id }).catch(() => undefined);
        }
        if (this.abortController === controller) {
          this.clearRvtoolsUploadQueue();
        }
        return undefined;
      }

      this.setState({ currentJob: job, isCreating: false });
      if (
        this.state.rvtoolsUpload &&
        TERMINAL_JOB_STATUSES.includes(job.status)
      ) {
        if (job.status === JobStatus.Failed) {
          await this.advanceAfterRvtoolsFileFailure(
            this.getActiveFileIndex(),
            job.error || "Processing failed",
            controller.signal,
            job,
          );
        } else if (job.status === JobStatus.Completed) {
          const completedIndex = this.getActiveFileIndex();
          if (completedIndex >= 0) {
            this.markRvtoolsFileValid(completedIndex);
          }
          if (job.assessmentId) {
            this.rvtoolsAssessmentId = job.assessmentId;
          }
          if (this.pendingRvtoolsFiles.length > 0) {
            const assessmentId =
              this.rvtoolsAssessmentId ?? job.assessmentId ?? undefined;
            if (assessmentId) {
              try {
                await this.startNextRvtoolsUpload(
                  assessmentId,
                  controller.signal,
                );
              } catch (nextErr) {
                if (!controller.signal.aborted) {
                  const errorToStore = await parseApiError(
                    nextErr,
                    "Failed to upload RVTools file",
                  );
                  const nextIndex = this.getActiveFileIndex();
                  await this.advanceAfterRvtoolsFileFailure(
                    nextIndex,
                    errorToStore.message,
                    controller.signal,
                    job,
                  );
                }
              }
              return job;
            }
            if (
              this.rvtoolsFlow === "create" &&
              this.pendingRvtoolsFiles.length > 0
            ) {
              try {
                await this.startNextRvtoolsCreate(controller.signal);
              } catch (nextErr) {
                if (!controller.signal.aborted) {
                  const errorToStore = await parseApiError(
                    nextErr,
                    "Failed to create RVTools assessment",
                  );
                  const nextIndex = this.getActiveFileIndex();
                  await this.advanceAfterRvtoolsFileFailure(
                    nextIndex,
                    errorToStore.message,
                    controller.signal,
                    job,
                  );
                }
              }
              return job;
            }
          }
          this.finalizeRvtoolsUploadSession(job);
        }
      }
      return job;
    } catch (err) {
      if (controller.signal.aborted) {
        if (this.abortController === controller) {
          this.clearRvtoolsUploadQueue();
        }
        return undefined;
      }

      const errorToStore = await parseApiError(
        err,
        "Failed to create RVTools job",
      );

      if (this.abortController !== controller) {
        return undefined;
      }

      this.setState({ createError: errorToStore, isCreating: false });
      const failedIndex = Math.max(0, this.getActiveFileIndex());
      await this.advanceAfterRvtoolsFileFailure(
        failedIndex,
        errorToStore.message,
        controller.signal,
        { id: 0, status: JobStatus.Failed, error: errorToStore.message },
      );
      const activeJob = this.state.currentJob;
      if (activeJob && !TERMINAL_JOB_STATUSES.includes(activeJob.status)) {
        return activeJob;
      }
      return undefined;
    }
  }

  async cancelRVToolsJob(): Promise<Job | null> {
    if (this.cancelInProgress) {
      return null;
    }
    this.cancelInProgress = true;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const currentJob = this.state.currentJob;

    this.clearRvtoolsUploadQueue();
    this.reset();

    let latestJob: Job | null = null;

    if (currentJob) {
      try {
        latestJob = await this.api.getJob({ id: currentJob.id });
      } catch {
        latestJob = currentJob;
      }

      if (!TERMINAL_JOB_STATUSES.includes(latestJob.status)) {
        try {
          await this.api.cancelJob({ id: latestJob.id });
        } catch (err) {
          console.error("Failed to cancel job:", err);
        }
      }
    }

    this.cancelInProgress = false;
    return latestJob;
  }

  clearCreateError(): void {
    const updates: Partial<JobsStoreState> = {};

    if (this.state.createError !== undefined) {
      updates.createError = undefined;
    }

    if (
      this.state.currentJob &&
      TERMINAL_JOB_STATUSES.includes(this.state.currentJob.status)
    ) {
      updates.currentJob = null;
    }

    if (Object.keys(updates).length > 0) {
      this.setState(updates);
    }
  }

  clearRvtoolsUploadResults(): void {
    if (!this.state.rvtoolsUpload) {
      return;
    }
    this.setState({ rvtoolsUpload: undefined });
  }

  removeRvtoolsUploadResult(fileName: string, fileSize: number): void {
    const upload = this.state.rvtoolsUpload;
    if (!upload) {
      return;
    }

    const results = upload.results.filter(
      (entry) => !(entry.fileName === fileName && entry.fileSize === fileSize),
    );
    if (results.length === upload.results.length) {
      return;
    }

    if (results.length === 0) {
      this.setState({ rvtoolsUpload: undefined });
      return;
    }

    this.setState({ rvtoolsUpload: { results } });
  }

  reset(): void {
    this.clearRvtoolsUploadQueue();
    this.setState({
      currentJob: null,
      isCreating: false,
      createError: undefined,
      rvtoolsUpload: undefined,
      rvtoolsPartialAssessmentId: undefined,
    });
  }

  protected override async poll(signal: AbortSignal): Promise<void> {
    if (this.cancelInProgress) {
      return;
    }

    const currentJob = this.state.currentJob;
    if (!currentJob || TERMINAL_JOB_STATUSES.includes(currentJob.status)) {
      return;
    }

    try {
      const updated = await this.api.getJob({ id: currentJob.id }, { signal });
      if (this.cancelInProgress) {
        return;
      }

      if (updated.status === JobStatus.Failed) {
        const failedIndex = this.getActiveFileIndex();
        await this.advanceAfterRvtoolsFileFailure(
          failedIndex,
          updated.error || "Processing failed",
          signal,
          updated,
        );
        return;
      }

      if (
        updated.status === JobStatus.Completed &&
        this.pendingRvtoolsFiles.length > 0
      ) {
        const assessmentId =
          this.rvtoolsAssessmentId ?? updated.assessmentId ?? undefined;

        if (this.rvtoolsFlow === "create" && updated.assessmentId) {
          this.rvtoolsAssessmentId = updated.assessmentId;
        }

        if (assessmentId) {
          const completedIndex = this.getActiveFileIndex();
          this.markRvtoolsFileValid(completedIndex);

          try {
            await this.startNextRvtoolsUpload(assessmentId, signal);
          } catch (err) {
            if (!signal.aborted) {
              console.error("Failed to upload next RVTools file:", err);
              const errorToStore = await parseApiError(
                err,
                "Failed to upload RVTools file",
              );
              const nextIndex = this.getActiveFileIndex();
              await this.advanceAfterRvtoolsFileFailure(
                nextIndex,
                errorToStore.message,
                signal,
                updated,
              );
            }
          }
          return;
        }
      }

      if (
        TERMINAL_JOB_STATUSES.includes(updated.status) &&
        this.pendingRvtoolsFiles.length === 0
      ) {
        const completedIndex = this.getActiveFileIndex();
        if (updated.status === JobStatus.Completed && completedIndex >= 0) {
          this.markRvtoolsFileValid(completedIndex);
        }
        if (updated.assessmentId) {
          this.rvtoolsAssessmentId = updated.assessmentId;
        }
        this.finalizeRvtoolsUploadSession(updated);
        return;
      }

      this.setState({ currentJob: updated });
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      console.error("Failed to poll job status:", err);
    }
  }

  private setState(partial: Partial<JobsStoreState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }
}
