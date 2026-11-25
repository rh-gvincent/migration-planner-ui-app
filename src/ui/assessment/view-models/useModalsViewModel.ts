import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../routing/Routes";

export interface ModalsViewModel {
  isCreateRVtoolAssessmentModalOpen: boolean;
  openCreateRVtoolAssessmentModal: () => void;
  closeCreateRVtoolAssessmentModal: () => void;

  isCreateDiscoveryApplianceModalOpen: boolean;
  openCreateDiscoveryApplianceModal: () => void;
  closeCreateDiscoveryApplianceModal: () => void;
  redirectToDiscoveryApplianceTab: () => void;

  isCreateApplianceAssessmentModalOpen: boolean;
  openCreateApplianceAssessmentModal: (sourceId?: string) => void;
  closeCreateApplianceAssessmentModal: () => void;
  preselectedSourceId?: string | null;
}

export const useModalsViewModel = (): ModalsViewModel => {
  const navigate = useNavigate();
  const [
    isCreateRVtoolAssessmentModalOpen,
    setIsCreateRVtoolAssessmentModalOpen,
  ] = useState(false);
  const [
    isCreateDiscoveryApplianceModalOpen,
    setIsCreateDiscoveryApplianceModalOpen,
  ] = useState(false);

  const [
    isCreateApplianceAssessmentModalOpen,
    setIsCreateApplianceAssessmentModalOpen,
  ] = useState(false);

  const [preselectedSourceId, setPreselectedSourceId] = useState<string | null>(
    null,
  );

  return {
    isCreateRVtoolAssessmentModalOpen,
    openCreateRVtoolAssessmentModal: () =>
      setIsCreateRVtoolAssessmentModalOpen(true),
    closeCreateRVtoolAssessmentModal: () =>
      setIsCreateRVtoolAssessmentModalOpen(false),

    isCreateDiscoveryApplianceModalOpen,
    openCreateDiscoveryApplianceModal: () =>
      setIsCreateDiscoveryApplianceModalOpen(true),
    closeCreateDiscoveryApplianceModal: () =>
      setIsCreateDiscoveryApplianceModalOpen(false),
    redirectToDiscoveryApplianceTab: () => navigate(routes.environments),

    isCreateApplianceAssessmentModalOpen,
    openCreateApplianceAssessmentModal: (sourceId) => {
      if (sourceId) {
        setPreselectedSourceId(sourceId);
      }
      return setIsCreateApplianceAssessmentModalOpen(true);
    },
    closeCreateApplianceAssessmentModal: () =>
      setIsCreateApplianceAssessmentModalOpen(false),
    preselectedSourceId,
  };
};
