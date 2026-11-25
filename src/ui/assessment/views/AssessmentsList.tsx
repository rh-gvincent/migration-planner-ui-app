import React, { useMemo } from "react";

import { formatRelativeTime } from "../../../lib/common/Time";
import type { AssessmentModel } from "../../../models/AssessmentModel";
import {
  getAssessmentDataCollectedMs,
  getAssessmentImportedMs,
} from "../../../models/assessmentTimestamps";
import { getAssessmentSourceLabel } from "../helpers/assessmentSource";
import {
  AssessmentsTable,
  type AssessmentTableRow,
  type ColumnKey,
  Columns,
  DEFAULT_VISIBLE_COLUMNS,
  type SortableColumn,
} from "./AssessmentsTable";

type AssessmentsListProps = {
  assessments: AssessmentModel[];
  nameFilter?: string;
  filterBy?: string;
  filterValue?: string;
  selectedSources?: string[];
  selectedOwners?: string[];
  sortBy?: { columnKey: SortableColumn; direction: "asc" | "desc" } | undefined;
  onSort?: (
    event: unknown,
    columnKey: SortableColumn,
    direction: "asc" | "desc",
  ) => void;
  onDelete?: (assessmentId: string) => void;
  onUpdate?: (assessmentId: string) => void;
  visibleColumns?: ColumnKey[];
  onShareAssessment?: (assessmentId: string) => void;
  onUnshareAssessment?: (assessmentId: string) => void;
};

export const AssessmentsList: React.FC<AssessmentsListProps> = ({
  assessments,
  nameFilter = "",
  filterBy = "Filter",
  filterValue = "",
  selectedSources = [],
  selectedOwners = [],
  sortBy,
  onSort,
  onDelete,
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  onShareAssessment,
  onUnshareAssessment,
}) => {
  const rows = useMemo((): AssessmentTableRow[] => {
    const safeAssessments = Array.isArray(assessments) ? assessments : [];
    const items = safeAssessments.map((assessment) => {
      const name = assessment.name;
      const id = String(assessment.id ?? "");
      const sourceType = assessment.sourceType || "Unknown";
      const source = getAssessmentSourceLabel(sourceType);
      const sourceId = assessment.sourceId;
      const permissions = Array.isArray(assessment.permissions)
        ? assessment.permissions
        : [];
      const isShared = assessment.sharing?.isShared || false;
      const sharedBy = assessment.sharing?.sharedBy || null;

      // Use pre-computed model properties
      const snapshotData = assessment.latestSnapshot;
      const ownerFullName = assessment.ownerFullName;
      const hasData = assessment.hasUsefulData;

      const dataCollectedMs = getAssessmentDataCollectedMs(assessment);
      const importedMs = getAssessmentImportedMs(assessment);

      return {
        key: id || name,
        id,
        name,
        source,
        sourceId,
        sourceType,
        dataCollectedMs,
        importedMs,
        owner: ownerFullName,
        hosts: snapshotData.hosts,
        vms: snapshotData.vms,
        networks: snapshotData.networks,
        datastores: snapshotData.datastores,
        hasData,
        permissions,
        isShared,
        sharedBy,
      };
    });

    let filtered = items;

    // Apply name filter
    if (nameFilter && nameFilter.trim() !== "") {
      const query = nameFilter.toLowerCase();
      filtered = filtered.filter((i) =>
        (i.name || "").toLowerCase().includes(query),
      );
    }

    // Apply dropdown filter (Source or Owner)
    if (filterBy !== "Filter" && filterValue.trim() !== "") {
      switch (filterBy) {
        case "Source":
          filtered = filtered.filter((i) =>
            i.source.toLowerCase().includes(filterValue.toLowerCase()),
          );
          break;
        case "Owner":
          filtered = filtered.filter((i) =>
            (i.owner || "").toLowerCase().includes(filterValue.toLowerCase()),
          );
          break;
        case Columns.ImportedToConsole:
        case "Imported to console": {
          const query = filterValue.trim().toLowerCase();
          // eslint-disable-next-line react-hooks/purity
          const nowMs = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;
          const matchByRule = (itemMs: number): boolean => {
            if (!itemMs) {
              return false;
            }
            const diffDays = Math.floor((nowMs - itemMs) / oneDayMs);

            // Common quick filters
            if (query === "today") return diffDays === 0;
            if (query === "yesterday") return diffDays === 1;
            if (
              query === "last 7 days" ||
              query === "past 7 days" ||
              query === "week"
            )
              return diffDays >= 0 && diffDays < 7;
            if (
              query === "last 30 days" ||
              query === "past 30 days" ||
              query === "month" ||
              query === "last month"
            )
              return diffDays >= 0 && diffDays < 30;

            // Numeric relative: e.g., "3 days", "10d"
            const rel = query.match(/(\d+)\s*(d|day|days)\b/);
            if (rel) {
              const days = Number(rel[1]);
              if (!Number.isNaN(days)) {
                return diffDays >= 0 && diffDays < days;
              }
            }

            // Date input: try to parse and match same calendar date
            const parsed = new Date(filterValue);
            if (!Number.isNaN(parsed.getTime())) {
              const targetY = parsed.getFullYear();
              const targetM = parsed.getMonth();
              const targetD = parsed.getDate();
              const d = new Date(itemMs);
              return (
                d.getFullYear() === targetY &&
                d.getMonth() === targetM &&
                d.getDate() === targetD
              );
            }

            // Fallback: substring on rendered label (e.g., "today", "1 day ago")
            return formatRelativeTime(itemMs).toLowerCase().includes(query);
          };

          filtered = filtered.filter((i) => matchByRule(i.importedMs ?? 0));
          break;
        }
        case Columns.DataCollectedOn:
        case "Data collected on": {
          const query = filterValue.trim().toLowerCase();
          // eslint-disable-next-line react-hooks/purity
          const nowMs = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;
          const matchByRule = (itemMs: number): boolean => {
            if (!itemMs) {
              return false;
            }
            const diffDays = Math.floor((nowMs - itemMs) / oneDayMs);

            if (query === "today") return diffDays === 0;
            if (query === "yesterday") return diffDays === 1;
            if (
              query === "last 7 days" ||
              query === "past 7 days" ||
              query === "week"
            )
              return diffDays >= 0 && diffDays < 7;
            if (
              query === "last 30 days" ||
              query === "past 30 days" ||
              query === "month" ||
              query === "last month"
            )
              return diffDays >= 0 && diffDays < 30;

            const rel = query.match(/(\d+)\s*(d|day|days)\b/);
            if (rel) {
              const days = Number(rel[1]);
              if (!Number.isNaN(days)) {
                return diffDays >= 0 && diffDays < days;
              }
            }

            const parsed = new Date(filterValue);
            if (!Number.isNaN(parsed.getTime())) {
              const targetY = parsed.getFullYear();
              const targetM = parsed.getMonth();
              const targetD = parsed.getDate();
              const d = new Date(itemMs);
              return (
                d.getFullYear() === targetY &&
                d.getMonth() === targetM &&
                d.getDate() === targetD
              );
            }

            return formatRelativeTime(itemMs).toLowerCase().includes(query);
          };

          filtered = filtered.filter((i) =>
            matchByRule(i.dataCollectedMs ?? 0),
          );
          break;
        }
      }
    }

    // Apply owners multi-select filter
    if (selectedOwners && selectedOwners.length > 0) {
      filtered = filtered.filter((i) =>
        i.owner ? selectedOwners.includes(i.owner) : false,
      );
    }

    if (selectedSources.length > 0) {
      filtered = filtered.filter((item) =>
        item.sourceId !== undefined && selectedSources.includes(item.sourceId),
      );
    }

    if (!sortBy) return filtered;

    const copy = [...filtered];
    switch (sortBy.columnKey) {
      case "Name":
        copy.sort((a, b) =>
          sortBy.direction === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name),
        );
        break;
      case "Source":
        copy.sort((a, b) =>
          sortBy.direction === "asc"
            ? a.source.localeCompare(b.source)
            : b.source.localeCompare(a.source),
        );
        break;
      case "DataCollectedOn":
        copy.sort((a, b) => {
          const aMs = a.dataCollectedMs ?? 0;
          const bMs = b.dataCollectedMs ?? 0;
          return sortBy.direction === "asc" ? aMs - bMs : bMs - aMs;
        });
        break;
      case "ImportedToConsole":
        copy.sort((a, b) => {
          const aMs = a.importedMs ?? 0;
          const bMs = b.importedMs ?? 0;
          return sortBy.direction === "asc" ? aMs - bMs : bMs - aMs;
        });
        break;
      case "Owner":
        copy.sort((a, b) =>
          sortBy.direction === "asc"
            ? (a.owner || "").localeCompare(b.owner || "")
            : (b.owner || "").localeCompare(a.owner || ""),
        );
        break;
      case "Hosts":
        copy.sort((a, b) => {
          const aHosts = typeof a.hosts === "number" ? a.hosts : 0;
          const bHosts = typeof b.hosts === "number" ? b.hosts : 0;
          return sortBy.direction === "asc" ? aHosts - bHosts : bHosts - aHosts;
        });
        break;
      case "VMs":
        copy.sort((a, b) => {
          const aVms = typeof a.vms === "number" ? a.vms : 0;
          const bVms = typeof b.vms === "number" ? b.vms : 0;
          return sortBy.direction === "asc" ? aVms - bVms : bVms - aVms;
        });
        break;
      case "Networks":
        copy.sort((a, b) => {
          const aNetworks = typeof a.networks === "number" ? a.networks : 0;
          const bNetworks = typeof b.networks === "number" ? b.networks : 0;
          return sortBy.direction === "asc"
            ? aNetworks - bNetworks
            : bNetworks - aNetworks;
        });
        break;
      case "Datastores":
        copy.sort((a, b) => {
          const aDatastores =
            typeof a.datastores === "number" ? a.datastores : 0;
          const bDatastores =
            typeof b.datastores === "number" ? b.datastores : 0;
          return sortBy.direction === "asc"
            ? aDatastores - bDatastores
            : bDatastores - aDatastores;
        });
        break;
    }
    return copy;
  }, [
    assessments,
    nameFilter,
    filterBy,
    filterValue,
    selectedSources,
    selectedOwners,
    sortBy,
  ]);

  const showNoResultFound = assessments.length > 0 && rows.length === 0;

  return (
    <AssessmentsTable
      assessments={rows}
      showNoResultFound={showNoResultFound}
      sortBy={sortBy}
      onSort={onSort}
      onDelete={onDelete}
      visibleColumns={visibleColumns}
      onShareAssessment={onShareAssessment}
      onUnshareAssessment={onUnshareAssessment}
    />
  );
};

AssessmentsList.displayName = "AssessmentsList";
