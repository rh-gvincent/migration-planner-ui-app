import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnvironmentPageProvider } from "../../../view-models/EnvironmentPageContext";
import type { EnvironmentPageViewModel } from "../../../view-models/useEnvironmentPageViewModel";
import {
  EnvironmentModal,
  type EnvironmentModalProps,
} from "../EnvironmentModal";

const mockVm = {
  sources: [],
  assessments: [],
  sourceSelected: null,
  selectSource: vi.fn(),
  selectSourceById: vi.fn(),
  getSourceById: vi.fn(),
  listSources: vi.fn().mockResolvedValue([]),
  isLoadingSources: false,
  errorLoadingSources: undefined,
  hasInitialLoad: true,
  deleteSource: vi.fn().mockResolvedValue({}),
  isDeletingSource: false,
  createDownloadSource: vi.fn().mockResolvedValue(undefined),
  isDownloadingSource: false,
  errorDownloadingSource: undefined,
  downloadSourceUrl: "",
  setDownloadUrl: vi.fn(),
  sourceCreatedId: null,
  deleteSourceCreated: vi.fn(),
  updateSource: vi.fn().mockResolvedValue(undefined),
  isUpdatingSource: false,
  errorUpdatingSource: undefined,
  uploadInventoryFromFile: vi.fn(),
  isUpdatingInventory: false,
  errorUpdatingInventory: undefined,
  inventoryUploadResult: null,
  clearInventoryUploadResult: vi.fn(),
  getDownloadUrlForSource: vi.fn(),
  fetchDownloadUrlForSource: vi.fn().mockResolvedValue(""),
  listAssessments: vi.fn().mockResolvedValue([]),
  isLoadingAssessments: false,
  assessmentFromAgentState: false,
  setAssessmentFromAgent: vi.fn(),
  clearErrors: vi.fn(),
  deleteAndRefresh: vi.fn().mockResolvedValue([]),
  isDeletingAndRefreshing: false,
  refreshOnFocus: vi.fn().mockResolvedValue(undefined),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
} as unknown as EnvironmentPageViewModel;

vi.mock("../../../view-models/EnvironmentPageContext", () => ({
  EnvironmentPageProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useEnvironmentPage: () => mockVm,
}));

vi.mock("../../../view-models/useApplianceVersionViewModel", () => ({
  useApplianceVersionViewModel: () => ({
    displayVersion: "v0.13.6",
    isLoading: false,
    releaseNotesUrl:
      "https://kubev2v.github.io/openshift-migration-advisor-docs/releases/",
  }),
}));

describe("EnvironmentModal - Create mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal when open in create mode", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Generate discovery appliance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Appliance version")).toBeInTheDocument();
    expect(screen.getByText("v0.13.6")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const props: EnvironmentModalProps = {
      isOpen: false,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.queryByRole("heading", { name: "Generate discovery appliance" }),
    ).not.toBeInTheDocument();
  });

  it("shows generate OVA button", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Generate OVA" }),
    ).toBeInTheDocument();
  });

  it("shows cancel button", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose,
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows required form fields", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    // Check for form elements by their form IDs
    expect(
      screen.getByPlaceholderText(/ams-vcenter-prod-1/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^SSH Key/)).toBeInTheDocument();
  });
});

describe("EnvironmentModal - Edit mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVm.getSourceById = vi.fn().mockReturnValue({
      id: "source-123",
      name: "Test Environment",
      sshkey: "",
      url: "https://vcenter.example.com",
      credentialUrl: "",
      inventory: { infrastructures: [] },
      total_cpu_cores: 0,
      total_ram_gb: 0,
      total_vms: 0,
    });
  });

  it("renders modal when open in edit mode with sourceId", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Update Environment" }),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const props: EnvironmentModalProps = {
      isOpen: false,
      onClose: vi.fn(),
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.queryByRole("heading", { name: "Update Environment" }),
    ).not.toBeInTheDocument();
  });

  it("shows update button in edit mode", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(
      screen.getByRole("button", { name: /Update OVA configuration/i }),
    ).toBeInTheDocument();
  });

  it("shows cancel button", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose,
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows form fields pre-filled with source data", () => {
    const props: EnvironmentModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      sourceId: "source-123",
      onSuccess: vi.fn(),
    };

    render(
      <EnvironmentPageProvider>
        <EnvironmentModal {...props} />
      </EnvironmentPageProvider>,
    );

    const nameInput = screen.getByLabelText(/^Discovery appliance name/);
    expect(nameInput).toHaveValue("Test Environment");
    expect(nameInput).toBeDisabled(); // Name is disabled in edit mode
  });
});
