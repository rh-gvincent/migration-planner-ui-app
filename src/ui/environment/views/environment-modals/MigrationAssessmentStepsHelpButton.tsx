import { Button, Popover } from "@patternfly/react-core";
import { OutlinedQuestionCircleIcon } from "@patternfly/react-icons";
import React from "react";

import { StepList } from "../../../core/components/Step";

type Step = {
  title: string;
  description: React.ReactNode;
};

const migrationAssessmentSteps: Step[] = [
  {
    title: "Set up",
    description: (
      <>Name the appliance, add an SSH key, and generate a discovery OVA.</>
    ),
  },
  {
    title: "Deploy",
    description:
      "Download the OVA and import it into vCenter to deploy the discovery appliance",
  },
  {
    title: "Discover",
    description:
      "Open the discovery appliance to collect inventory from vCenter and generate a migration report on the appliance. This is the primary outcome of deploying the discovery OVA.",
  },
  {
    title: "Share (Optional)",
    description:
      "To continue in Migration Advisor, share discovery appliance data with Red Hat so the appliance appears as connected in the Hybrid Console.",
  },
  {
    title: "Create assessment (Optional)",
    description: (
      <>
        In Migration Advisor on the Red Hat Hybrid Console, choose{" "}
        <strong>Create assessment</strong> to turn shared discovery data into a
        full migration assessment. This is separate from the report on the
        discovery appliance.
      </>
    ),
  },
];

export const MigrationAssessmentStepsHelpButton: React.FC = () => (
  <Popover
    aria-label="Migration assessment steps"
    headerContent="Migration assessment steps"
    headerComponent="h2"
    position="right"
    minWidth="360px"
    maxWidth="420px"
    appendTo={() => document.body}
    bodyContent={<StepList steps={migrationAssessmentSteps} />}
  >
    <Button variant="link" isInline icon={<OutlinedQuestionCircleIcon />}>
      Migration assessment steps
    </Button>
  </Popover>
);

MigrationAssessmentStepsHelpButton.displayName =
  "MigrationAssessmentStepsHelpButton";
