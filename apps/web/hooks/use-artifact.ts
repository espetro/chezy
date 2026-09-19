"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { UIArtifact } from "~/components/chat/artifact";

export const initialArtifactData: UIArtifact = {
  boundingBox: {
    height: 0,
    left: 0,
    top: 0,
    width: 0,
  },
  content: "",
  documentId: "init",
  isVisible: false,
  kind: "text",
  status: "idle",
  title: "",
};

type Selector<T> = (state: UIArtifact) => T;

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  // SWR requires an explicit null fetcher for cache-only reads.
  const { data: localArtifact } =
    // oxlint-disable-next-line unicorn/no-null
    useSWR<UIArtifact>("artifact", null, {
      fallbackData: initialArtifactData,
    });

  const selectedValue = useMemo(() => {
    if (!localArtifact) {
      return selector(initialArtifactData);
    }
    return selector(localArtifact);
  }, [localArtifact, selector]);

  return selectedValue;
}

export function useArtifact() {
  // SWR requires an explicit null fetcher for cache-only reads.
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    "artifact",
    // oxlint-disable-next-line unicorn/no-null
    null,
    {
      fallbackData: initialArtifactData,
    },
  );

  const artifact = useMemo(() => {
    if (!localArtifact) {
      return initialArtifactData;
    }
    return localArtifact;
  }, [localArtifact]);

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((currentArtifact) => {
        const artifactToUpdate = currentArtifact || initialArtifactData;

        if (typeof updaterFn === "function") {
          return updaterFn(artifactToUpdate);
        }

        return updaterFn;
      });
    },
    [setLocalArtifact],
  );

  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } = useSWR<any>(
    () => (artifact.documentId ? `artifact-metadata-${artifact.documentId}` : undefined),
    // SWR requires an explicit null fetcher for cache-only reads.
    // oxlint-disable-next-line unicorn/no-null
    null,
    {
      fallbackData: undefined,
    },
  );

  return useMemo(
    () => ({
      artifact,
      metadata: localArtifactMetadata,
      setArtifact,
      setMetadata: setLocalArtifactMetadata,
    }),
    [artifact, setArtifact, localArtifactMetadata, setLocalArtifactMetadata],
  );
}
