import {
  Dropdown,
  DropdownItem,
  DropdownList,
  type DropdownProps,
  MenuToggle,
  type MenuToggleElement,
} from "@patternfly/react-core";
import React, { useState } from "react";
import { useModals } from "../../assessment/view-models/ModalsContext";

type CreateAssessmentDropdownProps = Omit<
  DropdownProps,
  | "isOpen"
  | "onOpenChange"
  | "toggle"
  | "shouldFocusToggleOnSelect"
  | "children"
>;

const CreateAssessmentDropdown: React.FC<CreateAssessmentDropdownProps> = ({
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    openCreateApplianceAssessmentModal,
    openCreateRVtoolAssessmentModal,
  } = useModals();

  return (
    <Dropdown
      {...props}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          variant="primary"
          onClick={() => setIsOpen((prev) => !prev)}
          isExpanded={isOpen}
        >
          Create assessment
        </MenuToggle>
      )}
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        <DropdownItem
          key="rvtools"
          component="button"
          onClick={() => {
            setIsOpen(false);
            openCreateRVtoolAssessmentModal();
          }}
        >
          From an RVTools file
        </DropdownItem>
        <DropdownItem
          key="agent"
          component="button"
          onClick={() => {
            setIsOpen(false);
            openCreateApplianceAssessmentModal();
          }}
        >
          From a discovery appliance
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

CreateAssessmentDropdown.displayName = "CreateAssessmentDropdown";

export default CreateAssessmentDropdown;
