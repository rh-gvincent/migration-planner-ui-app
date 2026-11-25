import { Tab, TabContent, Tabs, TabTitleText } from "@patternfly/react-core";
import React from "react";
import { Outlet } from "react-router-dom";

import { AppPage } from "../../core/components/AppPage";
import { PartnerTab } from "../components/PartnerTab";
import { HOME_TAB_LABELS } from "../constants";
import { useHomeScreenViewModel } from "../view-models/useHomeScreenViewModel";
import HomeScreenSubtitle from "./HomeScreenSubtitle";

export const HomeScreen: React.FC = () => {
  const vm = useHomeScreenViewModel();

  return (
    <AppPage
      breadcrumbs={vm.breadcrumbs}
      title="Assess your migration from vCenter to OpenShift"
      subtitle={<HomeScreenSubtitle />}
    >
      <Tabs
        activeKey={vm.activeTabKey}
        onSelect={vm.handleTabClick}
        aria-label="Migration tabs"
        role="region"
      >
        <Tab
          eventKey={0}
          title={<TabTitleText>{HOME_TAB_LABELS.assessments}</TabTitleText>}
          aria-label={`${HOME_TAB_LABELS.assessments} tab`}
        />
        <Tab
          eventKey={1}
          title={<TabTitleText>{HOME_TAB_LABELS.environments}</TabTitleText>}
          aria-label={`${HOME_TAB_LABELS.environments} tab`}
        />
        <Tab
          eventKey={2}
          title={<TabTitleText>{HOME_TAB_LABELS.tools}</TabTitleText>}
          aria-label={`${HOME_TAB_LABELS.tools} tab`}
        />
        {vm.partnerTab && (
          <PartnerTab
            eventKey={vm.partnerTab.key}
            label={vm.partnerTab.label}
            pendingRequestsCount={vm.pendingRequestsCount}
            shouldShowBadge={vm.shouldShowBadge}
            isLoading={vm.isLoadingPartnerRequests}
          />
        )}
      </Tabs>

      <TabContent id="home-screen-content">
        <Outlet />
      </TabContent>
    </AppPage>
  );
};

HomeScreen.displayName = "HomeScreen";

export default HomeScreen;
