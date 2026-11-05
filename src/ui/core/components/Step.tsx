import { Content } from "@patternfly/react-core";
import React from "react";

export type Step = {
  title: string;
  description: React.ReactNode;
};

export const StepList: React.FC<{ steps: Step[] }> = ({ steps }) => (
  <Content component="ol">
    {steps.map((step) => (
      <Content component="li" key={step.title}>
        <strong>{step.title}</strong>
        <Content component="p">{step.description}</Content>
      </Content>
    ))}
  </Content>
);
