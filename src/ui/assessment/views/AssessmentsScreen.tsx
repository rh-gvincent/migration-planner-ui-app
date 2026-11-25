import { css } from "@emotion/css";
import ColumnManagementModal, {
  type ColumnManagementModalColumn,
} from "@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal";
import {
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { RhUiColumnsIcon } from "@patternfly/react-icons";
import React, { useMemo, useState } from "react";

import type { AssessmentModel } from "../../../models/AssessmentModel";
import {
  AttributeValueFilter,
  type AttributeValueFilterAttribute,
  attributeValueFilterToolbarStyle,
} from "../../core/components/attribute-value-filter";
import { ConfirmationModal } from "../../core/components/ConfirmationModal";
import { useAssessmentsScreenViewModel } from "../view-models/useAssessmentsScreenViewModel";
import AssessmentEmptyState from "./AssessmentEmptyState";
import { AssessmentsList } from "./AssessmentsList";
import {
  COLUMN_MANAGEMENT_METADATA,
  type ColumnKey,
  Columns,
  type SortableColumn,
} from "./AssessmentsTable";
import UpdateAssessment from "./UpdateAssessment";
import CreateAssessmentDropdown from "../../core/components/CreateAssessmentDropdown";

const tableContainerStyle = css`
  max-width: 100%;
  overflow: auto;
`;

export const AssessmentsScreen: React.FC = () => {
  const {
    sources = [],
    selectedSources,
    setSelectedSources,
    selectedOwners,
    setSelectedOwners,
    nameFilter,
    setNameFilter,
    clearAllFilters,
    isSharingAssessment,
    isUnsharingAssessment,
    isDeletingAssessment,
    isColumnModalOpen,
    setIsColumnModalOpen,
    visibleColumns,
    setVisibleColumns,
    sortBy,
    setSortBy,
    updateAssessment,
    shareAssessment,
    unshareAssessment,
    deleteAssessment,
    assessments,
  } = useAssessmentsScreenViewModel();

  const columnManagementData = React.useMemo(
    (): ColumnManagementModalColumn[] =>
      (Object.keys(Columns) as ColumnKey[])
        .filter((key) => key !== "Actions")
        .map((key) => ({
          key,
          title: COLUMN_MANAGEMENT_METADATA[key].title,
          isShownByDefault: COLUMN_MANAGEMENT_METADATA[key].isShownByDefault,
          isShown: visibleColumns.includes(key),
          isUntoggleable: COLUMN_MANAGEMENT_METADATA[key].isUntoggleable,
        })),
    [visibleColumns],
  );

  const handleApplyColumns = React.useCallback(
    (newColumns: ColumnManagementModalColumn[]) => {
      const selectedKeys = newColumns
        .filter((col) => col.isShown)
        .map((col) => col.key as ColumnKey);
      setVisibleColumns(selectedKeys);
      setIsColumnModalOpen(false);
    },
    [setVisibleColumns, setIsColumnModalOpen],
  );

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [isUnsharingModalOpen, setIsUnsharingModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentModel | null>(null);

  const formatName = (name?: string): string | undefined =>
    name
      ?.split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const owners = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(assessments) ? assessments : [])
            .map((a) => {
              const ownerFirstName = formatName(a.ownerFirstName);
              const ownerLastName = formatName(a.ownerLastName);
              const ownerFullName =
                ownerFirstName && ownerLastName
                  ? `${ownerFirstName} ${ownerLastName}`
                  : ownerFirstName || ownerLastName || "";
              return ownerFullName;
            })
            .filter((name) => !!name && name.trim() !== ""),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [assessments],
  );

  const onSort = (
    _event: unknown,
    columnKey: SortableColumn,
    direction: "asc" | "desc",
  ): void => {
    setSortBy({ columnKey, direction });
  };

  const filterAttributes = useMemo(
    (): AttributeValueFilterAttribute[] => [
      {
        id: "name",
        label: "Name",
        type: "text",
        value: nameFilter,
        onChange: setNameFilter,
        placeholder: "Filter by name",
        ariaLabel: "Filter by name",
      },
      {
        id: "owner",
        label: "Owner",
        type: "checkbox",
        options: owners.map((owner) => ({ value: owner, label: owner })),
        selections: selectedOwners,
        onSelectionsChange: setSelectedOwners,
      },
      {
        id: "discovery-appliance",
        label: "Discovery appliance",
        type: "checkbox",
        options: sources.map((source) => ({
          value: source.id,
          label: source.name,
        })),
        selections: selectedSources,
        onSelectionsChange: setSelectedSources,
      },
    ],
    [
      owners,
      nameFilter,
      setNameFilter,
      selectedOwners,
      setSelectedOwners,
      selectedSources,
      setSelectedSources,
      sources,
    ],
  );

  const handleUpdateAssessment = (assessmentId: string): void => {
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (assessment) {
      setSelectedAssessment(assessment);
      setIsUpdateModalOpen(true);
    }
  };
  const handleShareAssessment = (assessmentId: string): void => {
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (assessment) {
      setSelectedAssessment(assessment);
      setIsSharingModalOpen(true);
    }
  };
  const handleUnshareAssessment = (assessmentId: string): void => {
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (assessment) {
      setSelectedAssessment(assessment);
      setIsUnsharingModalOpen(true);
    }
  };

  const isTableEmpty = (): boolean => {
    return !Array.isArray(assessments) || assessments.length === 0;
  };

  const handleDeleteAssessment = (assessmentId: string): void => {
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (assessment) {
      setSelectedAssessment(assessment);
      setIsDeleteModalOpen(true);
    }
  };

  const handleCloseUpdateModal = (): void => {
    setIsUpdateModalOpen(false);
    setSelectedAssessment(null);
  };

  const handleCloseSharingModal = (): void => {
    setIsSharingModalOpen(false);
    setSelectedAssessment(null);
  };

  const handleCloseUnsharingModal = (): void => {
    setIsUnsharingModalOpen(false);
    setSelectedAssessment(null);
  };

  const handleCloseDeleteModal = (): void => {
    setIsDeleteModalOpen(false);
    setSelectedAssessment(null);
  };

  const handleConfirmUpdate = async (name: string): Promise<void> => {
    if (!selectedAssessment) return;
    await updateAssessment(selectedAssessment.id, name);
    handleCloseUpdateModal();
  };

  const handleConfirmShare = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await shareAssessment(selectedAssessment.id);
    handleCloseSharingModal();
  };

  const handleConfirmUnshare = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await unshareAssessment(selectedAssessment.id);
    handleCloseUnsharingModal();
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await deleteAssessment(selectedAssessment.id);
    handleCloseDeleteModal();
  };

  return (
    <>
      {!isTableEmpty() && (
        <Toolbar
          clearAllFilters={clearAllFilters}
          className={attributeValueFilterToolbarStyle}
        >
          <ToolbarContent>
            <AttributeValueFilter
              attributes={filterAttributes}
              defaultActiveAttributeId={
                selectedSources.length > 0 ? "discovery-appliance" : "name"
              }
            />
            <ToolbarItem>
              <Button
                variant="control"
                icon={<RhUiColumnsIcon />}
                onClick={() => setIsColumnModalOpen(true)}
                aria-label="Manage columns"
              />
            </ToolbarItem>
            <ToolbarItem>
              <CreateAssessmentDropdown />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}

      {isTableEmpty() ? (
        <AssessmentEmptyState />
      ) : (
        <div className={tableContainerStyle}>
          <AssessmentsList
            assessments={assessments}
            nameFilter={nameFilter}
            sortBy={sortBy}
            onSort={onSort}
            onDelete={handleDeleteAssessment}
            onUpdate={handleUpdateAssessment}
            onShareAssessment={handleShareAssessment}
            onUnshareAssessment={handleUnshareAssessment}
            selectedOwners={selectedOwners}
            selectedSources={selectedSources}
            visibleColumns={visibleColumns}
          />
        </div>
      )}

      <UpdateAssessment
        isOpen={isUpdateModalOpen}
        onClose={handleCloseUpdateModal}
        onSubmit={(name) => {
          void handleConfirmUpdate(name);
        }}
        name={(selectedAssessment as AssessmentModel)?.name || ""}
      />

      <ConfirmationModal
        isOpen={isSharingModalOpen}
        onClose={handleCloseSharingModal}
        onCancel={handleCloseSharingModal}
        onConfirm={() => {
          void handleConfirmShare();
        }}
        isDisabled={isSharingAssessment}
        title="Share assessment with partner"
        primaryButtonVariant="primary"
        confirmButtonText="Share"
      >
        Your partner will receive access to the{" "}
        <b>{(selectedAssessment as AssessmentModel)?.name}</b> assessment.
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={isUnsharingModalOpen}
        onClose={handleCloseUnsharingModal}
        onCancel={handleCloseUnsharingModal}
        onConfirm={() => {
          void handleConfirmUnshare();
        }}
        isDisabled={isUnsharingAssessment}
        title="Unshare assessment with partner"
        titleIconVariant="warning"
        primaryButtonVariant="danger"
        confirmButtonText="Unshare"
      >
        Your partner will lose access to the{" "}
        <b>{(selectedAssessment as AssessmentModel)?.name}</b> assessment.
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onCancel={handleCloseDeleteModal}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        isDisabled={isDeletingAssessment}
        title="Delete Assessment"
        titleIconVariant="warning"
        primaryButtonVariant="danger"
      >
        Are you sure you want to delete{" "}
        <b>{(selectedAssessment as AssessmentModel)?.name}?</b>
      </ConfirmationModal>

      <ColumnManagementModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        appliedColumns={columnManagementData}
        applyColumns={handleApplyColumns}
      />
    </>
  );
};

AssessmentsScreen.displayName = "AssessmentsScreen";
