import type { InfoApiInterface } from "@openshift-migration-advisor/planner-sdk";

import { ExternalStoreBase } from "../../lib/mvvm/ExternalStore";
import type { VersionInfo } from "../../models/VersionInfo";
import type { IVersionsStore } from "./interfaces/IVersionsStore";

export const UI_NAME = "migration-advisor-dev-app";
export const API_NAME = "migration-planner";

interface AppInfo {
  app_name: string;
  node_version: string;
  src_hash: string;
  src_tag: string;
  src_branch: string;
  app_version: string;
  patternfly_dependencies: string;
  rh_cloud_services_dependencies: string;
}

export class VersionsStore
  extends ExternalStoreBase<VersionInfo>
  implements IVersionsStore
{
  private infoApi: InfoApiInterface;
  private state: VersionInfo = {
    ui: {
      name: UI_NAME,
      versionName: process.env.MIGRATION_PLANNER_UI_VERSION || "unknown",
      gitCommit: process.env.MIGRATION_PLANNER_UI_GIT_COMMIT || "unknown",
    },
    api: {
      name: API_NAME,
      versionName: "unknown",
      gitCommit: "unknown",
    },
    agent: {
      versionName: null,
      gitCommit: null,
    },
  };

  constructor(infoApi: InfoApiInterface) {
    super();
    this.infoApi = infoApi;
  }

  async getUiVersionInfo(signal?: AbortSignal): Promise<VersionInfo> {
    let versionName = "";
    let gitCommit = "";

    try {
      const response = await fetch(`/apps/${UI_NAME}/app.info.json`, {
        signal,
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (isAppInfo(payload)) {
          versionName = payload.app_version;
          gitCommit = payload.src_hash;
        } else {
          console.log("Invalid app.info.json payload, using fallback");
        }
      } else {
        console.log("app.info.json not available, using fallback");
      }
    } catch {
      console.log("Failed to fetch app.info.json, using fallback");
    }

    this.state.ui.versionName =
      versionName || process.env.MIGRATION_PLANNER_UI_VERSION || "unknown";
    this.state.ui.gitCommit =
      gitCommit || process.env.MIGRATION_PLANNER_UI_GIT_COMMIT || "unknown";
    this.notify();
    return this.getSnapshot();
  }

  async getApiVersionInfo(signal?: AbortSignal): Promise<VersionInfo> {
    const info = await this.infoApi.getInfo({ signal });
    this.state.api.versionName = info.versionName ?? "unknown";
    this.state.api.gitCommit = info.gitCommit ?? "unknown";
    this.state.agent.versionName = info.agentVersionName ?? null;
    this.state.agent.gitCommit = info.agentGitCommit ?? null;
    this.notify();
    return this.getSnapshot();
  }

  override getSnapshot(): VersionInfo {
    return this.state;
  }
}

function isAppInfo(value: unknown): value is AppInfo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.app_version === "string" && typeof v.src_hash === "string";
}
