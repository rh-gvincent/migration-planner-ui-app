import React from "react";
import { Outlet } from "react-router-dom";
import { EnvironmentPageProvider } from "../../environment/view-models/EnvironmentPageContext";
import { ModalsProvider } from "../../assessment/view-models/ModalsContext";
import { AppPage } from "../../core/components/AppPage";
import HomeScreenSubtitle from "./HomeScreenSubtitle";
import { useAppViewModel } from "../view-models/useAppViewModel";

export const AppWrapper: React.FC = () => {
  const vm = useAppViewModel();

  return (
    <AppPage
      breadcrumbs={vm.breadcrumbs}
      title="Assess your migration from vCenter to OpenShift"
      subtitle={<HomeScreenSubtitle />}
    >
      <ModalsProvider>
        <Outlet />
      </ModalsProvider>
    </AppPage>
  );
};

AppWrapper.displayName = "AppWrapper";
