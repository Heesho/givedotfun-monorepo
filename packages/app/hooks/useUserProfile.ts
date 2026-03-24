import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { formatEther } from "viem";
import {
  getAccount,
  getAllCoins,
  type SubgraphCoinListItem,
} from "@/lib/subgraph-launchpad";
import { ERC20_ABI } from "@/lib/contracts";
import { DEFAULT_CHAIN_ID, ipfsToHttp } from "@/lib/constants";

export type UserHolding = {
  address: `0x${string}`;       // Fundraiser address
  coinAddress: `0x${string}`;   // Coin token address
  tokenName: string;
  tokenSymbol: string;
  uri: string;
  logoUrl: string | null;
  balance: bigint;              // Raw token balance (18 decimals)
  balanceNum: number;           // Formatted balance
  priceUsd: number;             // Price per token in USD
  valueUsd: number;             // balance * price
  change24h: number;
  sparklinePrices: number[];
};

export type UserLaunchedFundraiser = {
  address: `0x${string}`;
  coinAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  uri: string;
  logoUrl: string | null;
  totalMinted: number;
  coinPrice: number;
  marketCapUsd: number;
  change24h: number;
  sparklinePrices: number[];
};

/** Compute 24h change + sparkline from subgraph dayData (same logic as explore page) */
function computePriceData(coin: SubgraphCoinListItem, priceUsd: number) {
  let change24h = 0;
  if (coin.dayData && coin.dayData.length >= 2) {
    const yesterdayClose = parseFloat(coin.dayData[1].close);
    if (yesterdayClose > 0 && priceUsd > 0) {
      change24h = ((priceUsd - yesterdayClose) / yesterdayClose) * 100;
    }
  } else if (coin.dayData && coin.dayData.length === 1) {
    const todayOpen = parseFloat(coin.dayData[0].open);
    if (todayOpen > 0 && priceUsd > 0) {
      change24h = ((priceUsd - todayOpen) / todayOpen) * 100;
    }
  }

  const sparklinePrices: number[] = [];
  if (coin.dayData && coin.dayData.length > 0) {
    const reversed = [...coin.dayData].reverse();
    for (const d of reversed) {
      sparklinePrices.push(parseFloat(d.close));
    }
    sparklinePrices.push(priceUsd);
  }

  return { change24h, sparklinePrices };
}

export function useUserProfile(accountAddress: `0x${string}` | undefined) {
  // Fetch user account data from subgraph
  const {
    data: accountData,
    isLoading: isLoadingAccount,
  } = useQuery({
    queryKey: ["userProfile", accountAddress],
    queryFn: async () => {
      if (!accountAddress) return null;
      return getAccount(accountAddress);
    },
    enabled: !!accountAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Fetch all coins from subgraph (to know which tokens exist + prices)
  const { data: allCoins, isLoading: isLoadingCoins } = useQuery({
    queryKey: ["allCoins"],
    queryFn: () => getAllCoins(100),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Build balanceOf calls for every coin token
  const balanceOfCalls = useMemo(() => {
    if (!accountAddress || !allCoins?.length) return [];
    return allCoins.map((coin) => ({
      address: coin.id.toLowerCase() as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [accountAddress] as const,
      chainId: DEFAULT_CHAIN_ID,
    }));
  }, [accountAddress, allCoins]);

  const { data: balanceResults, isLoading: isLoadingBalances } = useReadContracts({
    contracts: balanceOfCalls,
    query: {
      enabled: balanceOfCalls.length > 0,
      staleTime: 15_000,
      refetchInterval: 30_000,
    },
  });

  // Combine balances with coin metadata, filter non-zero, sort by USD value
  const holdings: UserHolding[] = useMemo(() => {
    if (!allCoins?.length || !balanceResults?.length) return [];

    const items: UserHolding[] = [];

    for (let i = 0; i < allCoins.length; i++) {
      const coin = allCoins[i];
      const result = balanceResults[i];
      if (!result || result.status !== "success") continue;

      const balance = result.result as bigint;
      if (balance === 0n) continue;

      const balanceNum = Number(formatEther(balance));
      const priceUsd = parseFloat(coin.priceUSD) || parseFloat(coin.price) || 0;
      const valueUsd = balanceNum * priceUsd;
      const { change24h, sparklinePrices } = computePriceData(coin, priceUsd);

      items.push({
        address: (coin.fundraiser?.id?.toLowerCase() ?? "0x0") as `0x${string}`,
        coinAddress: coin.id.toLowerCase() as `0x${string}`,
        tokenName: coin.name,
        tokenSymbol: coin.symbol,
        uri: coin.fundraiser?.uri ?? "",
        logoUrl: coin.fundraiser?.metadata?.image ? ipfsToHttp(coin.fundraiser.metadata.image) : null,
        balance,
        balanceNum,
        priceUsd,
        valueUsd,
        change24h,
        sparklinePrices,
      });
    }

    // Sort by USD value descending
    items.sort((a, b) => b.valueUsd - a.valueUsd);

    return items;
  }, [allCoins, balanceResults]);

  // Launched fundraisers: filter coins where launcher matches account
  const launchedFundraisers: UserLaunchedFundraiser[] = useMemo(() => {
    if (!allCoins?.length || !accountAddress) return [];

    return allCoins
      .filter((u) => u.fundraiser?.launcher?.id?.toLowerCase() === accountAddress.toLowerCase())
      .map((u) => {
        const totalMinted = parseFloat(u.totalMinted || "0");
        const coinPrice = parseFloat(u.priceUSD) || parseFloat(u.price) || 0;
        const totalSupply = parseFloat(u.totalSupply || "0");
        let marketCapUsd = parseFloat(u.marketCapUSD) || 0;
        if (marketCapUsd === 0 && coinPrice > 0 && totalSupply > 0) {
          marketCapUsd = coinPrice * totalSupply;
        }
        const { change24h, sparklinePrices } = computePriceData(u, coinPrice);
        return {
          address: (u.fundraiser?.id?.toLowerCase() ?? "0x0") as `0x${string}`,
          coinAddress: (u.id?.toLowerCase() ?? "0x0") as `0x${string}`,
          tokenName: u.name,
          tokenSymbol: u.symbol,
          uri: u.fundraiser?.uri ?? "",
          logoUrl: u.fundraiser?.metadata?.image ? ipfsToHttp(u.fundraiser.metadata.image) : null,
          totalMinted,
          coinPrice,
          marketCapUsd,
          change24h,
          sparklinePrices,
        };
      })
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd);
  }, [allCoins, accountAddress]);

  const totalHoldingsValueUsd = useMemo(
    () => holdings.reduce((sum, h) => sum + h.valueUsd, 0),
    [holdings]
  );

  const isLoading = isLoadingAccount || isLoadingCoins || isLoadingBalances;

  return {
    accountData,
    holdings,
    launchedFundraisers,
    totalHoldingsValueUsd,
    isLoading,
  };
}
