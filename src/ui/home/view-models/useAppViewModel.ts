import { useLocation } from "react-router-dom";
import { useIdentity } from "../../../hooks/useIdentity";
import { routes } from "../../../routing/Routes";
import { HOME_TAB_LABELS, PARTNER_TAB_LABELS } from "../constants";

export interface AppViewModel {
  breadcrumbs: Array<{
    key: number;
    children: string;
    isActive?: boolean;
  }>;
}

export const useAppViewModel = (): AppViewModel => {
  const location = useLocation();
  const identity = useIdentity();
  const getActiveTabKey = (): number => {
    if (location.pathname.startsWith(routes.environments)) return 1;
    if (location.pathname.startsWith(routes.tools)) return 2;
    if (
      location.pathname.startsWith(routes.partners) ||
      location.pathname.startsWith(routes.myPartner) ||
      location.pathname.startsWith(routes.customers) ||
      location.pathname.startsWith(routes.adminGroups)
    ) {
      return 3;
    }
    return 0; // assessments
  };

  const activeTabKey = getActiveTabKey();

  const getPartnerTabConfig = () => {
    if (!identity) return null;

    switch (identity.kind) {
      case "regular":
        return {
          label: PARTNER_TAB_LABELS.regular,
          path: routes.partners,
          key: 3,
        };
      case "customer":
        return {
          label: PARTNER_TAB_LABELS.customer,
          path: routes.myPartner,
          key: 3,
        };
      case "partner":
        return {
          label: PARTNER_TAB_LABELS.partner,
          path: routes.customers,
          key: 3,
        };
      case "admin":
        return {
          label: PARTNER_TAB_LABELS.admin,
          path: routes.adminGroups,
          key: 3,
        };
      default:
        return null;
    }
  };
  const partnerTab = getPartnerTabConfig();

  const getBreadcrumbLabel = (): string => {
    switch (activeTabKey) {
      case 0:
        return HOME_TAB_LABELS.assessments;
      case 1:
        return HOME_TAB_LABELS.environments;
      case 2:
        return HOME_TAB_LABELS.tools;
      case 3:
        return partnerTab?.label ?? PARTNER_TAB_LABELS.regular;
      default:
        return HOME_TAB_LABELS.assessments;
    }
  };

  const breadcrumbs = [
    { key: 1, children: "Migration advisor" },
    {
      key: 2,
      children: getBreadcrumbLabel(),
      isActive: true,
    },
  ];

  return {
    breadcrumbs,
  };
};
