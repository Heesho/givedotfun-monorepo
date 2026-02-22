"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipfsToHttp } from "@/lib/constants";

export type TokenMetadata = {
  image?: string;
  description?: string;
  defaultMessage?: string;
  recipientName?: string;
  links?: string[];
  // Legacy format support
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
};

const METADATA_STALE_TIME = 30 * 60 * 1000; // 30 minutes - metadata rarely changes

/**
 * Fetch and cache token metadata from IPFS
 * Uses React Query for caching and deduplication
 */
async function fetchMetadata(fundraiserUri: string): Promise<TokenMetadata | null> {
  if (!fundraiserUri || fundraiserUri === "") return null;

  const metadataUrl = ipfsToHttp(fundraiserUri);
  if (!metadataUrl || metadataUrl === "") return null;

  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Hook for fetching token metadata with caching
 */
export function useTokenMetadata(fundraiserUri: string | undefined) {
  const validUri = fundraiserUri && fundraiserUri.length > 0 && fundraiserUri.startsWith("ipfs://");

  const { data: metadata, isLoading } = useQuery({
    queryKey: ["tokenMetadata", fundraiserUri],
    queryFn: () => fetchMetadata(fundraiserUri!),
    enabled: !!validUri,
    staleTime: METADATA_STALE_TIME,
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
  });

  const logoUrl = metadata?.image ? ipfsToHttp(metadata.image) : null;

  return {
    metadata,
    logoUrl,
    isLoading: validUri ? isLoading : false,
  };
}

/**
 * Hook to prefetch metadata for multiple fundraisers at once
 * Call this when you have a list of fundraisers to prefetch their metadata
 */
export function usePrefetchMetadata() {
  const queryClient = useQueryClient();

  // Memoize the prefetch function to prevent useEffect loops
  const prefetch = useCallback((fundraiserUris: string[]) => {
    const uniqueUris = [...new Set(fundraiserUris.filter((uri) => uri && uri.startsWith("ipfs://")))];

    uniqueUris.forEach((fundraiserUri) => {
      queryClient.prefetchQuery({
        queryKey: ["tokenMetadata", fundraiserUri],
        queryFn: () => fetchMetadata(fundraiserUri),
        staleTime: METADATA_STALE_TIME,
      });
    });
  }, [queryClient]);

  return prefetch;
}

/**
 * Batch fetch metadata for multiple fundraisers
 * Returns a map of fundraiserUri -> metadata
 */
export function useBatchMetadata(fundraiserUris: string[]) {
  const uniqueUris = [...new Set(fundraiserUris.filter(Boolean))];

  const { data: metadataMap, isLoading } = useQuery({
    queryKey: ["batchMetadata", uniqueUris.sort().join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        uniqueUris.map(async (uri) => {
          const metadata = await fetchMetadata(uri);
          return [uri, metadata] as const;
        })
      );
      return Object.fromEntries(results) as Record<string, TokenMetadata | null>;
    },
    enabled: uniqueUris.length > 0,
    staleTime: METADATA_STALE_TIME,
    gcTime: 60 * 60 * 1000,
  });

  return {
    metadataMap: metadataMap ?? {},
    isLoading,
    getLogoUrl: (fundraiserUri: string) => {
      const metadata = metadataMap?.[fundraiserUri];
      return metadata?.image ? ipfsToHttp(metadata.image) : null;
    },
  };
}
