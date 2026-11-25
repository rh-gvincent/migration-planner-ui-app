import { css } from "@emotion/css";
import { EmptySearchResults } from "@openshift-migration-advisor/shared-components";
import ColumnManagementModal, {
  type ColumnManagementModalColumn,
} from "@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  type MenuToggleElement,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  RhUiArrowLeftIcon,
  RhUiColumnsIcon,
  RhUiEllipsisVerticalIcon,
} from "@patternfly/react-icons";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import useLocalStorage from "../../../hooks/useLocalStorage";
import type { AssessmentModel } from "../../../models/AssessmentModel";
import type { SourceModel } from "../../../models/SourceModel";
import {
  getSourceDataCollectedMs,
  getSourceImportedMs,
} from "../../../models/sourceTimestamps";
import { routes } from "../../../routing/Routes";
import {
  AttributeValueFilter,
  type AttributeValueFilterAttribute,
  attributeValueFilterToolbarStyle,
} from "../../core/components/attribute-value-filter";
import { ConfirmationModal } from "../../core/components/ConfirmationModal";
import { OVASetUpInstructionsModal } from "../../core/components/OVASetUpInstructionsModal";
import {
  TIMESTAMP_COLUMN_HELP,
  TimestampColumnTitle,
  TimestampTableCell,
} from "../../core/components/TimestampTableCell";
import {
  DISCOVERY_VM_STATUS_FILTER_OPTIONS,
  type DiscoveryVmStatusFilterKey,
  getSourceDiscoveryVmStatusLabel,
  isInventoryUploadedManually,
  isSourceUploadedManually,
  sourceMatchesDiscoveryVmStatusFilter,
} from "../helpers/discoveryVmStatus";
import { normalizeDiscoveryApplianceVisibleColumns } from "../helpers/normalizeDiscoveryApplianceColumns";
import { useEnvironmentPage } from "../view-models/EnvironmentPageContext";
import { AgentStatusView } from "./AgentStatusView";
import {
  COLUMN_MANAGEMENT_KEYS,
  COLUMN_MANAGEMENT_METADATA,
  Columns,
  DEFAULT_VISIBLE_COLUMNS,
  type ManageableColumnKey,
  MANDATORY_COLUMNS,
  SORTABLE_COLUMNS,
  type SortableColumnKey,
} from "./Columns";
import { DiscoveryAppliancesEmptyState } from "./DiscoveryAppliancesEmptyState";
import { DiscoveryAppliancesErrorLoadingState } from "./DiscoveryAppliancesErrorLoadingState";
import { UploadInventoryAction } from "./UploadInventoryAction";
import { getAgentVersionDisplayLabel, VersionStatus } from "./VersionStatus";
import { useModals } from "../../assessment/view-models/ModalsContext";

const VISIBLE_COLUMNS_STORAGE_KEY =
  "migration-advisor:discovery-appliances-visible-columns";
const VISIBLE_COLUMNS_STORAGE_VERSION = 3;

const VALUE_NOT_AVAILABLE = "-";

const getHostsCount = (source: SourceModel): number =>
  source.inventory?.vcenter?.infra.totalHosts ?? 0;

const getVmsCount = (source: SourceModel): number =>
  source.inventory?.vcenter?.vms.total ?? 0;

const getNetworksCount = (source: SourceModel): number =>
  source.inventory?.vcenter?.infra.networks?.length ?? 0;

const getDatastoresCount = (source: SourceModel): number =>
  source.inventory?.vcenter?.infra.datastores?.length ?? 0;

const getSourceAgentVersionLabel = (source: SourceModel): string =>
  getAgentVersionDisplayLabel({
    displayStatus: source.displayStatus,
    isUploadedManually: isSourceUploadedManually(source),
    agentVersion: source.agentVersion,
    agentVersionWarning: source.agentVersionWarning,
  });

const tableContainerStyle = css`
  max-width: 100%;
  overflow: auto;
`;

const backButtonWrapper = css`
  margin-bottom: 16px;
`;

const tableHeaderNormal = css`
  white-space: normal;
`;

const tableCellTop = css`
  vertical-align: top;
`;

type SourceTableProps = {
  onlySourceId?: string;
  uploadOnly?: boolean;
  onEditEnvironment?: (sourceId: string) => void;
  onAddEnvironment?: () => void;
  onDownloadOva?: (sourceId: string) => void;
};

export const SourcesTable: React.FC<SourceTableProps> = ({
  onlySourceId,
  uploadOnly = false,
  onEditEnvironment,
  onAddEnvironment,
  onDownloadOva,
}) => {
  const vm = useEnvironmentPage();
  const navigate = useNavigate();
  const assessmentVm = useModals();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<SourceModel | null>(null);
  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentModel | null>(null);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [isUnsharingModalOpen, setIsUnsharingModalOpen] = useState(false);
  const [isDeleteAssessmentModalOpen, setIsDeleteAssessmentModalOpen] =
    useState(false);
  const [showOVASetUpInstructions, setShowOVASetUpInstructions] =
    useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<
    DiscoveryVmStatusFilterKey[]
  >([]);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [userSelectedColumns, setUserSelectedColumns] = useLocalStorage<
    ManageableColumnKey[]
  >(
    VISIBLE_COLUMNS_STORAGE_KEY,
    DEFAULT_VISIBLE_COLUMNS,
    VISIBLE_COLUMNS_STORAGE_VERSION,
  );

  const visibleColumns = useMemo(() => {
    const normalized =
      normalizeDiscoveryApplianceVisibleColumns(userSelectedColumns);
    return Array.from(new Set([...normalized, ...MANDATORY_COLUMNS]));
  }, [userSelectedColumns]);

  const [internalSortBy, setInternalSortBy] = useState<{
    columnKey: SortableColumnKey;
    direction: "asc" | "desc";
  }>({
    columnKey: "Name",
    direction: "asc",
  });

  const sortBy = useMemo(() => {
    const sortedKey = internalSortBy.columnKey;
    if (!visibleColumns.includes(sortedKey)) {
      return { columnKey: "Name" as const, direction: "asc" as const };
    }
    return internalSortBy;
  }, [internalSortBy, visibleColumns]);

  const setSortBy = setInternalSortBy;

  const isColumnVisible = (columnKey: ManageableColumnKey): boolean =>
    visibleColumns.includes(columnKey);

  const tableColumnCount = 2 + visibleColumns.length;

  const columnManagementData = useMemo(
    (): ColumnManagementModalColumn[] =>
      COLUMN_MANAGEMENT_KEYS.map((key) => ({
        key,
        title: COLUMN_MANAGEMENT_METADATA[key].title,
        isShownByDefault: COLUMN_MANAGEMENT_METADATA[key].isShownByDefault,
        isShown: visibleColumns.includes(key),
        isUntoggleable: COLUMN_MANAGEMENT_METADATA[key].isUntoggleable,
      })),
    [visibleColumns],
  );

  const handleApplyColumns = useCallback(
    (newColumns: ColumnManagementModalColumn[]) => {
      const selectedKeys = newColumns
        .filter((col) => col.isShown)
        .map((col) => col.key as ManageableColumnKey);
      setUserSelectedColumns(selectedKeys);
      setIsColumnModalOpen(false);
    },
    [setUserSelectedColumns],
  );

  const clearAllFilters = (): void => {
    setSearch("");
    setSelectedStatuses([]);
  };

  const statusOptions = DISCOVERY_VM_STATUS_FILTER_OPTIONS;

  const sourcesList = useMemo(
    () => (vm.sources ? [...vm.sources] : []),
    [vm.sources],
  );

  const hasSources = sourcesList.length > 0;

  const filteredSources = useMemo(() => {
    if (sourcesList.length === 0) return [];
    let filtered = sourcesList;

    // Filter by specific source id if provided
    if (onlySourceId) {
      filtered = filtered.filter((s) => s.id === onlySourceId);
    }

    // Name-only search
    if (search && search.trim() !== "") {
      const query = search.toLowerCase();
      filtered = filtered.filter((source) =>
        (source.name || "").toLowerCase().includes(query),
      );
    }

    // Multi-select statuses with label mapping
    if (selectedStatuses && selectedStatuses.length > 0) {
      filtered = filtered.filter((source) =>
        selectedStatuses.some((key) =>
          sourceMatchesDiscoveryVmStatusFilter(source, key),
        ),
      );
    }

    const copy = [...filtered];
    switch (sortBy.columnKey) {
      case "Name":
        copy.sort((a, b) =>
          sortBy.direction === "asc"
            ? (a.name || "").localeCompare(b.name || "")
            : (b.name || "").localeCompare(a.name || ""),
        );
        break;
      case "Status":
        copy.sort((a, b) => {
          const aLabel = getSourceDiscoveryVmStatusLabel(a);
          const bLabel = getSourceDiscoveryVmStatusLabel(b);
          return sortBy.direction === "asc"
            ? aLabel.localeCompare(bLabel)
            : bLabel.localeCompare(aLabel);
        });
        break;
      case "VersionStatus":
        copy.sort((a, b) => {
          const aLabel = getSourceAgentVersionLabel(a);
          const bLabel = getSourceAgentVersionLabel(b);
          return sortBy.direction === "asc"
            ? aLabel.localeCompare(bLabel)
            : bLabel.localeCompare(aLabel);
        });
        break;
      case "Hosts":
        copy.sort((a, b) => {
          const aHosts = getHostsCount(a);
          const bHosts = getHostsCount(b);
          return sortBy.direction === "asc" ? aHosts - bHosts : bHosts - aHosts;
        });
        break;
      case "VMs":
        copy.sort((a, b) => {
          const aVms = getVmsCount(a);
          const bVms = getVmsCount(b);
          return sortBy.direction === "asc" ? aVms - bVms : bVms - aVms;
        });
        break;
      case "Networks":
        copy.sort((a, b) => {
          const aNetworks = getNetworksCount(a);
          const bNetworks = getNetworksCount(b);
          return sortBy.direction === "asc"
            ? aNetworks - bNetworks
            : bNetworks - aNetworks;
        });
        break;
      case "Datastores":
        copy.sort((a, b) => {
          const aDatastores = getDatastoresCount(a);
          const bDatastores = getDatastoresCount(b);
          return sortBy.direction === "asc"
            ? aDatastores - bDatastores
            : bDatastores - aDatastores;
        });
        break;
      case "DataCollectedOn":
        copy.sort((a, b) => {
          const aMs = getSourceDataCollectedMs(a) ?? 0;
          const bMs = getSourceDataCollectedMs(b) ?? 0;
          return sortBy.direction === "asc" ? aMs - bMs : bMs - aMs;
        });
        break;
      case "ImportedToConsole":
        copy.sort((a, b) => {
          const aMs = getSourceImportedMs(a) ?? 0;
          const bMs = getSourceImportedMs(b) ?? 0;
          return sortBy.direction === "asc" ? aMs - bMs : bMs - aMs;
        });
        break;
    }

    return copy;
  }, [sourcesList, search, selectedStatuses, onlySourceId, sortBy]);

  const filterAttributes = useMemo(
    (): AttributeValueFilterAttribute[] => [
      {
        id: "name",
        label: "Name",
        type: "text",
        value: search,
        onChange: setSearch,
        placeholder: "Filter by name",
        ariaLabel: "Filter by name",
      },
      {
        id: "status",
        label: "Appliance status",
        type: "checkbox",
        options: statusOptions.map((option) => ({
          value: option.key,
          label: option.label,
        })),
        selections: selectedStatuses,
        onSelectionsChange: (selections) =>
          setSelectedStatuses(selections as DiscoveryVmStatusFilterKey[]),
      },
    ],
    [search, selectedStatuses, statusOptions],
  );

  const getSortParams = (columnKey: SortableColumnKey) => {
    const columnIndex = SORTABLE_COLUMNS.indexOf(columnKey);
    const activeSortColumnIndex = SORTABLE_COLUMNS.indexOf(sortBy.columnKey);
    return {
      sortBy: {
        index: activeSortColumnIndex,
        direction: sortBy.direction,
      },
      onSort: (_event: unknown, _index: number, direction: "asc" | "desc") => {
        setSortBy({ columnKey, direction });
      },
      columnIndex,
    };
  };

  // Polling lifecycle is handled by the EnvironmentPageViewModel.
  // We only need to refresh on tab/window focus.

  // Refresh immediately when returning to the tab/window (no manual reload needed)
  useEffect(() => {
    const onFocus = (): void => {
      void vm.refreshOnFocus();
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void vm.refreshOnFocus();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.refreshOnFocus]);

  useEffect(
    () => {
      const firstVisibleSource = filteredSources[0];
      if (!vm.sourceSelected && firstVisibleSource) {
        vm.selectSource(firstVisibleSource);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredSources, vm.sources],
  );

  const handleDelete = (source: SourceModel): void => {
    setDeleteTarget(null);
    void vm.deleteAndRefresh(source.id).then((sources) => {
      if (sources?.length) {
        vm.selectSource(sources[0]);
      }
    });
  };

  const closeAssessmentActionModals = (): void => {
    setSelectedAssessment(null);
    setIsSharingModalOpen(false);
    setIsUnsharingModalOpen(false);
    setIsDeleteAssessmentModalOpen(false);
  };

  const handleConfirmShareAssessment = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await vm.shareAssessment(selectedAssessment.id);
    closeAssessmentActionModals();
  };

  const handleConfirmUnshareAssessment = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await vm.unshareAssessment(selectedAssessment.id);
    closeAssessmentActionModals();
  };

  const handleConfirmDeleteAssessment = async (): Promise<void> => {
    if (!selectedAssessment) return;
    await vm.deleteAssessment(selectedAssessment.id);
    closeAssessmentActionModals();
  };

  // Show empty state if no sources
  if (!hasSources && onAddEnvironment) {
    return (
      <>
        <DiscoveryAppliancesEmptyState onAddEnvironment={onAddEnvironment} />
        <DiscoveryAppliancesErrorLoadingState />
      </>
    );
  }

  const showNoResultFound = hasSources && filteredSources.length === 0;

  return (
    <div>
      {vm.assessmentFromAgentState && (
        <div className={backButtonWrapper}>
          <Button
            variant="link"
            icon={<RhUiArrowLeftIcon />}
            onClick={() => {
              vm.setAssessmentFromAgent?.(false);
              void navigate(routes.assessments);
            }}
          >
            Back to Assessments
          </Button>
        </div>
      )}

      <Toolbar
        clearAllFilters={clearAllFilters}
        className={attributeValueFilterToolbarStyle}
      >
        <ToolbarContent>
          <AttributeValueFilter
            attributes={filterAttributes}
            defaultActiveAttributeId="name"
          />
          {hasSources ? (
            <ToolbarItem>
              <Button
                variant="control"
                icon={<RhUiColumnsIcon />}
                onClick={() => setIsColumnModalOpen(true)}
                aria-label="Manage columns"
              />
            </ToolbarItem>
          ) : null}
          {hasSources && onAddEnvironment ? (
            <ToolbarItem>
              <Button variant="primary" onClick={onAddEnvironment}>
                Generate discovery appliance
              </Button>
            </ToolbarItem>
          ) : null}

          {hasSources ? (
            <ToolbarItem>
              <Button
                variant="secondary"
                onClick={() =>
                  assessmentVm.openCreateApplianceAssessmentModal()
                }
              >
                Create assessment
              </Button>
            </ToolbarItem>
          ) : null}

          {/* todo add Pagination */}
        </ToolbarContent>
      </Toolbar>

      <div className={tableContainerStyle}>
        <Table
          aria-label="Sources table"
          variant="compact"
          borders={false}
          isStickyHeader
          gridBreakPoint="grid-md"
        >
          <Thead>
            <Tr>
              {isColumnVisible("Name") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("Name")}
                  modifier="nowrap"
                >
                  {Columns.Name}
                </Th>
              )}
              {isColumnVisible("Status") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("Status")}
                  modifier="nowrap"
                >
                  {Columns.Status}
                </Th>
              )}
              {isColumnVisible("VersionStatus") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("VersionStatus")}
                  modifier="nowrap"
                >
                  {Columns.VersionStatus}
                </Th>
              )}
              {isColumnVisible("Hosts") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("Hosts")}
                  modifier="nowrap"
                >
                  {Columns.Hosts}
                </Th>
              )}
              {isColumnVisible("VMs") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("VMs")}
                  modifier="nowrap"
                >
                  {Columns.VMs}
                </Th>
              )}
              {isColumnVisible("Networks") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("Networks")}
                  modifier="nowrap"
                >
                  {Columns.Networks}
                </Th>
              )}
              {isColumnVisible("Datastores") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("Datastores")}
                  modifier="nowrap"
                >
                  {Columns.Datastores}
                </Th>
              )}
              {isColumnVisible("DataCollectedOn") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("DataCollectedOn")}
                  modifier="nowrap"
                >
                  <TimestampColumnTitle
                    label={Columns.DataCollectedOn}
                    helpText={TIMESTAMP_COLUMN_HELP.dataCollected}
                  />
                </Th>
              )}
              {isColumnVisible("ImportedToConsole") && (
                <Th
                  className={tableHeaderNormal}
                  sort={getSortParams("ImportedToConsole")}
                  modifier="nowrap"
                >
                  <TimestampColumnTitle
                    label={Columns.ImportedToConsole}
                    helpText={TIMESTAMP_COLUMN_HELP.importedDiscoveryAppliance}
                  />
                </Th>
              )}
              <Th className={tableHeaderNormal} modifier="nowrap">
                {Columns.Assessments}
              </Th>
              {isColumnVisible("Actions") && (
                <Th modifier="fitContent" screenReaderText="Actions">
                  {Columns.Actions}
                </Th>
              )}
            </Tr>
          </Thead>
          {showNoResultFound && (
            <Tbody>
              <Tr>
                <Td colSpan={tableColumnCount}>
                  <EmptySearchResults title="No matching environment found" />
                </Td>
              </Tr>
            </Tbody>
          )}
          {filteredSources.map((source, rowIndex) => {
            const agent = source.agent;
            const isUploadAllowed = !source.agent || source.onPremises;
            const assessmentCount = vm.getAssessmentsForSource(
              source.id,
            ).length;
            return (
              <Tbody key={source.id}>
                <Tr>
                  {isColumnVisible("Name") && (
                    <Td dataLabel={Columns.Name} className={tableCellTop}>
                      {source.name}
                    </Td>
                  )}
                  {isColumnVisible("Status") && (
                    <Td dataLabel={Columns.Status} className={tableCellTop}>
                      <AgentStatusView
                        status={source.displayStatus}
                        statusInfo={
                          source.isReady
                            ? undefined
                            : agent
                              ? agent.statusInfo
                              : "Not connected"
                        }
                        credentialUrl={agent ? agent.credentialUrl : ""}
                        uploadedManually={isInventoryUploadedManually(source)}
                        updatedAt={source?.updatedAt}
                      />
                    </Td>
                  )}
                  {isColumnVisible("VersionStatus") && (
                    <Td
                      dataLabel={Columns.VersionStatus}
                      className={tableCellTop}
                    >
                      <VersionStatus
                        displayStatus={source.displayStatus}
                        isUploadedManually={isSourceUploadedManually(source)}
                        agentVersion={source.agentVersion}
                        agentVersionWarning={source.agentVersionWarning}
                      />
                    </Td>
                  )}
                  {isColumnVisible("Hosts") && (
                    <Td dataLabel={Columns.Hosts} className={tableCellTop}>
                      {source?.inventory?.vcenter?.infra.totalHosts ??
                        VALUE_NOT_AVAILABLE}
                    </Td>
                  )}
                  {isColumnVisible("VMs") && (
                    <Td dataLabel={Columns.VMs} className={tableCellTop}>
                      {source?.inventory?.vcenter?.vms.total ??
                        VALUE_NOT_AVAILABLE}
                    </Td>
                  )}
                  {isColumnVisible("Networks") && (
                    <Td dataLabel={Columns.Networks} className={tableCellTop}>
                      {source?.inventory?.vcenter?.infra.networks?.length ??
                        VALUE_NOT_AVAILABLE}
                    </Td>
                  )}
                  {isColumnVisible("Datastores") && (
                    <Td dataLabel={Columns.Datastores} className={tableCellTop}>
                      {source?.inventory?.vcenter?.infra.datastores?.length ??
                        VALUE_NOT_AVAILABLE}
                    </Td>
                  )}
                  {isColumnVisible("DataCollectedOn") && (
                    <Td
                      dataLabel={Columns.DataCollectedOn}
                      className={tableCellTop}
                      modifier="nowrap"
                    >
                      <TimestampTableCell
                        columnLabel={Columns.DataCollectedOn}
                        ms={getSourceDataCollectedMs(source)}
                        helpText={TIMESTAMP_COLUMN_HELP.dataCollected}
                      />
                    </Td>
                  )}
                  {isColumnVisible("ImportedToConsole") && (
                    <Td
                      dataLabel={Columns.ImportedToConsole}
                      className={tableCellTop}
                      modifier="nowrap"
                    >
                      <TimestampTableCell
                        columnLabel={Columns.ImportedToConsole}
                        ms={getSourceImportedMs(source)}
                        helpText={
                          TIMESTAMP_COLUMN_HELP.importedDiscoveryAppliance
                        }
                      />
                    </Td>
                  )}
                  <Td dataLabel={Columns.Assessments} className={tableCellTop}>
                    <Button
                      variant="link"
                      isInline
                      aria-label={`Show assessments for ${source.name}`}
                      onClick={() =>
                        void navigate(routes.assessments, {
                          state: { selectedSources: [source.id] },
                        })
                      }
                    >
                      {assessmentCount}
                    </Button>
                  </Td>
                  {isColumnVisible("Actions") && (
                    <Td dataLabel={Columns.Actions} modifier="fitContent">
                      {uploadOnly ? (
                        <>
                          {isUploadAllowed && source.name !== "Example" && (
                            <UploadInventoryAction sourceId={source.id} />
                          )}
                        </>
                      ) : (
                        <Dropdown
                          isOpen={openDropdowns[source.id] || false}
                          popperProps={{
                            appendTo: () => document.body,
                            position: "end",
                          }}
                          onOpenChange={(isOpen) =>
                            setOpenDropdowns((prev) => ({
                              ...prev,
                              [source.id]: isOpen,
                            }))
                          }
                          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                            <MenuToggle
                              ref={toggleRef}
                              aria-label="Actions"
                              variant="plain"
                              onClick={() =>
                                setOpenDropdowns((prev) => ({
                                  ...prev,
                                  [source.id]: !prev[source.id],
                                }))
                              }
                              icon={<RhUiEllipsisVerticalIcon />}
                              style={{ padding: 0, width: "fit-content" }}
                            />
                          )}
                        >
                          <DropdownList>
                            <DropdownItem
                              onClick={() => {
                                setOpenDropdowns((prev) => ({
                                  ...prev,
                                  [source.id]: false,
                                }));
                                assessmentVm.openCreateApplianceAssessmentModal(
                                  source.id,
                                );
                              }}
                            >
                              Create assessment
                            </DropdownItem>
                            <DropdownItem
                              isDisabled={!onDownloadOva}
                              onClick={() => {
                                setOpenDropdowns((prev) => ({
                                  ...prev,
                                  [source.id]: false,
                                }));
                                onDownloadOva?.(source.id);
                              }}
                            >
                              Download OVA
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => {
                                setOpenDropdowns((prev) => ({
                                  ...prev,
                                  [source.id]: false,
                                }));
                                setShowOVASetUpInstructions(true);
                              }}
                            >
                              OVA set up instructions
                            </DropdownItem>
                            <DropdownItem
                              isDisabled={!onEditEnvironment}
                              onClick={() => {
                                setOpenDropdowns((prev) => ({
                                  ...prev,
                                  [source.id]: false,
                                }));
                                onEditEnvironment?.(source.id);
                              }}
                            >
                              Edit discovery appliance
                            </DropdownItem>
                            <DropdownItem
                              isDisabled={
                                vm.isDeletingSource || source.name === "Example"
                              }
                              onClick={() => setDeleteTarget(source)}
                            >
                              Delete discovery appliance
                            </DropdownItem>
                          </DropdownList>
                        </Dropdown>
                      )}
                    </Td>
                  )}
                </Tr>
              </Tbody>
            );
          })}
        </Table>
      </div>
      {showOVASetUpInstructions && (
        <OVASetUpInstructionsModal
          onClose={() => setShowOVASetUpInstructions(false)}
        />
      )}
      <ColumnManagementModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        appliedColumns={columnManagementData}
        applyColumns={handleApplyColumns}
      />
      {deleteTarget && (
        <ConfirmationModal
          title="Delete Environment"
          titleIconVariant="warning"
          isOpen={Boolean(deleteTarget)}
          isDisabled={vm.isDeletingAndRefreshing}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) {
              handleDelete(deleteTarget);
            }
          }}
          onClose={() => setDeleteTarget(null)}
        >
          Are you sure you want to delete{" "}
          <b>{deleteTarget.name || "this environment"}</b>?
          <br />
          To use it again, create a new discovery image and redeploy it.
        </ConfirmationModal>
      )}
      <ConfirmationModal
        isOpen={isSharingModalOpen}
        onClose={closeAssessmentActionModals}
        onCancel={closeAssessmentActionModals}
        onConfirm={() => {
          void handleConfirmShareAssessment();
        }}
        isDisabled={vm.isSharingAssessment}
        title="Share assessment with partner"
        primaryButtonVariant="primary"
        confirmButtonText="Share"
      >
        Your partner will receive access to the{" "}
        <b>{selectedAssessment?.name}</b> assessment.
      </ConfirmationModal>
      <ConfirmationModal
        isOpen={isUnsharingModalOpen}
        onClose={closeAssessmentActionModals}
        onCancel={closeAssessmentActionModals}
        onConfirm={() => {
          void handleConfirmUnshareAssessment();
        }}
        isDisabled={vm.isUnsharingAssessment}
        title="Unshare assessment with partner"
        titleIconVariant="warning"
        primaryButtonVariant="danger"
        confirmButtonText="Unshare"
      >
        Your partner will lose access to the <b>{selectedAssessment?.name}</b>{" "}
        assessment.
      </ConfirmationModal>
      <ConfirmationModal
        isOpen={isDeleteAssessmentModalOpen}
        onClose={closeAssessmentActionModals}
        onCancel={closeAssessmentActionModals}
        onConfirm={() => {
          void handleConfirmDeleteAssessment();
        }}
        isDisabled={vm.isDeletingAssessment}
        title="Delete Assessment"
        titleIconVariant="warning"
        primaryButtonVariant="danger"
      >
        Are you sure you want to delete <b>{selectedAssessment?.name}</b>?
      </ConfirmationModal>
    </div>
  );
};
