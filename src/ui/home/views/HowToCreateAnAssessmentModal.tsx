import {
  Modal,
  ModalBody,
  ModalHeader,
  Tab,
  TabContentBody,
  Tabs,
  TabTitleText,
} from "@patternfly/react-core";
import React, { useState } from "react";

import { type Step, StepList } from "../../core/components/Step";
import OvaSetupInstructionsPopover from "./OvaSetupInstructionsPopover";

const discoverySteps: Step[] = [
  {
    title: "Set up",
    description: (
      <>
        On the <strong>Discovery appliances</strong> tab, choose{" "}
        <strong>Generate discovery appliance</strong>. Name the appliance, add
        an SSH key, and generate a discovery OVA.
      </>
    ),
  },
  {
    title: "Deploy",
    description: (
      <>
        Download the OVA and import it into vCenter to deploy the discovery
        appliance. <OvaSetupInstructionsPopover />
      </>
    ),
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

const rvtoolsSteps: Step[] = [
  {
    title: "Start",
    description: (
      <>
        On the <strong>RVTools assessments</strong> tab, choose{" "}
        <strong>Create RVTools assessment</strong> or{" "}
        <strong>Upload RVTools file</strong>.
      </>
    ),
  },
  {
    title: "Upload",
    description:
      "Name your assessment and upload an RVTools Excel export (.xls or .xlsx).",
  },
  {
    title: "Review",
    description:
      "Open the assessment from the RVTools assessments tab to review the report.",
  },
];

type HowToCreateAnAssessmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const HowToCreateAnAssessmentModal: React.FC<
  HowToCreateAnAssessmentModalProps
> = ({ isOpen, onClose }) => {
  const [activeTabKey, setActiveTabKey] = useState<string | number>(
    "discovery",
  );

  return (
    <Modal
      variant="medium"
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="how-to-create-an-assessment-title"
    >
      <ModalHeader
        title="How to create an assessment"
        labelId="how-to-create-an-assessment-title"
      />
      <ModalBody>
        <Tabs
          activeKey={activeTabKey}
          onSelect={(_event, key) => setActiveTabKey(key)}
          aria-label="Assessment generation methods"
        >
          <Tab
            eventKey="discovery"
            title={<TabTitleText>Discovery appliance</TabTitleText>}
          >
            <TabContentBody hasPadding>
              <StepList steps={discoverySteps} />
            </TabContentBody>
          </Tab>
          <Tab
            eventKey="rvtools"
            title={<TabTitleText>RVTools upload</TabTitleText>}
          >
            <TabContentBody hasPadding>
              <StepList steps={rvtoolsSteps} />
            </TabContentBody>
          </Tab>
        </Tabs>
      </ModalBody>
    </Modal>
  );
};

HowToCreateAnAssessmentModal.displayName = "HowToCreateAnAssessmentModal";

export default HowToCreateAnAssessmentModal;
