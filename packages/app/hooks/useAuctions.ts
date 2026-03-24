import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress, formatUnits } from "viem";
import {
  MULTICALL_ABI,
  CONTRACT_ADDRESSES,
  QUOTE_TOKEN_DECIMALS,
  type AuctionState,
} from "@/lib/contracts";
import { ipfsToHttp } from "@/lib/constants";
import { useCoinList } from "./useAllFundraisers";
import { useFarcaster } from "./useFarcaster";
import type { SubgraphCoinListItem } from "@/lib/subgraph-launchpad";

export type AuctionItem = {
  fundraiserAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  logoUrl: string | null;
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

type IndexedFundraiser = {
  fundraiserAddress: `0x${string}`;
  coin: SubgraphCoinListItem;
};

export function useAuctions() {
  const { coins: allCoins, isLoading: isLoadingList } = useCoinList("top", 100);
  const { address: account } = useFarcaster();

  const multicallAddr = CONTRACT_ADDRESSES.multicall as `0x${string}`;

  // Build flat contract call array using single multicall
  const { contracts, indexToFundraiser } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractCalls: any[] = [];
    const mapping: IndexedFundraiser[] = [];

    for (const u of allCoins) {
      if (!u.fundraiser?.id) continue;
      const fundraiserAddr = u.fundraiser.id.toLowerCase() as `0x${string}`;

      contractCalls.push({
        address: multicallAddr,
        abi: MULTICALL_ABI,
        functionName: "getAuction" as const,
        args: [fundraiserAddr, account ?? zeroAddress] as const,
        chainId: base.id,
      });
      mapping.push({ fundraiserAddress: fundraiserAddr, coin: u });
    }

    return { contracts: contractCalls, indexToFundraiser: mapping };
  }, [allCoins, account, multicallAddr]);

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

        const { fundraiserAddress, coin } = indexToFundraiser[index];

        // Calculate profit/loss
        const lpCostInQuote = (state.price * state.lpTokenPrice) / BigInt(1e18);
        const lpCostScaled = lpCostInQuote / BigInt(1e12); // normalize to 6 decimals

        const rewardUsd = Number(formatUnits(state.quoteAccumulated, QUOTE_TOKEN_DECIMALS));
        const lpCostUsd = Number(formatUnits(lpCostScaled, QUOTE_TOKEN_DECIMALS));
        const profit = rewardUsd - lpCostUsd;

        const isActive = state.quoteAccumulated > 0n && state.price > 0n;

        return {
          fundraiserAddress,
          tokenName: coin.name,
          tokenSymbol: coin.symbol,
          logoUrl: coin.fundraiser.metadata?.image ? ipfsToHttp(coin.fundraiser.metadata.image) : null,
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
  }, [states, indexToFundraiser]);

  return {
    auctions,
    isLoading: isLoadingList || isLoadingStates,
  };
}
