import React, {
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";

import { type ModalsViewModel, useModalsViewModel } from "./useModalsViewModel";
import AppModals from "../views/AppModals";

const ModalsContext = createContext<ModalsViewModel | null>(null);

export const ModalsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const model = useModalsViewModel();

  return (
    <ModalsContext.Provider value={model}>
      {children}
      <AppModals />
    </ModalsContext.Provider>
  );
};

export const useModals = (): ModalsViewModel => {
  const context = useContext(ModalsContext);

  if (!context) {
    throw new Error(
      "useCreateAssessment() must be used within <CreateAssessmentProvider>",
    );
  }

  return context;
};
