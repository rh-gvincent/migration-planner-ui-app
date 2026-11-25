import "@testing-library/jest-dom";

import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateRvtoolsAssessmentModal } from "../CreateRvtoolsAssessmentModal";

const makeFile = (name: string): File =>
  new File(["rvtools data"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

const renderForm = (onSubmit = vi.fn()) =>
  render(
    <CreateRvtoolsAssessmentModal
      isOpen
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

describe("CreateRvtoolsAssessmentModal form", () => {
  it("renders the assessment name and consent fields", () => {
    const { getByRole } = renderForm();

    expect(
      getByRole("textbox", { name: /Assessment name/i }),
    ).toBeInTheDocument();
    expect(
      getByRole("checkbox", {
        name: /I agree to share aggregated data about my environment with Red Hat/i,
      }),
    ).toBeInTheDocument();
    expect(getByRole("button", { name: "Select files" })).toBeInTheDocument();
  });

  it("submits the trimmed name and checked consent", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const { getAllByText, getByLabelText, getByRole } = renderForm(onSubmit);
    const files = [makeFile("rvtools-one.xlsx"), makeFile("rvtools-two.xlsx")];
    const fileInput = document.querySelector('input[type="file"][multiple]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Multiple RVTools file input not found");
    }

    await user.upload(fileInput, files);
    expect(
      getByLabelText("Upload progress for rvtools-one.xlsx"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(getAllByText("100%")).toHaveLength(files.length);
    });

    await user.type(
      getByRole("textbox", { name: /Assessment name/i }),
      "  RVTools assessment  ",
    );
    await user.click(
      getByRole("checkbox", {
        name: /I agree to share aggregated data about my environment with Red Hat/i,
      }),
    );
    await waitFor(() => {
      expect(getByRole("button", { name: /Create assessment/i })).toBeEnabled();
    });
    await user.click(getByRole("button", { name: /Create assessment/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "RVTools assessment",
        consentChecked: true,
        files,
      });
    });
  });

  it("keeps the submit button disabled while the form is invalid", async () => {
    const onSubmit = vi.fn();
    const { getByRole } = renderForm(onSubmit);

    expect(getByRole("button", { name: /Create assessment/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("enables submit after all Yup-validated fields are valid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = renderForm(onSubmit);
    const createButton = getByRole("button", { name: /Create assessment/i });

    await user.type(
      getByRole("textbox", { name: /Assessment name/i }),
      "Assessment",
    );
    expect(createButton).toBeDisabled();

    await user.click(
      getByRole("checkbox", {
        name: /I agree to share aggregated data about my environment with Red Hat/i,
      }),
    );
    const fileInput = document.querySelector('input[type="file"][multiple]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Multiple RVTools file input not found");
    }
    await user.upload(fileInput, makeFile("assessment.xlsx"));

    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });
  });
});
