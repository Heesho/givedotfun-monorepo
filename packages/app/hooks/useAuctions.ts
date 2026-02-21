import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress, formatUnits } from "viem";
import {
  MULTICALL_ABI,
  getMulticallAddress,
  QUOTE_TOKEN_DECIMALS,
  type AuctionState,
} from "@/lib/contracts";
import { useRigList } from "./useAllRigs";
import { useFarcaster } from "./useFarcaster";
import type { SubgraphUnitListItem } from "@/lib/subgraph-launchpad";

export type AuctionItem = {
  rigAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  rigUri: string;
  // Auction state
  lpPrice: bigint; // Current LP cost (18 dec)
  quoteAccumulated: bigint; // USDC in auction (6 dec)
  lpTokenPrice: bigint; // LP value in USDC (18 dec)
  epochId: bigint;
  // Derived display values
  lpCostUsd: number; // LP cost in USD-ish
  rewardUsd: number; // USDC reward as number
  profit: number; // reward - cost
  isProfitable: boolean;
  isActive: boolean; // Has USDC and price > 0
};

type IndexedRig = {
  rigAddress: `0x${string}`;
  unit: SubgraphUnitListItem;
};

export function useAuctions() {
  const { units: allUnits, isLoading: isLoadingList } = useRigList("top", 100);
  const { address: account } = useFarcaster();

  // Build flat contract call array — all rigs use fundraiser multicall
  const { contracts, indexToRig } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractCalls: any[] = [];
    const mapping: IndexedRig[] = [];

    for (const u of allUnits) {
      if (!u.rig?.uri?.startsWith("ipfs://")) continue;
      const rigAddr = u.rig.id.toLowerCase() as `0x${string}`;
      const multicall = getMulticallAddress();

      contractCalls.push({
        address: multicall,
        abi: MULTICALL_ABI,
        functionName: "getAuction" as const,
        args: [rigAddr, account ?? zeroAddress] as const,
        chainId: base.id,
      });
      mapping.push({ rigAddress: rigAddr, unit: u });
    }

    return { contracts: contractCalls, indexToRig: mapping };
  }, [allUnits, account]);

  const { data: states, isLoading: isLoadingStates } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 30_000,
      refetchOnWindowFocus: false,
    },
  });

  const auctions: AuctionItem[] = useMemo(() => {
    if (!states) return [];

    return states
      .map((result, index) => {
        if (result.status !== "success" || !result.result) return null;
        const state = result.result as AuctionState;

        const { rigAddress, unit } = indexToRig[index];

        // Calculate profit/loss
        const lpCostInQuote = (state.price * state.lpTokenPrice) / BigInt(1e18);
        const lpCostScaled = lpCostInQuote / BigInt(1e12); // normalize to 6 decimals

        const rewardUsd = Number(formatUnits(state.quoteAccumulated, QUOTE_TOKEN_DECIMALS));
        const lpCostUsd = Number(formatUnits(lpCostScaled, QUOTE_TOKEN_DECIMALS));
        const profit = rewardUsd - lpCostUsd;

        const isActive = state.quoteAccumulated > 0n && state.price > 0n;

        return {
          rigAddress,
          tokenName: unit.name,
          tokenSymbol: unit.symbol,
          rigUri: unit.rig.uri,
          lpPrice: state.price,
          quoteAccumulated: state.quoteAccumulated,
          lpTokenPrice: state.lpTokenPrice,
          epochId: state.epochId,
          lpCostUsd,
          rewardUsd,
          profit,
          isProfitable: profit > 0,
          isActive,
        };
      })
      .filter((item): item is AuctionItem => item !== null && item.isActive)
      .sort((a, b) => b.profit - a.profit); // Most profitable first
  }, [states, indexToRig]);

  return {
    auctions,
    isLoading: isLoadingList || isLoadingStates,
  };
}
