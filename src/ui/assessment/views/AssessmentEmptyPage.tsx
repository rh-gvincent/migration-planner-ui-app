import {
  Content,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Title,
} from "@patternfly/react-core";
import React from "react";

import { DiscoveryApplianceCard } from "./assessment-empty/DiscoveryApplianceCard";
import { RvtoolsCard } from "./assessment-empty/RvtoolsCard";
import { useModals } from "../view-models/ModalsContext";

const AssessmentEmptyPage: React.FC = () => {
  const { openCreateRVtoolAssessmentModal, openCreateDiscoveryApplianceModal } =
    useModals();
  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h2" size="lg">
          Select an assessment creation method
        </Title>
        <Content component="p">
          Start with a live discovery appliance scan, or upload an existing
          RVTools spreadsheet.
        </Content>
      </StackItem>
      <StackItem>
        <Grid hasGutter role="group" aria-label="Assessment creation methods">
          <GridItem md={6} xl2={4}>
            <DiscoveryApplianceCard
              onSelect={openCreateDiscoveryApplianceModal}
            />
          </GridItem>
          <GridItem md={6} xl2={4}>
            <RvtoolsCard onSelect={openCreateRVtoolAssessmentModal} />
          </GridItem>
        </Grid>
      </StackItem>
    </Stack>
  );
};

AssessmentEmptyPage.displayName = "AssessmentEmptyPage";

export default AssessmentEmptyPage;
