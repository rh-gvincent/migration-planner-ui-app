import "@testing-library/jest-dom";

import type { Assessment } from "@openshift-migration-advisor/planner-sdk";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAssessmentModel } from "../../../../models/AssessmentModel";
import {
  selectAttribute,
  selectCheckboxOption,
} from "../../../core/components/attribute-value-filter/__tests__/filterTestHelpers";
import type { useAssessmentsScreenViewModel } from "../../view-models/useAssessmentsScreenViewModel";
import { AssessmentsScreen } from "../AssessmentsScreen";
import { DEFAULT_VISIBLE_COLUMNS } from "../AssessmentsTable";

type AssessmentsScreenViewModel = ReturnType<
  typeof useAssessmentsScreenViewModel
>;

let mockViewModel: AssessmentsScreenViewModel;

vi.mock("../../view-models/useAssessmentsScreenViewModel", () => ({
  useAssessmentsScreenViewModel: () => mockViewModel,
}));

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
  }: {
    children: React.ReactNode;
    to: string;
  }): React.ReactElement => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock(
  "@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal",
  () => ({
    default: (): null => null,
  }),
);

vi.mock("../../../core/components/CreateAssessmentDropdown", () => ({
  default: (): React.ReactElement => (
    <button type="button">Create assessment</button>
  ),
}));

const makeAssessment = (overrides: Partial<Assessment> = {}) =>
  createAssessmentModel({
    id: "assessment-1",
    name: "Alpha Discovery",
    sourceType: "inventory",
    createdAt: new Date("2026-01-01"),
    snapshots: [],
    ...overrides,
  });

const makeViewModel = (
  overrides: Partial<AssessmentsScreenViewModel> = {},
): AssessmentsScreenViewModel => ({
  assessments: [],
  isUpdatingAssessment: false,
  isDeletingAssessment: false,
  isColumnModalOpen: false,
  setIsColumnModalOpen: vi.fn(),
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  setVisibleColumns: vi.fn(),
  sortBy: undefined,
  setSortBy: vi.fn(),
  updateAssessment: vi.fn(),
  deleteAssessment: vi.fn(),
  shareAssessment: vi.fn(),
  isSharingAssessment: false,
  unshareAssessment: vi.fn(),
  isUnsharingAssessment: false,
  ...overrides,
});

const assessments = [
  makeAssessment({
    id: "a-1",
    name: "Alpha Discovery",
    sourceType: "inventory",
  }),
  makeAssessment({ id: "a-2", name: "Beta RVTools", sourceType: "rvtools" }),
  makeAssessment({
    id: "a-3",
    name: "Gamma Discovery",
    sourceType: "inventory",
    ownerFirstName: "Jane",
    ownerLastName: "Smith",
  }),
];

beforeEach(() => {
  mockViewModel = makeViewModel();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssessmentsScreen Source column", () => {
  it("shows Uploaded file for rvtools and inventory assessments", () => {
    render(<AssessmentsScreen />);

    const table = screen.getByRole("grid", { name: "Assessments table" });
    expect(within(table).getAllByText("Uploaded file")).toHaveLength(3);
  });
});

describe("AssessmentsScreen filters", () => {
  it("filters assessments by name", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    await user.type(
      screen.getByRole("textbox", { name: "Filter by name" }),
      "Beta",
    );

    expect(screen.getByText("Beta RVTools")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Discovery")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma Discovery")).not.toBeInTheDocument();
  });

  it("filters assessments by owner", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    await selectAttribute(user, "Owner");
    await user.click(screen.getByRole("button", { name: "Filter by owner" }));
    await selectCheckboxOption(user, "Jane Smith");

    expect(screen.getByText("Gamma Discovery")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Discovery")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta RVTools")).not.toBeInTheDocument();
  });

  it("clears all filters from the toolbar action", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    await user.type(
      screen.getByRole("textbox", { name: "Filter by name" }),
      "Beta",
    );

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    const table = screen.getByRole("grid", { name: "Assessments table" });
    expect(within(table).getByText("Alpha Discovery")).toBeInTheDocument();
    expect(within(table).getByText("Beta RVTools")).toBeInTheDocument();
    expect(within(table).getByText("Gamma Discovery")).toBeInTheDocument();
  });

  it("switches the visible value control when the active attribute changes", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    expect(
      screen.getByRole("textbox", { name: "Filter by name" }),
    ).toBeInTheDocument();

    await selectAttribute(user, "Owner");

    expect(
      screen.getByRole("button", { name: "Filter by owner" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Filter by name" }),
    ).not.toBeInTheDocument();
  });
});

describe("AssessmentsScreen sharing actions", () => {
  const openKebab = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await user.click(screen.getByRole("button", { name: "Actions" }));
  };

  it("shows 'Share assessment' in the kebab for a non-shared assessment", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    await openKebab(user);

    expect(
      screen.getByRole("menuitem", { name: "Share assessment" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Unshare assessment" }),
    ).not.toBeInTheDocument();
  });

  it("shows 'Unshare assessment' instead of 'Share assessment' when already shared", async () => {
    const user = userEvent.setup();
    render(<AssessmentsScreen />);

    await openKebab(user);

    expect(
      screen.getByRole("menuitem", { name: "Unshare assessment" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Share assessment" }),
    ).not.toBeInTheDocument();
  });

  it("calls shareAssessment after confirming the share modal", async () => {
    const user = userEvent.setup();
    const shareAssessment = vi.fn();
    mockViewModel = makeViewModel({ shareAssessment });
    render(<AssessmentsScreen />);

    await openKebab(user);
    await user.click(
      screen.getByRole("menuitem", { name: "Share assessment" }),
    );
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(shareAssessment).toHaveBeenCalledWith("a-1");
  });

  it("calls unshareAssessment after confirming the unshare modal", async () => {
    const user = userEvent.setup();
    const unshareAssessment = vi.fn();
    mockViewModel = makeViewModel({ unshareAssessment });
    render(<AssessmentsScreen />);

    await openKebab(user);
    await user.click(
      screen.getByRole("menuitem", { name: "Unshare assessment" }),
    );
    await user.click(screen.getByRole("button", { name: "Unshare" }));

    expect(unshareAssessment).toHaveBeenCalledWith("a-1");
  });
});
