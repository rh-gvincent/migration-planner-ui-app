import { useInjection } from "@openshift-migration-advisor/ioc";
import { useState, useSyncExternalStore } from "react";
import { Symbols } from "../../../config/Dependencies";

import type { ISourcesStore } from "../../../data/stores/interfaces/ISourcesStore";
import type { SourceModel } from "../../../models/SourceModel";
import { useAsyncFn } from "react-use";

export interface DiscoveryApplianceViewModel {
  sources: SourceModel[];
  listSources: () => Promise<SourceModel[]>;
  isLoadingSources: boolean;
  errorLoadingSources?: Error;
  hasInitialLoad: boolean;
}

export const useDiscoveryApplianceViewModel =
  (): DiscoveryApplianceViewModel => {
    const sourcesStore = useInjection<ISourcesStore>(Symbols.SourcesStore);

    const sources =
      useSyncExternalStore(
        sourcesStore.subscribe.bind(sourcesStore),
        sourcesStore.getSnapshot.bind(sourcesStore),
      ) ?? [];

    const [hasInitialLoad, setHasInitialLoad] = useState(false);

    const [listSourcesState, doListSources] = useAsyncFn(
      async () => {
        try {
          return await sourcesStore.list();
        } finally {
          setHasInitialLoad(true);
        }
      },
      [sourcesStore],
      { loading: true },
    );

    return {
      sources,
      listSources: doListSources,
      isLoadingSources: listSourcesState.loading,
      errorLoadingSources: listSourcesState.error,
      hasInitialLoad,
    };
  };
