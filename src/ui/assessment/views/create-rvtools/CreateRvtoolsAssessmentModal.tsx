import { yupResolver } from "@hookform/resolvers/yup";
import { TextInputFormGroup } from "@openshift-migration-advisor/shared-components";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import { RhUiExternalLinkIcon } from "@patternfly/react-icons";
import React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import * as yup from "yup";

import { MultipleFilesInputFormGroup } from "../../rvtools/MultipleFilesInputFormGroup";
import type { RvtoolsFileValidationResult } from "../../rvtools/types";
import {
  MAX_RVTOOLS_FILES,
  RVTOOLS_ACCEPT,
  RVTOOLS_DATA_SHARING_URL,
  RVTOOLS_MAX_FILE_BYTES,
} from "../../rvtools/constants";
import { isAllowedRvtoolsExtension } from "../../rvtools/validation";
import type { CreateRvtoolsAssessmentFormValues } from "./types";

export interface CreateRvtoolsAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (payload: CreateRvtoolsAssessmentFormValues) => void;
  onClearError?: () => void;
  isLoading?: boolean;
  error?: Error | null;
  fileResults?: RvtoolsFileValidationResult[];
}

const FORM_ID = "create-rvtools-assessment-form";

const validationSchema: yup.ObjectSchema<CreateRvtoolsAssessmentFormValues> =
  yup.object({
    name: yup.string().trim().required("Assessment name is required"),
    consentChecked: yup
      .boolean()
      .required()
      .oneOf([true], "Please agree to share aggregated data."),
    files: yup
      .array()
      .of(yup.mixed<File>().required())
      .required()
      .min(1, "Select at least one RVTools file.")
      .max(
        MAX_RVTOOLS_FILES,
        `You can upload up to ${MAX_RVTOOLS_FILES} files.`,
      )
      .test(
        "rvtools-file-extension",
        "Unsupported file format. Please select XLSX or XLS files.",
        (files) =>
          !files || files.every((file) => isAllowedRvtoolsExtension(file.name)),
      )
      .test(
        "rvtools-file-size",
        `Each file must be no larger than ${Math.round(RVTOOLS_MAX_FILE_BYTES / (1024 * 1024))} MiB.`,
        (files) =>
          !files || files.every((file) => file.size <= RVTOOLS_MAX_FILE_BYTES),
      ),
  });

export const CreateRvtoolsAssessmentModal: React.FC<
  CreateRvtoolsAssessmentModalProps
> = ({
  isOpen,
  onClose,
  onSubmit,
  onClearError,
  isLoading = false,
  error = null,
  fileResults = [],
}) => {
  const methods = useForm<CreateRvtoolsAssessmentFormValues>({
    resolver: yupResolver(validationSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      consentChecked: false,
      files: [],
    },
  });
  const {
    control,
    formState: { errors: formErrors },
  } = methods;

  const handleFormSubmit = (
    values: CreateRvtoolsAssessmentFormValues,
  ): void => {
    onSubmit?.({
      name: values.name.trim(),
      consentChecked: values.consentChecked,
      files: values.files,
    });
  };

  return (
    <FormProvider<CreateRvtoolsAssessmentFormValues> {...methods}>
      <Modal variant="medium" isOpen={isOpen} onClose={onClose}>
        <ModalHeader title="Create assessment from RVTools" />
        <ModalBody>
          <Stack hasGutter>
            {error && (
              <StackItem>
                <Alert
                  variant="danger"
                  isInline
                  title="An error occurred while creating the assessment"
                >
                  {error.message}
                </Alert>
              </StackItem>
            )}
            <StackItem>
              <Form
                id={FORM_ID}
                noValidate
                onSubmit={(event) => {
                  void methods.handleSubmit(handleFormSubmit)(event);
                }}
              >
                <TextInputFormGroup
                  id="rvtools-assessment-name"
                  name="name"
                  label="Assessment name"
                  placeholder="Enter assessment name"
                  isRequired
                  isDisabled={isLoading}
                />

                <MultipleFilesInputFormGroup
                  id="rvtools-files"
                  name="files"
                  label="RVTools files (Excel)"
                  isRequired
                  isDisabled={isLoading}
                  isActive={isOpen}
                  accept={RVTOOLS_ACCEPT}
                  maxFiles={MAX_RVTOOLS_FILES}
                  fileResults={fileResults}
                  onClearError={onClearError}
                />

                <FormGroup fieldId="rvtools-data-share-consent" isRequired>
                  <Controller
                    control={methods.control}
                    name="consentChecked"
                    render={({ field }) => (
                      <Checkbox
                        id="rvtools-data-share-consent"
                        name={field.name}
                        label={
                          <>
                            I agree to share aggregated data about my
                            environment with Red Hat.{" "}
                            <a
                              href={RVTOOLS_DATA_SHARING_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Learn more <RhUiExternalLinkIcon />
                            </a>
                          </>
                        }
                        isChecked={field.value}
                        onChange={(_event, checked) => field.onChange(checked)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        isDisabled={isLoading}
                        aria-invalid={Boolean(formErrors.consentChecked)}
                        aria-describedby={
                          formErrors.consentChecked
                            ? "rvtools-data-share-consent-error"
                            : undefined
                        }
                      />
                    )}
                  />
                  {formErrors.consentChecked?.message && (
                    <FormHelperText id="rvtools-data-share-consent-error">
                      <HelperText>
                        <HelperTextItem variant="error">
                          {formErrors.consentChecked.message}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              </Form>
            </StackItem>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button
            key="create"
            variant="primary"
            type="submit"
            form={FORM_ID}
            isDisabled={isLoading || !methods.formState.isValid}
            isLoading={isLoading}
          >
            Create assessment
          </Button>
          <Button
            key="cancel"
            variant="link"
            onClick={onClose}
            isDisabled={isLoading}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </FormProvider>
  );
};

CreateRvtoolsAssessmentModal.displayName = "CreateRvtoolsAssessmentModal";

export default CreateRvtoolsAssessmentModal;
