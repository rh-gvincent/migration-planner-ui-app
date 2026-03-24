const assert = require("node:assert");
const webpack = require("webpack");
const dependencies = require("./package.json").dependencies;

assert(
  process.env.MIGRATION_PLANNER_API_BASE_URL,
  "MIGRATION_PLANNER_API_BASE_URL is required",
);

/** @type {import('@redhat-cloud-services/frontend-components-config').FecWebpackConfiguration} */
module.exports = {
  appUrl: "/openshift/migration-advisor-dev",
  debug: true,
  useProxy: true,
  proxyVerbose: true,
  sassPrefix: ".assisted-migration-app, .assistedMigrationApp",
  interceptChromeConfig: false,
  plugins: [
    new webpack.DefinePlugin({
      "process.env.MIGRATION_PLANNER_API_BASE_URL": JSON.stringify(
        process.env.MIGRATION_PLANNER_API_BASE_URL,
      ),
      "process.env.MIGRATION_PLANNER_COST_ESTIMATION_API_BASE_URL":
        JSON.stringify(
          process.env.MIGRATION_PLANNER_COST_ESTIMATION_API_BASE_URL,
        ),
      "process.env.MIGRATION_PLANNER_UI_GIT_COMMIT": JSON.stringify(
        process.env.MIGRATION_PLANNER_UI_GIT_COMMIT,
      ),
      "process.env.MIGRATION_PLANNER_UI_VERSION": JSON.stringify(
        process.env.MIGRATION_PLANNER_UI_VERSION,
      ),
      // Static mount-path prefix — consumed by src/routing/Routes.ts.
      // Must match appUrl in this file. In standalone (Vite) mode this is
      // defined as "" in dev/vite.config.ts.
      "process.env.MIGRATION_PLANNER_APP_BASENAME": JSON.stringify(
        "/openshift/migration-advisor-dev",
      ),
    }),
    // Prevent ENOSPC / EMFILE by excluding node_modules from webpack's
    // file-system watcher.  The FEC-generated config sets no watchOptions,
    // so without this patch watchpack opens OS-level watchers for every
    // file in node_modules (~150k files).
    {
      apply(compiler) {
        const ignored = /[\\/]node_modules[\\/]|[\\/]build-tools[\\/]/;
        const polling = process.env.WATCHPACK_POLLING;
        const patchWatchOptions = (c) => {
          c.options.watchOptions = {
            ...c.options.watchOptions,
            ignored,
            followSymlinks: false,
            ...(polling ? { poll: Number(polling) || 1000 } : {}),
          };
        };
        compiler.hooks.afterEnvironment.tap("ExcludeNodeModulesFromWatch", () =>
          patchWatchOptions(compiler),
        );
        if (Array.isArray(compiler.compilers)) {
          for (const child of compiler.compilers) {
            child.hooks.afterEnvironment.tap(
              "ExcludeNodeModulesFromWatch",
              () => patchWatchOptions(child),
            );
          }
        }
      },
    },
  ],
  hotReload: process.env.HOT === "true",
  moduleFederation: {
    exposes: {
      "./RootApp": "./src/MainApp",
    },
    exclude: ["react-router-dom"],
    shared: [
      {
        "react-router-dom": {
          singleton: true,
          import: false,
          version: dependencies["react-router-dom"],
        },
      },
    ],
  },
};
