import { useInjection } from "@openshift-migration-advisor/ioc";
import { useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAsync } from "react-use";

import { Symbols } from "../../../config/Dependencies";
import type { IPartnerRequestsStore } from "../../../data/stores/interfaces/IPartnerRequestsStore";
import { useIdentity } from "../../../hooks/useIdentity";
import { routes } from "../../../routing/Routes";
import { HOME_TAB_LABELS, PARTNER_TAB_LABELS } from "../constants";

export interface HomeScreenViewModel {
  activeTabKey: number;
  breadcrumbs: Array<{
    key: number;
    children: string;
    isActive?: boolean;
  }>;
  partnerTab: {
    label: string;
    path: string;
    key: number;
  } | null;
  handleTabClick: (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => void;
  pendingRequestsCount: number;
  shouldShowBadge: boolean;
  isLoadingPartnerRequests: boolean;
}

export const useHomeScreenViewModel = (): HomeScreenViewModel => {
  const location = useLocation();
  const navigate = useNavigate();

  // User store injection
  const identity = useIdentity();

  // Partner requests store subscription
  const partnerRequestsStore = useInjection<IPartnerRequestsStore>(
    Symbols.PartnerRequestsStore,
  );

  const requests = useSyncExternalStore(
    partnerRequestsStore.subscribe.bind(partnerRequestsStore),
    partnerRequestsStore.getSnapshot.bind(partnerRequestsStore),
  );

  const shouldShowBadge = identity?.isPartner ?? false;

  const { loading: isLoadingPartnerRequestsRaw } = useAsync(async () => {
    if (!shouldShowBadge) return [];
    return partnerRequestsStore.list();
  }, [partnerRequestsStore, shouldShowBadge]);

  const isLoadingPartnerRequests =
    shouldShowBadge && isLoadingPartnerRequestsRaw;

  const pendingRequestsCount = requests.filter(
    (request) => request.requestStatus === "pending",
  ).length;

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

  const handleTabClick = (
    _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ): void => {
    const index = typeof tabIndex === "number" ? tabIndex : Number(tabIndex);

    switch (index) {
      case 0:
        void navigate(routes.assessments);
        break;
      case 1:
        void navigate(routes.environments);
        break;
      case 2:
        void navigate(routes.tools);
        break;
      case 3:
        void navigate(partnerTab?.path ?? routes.partners);
        break;
      default:
        void navigate(routes.assessments);
    }
  };

  return {
    activeTabKey,
    breadcrumbs,
    partnerTab,
    pendingRequestsCount,
    shouldShowBadge,
    isLoadingPartnerRequests,
    handleTabClick,
  };
};
