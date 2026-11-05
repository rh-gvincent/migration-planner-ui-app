import { yupResolver } from "@hookform/resolvers/yup";
import {
  CheckboxFormGroup,
  RadioButtonFormGroup,
  TextAreaFormGroup,
  TextInputFormGroup,
} from "@openshift-migration-advisor/shared-components";
import { Alert, Form, FormAlert, FormGroup } from "@patternfly/react-core";
import React, { useEffect } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import * as yup from "yup";

import { validateSshKey } from "../../helpers/sshKey";
import {
  validateHttpProxy,
  validateHttpsProxy,
  validateIpAddress,
  validateNoProxy,
  validateSubnetMask,
} from "../../helpers/validation";
import {
  ApplianceVersionSection,
  type ApplianceVersionSectionProps,
} from "./ApplianceVersionSection";

export interface EnvironmentFormValues {
  environmentName: string;
  sshKey: string;
  enableProxy: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  networkConfigType: "dhcp" | "static";
  ipAddress: string;
  subnetMask: string;
  defaultGateway: string;
  dns: string;
}

export interface EnvironmentFormProps {
  id: string;
  formValues?: EnvironmentFormValues;
  onSubmit: (data: EnvironmentFormValues) => void;
  setIsValid?: (isValid: boolean) => void;
  hasError?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  applianceVersion?: ApplianceVersionSectionProps;
}

const createBaseValidationSchema = () =>
  yup.object().shape({
    environmentName: yup
      .string()
      .trim()
      .required("Environment name is required")
      .matches(
        /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        "Must start with a letter and contain only letters, numbers, underscores, and hyphens",
      )
      .max(50, "Must be 50 characters or less"),

    sshKey: yup
      .string()
      .trim()
      .default("")
      .test(
        "valid-ssh-key",
        "Invalid SSH key format. Please provide a valid SSH public key.",
        (value) => {
          if (!value) return true;
          return validateSshKey(value) === null;
        },
      ),

    enableProxy: yup.boolean().default(false),

    httpProxy: yup
      .string()
      .trim()
      .default("")
      .when("enableProxy", {
        is: true,
        then: (schema) =>
          schema.test("valid-http-proxy", function (value) {
            if (!value) return true;
            const error = validateHttpProxy(value);
            return error === null ? true : this.createError({ message: error });
          }),
      }),

    httpsProxy: yup
      .string()
      .trim()
      .default("")
      .when("enableProxy", {
        is: true,
        then: (schema) =>
          schema.test("valid-https-proxy", function (value) {
            if (!value) return true;
            const error = validateHttpsProxy(value);
            return error === null ? true : this.createError({ message: error });
          }),
      }),

    noProxy: yup
      .string()
      .trim()
      .default("")
      .test("valid-no-proxy", function (value) {
        if (!value) return true;
        const error = validateNoProxy(value);
        return error === null ? true : this.createError({ message: error });
      })
      .when(["httpProxy", "httpsProxy"], {
        is: (httpProxy: string, httpsProxy: string) => {
          return !httpProxy?.trim() && !httpsProxy?.trim();
        },
        then: (schema) =>
          schema.test("requires-proxy-url", function (value) {
            if (!value?.trim()) return true;
            return this.createError({
              message:
                "No proxy domains requires at least one proxy URL (HTTP or HTTPS)",
            });
          }),
      }),

    networkConfigType: yup
      .string()
      .oneOf(["dhcp", "static"] as const)
      .default("dhcp"),

    ipAddress: yup
      .string()
      .trim()
      .default("")
      .when("networkConfigType", {
        is: "static",
        then: (schema) =>
          schema
            .required("IP address is required for static configuration")
            .test("valid-ip", function (value) {
              const error = validateIpAddress(value || "");
              return error === null
                ? true
                : this.createError({ message: error });
            }),
      }),

    subnetMask: yup
      .string()
      .trim()
      .default("")
      .when("networkConfigType", {
        is: "static",
        then: (schema) =>
          schema
            .required("Subnet mask is required for static configuration")
            .test("valid-subnet", function (value) {
              const error = validateSubnetMask(value || "");
              return error === null
                ? true
                : this.createError({ message: error });
            }),
      }),

    defaultGateway: yup
      .string()
      .trim()
      .default("")
      .when("networkConfigType", {
        is: "static",
        then: (schema) =>
          schema
            .required("Default gateway is required for static configuration")
            .test("valid-gateway", function (value) {
              const error = validateIpAddress(value || "");
              return error === null
                ? true
                : this.createError({ message: error });
            }),
      }),

    dns: yup
      .string()
      .trim()
      .default("")
      .when("networkConfigType", {
        is: "static",
        then: (schema) =>
          schema
            .required("DNS server is required for static configuration")
            .test("valid-dns", function (value) {
              const error = validateIpAddress(value || "");
              return error === null
                ? true
                : this.createError({ message: error });
            }),
      }),
  });

export const EnvironmentForm: React.FC<EnvironmentFormProps> = ({
  id,
  formValues,
  onSubmit,
  setIsValid,
  hasError,
  errorTitle,
  errorMessage,
  applianceVersion,
}) => {
  const methods = useForm<EnvironmentFormValues>({
    resolver: yupResolver(createBaseValidationSchema()),
    mode: "onTouched",
    defaultValues: formValues || {
      environmentName: "",
      sshKey: "",
      enableProxy: false,
      httpProxy: "",
      httpsProxy: "",
      noProxy: "",
      networkConfigType: "dhcp",
      ipAddress: "",
      subnetMask: "",
      defaultGateway: "",
      dns: "",
    },
  });

  const enableProxy = useWatch({
    control: methods.control,
    name: "enableProxy",
  });
  const networkConfigType = useWatch({
    control: methods.control,
    name: "networkConfigType",
  });
  const httpProxy = useWatch({
    control: methods.control,
    name: "httpProxy",
  });
  const httpsProxy = useWatch({
    control: methods.control,
    name: "httpsProxy",
  });

  useEffect(() => {
    setIsValid?.(methods.formState.isValid);
  }, [methods.formState.isValid, setIsValid]);

  useEffect(() => {
    if (methods.formState.touchedFields.noProxy) {
      void methods.trigger("noProxy");
    }
  }, [httpProxy, httpsProxy, methods]);

  return (
    <FormProvider {...methods}>
      <Form
        noValidate
        id={id}
        onSubmit={(e) => {
          void methods.handleSubmit(onSubmit)(e);
        }}
      >
        <TextInputFormGroup
          id="environmentName"
          name="environmentName"
          label="Discovery appliance name"
          placeholder="Example: ams-vcenter-prod-1"
          isRequired
          isDisabled={!!formValues}
        />

        <TextAreaFormGroup
          id="sshKey"
          name="sshKey"
          label="SSH Key"
          placeholder="Example: ssh-rsa AAAAB3NzaC1yc2E..."
          helpText="Paste the content of a public SSH key you want to use to connect to the discovery appliance."
        />

        <CheckboxFormGroup
          id="enableProxy"
          name="enableProxy"
          label="Enable proxy"
        />

        {enableProxy && (
          <>
            <TextInputFormGroup
              id="httpProxy"
              name="httpProxy"
              label="HTTP proxy URL"
              placeholder="http://proxy.example.com:8080"
              helpText="URL must start with http://"
            />

            <TextInputFormGroup
              id="httpsProxy"
              name="httpsProxy"
              label="HTTPS proxy URL"
              placeholder="https://proxy.example.com:8443"
              helpText="URL must start with https://"
            />

            <TextInputFormGroup
              id="noProxy"
              name="noProxy"
              label="No proxy domains"
              placeholder="one.domain.com,second.domain.com"
              helpText="Use a comma to separate each listed domain. Preface a domain with &ldquo;.&rdquo; to include its subdomains. Use &ldquo;*&rdquo; to bypass the proxy for all destinations."
            />
          </>
        )}

        <RadioButtonFormGroup
          id="networkConfigType"
          name="networkConfigType"
          label="Network configuration"
          options={[
            { value: "dhcp", label: "DHCP", id: "dhcp-radio" },
            {
              value: "static",
              label: "Static IP configuration",
              id: "static-ip-radio",
            },
          ]}
        />

        {networkConfigType === "static" && (
          <>
            <TextInputFormGroup
              id="ipAddress"
              name="ipAddress"
              label="IP address"
              placeholder="10.0.0.2"
              isRequired
            />

            <TextInputFormGroup
              id="subnetMask"
              name="subnetMask"
              label="Subnet mask"
              placeholder="24"
              isRequired
            />

            <TextInputFormGroup
              id="defaultGateway"
              name="defaultGateway"
              label="Default gateway"
              placeholder="10.0.0.1"
              isRequired
            />

            <TextInputFormGroup
              id="dns"
              name="dns"
              label="DNS"
              placeholder="10.0.0.1"
              isRequired
            />
          </>
        )}
        {applianceVersion && (
          <FormGroup label="Appliance version" fieldId="appliance-version">
            <ApplianceVersionSection {...applianceVersion} />
          </FormGroup>
        )}
        {hasError && (
          <FormAlert>
            <Alert isInline variant="danger" title={errorTitle}>
              {errorMessage}
            </Alert>
          </FormAlert>
        )}
      </Form>
    </FormProvider>
  );
};
