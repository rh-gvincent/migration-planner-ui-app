import {
  ChartExportProvider,
  useChartExport,
} from "@openshift-migration-advisor/shared-components";
import {
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  Bullseye,
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  List,
  ListItem,
  Spinner,
  Stack,
  StackItem,
  Tab,
  TabContent,
  TabContentBody,
  Tabs,
  TabTitleText,
  Tooltip,
} from "@patternfly/react-core";
import { RhUiAddCircleIcon } from "@patternfly/react-icons";
import React from "react";
import { Link } from "react-router-dom";

import { themeTooltipFlyoutProps } from "../../../lib/patternfly/flyoutAppendTo";
import { routes } from "../../../routing/Routes";
import { AppPage } from "../../core/components/AppPage";
import { HOME_TAB_LABELS } from "../../home/constants";
import { fromGroupOptionId } from "../helpers/groupViewModel";
import { useReportPageViewModel } from "../view-models/useReportPageViewModel";
import { Dashboard } from "./assessment-report/Dashboard";
import { ReportFilterBar } from "./assessment-report/ReportFilterBar";
import { ReportSourceStatus } from "./assessment-report/ReportSourceStatus";
import { DeployOvaBanner } from "./DeployOvaBanner";
import { ExportReportButton } from "./ExportReportButton";
import { ManualEnvironmentDetailsPanel } from "./manual-environment/ManualEnvironmentDetailsPanel";
import { MigrationRecommendations } from "./migration-recommendations/MigrationRecommendations";
import { MANUAL_ENVIRONMENT_DETAILS_TAB } from "./migration-recommendations/types";
import { RvtoolsUploadWarning } from "./rvtools/RvtoolsUploadWarning";

const ReportContent: React.FC = () => {
  const vm = useReportPageViewModel();
  const charts = useChartExport();
  const {
    rvtoolsAppendSuccessMessage,
    dismissRvtoolsAppendSuccess,
    rvtoolsAppendNotice,
    dismissRvtoolsAppendNotice,
  } = vm;

  const showRvtoolsAppendToast =
    Boolean(rvtoolsAppendSuccessMessage) || Boolean(rvtoolsAppendNotice);

  if (vm.isInitialLoading) {
    return (
      <Bullseye>
        <Spinner size="lg" />
      </Bullseye>
    );
  }

  if (!vm.assessment) {
    return (
      <AppPage
        breadcrumbs={[
          {
            key: 1,
            children: "Migration advisor",
          },
          {
            key: 2,
            to: routes.assessments,
            children: HOME_TAB_LABELS.assessments,
          },
          { key: 3, children: "Assessment not found", isActive: true },
        ]}
        title="Assessment details"
      >
        <Stack hasGutter>
          <StackItem>
            <Content component={ContentVariants.p}>
              The requested assessment was not found.
            </Content>
          </StackItem>
          <StackItem>
            <Link to={routes.assessments}>
              <Button variant="primary">Back to assessments</Button>
            </Link>
          </StackItem>
        </Stack>
      </AppPage>
    );
  }

  const handleClusterSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ): void => {
    if (typeof value === "string") {
      vm.selectCluster(value);
    }
    vm.setClusterSelectOpen(false);
  };

  const exportUnavailableTooltip = vm.clusterView.isAggregateView
    ? "Export is unavailable because this assessment has no VMs with host inventory."
    : "Export is unavailable because this cluster has no VMs.";

  const hasTopPageAlerts =
    Boolean(vm.vcenterInventoryLoadError) ||
    Boolean(vm.clusterInventoryLoadError) ||
    Boolean(charts?.exportError);

  return (
    <>
      {showRvtoolsAppendToast ? (
        <AlertGroup
          isToast
          isLiveRegion
          aria-label="RVTools file upload notifications"
        >
          {rvtoolsAppendSuccessMessage ? (
            <Alert
              variant="success"
              title={rvtoolsAppendSuccessMessage}
              timeout={6000}
              onTimeout={dismissRvtoolsAppendSuccess}
              actionClose={
                <AlertActionCloseButton onClose={dismissRvtoolsAppendSuccess} />
              }
            />
          ) : null}
          {rvtoolsAppendNotice ? (
            <Alert
              variant={rvtoolsAppendNotice.variant}
              title={rvtoolsAppendNotice.message}
              timeout={8000}
              onTimeout={dismissRvtoolsAppendNotice}
              actionClose={
                <AlertActionCloseButton onClose={dismissRvtoolsAppendNotice} />
              }
            />
          ) : null}
        </AlertGroup>
      ) : null}
      <AppPage
        breadcrumbs={[
          {
            key: 1,
            children: "Migration advisor",
          },
          {
            key: 2,
            to: routes.assessments,
            children: HOME_TAB_LABELS.assessments,
          },
          {
            key: 3,
            children: `${vm.assessment.name || `Assessment ${vm.assessmentId}`} - vCenter report`,
            isActive: true,
          },
        ]}
        title={`${vm.assessment.name || `Assessment ${vm.assessmentId}`} - vCenter report`}
        caption={
          <Stack>
            <StackItem>
              <ReportSourceStatus
                sourceType={vm.assessment.sourceType}
                displayStatus={vm.source?.displayStatus}
                isReady={vm.source?.isReady}
                agent={vm.source?.agent}
                onPremises={vm.source?.onPremises}
                hasInventory={vm.source?.inventory !== undefined}
                updatedAt={vm.source?.updatedAt}
              />
            </StackItem>
            <StackItem>
              <p>
                Presenting the information we were able to fetch from the
                discovery process
              </p>
            </StackItem>
            <StackItem>
              <p>
                <strong>Data collected on:</strong> {vm.dataCollectedText}
              </p>
            </StackItem>
            <StackItem>
              <p>
                <strong>Imported to console:</strong> {vm.importedToConsoleText}
              </p>
            </StackItem>
            <StackItem>
              {vm.inventoryScopeSummary ? (
                <>
                  Inventory: <strong>{vm.inventoryScopeSummary}</strong>
                </>
              ) : (
                "No vSphere clusters detected"
              )}
            </StackItem>
          </Stack>
        }
        alerts={
          hasTopPageAlerts ? (
            <Stack hasGutter>
              {vm.vcenterInventoryLoadError ? (
                <StackItem>
                  <Alert
                    variant="danger"
                    isInline
                    title="Could not load vCenter data"
                  >
                    {vm.vcenterInventoryLoadError.message}
                  </Alert>
                </StackItem>
              ) : null}
              {vm.clusterInventoryLoadError ? (
                <StackItem>
                  <Alert
                    variant="danger"
                    isInline
                    title="Could not load cluster data"
                  >
                    {vm.clusterInventoryLoadError.message}
                  </Alert>
                </StackItem>
              ) : null}
              {charts?.exportError ? (
                <StackItem>
                  <Alert
                    variant="danger"
                    isInline
                    title="Export failed"
                    actionClose={
                      <AlertActionCloseButton
                        onClose={charts.clearExportError}
                      />
                    }
                  >
                    <p>{charts.exportError}</p>
                  </Alert>
                </StackItem>
              ) : null}
            </Stack>
          ) : undefined
        }
        headerActions={
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            gap={{ default: "gapSm" }}
          >
            {vm.canAppendRvtoolsFiles && (
              <FlexItem>
                <Button
                  variant="primary"
                  icon={<RhUiAddCircleIcon />}
                  onClick={vm.openAppendRvtoolsModal}
                >
                  Add RVTools files
                </Button>
              </FlexItem>
            )}
            <FlexItem>
              {vm.canExportReport ? (
                <ExportReportButton
                  documentTitle={vm.exportDocumentTitle}
                  pdfExtraPages={vm.pdfExtraPages}
                />
              ) : (
                <Tooltip
                  {...themeTooltipFlyoutProps}
                  content={<p>{exportUnavailableTooltip}</p>}
                >
                  <ExportReportButton
                    documentTitle={vm.exportDocumentTitle}
                    pdfExtraPages={vm.pdfExtraPages}
                    isDisabled
                  />
                </Tooltip>
              )}
            </FlexItem>
          </Flex>
        }
      >
        {(vm.assessment.sourceType === "rvtools" &&
          vm.rvtoolsPendingUploadBatches.length > 0) ||
        vm.hasMissingMetrics ? (
          <Stack hasGutter>
            {vm.assessment.sourceType === "rvtools"
              ? vm.rvtoolsPendingUploadBatches.map((batch) => (
                  <StackItem key={batch.id}>
                    <RvtoolsUploadWarning
                      batch={batch}
                      failures={batch.failures}
                      isDismissed={vm.isRvtoolsUploadWarningDismissed(batch.id)}
                      onDismiss={() => vm.dismissRvtoolsUploadWarning(batch.id)}
                      canAddMoreRvtoolsFiles={
                        vm.canAppendRvtoolsFiles &&
                        vm.rvtoolsRemainingFileSlots > 0
                      }
                      onAddRvtoolsFiles={vm.openAppendRvtoolsFromErrorReview}
                    />
                  </StackItem>
                ))
              : null}
            {vm.hasMissingMetrics ? (
              <StackItem>
                <Alert
                  variant="warning"
                  isInline
                  title="Limited recommendation: required metrics are missing."
                >
                  <Stack hasGutter>
                    <StackItem>
                      <p>
                        Add the following to improve accuracy and create a new
                        assessment:
                      </p>
                      <List>
                        {vm.missingMetrics.map((metric) => (
                          <ListItem key={metric}>{metric}</ListItem>
                        ))}
                      </List>
                    </StackItem>
                    <StackItem>
                      <Link to={routes.assessments}>Go to assessments</Link>
                    </StackItem>
                  </Stack>
                </Alert>
              </StackItem>
            ) : null}
          </Stack>
        ) : null}
        {vm.assessment.sourceType === "rvtools" && <DeployOvaBanner />}

        <Tabs
          activeKey={vm.activeReportTab}
          onSelect={(_event, tabIndex) => {
            if (
              tabIndex === "report" ||
              tabIndex === "recommendations" ||
              tabIndex === MANUAL_ENVIRONMENT_DETAILS_TAB
            ) {
              vm.setActiveReportTab(tabIndex);
            }
          }}
          aria-label="Assessment report sections"
        >
          <Tab
            eventKey="report"
            title={<TabTitleText>Migration report</TabTitleText>}
            tabContentId="assessment-report-panel"
          />
          <Tab
            eventKey={MANUAL_ENVIRONMENT_DETAILS_TAB}
            title={<TabTitleText>Manual environment details</TabTitleText>}
            tabContentId="assessment-manual-environment-panel"
          />
          <Tab
            eventKey="recommendations"
            title={<TabTitleText>Migration recommendations</TabTitleText>}
            tabContentId="assessment-recommendations-panel"
          />
        </Tabs>

        <TabContent
          eventKey="report"
          id="assessment-report-panel"
          activeKey={vm.activeReportTab}
          hidden={vm.activeReportTab !== "report"}
          aria-label="Migration report"
        >
          <TabContentBody>
            <Stack hasGutter>
              <StackItem>
                <ReportFilterBar
                  clusterView={vm.clusterView}
                  clusterSelectDisabled={vm.clusterSelectDisabled}
                  isClusterSelectOpen={vm.isClusterSelectOpen}
                  onClusterSelectOpenChange={vm.setClusterSelectOpen}
                  onClusterSelect={handleClusterSelect}
                  viewingGroupView={vm.viewingGroupView}
                  isViewingGroupSelectOpen={vm.isGroupSelectOpen}
                  onViewingGroupSelectOpenChange={vm.setGroupSelectOpen}
                  onViewingGroupSelect={(_event, value) => {
                    if (typeof value === "string") {
                      vm.selectGroup(fromGroupOptionId(value));
                    }
                  }}
                  vcenterView={vm.vcenterFilterView}
                  isVcenterSelectOpen={vm.isVcenterSelectOpen}
                  onVcenterSelectOpenChange={vm.setVcenterSelectOpen}
                  onVcenterSelect={(_event, value) => {
                    if (typeof value === "string") {
                      vm.selectVcenterScope(fromGroupOptionId(value));
                    }
                  }}
                  viewingScopeSummary={vm.viewingScopeSummary}
                />
              </StackItem>
              <StackItem>
                {vm.isReportInventoryLoading && !vm.scopedClusterView ? (
                  <Bullseye>
                    <Spinner size="lg" />
                  </Bullseye>
                ) : vm.scopedClusterView ? (
                  <Dashboard
                    infra={vm.scopedClusterView.viewInfra}
                    vms={vm.scopedClusterView.viewVms}
                    cpuCores={vm.scopedClusterView.cpuCores}
                    ramGB={vm.scopedClusterView.ramGB}
                    clusters={vm.scopedClusterView.viewClusters}
                    isAggregateView={vm.scopedClusterView.isAggregateView}
                    clusterFound={vm.scopedClusterView.clusterFound}
                    vcenterVersion={vm.vcenterVersion}
                    vcenterId={vm.vcenterId}
                  />
                ) : (
                  <Bullseye>
                    <Content component={ContentVariants.p}>
                      {vm.clusterView.isAggregateView
                        ? "This assessment does not have report data yet."
                        : "No data is available for the selected cluster."}
                    </Content>
                  </Bullseye>
                )}
              </StackItem>
            </Stack>
          </TabContentBody>
        </TabContent>
        <TabContent
          eventKey={MANUAL_ENVIRONMENT_DETAILS_TAB}
          id="assessment-manual-environment-panel"
          activeKey={vm.activeReportTab}
          hidden={vm.activeReportTab !== MANUAL_ENVIRONMENT_DETAILS_TAB}
          aria-label="Manual environment details"
        >
          <TabContentBody>
            <ManualEnvironmentDetailsPanel />
          </TabContentBody>
        </TabContent>
        <TabContent
          eventKey="recommendations"
          id="assessment-recommendations-panel"
          activeKey={vm.activeReportTab}
          hidden={vm.activeReportTab !== "recommendations"}
          aria-label="Migration recommendations"
        >
          <TabContentBody>
            <MigrationRecommendations
              selectedTool={vm.selectedRecommendationTool}
              onSelectTool={vm.openRecommendationTool}
              onBack={vm.closeRecommendationTool}
              isAggregateView={vm.clusterView.isAggregateView}
              areToolsDisabled={!vm.canUseRecommendationTools}
              canOpenArchitecture={vm.canShowClusterRecommendations}
              isPartner={vm.isPartner}
              clusterName={vm.clusterView.selectionLabel}
              clusterId={vm.selectedClusterId}
              assessmentId={vm.assessmentId || ""}
              onCalculated={(result, formValues) => {
                vm.onSizingCalculated({
                  result,
                  formValues,
                  clusterName: vm.clusterView.selectionLabel,
                  clusterId: vm.selectedClusterId,
                });
              }}
            />
          </TabContentBody>
        </TabContent>
      </AppPage>
    </>
  );
};

const Report: React.FC = () => (
  <ChartExportProvider>
    <ReportContent />
  </ChartExportProvider>
);

Report.displayName = "Report";

export default Report;
