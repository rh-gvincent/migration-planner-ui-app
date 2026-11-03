import { InvalidObject } from "@redhat-cloud-services/frontend-components/InvalidObject";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AssessmentsScreen } from "../ui/assessment/views/AssessmentsScreen";
import { EnvironmentsScreen } from "../ui/environment/views/EnvironmentsScreen";
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
import { routes } from "./Routes";

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

const CreateFromOva = lazy(
  () =>
    import(
      /* webpackChunkName: "CreateFromOva" */ "../ui/assessment/views/CreateFromOva"
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

      {/* Pathless layout route — HomeScreen renders the shell + <Outlet /> */}
      <Route element={<HomeScreen />} errorElement={<InvalidObject />}>
        <Route path="assessments" element={<AssessmentsScreen />} />
        <Route path="environments" element={<EnvironmentsScreen />} />
        <Route path="tools" element={<ToolsScreen />} />
        <Route
          path="tools/cluster-sizing"
          element={<ClusterSizingToolScreen />}
        />
        <Route
          path="tools/cost-estimation"
          element={<PartnerViewRequireRole role="partner" />}
        >
          <Route index element={<StandaloneCostEstimationScreen />} />
        </Route>

        {/* Partner feature */}
        <Route
          path="partners"
          element={<PartnerViewRequireRole role="regular" />}
        >
          <Route index element={<PartnersScreen />} />
        </Route>
        <Route
          path="partners/my"
          element={<PartnerViewRequireRole role="customer" />}
        >
          <Route index element={<MyPartnerScreen />} />
        </Route>
        <Route
          path="partners/customers"
          element={<PartnerViewRequireRole role="partner" />}
        >
          <Route index element={<CustomersScreen />} />
        </Route>
        <Route
          path="partners/groups"
          element={<PartnerViewRequireRole role="admin" />}
        >
          <Route index element={<GroupsScreen />} />
          <Route path=":id" element={<GroupDetailScreen />} />
        </Route>
      </Route>
      {/* Independent routes — they have their own page layout */}
      <Route
        path="assessments/:id/report/manual-details"
        element={<ManualEnvironmentWizardPage />}
      />
      <Route path="assessments/:id/report" element={<ReportPage />} />
      <Route path="assessments/example-report" element={<ExampleReport />} />
      <Route
        path="assessments/discovery-ova-example-report"
        element={<DiscoveryOvaExampleReport />}
      />
      <Route path="assessments/create" element={<CreateFromOva />} />
    </Route>
    <Route path="*" element={<InvalidObject />} />
  </Routes>
);
