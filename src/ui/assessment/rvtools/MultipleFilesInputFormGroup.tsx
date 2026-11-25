import { FormFieldHelperText } from "@openshift-migration-advisor/shared-components";
import {
  Button,
  ExpandableSection,
  FormGroup,
  Label,
  Progress,
  ProgressMeasureLocation,
  ProgressSize,
  Truncate,
} from "@patternfly/react-core";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  FileIcon,
  InProgressIcon,
  RhUiTrashIcon,
  RhUiUploadIcon,
} from "@patternfly/react-icons";
import React, { useEffect, useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";

import {
  MAX_RVTOOLS_FILES,
  RVTOOLS_ACCEPT,
  RVTOOLS_FILE_REQUIREMENTS_URL,
} from "./constants";
import {
  formatRvtoolsBackendErrorMessage,
  formatRvtoolsFileSize,
} from "./formatters";
import type { RvtoolsFileValidationResult } from "./types";
import {
  dropzoneIntroStyle,
  dropzoneStyle,
  dropzoneTextStyle,
  hiddenInputStyle,
  stagedFileActionsStyle,
  stagedFileCompleteIconStyle,
  stagedFileMetaStyle,
  stagedFileNameStyle,
  stagedFilePercentStyle,
  stagedFileProgressStyle,
  stagedFileRowStyle,
  stagedFilesListStyle,
  stagedFilesPanelStyle,
  stagedFilesToolbarIconStyle,
  stagedFilesToolbarToggleStyle,
} from "./styles";
import { useRvtoolsFileStaging } from "./useRvtoolsFileStaging";

export interface MultipleFilesInputFormGroupProps {
  id: string;
  name: string;
  label: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isActive?: boolean;
  accept?: string;
  maxFiles?: number;
  fileResults?: RvtoolsFileValidationResult[];
  onClearError?: () => void;
}

export const MultipleFilesInputFormGroup: React.FC<
  MultipleFilesInputFormGroupProps
> = ({
  id,
  name,
  label,
  isRequired = false,
  isDisabled = false,
  isActive = true,
  accept = RVTOOLS_ACCEPT,
  maxFiles = MAX_RVTOOLS_FILES,
  fileResults = [],
  onClearError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isStagedFilesExpanded, setIsStagedFilesExpanded] = useState(true);
  const methods = useFormContext();
  const {
    field,
    fieldState: { error },
  } = useController({ name, control: methods.control });
  const staging = useRvtoolsFileStaging({
    mode: "create",
    isActive,
    isDisabled,
    maxFiles,
    onClearError,
  });

  const stagedFiles = staging.stagedFiles;
  const files = stagedFiles.map((entry) => entry.file);
  const previousFilesRef = useRef<File[]>([]);
  const isTouched = methods.formState.touchedFields[name] as
    boolean | undefined;
  const showValidationError =
    error && (isTouched || methods.formState.isSubmitted);

  useEffect(() => {
    const filesChanged =
      files.length !== previousFilesRef.current.length ||
      files.some((file, index) => file !== previousFilesRef.current[index]);
    if (!filesChanged) {
      return;
    }
    previousFilesRef.current = files;
    field.onChange(files);
  }, [field.onChange, files]);

  const addFiles = (newFiles: File[]): void => {
    if (isDisabled) {
      return;
    }
    staging.addFiles(newFiles);
    field.onBlur();
  };

  const isRowComplete = (fileStatus: string, progress: number): boolean =>
    fileStatus === "valid" ||
    fileStatus === "invalid" ||
    (fileStatus === "staged" && progress >= 100);

  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={id}>
      <div className={dropzoneIntroStyle}>
        Select one or more Excel files from RVTools. Multiple files are merged
        into one assessment. An assessment will be created from files that
        process successfully. Files with errors will be excluded.
        <br />
        <a
          href={RVTOOLS_FILE_REQUIREMENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          RVTools file requirements
        </a>
      </div>

      <section
        className={dropzoneStyle}
        aria-label="RVTools file drop zone"
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addFiles(Array.from(event.dataTransfer.files ?? []));
        }}
      >
        <RhUiUploadIcon aria-hidden />
        <div className={dropzoneTextStyle}>
          <div>Drag and drop files here or</div>
          <div>
            Accepted file types:{" "}
            {accept.replaceAll(".", "").replaceAll(",", ", ")}. Up to {maxFiles}{" "}
            files.
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          isDisabled={isDisabled || stagedFiles.length >= maxFiles}
        >
          Select files
        </Button>
        <input
          ref={(element) => {
            fileInputRef.current = element;
            field.ref(element);
          }}
          id={id}
          name={field.name}
          className={hiddenInputStyle}
          type="file"
          accept={accept}
          multiple
          onBlur={field.onBlur}
          onChange={(event) => {
            addFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
          disabled={isDisabled}
          aria-label={label}
        />
      </section>

      {staging.filePickerError ? (
        <FormFieldHelperText errorMessage={staging.filePickerError} />
      ) : null}
      {!staging.filePickerError ? (
        <FormFieldHelperText
          errorMessage={
            showValidationError && typeof error?.message === "string"
              ? error.message
              : undefined
          }
        />
      ) : null}

      {stagedFiles.length > 0 ? (
        <ExpandableSection
          className={stagedFilesPanelStyle}
          toggleContent={
            <span className={stagedFilesToolbarToggleStyle}>
              <CheckCircleIcon
                className={stagedFilesToolbarIconStyle}
                aria-hidden
              />
              {stagedFiles.length} of {maxFiles} files selected
            </span>
          }
          isExpanded={isStagedFilesExpanded}
          onToggle={(_event, expanded) => {
            setIsStagedFilesExpanded(expanded);
          }}
        >
          <div
            className={stagedFilesListStyle}
            aria-label="Selected RVTools files"
          >
            {stagedFiles.map((staged) => {
              const uploadResult = fileResults.find(
                (result) =>
                  result.fileName === staged.file.name &&
                  result.fileSize === staged.file.size,
              );
              const displayStatus =
                uploadResult?.status === "valid" ||
                uploadResult?.status === "invalid"
                  ? uploadResult.status
                  : staged.status;
              const errorMessage =
                uploadResult?.status === "invalid" && uploadResult.errorMessage
                  ? formatRvtoolsBackendErrorMessage(uploadResult.errorMessage)
                  : staged.errorMessage;
              const isComplete = isRowComplete(
                displayStatus,
                staged.progress,
              );
              const progressVariant =
                displayStatus === "invalid"
                  ? "danger"
                  : isComplete
                    ? "success"
                    : undefined;

              return (
                <div key={staged.id} className={stagedFileRowStyle}>
                  <div className={stagedFileMetaStyle}>
                    <FileIcon aria-hidden />
                    <span className={stagedFileNameStyle}>
                      <Truncate content={staged.file.name} />
                      <span> {formatRvtoolsFileSize(staged.file.size)}</span>
                    </span>
                  </div>
                  <div className={stagedFileActionsStyle}>
                    <span className={stagedFilePercentStyle}>
                      {staged.progress}%
                    </span>
                    {displayStatus === "invalid" ? (
                      <ExclamationCircleIcon aria-label="Invalid" />
                    ) : isComplete ? (
                      <CheckCircleIcon
                        className={stagedFileCompleteIconStyle}
                        aria-label="Ready"
                      />
                    ) : displayStatus === "processing" ? (
                      <InProgressIcon aria-label="Processing" />
                    ) : displayStatus === "queued" ? (
                      <Label color="grey">Waiting</Label>
                    ) : null}
                    <Button
                      type="button"
                      variant="plain"
                      aria-label={`Remove ${staged.file.name}`}
                      onClick={() => staging.removeFile(staged.id)}
                      isDisabled={
                        isDisabled ||
                        staged.status === "processing" ||
                        staged.status === "queued"
                      }
                    >
                      <RhUiTrashIcon />
                    </Button>
                  </div>
                  <div className={stagedFileProgressStyle}>
                    <Progress
                      value={staged.progress}
                      aria-label={`Upload progress for ${staged.file.name}`}
                      size={ProgressSize.sm}
                      variant={progressVariant}
                      measureLocation={ProgressMeasureLocation.none}
                      hideStatusIcon
                    />
                  </div>
                  {errorMessage ? (
                    <FormFieldHelperText errorMessage={errorMessage} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      ) : null}
    </FormGroup>
  );
};

MultipleFilesInputFormGroup.displayName = "MultipleFilesInputFormGroup";

export default MultipleFilesInputFormGroup;
