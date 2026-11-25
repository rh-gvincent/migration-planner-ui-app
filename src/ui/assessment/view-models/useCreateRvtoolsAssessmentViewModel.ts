import { useInjection } from "@openshift-migration-advisor/ioc";
import { JobStatus } from "@openshift-migration-advisor/planner-sdk";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useAsyncFn } from "react-use";

import { Symbols } from "../../../config/Dependencies";
import {
  JOB_POLLING_INTERVAL,
  TERMINAL_JOB_STATUSES,
} from "../../../data/stores/JobsStore";
import type { IJobsStore } from "../../../data/stores/interfaces/IJobsStore";
import {
  getAssessmentNameErrorMessage,
  isNameError,
} from "../../../lib/common/ErrorParser";
import { routes } from "../../../routing/Routes";
import type { RvtoolsFileValidationResult } from "../rvtools/types";
import type { CreateRvtoolsAssessmentFormValues } from "../views/create-rvtools/types";

const DUPLICATE_FILE_ERROR_PATTERN =
  /\bduplicate\b|\balready (?:exists|uploaded|added|included|present)\b/i;

export interface CreateRVToolsAssessmentViewModel {
  onSubmit: (payload: CreateRvtoolsAssessmentFormValues) => void;
  onClearError: () => void;
  isLoading: boolean;
  error: Error | null;
  files: RvtoolsFileValidationResult[];
}

export const useCreateRVToolsAssessmentViewModel =
  (): CreateRVToolsAssessmentViewModel => {
    const navigate = useNavigate();
    const jobsStore = useInjection<IJobsStore>(Symbols.JobsStore);
    const jobState = useSyncExternalStore(
      jobsStore.subscribe.bind(jobsStore),
      jobsStore.getSnapshot.bind(jobsStore),
    );
    const files = useMemo(
      (): RvtoolsFileValidationResult[] =>
        (jobState.rvtoolsUpload?.results ?? []).filter(
          (result) =>
            !result.errorMessage ||
            !isNameError(new Error(result.errorMessage)),
        ),
      [jobState.rvtoolsUpload],
    );
    const [submitState, submit] = useAsyncFn(
      async ({ name, files }: CreateRvtoolsAssessmentFormValues) => {
        jobsStore.clearCreateError();
        const job = await jobsStore.createRVToolsJob(name, files);
        if (job) {
          jobsStore.startPolling(JOB_POLLING_INTERVAL);
        }
      },
      [jobsStore],
    );

    const error = useMemo((): Error | null => {
      const errors = [
        jobState.createError,
        submitState.error,
        ...(jobState.currentJob?.status === JobStatus.Failed &&
        jobState.currentJob.error
          ? [new Error(jobState.currentJob.error)]
          : []),
        ...(jobState.rvtoolsUpload?.results ?? []).flatMap((result) =>
          result.errorMessage ? [new Error(result.errorMessage)] : [],
        ),
      ];
      const assessmentError = errors
        .map((candidate) => getAssessmentNameErrorMessage(candidate ?? null))
        .find((message): message is string => Boolean(message));

      if (assessmentError) {
        return new Error(assessmentError);
      }

      const duplicateFileError = jobState.rvtoolsUpload?.results.find(
        (result) =>
          result.errorMessage &&
          DUPLICATE_FILE_ERROR_PATTERN.test(result.errorMessage),
      );
      if (duplicateFileError?.errorMessage) {
        return new Error(duplicateFileError.errorMessage);
      }

      if (submitState.error) {
        return submitState.error;
      }

      const hasSpecificFileError = files.some(
        (result) => result.status === "invalid" && result.errorMessage,
      );
      const createErrorIsShownForFile = files.some(
        (result) =>
          result.status === "invalid" &&
          result.errorMessage === jobState.createError?.message,
      );

      if (
        jobState.createError &&
        !createErrorIsShownForFile &&
        jobState.currentJob?.status !== JobStatus.Completed
      ) {
        return jobState.createError;
      }
      if (
        jobState.currentJob?.status === JobStatus.Failed &&
        !hasSpecificFileError
      ) {
        return new Error(jobState.currentJob.error || "Processing failed");
      }
      return null;
    }, [
      files,
      jobState.createError,
      jobState.currentJob,
      jobState.rvtoolsUpload,
      submitState.error,
    ]);

    const onSubmit = useCallback(
      (payload: CreateRvtoolsAssessmentFormValues): void => {
        void submit(payload);
      },
      [submit],
    );

    const onClearError = useCallback((): void => {
      jobsStore.clearCreateError();
    }, [jobsStore]);

    useEffect(() => {
      const { currentJob } = jobState;
      if (!currentJob || !TERMINAL_JOB_STATUSES.includes(currentJob.status)) {
        return;
      }

      jobsStore.stopPolling();

      if (
        currentJob.status !== JobStatus.Completed ||
        !currentJob.assessmentId
      ) {
        return;
      }

      void navigate(routes.assessmentReport(currentJob.assessmentId));
      jobsStore.reset();
    }, [jobState, jobsStore, navigate]);

    const isJobProcessing = Boolean(
      jobState.currentJob &&
      !TERMINAL_JOB_STATUSES.includes(jobState.currentJob.status),
    );

    return {
      onSubmit,
      onClearError,
      isLoading:
        jobState.isCreating ||
        (jobState.currentJob === null && submitState.loading) ||
        isJobProcessing,
      error,
      files,
    };
  };
