import { InvalidObject } from "@redhat-cloud-services/frontend-components/InvalidObject";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AssessmentsScreen } from "../ui/assessment/views/AssessmentsScreen";
import { HomeScreen } from "../ui/home/views/HomeScreen";
import { GroupsScreen } from "../ui/partner/admin/views/GroupsScreen";
import { MyPartnerScreen } from "../ui/partner/customer/views/MyPartnerScreen";
import { CustomersScreen } from "../ui/partner/partner/views/CustomersScreen";
import { PartnersScreen } from "../ui/partner/regularUser/views/PartnersScreen";
import { PartnerViewRequireRole } from "../ui/partner/views/PartnerViewRequireRole";
import ClusterSizingToolScreen from "../ui/tools/ClusterSizingTool/views/ClusterSizingToolScreen";
import StandaloneCostEstimationScreen from "../ui/tools/StandaloneCostEstimation/views/StandaloneCostEstimationScreen";
import { ToolsScreen } from "../ui/tools/views/ToolsScreen";
import { IdentityWrapper } from "./IdentityWrapper";
import EnvironmentsScreen from "../ui/environment/views/EnvironmentsScreen";
import { routes } from "./Routes";
import { AppWrapper } from "../ui/home/views/AppWrapper";

const ReportPage = lazy(
  () =>
    import(/* webpackChunkName: "Report" */ "../ui/report/views/ReportPage"),
);

const ManualEnvironmentWizardPage = lazy(
  () =>
    import(
      /* webpackChunkName: "ManualEnvironmentWizard" */ "../ui/report/views/manual-environment/ManualEnvironmentWizard"
    ),
);

const ExampleReport = lazy(
  () =>
    import(
      /* webpackChunkName: "ExampleReport" */ "../ui/report/views/ExampleReport"
    ),
);

const DiscoveryOvaExampleReport = lazy(
  () =>
    import(
      /* webpackChunkName: "DiscoveryOvaExampleReport" */ "../ui/report/views/DiscoveryOvaExampleReport"
    ),
);

const AssessmentEmptyPage = lazy(
  () =>
    import(
      /* webpackChunkName: "AssessmentEmptyPage" */ "../ui/assessment/views/AssessmentEmptyPage"
    ),
);

const GroupDetailScreen = lazy(
  () =>
    import(
      /* webpackChunkName: "Group" */ "../ui/partner/admin/views/GroupDetailScreen"
    ),
);

export const AppRoutes: React.FC = () => (
  <Routes>
    {/* Identity wrapper loads current identity and renders child routes */}
    <Route element={<IdentityWrapper />}>
      <Route index element={<Navigate to={routes.assessments} replace />} />

      <Route element={<AppWrapper />}>
        <Route path="assessments/empty" element={<AssessmentEmptyPage />} />
      </Route>
    </Route>
    <Route path="*" element={<InvalidObject />} />
  </Routes>
);
