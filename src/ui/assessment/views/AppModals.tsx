import React from "react";

import { useModals } from "../view-models/ModalsContext";
import CreateRvtoolsAssessmentModal from "./create-rvtools/CreateRvtoolsAssessmentModal";
import CreateDiscoveryAssessmentModal from "../../environment/views/environment-modals/CreateDiscoveryAssessmentModal";
import { DiscoveryApplianceModal } from "../../environment/views/environment-modals";
import { useDiscoveryApplianceViewModel } from "../../environment/view-models/useDiscoveryApplianceViewModel";
import { useCreateRVToolsAssessmentViewModel } from "../view-models/useCreateRvtoolsAssessmentViewModel";

export const AppModals: React.FC = () => {
  const vm = useModals();
  const rvtoolsVm = useCreateRVToolsAssessmentViewModel();
  const discoveryApplianceVm = useDiscoveryApplianceViewModel();

  return (
    <>
      {vm.isCreateRVtoolAssessmentModalOpen && (
        <CreateRvtoolsAssessmentModal
          isOpen={vm.isCreateRVtoolAssessmentModalOpen}
          onClose={vm.closeCreateRVtoolAssessmentModal}
          onSubmit={rvtoolsVm.onSubmit}
          onClearError={rvtoolsVm.onClearError}
          isLoading={rvtoolsVm.isLoading}
          error={rvtoolsVm.error}
          fileResults={rvtoolsVm.files}
        />
      )}
      {/* {vm.isCreateApplianceAssessmentModalOpen && (
        <CreateDiscoveryAssessmentModal
          isOpen={vm.isCreateApplianceAssessmentModalOpen}
          onClose={vm.closeCreateApplianceAssessmentModal}
          sources={discoveryApplianceVm.sources}
          preselectedSourceId={vm.preselectedSourceId || undefined}
          onInventoryUploaded={() => {
            void discoveryApplianceVm.listSources();
          }}
        />
      )}*/}
      {vm.isCreateDiscoveryApplianceModalOpen && (
        <DiscoveryApplianceModal
          initialState={{ mode: "create" }}
          onCancel={vm.closeCreateApplianceAssessmentModal}
          onClose={vm.redirectToDiscoveryApplianceTab}
        />
      )}
    </>
  );
};

AppModals.displayName = "AppModals";

export default AppModals;
