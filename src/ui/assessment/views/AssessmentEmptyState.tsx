import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { ExternalLinkAltIcon, PlusCircleIcon } from "@patternfly/react-icons";
import React from "react";
import CreateAssessmentDropdown from "../../core/components/CreateAssessmentDropdown";

const LEARN_MORE_URL =
  "https://kubev2v.github.io/openshift-migration-advisor-docs/docs/tutorial/";

const AssessmentEmptyState: React.FC = () => {
  return (
    <EmptyState
      headingLevel="h2"
      icon={PlusCircleIcon}
      titleText="No assessments yet"
    >
      <EmptyStateBody>
        Create an assessment from an RVTools file, or from a discovery appliance
        you&apos;ve already set up.
      </EmptyStateBody>

      <EmptyStateFooter>
        <EmptyStateActions>
          <CreateAssessmentDropdown />
        </EmptyStateActions>
        <EmptyStateActions>
          <Button
            variant="link"
            component="a"
            href={LEARN_MORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
          >
            Learn more
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
};

AssessmentEmptyState.displayName = "AssessmentEmptyState";

export default AssessmentEmptyState;
