import { EmptySearchResults } from "@openshift-migration-advisor/shared-components";
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Icon,
  MenuToggle,
  type MenuToggleElement,
  Tooltip,
  Truncate,
} from "@patternfly/react-core";
import {
  RhUiConnectedIcon,
  RhUiDocumentIcon,
  RhUiEllipsisVerticalIcon,
  RhUiWarningFillIcon,
} from "@patternfly/react-icons";
import {
  Table,
  TableText,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { themeTooltipFlyoutProps } from "../../../lib/patternfly/flyoutAppendTo";
import type { AssessmentModel } from "../../../models/AssessmentModel";
import { routes } from "../../../routing/Routes";
import {
  TIMESTAMP_COLUMN_HELP,
  TimestampColumnTitle,
  TimestampTableCell,
} from "../../core/components/TimestampTableCell";
import { isUploadedFileSourceType } from "../helpers/assessmentSource";

const openAssistedInstaller = (): void => {
  const currentHost = window.location.hostname;
  if (currentHost === "console.stage.redhat.com") {
    window.open(
      "https://console.dev.redhat.com/openshift/assisted-installer/clusters/~new?source=assisted_migration",
      "_blank",
    );
  } else {
    window.open(
      "/openshift/assisted-installer/clusters/~new?source=assisted_migration",
      "_blank",
    );
  }
};

export const Columns = {
  Name: "Name",
  Source: "Source",
  Owner: "Owner",
  Hosts: "Hosts",
  VMs: "VMs",
  Networks: "Networks",
  Datastores: "Datastores",
  SharingStatus: "Sharing status",
  DataCollectedOn: "Data collected on",
  ImportedToConsole: "Imported to console",
  Actions: "",
} as const;

export type ColumnKey = keyof typeof Columns;
export const DEFAULT_VISIBLE_COLUMNS = Object.keys(Columns) as ColumnKey[];
export const MANDATORY_COLUMNS: ColumnKey[] = ["Name", "Actions"];

export const COLUMN_MANAGEMENT_METADATA: Record<
  ColumnKey,
  {
    title: string;
    isShownByDefault: boolean;
    isUntoggleable: boolean;
  }
> = {
  Name: {
    title: Columns.Name,
    isShownByDefault: true,
    isUntoggleable: true,
  },
  Source: {
    title: Columns.Source,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  Owner: {
    title: Columns.Owner,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  Hosts: {
    title: Columns.Hosts,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  VMs: {
    title: Columns.VMs,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  Networks: {
    title: Columns.Networks,
    isShownByDefault: false,
    isUntoggleable: false,
  },
  Datastores: {
    title: Columns.Datastores,
    isShownByDefault: false,
    isUntoggleable: false,
  },
  SharingStatus: {
    title: Columns.SharingStatus,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  DataCollectedOn: {
    title: Columns.DataCollectedOn,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  ImportedToConsole: {
    title: Columns.ImportedToConsole,
    isShownByDefault: true,
    isUntoggleable: false,
  },
  Actions: {
    title: Columns.Actions,
    isShownByDefault: true,
    isUntoggleable: true,
  },
};

export type SortableColumn = Exclude<ColumnKey, "SharingStatus" | "Actions">;
export const SORTABLE_COLUMNS: SortableColumn[] = [
  "Name",
  "Source",
  "Owner",
  "Hosts",
  "VMs",
  "Networks",
  "Datastores",
  "DataCollectedOn",
  "ImportedToConsole",
];

export type AssessmentTableRow = {
  key: string;
  id: string;
  name: string;
  source: string;
  sourceId?: string;
  sourceType: string;
  dataCollectedMs?: number;
  importedMs?: number;
  owner: string;
  hosts: string | number;
  vms: string | number;
  networks: string | number;
  datastores: string | number;
  hasData: boolean;
  permissions: NonNullable<AssessmentModel["permissions"]>;
  isShared: boolean;
  sharedBy: NonNullable<
    NonNullable<AssessmentModel["sharing"]>["sharedBy"]
  > | null;
};

type AssessmentsTableProps = {
  assessments: AssessmentTableRow[];
  showNoResultFound: boolean;
  sortBy?: { columnKey: SortableColumn; direction: "asc" | "desc" };
  onSort?: (
    event: unknown,
    columnKey: SortableColumn,
    direction: "asc" | "desc",
  ) => void;
  onDelete?: (assessmentId: string) => void;
  visibleColumns?: ColumnKey[];
  onShareAssessment?: (assessmentId: string) => void;
  onUnshareAssessment?: (assessmentId: string) => void;
};

export const AssessmentsTable: React.FC<AssessmentsTableProps> = ({
  assessments,
  showNoResultFound,
  sortBy,
  onSort,
  onDelete,
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  onShareAssessment,
  onUnshareAssessment,
}) => {
  const navigate = useNavigate();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );

  const toggleDropdown = (assessmentId: string): void => {
    setOpenDropdowns((previous) => ({
      ...previous,
      [assessmentId]: !previous[assessmentId],
    }));
  };

  const isColumnVisible = (columnKey: ColumnKey): boolean =>
    visibleColumns.includes(columnKey);

  const getSortParams = (columnKey: SortableColumn) => {
    if (!onSort || !sortBy) return undefined;
    const columnIndex = SORTABLE_COLUMNS.indexOf(columnKey);
    const activeSortColumnIndex = SORTABLE_COLUMNS.indexOf(sortBy.columnKey);
    return {
      sortBy: {
        index: activeSortColumnIndex,
        direction: sortBy.direction,
      },
      onSort: (event: unknown, _index: number, direction: "asc" | "desc") => {
        onSort(event, columnKey, direction);
      },
      columnIndex,
    };
  };

  return (
    <Table
      aria-label="Assessments table"
      variant="compact"
      borders={false}
      isStickyHeader
      gridBreakPoint="grid-md"
    >
      <Thead>
        <Tr>
          {isColumnVisible("Name") && (
            <Th sort={getSortParams("Name")} modifier="nowrap">
              {Columns.Name}
            </Th>
          )}
          {isColumnVisible("Source") && (
            <Th sort={getSortParams("Source")} modifier="nowrap">
              {Columns.Source}
            </Th>
          )}
          {isColumnVisible("Owner") && (
            <Th sort={getSortParams("Owner")} modifier="nowrap">
              {Columns.Owner}
            </Th>
          )}
          {isColumnVisible("Hosts") && (
            <Th sort={getSortParams("Hosts")} modifier="nowrap">
              {Columns.Hosts}
            </Th>
          )}
          {isColumnVisible("VMs") && (
            <Th sort={getSortParams("VMs")} modifier="nowrap">
              {Columns.VMs}
            </Th>
          )}
          {isColumnVisible("Networks") && (
            <Th sort={getSortParams("Networks")} modifier="nowrap">
              {Columns.Networks}
            </Th>
          )}
          {isColumnVisible("Datastores") && (
            <Th sort={getSortParams("Datastores")} modifier="nowrap">
              {Columns.Datastores}
            </Th>
          )}
          {isColumnVisible("SharingStatus") && (
            <Th modifier="nowrap">{Columns.SharingStatus}</Th>
          )}
          {isColumnVisible("DataCollectedOn") && (
            <Th sort={getSortParams("DataCollectedOn")} modifier="nowrap">
              <TimestampColumnTitle
                label={Columns.DataCollectedOn}
                helpText={TIMESTAMP_COLUMN_HELP.dataCollected}
              />
            </Th>
          )}
          {isColumnVisible("ImportedToConsole") && (
            <Th sort={getSortParams("ImportedToConsole")} modifier="nowrap">
              <TimestampColumnTitle
                label={Columns.ImportedToConsole}
                helpText={TIMESTAMP_COLUMN_HELP.importedAssessment}
              />
            </Th>
          )}
          {isColumnVisible("Actions") && (
            <Th modifier="fitContent" screenReaderText="Actions">
              {Columns.Actions}
            </Th>
          )}
        </Tr>
      </Thead>
      <Tbody>
        {showNoResultFound && (
          <Tr>
            <Td colSpan={visibleColumns.length}>
              <EmptySearchResults title="No matching assessment found" />
            </Td>
          </Tr>
        )}
        {assessments.map((assessment) => (
          <Tr key={assessment.key}>
            {isColumnVisible("Name") && (
              <Td dataLabel={Columns.Name}>
                {assessment.hasData ? (
                  <TableText wrapModifier="breakWord">
                    <Link to={routes.assessmentReport(assessment.id)}>
                      {assessment.name}
                    </Link>
                  </TableText>
                ) : (
                  <span>
                    <Tooltip
                      {...themeTooltipFlyoutProps}
                      content={
                        assessment.sourceType.toLowerCase().includes("rvtools")
                          ? "No inventory data found. The uploaded file may be corrupted. Please verify and re-upload."
                          : "No inventory data yet. Data collection may be in progress or the source connection failed."
                      }
                    >
                      <Icon status="warning">
                        <RhUiWarningFillIcon />
                      </Icon>
                    </Tooltip>{" "}
                    <Tooltip
                      {...themeTooltipFlyoutProps}
                      content={assessment.name}
                    >
                      <span>{assessment.name}</span>
                    </Tooltip>
                  </span>
                )}
              </Td>
            )}
            {isColumnVisible("Source") && (
              <Td dataLabel={Columns.Source}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {isUploadedFileSourceType(assessment.sourceType) ? (
                    <RhUiDocumentIcon />
                  ) : (
                    <RhUiConnectedIcon />
                  )}
                  <Truncate content={assessment.source} />
                </div>
              </Td>
            )}
            {isColumnVisible("Owner") && (
              <Td dataLabel={Columns.Owner}>
                <Truncate content={assessment.owner} />
              </Td>
            )}
            {isColumnVisible("Hosts") && (
              <Td dataLabel={Columns.Hosts}>{assessment.hosts}</Td>
            )}
            {isColumnVisible("VMs") && (
              <Td dataLabel={Columns.VMs}>{assessment.vms}</Td>
            )}
            {isColumnVisible("Networks") && (
              <Td dataLabel={Columns.Networks}>{assessment.networks}</Td>
            )}
            {isColumnVisible("Datastores") && (
              <Td dataLabel={Columns.Datastores}>{assessment.datastores}</Td>
            )}
            {isColumnVisible("SharingStatus") && (
              <Td dataLabel={Columns.SharingStatus}>
                {assessment.isShared
                  ? assessment.sharedBy
                    ? assessment.sharedBy.name
                      ? `Shared by ${assessment.sharedBy.name}`
                      : "Shared by customer"
                    : "Shared with partner"
                  : "Not shared"}
              </Td>
            )}
            {isColumnVisible("DataCollectedOn") && (
              <Td dataLabel={Columns.DataCollectedOn} modifier="nowrap">
                <TimestampTableCell
                  columnLabel={Columns.DataCollectedOn}
                  ms={assessment.dataCollectedMs}
                  helpText={TIMESTAMP_COLUMN_HELP.dataCollected}
                />
              </Td>
            )}
            {isColumnVisible("ImportedToConsole") && (
              <Td dataLabel={Columns.ImportedToConsole} modifier="nowrap">
                <TimestampTableCell
                  columnLabel={Columns.ImportedToConsole}
                  ms={assessment.importedMs}
                  helpText={TIMESTAMP_COLUMN_HELP.importedAssessment}
                />
              </Td>
            )}
            {isColumnVisible("Actions") && (
              <Td dataLabel={Columns.Actions} modifier="fitContent">
                <Dropdown
                  isOpen={openDropdowns[assessment.id] || false}
                  popperProps={{
                    appendTo: () => document.body,
                    position: "end",
                  }}
                  onOpenChange={(isOpen) =>
                    setOpenDropdowns((previous) => ({
                      ...previous,
                      [assessment.id]: isOpen,
                    }))
                  }
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      aria-label="Actions"
                      variant="plain"
                      onClick={() => toggleDropdown(assessment.id)}
                      icon={<RhUiEllipsisVerticalIcon />}
                      style={{ padding: 0, width: "fit-content" }}
                    ></MenuToggle>
                  )}
                >
                  <DropdownList>
                    <DropdownItem
                      onClick={() => {
                        void navigate(routes.assessmentReport(assessment.id));
                      }}
                      isDisabled={
                        !assessment.hasData ||
                        !assessment.permissions.includes("read")
                      }
                    >
                      View assessment report
                    </DropdownItem>
                    {assessment.isShared ? (
                      <DropdownItem
                        onClick={() => {
                          toggleDropdown(assessment.id);
                          onUnshareAssessment?.(assessment.id);
                        }}
                        isDisabled={
                          !onUnshareAssessment ||
                          !assessment.permissions.includes("share")
                        }
                      >
                        Unshare assessment
                      </DropdownItem>
                    ) : (
                      <DropdownItem
                        onClick={() => {
                          toggleDropdown(assessment.id);
                          onShareAssessment?.(assessment.id);
                        }}
                        isDisabled={
                          !onShareAssessment ||
                          !assessment.permissions.includes("share")
                        }
                      >
                        Share assessment
                      </DropdownItem>
                    )}
                    <DropdownItem
                      onClick={openAssistedInstaller}
                      isDisabled={!assessment.hasData}
                    >
                      Create a target cluster
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        toggleDropdown(assessment.id);
                        onDelete?.(assessment.id);
                      }}
                      isDisabled={
                        !onDelete || !assessment.permissions.includes("delete")
                      }
                    >
                      Delete assessment
                    </DropdownItem>
                  </DropdownList>
                </Dropdown>
              </Td>
            )}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

AssessmentsTable.displayName = "AssessmentsTable";
