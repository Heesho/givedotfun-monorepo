"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Share2, Loader2, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatEther, formatUnits } from "viem";
import { MineModal } from "@/components/mine-modal";
import { TradeModal } from "@/components/trade-modal";
import { AuctionModal } from "@/components/auction-modal";
import { LiquidityModal } from "@/components/liquidity-modal";
import { AdminModal } from "@/components/admin-modal";
import { DonationHistoryItem } from "@/components/donation-history-item";
import { Leaderboard } from "@/components/leaderboard";
import { useFundraiserState } from "@/hooks/useFundraiserState";
import { useTokenMetadata } from "@/hooks/useMetadata";
import { useFarcaster, composeCast } from "@/hooks/useFarcaster";
import { useDexScreener } from "@/hooks/useDexScreener";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { useFundHistory } from "@/hooks/useFundHistory";
import { useRigLeaderboard } from "@/hooks/useRigLeaderboard";
import {
  useBatchedTransaction,
  encodeContractCall,
  type Call,
} from "@/hooks/useBatchedTransaction";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  QUOTE_TOKEN_DECIMALS,
} from "@/lib/contracts";
import { getFundraiser, getUserFundraiserTotals } from "@/lib/subgraph-launchpad";
import { truncateAddress, formatPrice, formatNumber, formatMarketCap, timeAgo } from "@/lib/format";
import { PriceChart, type HoverData } from "@/components/price-chart";
import { TokenLogo } from "@/components/token-logo";
import { Particles } from "@/components/ui/particles";

type Timeframe = "1H" | "1D" | "1W" | "1M" | "ALL";

// Clickable address component
function AddressLink({ address }: { address: string | null }) {
  if (!address) return <span>None</span>;
  return (
      <a
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-primary hover:underline"
      >
      {truncateAddress(address)}
    </a>
  );
}

// Format emission (per day) - BigInt string with 18 decimals
function formatEmission(emission: string | undefined): string {
  if (!emission) return "0";
  const value = parseFloat(emission) / 1e18;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M/day`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K/day`;
  return `${value.toFixed(2)}/day`;
}

// Format time period (seconds to human readable)
function formatPeriod(seconds: string | undefined): string {
  if (!seconds) return "0";
  const secs = parseInt(seconds);
  const formatUnit = (value: number, singular: string, plural: string) =>
    `${value} ${value === 1 ? singular : plural}`;

  if (secs >= 86400 * 365) {
    const years = secs / (86400 * 365);
    const roundedYears = years >= 10 ? Math.round(years) : Number(years.toFixed(1));
    return formatUnit(roundedYears, "year", "years");
  }
  if (secs >= 86400 * 30) return formatUnit(Math.round(secs / (86400 * 30)), "month", "months");
  if (secs >= 86400 * 7) return formatUnit(Math.round(secs / (86400 * 7)), "week", "weeks");
  if (secs >= 86400) return formatUnit(Math.round(secs / 86400), "day", "days");
  if (secs >= 3600) return formatUnit(Math.round(secs / 3600), "hour", "hours");
  if (secs >= 60) return formatUnit(Math.round(secs / 60), "min", "min");
  return `${secs}s`;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Loading skeleton for the page
function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div
        className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <Link
            href="/explore"
            className="p-2 -ml-2 rounded-none hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-[144px] opacity-0">
            <div className="slab-inset px-3 py-1.5">
              <div className="text-[15px] font-semibold">--</div>
            </div>
          </div>
          <div className="p-2 -mr-2" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          {/* Token info skeleton */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-none bg-secondary animate-pulse" />
              <div>
                <div className="w-16 h-4 bg-secondary rounded animate-pulse mb-1" />
                <div className="w-24 h-5 bg-secondary rounded animate-pulse" />
              </div>
            </div>
            <div className="text-right">
              <div className="w-20 h-6 bg-secondary rounded animate-pulse mb-1" />
              <div className="w-14 h-4 bg-secondary rounded animate-pulse" />
            </div>
          </div>

          {/* Chart skeleton */}
          <div className="h-44 mb-2 -mx-4 bg-secondary/30 animate-pulse rounded" />

          {/* Timeframe selector skeleton */}
          <div className="flex justify-between mb-5 px-2">
            {["1H", "1D", "1W", "1M", "ALL"].map((tf) => (
              <div key={tf} className="px-3.5 py-1.5 rounded-none bg-secondary/50 text-[13px] text-muted-foreground">
                {tf}
              </div>
            ))}
          </div>

          {/* Stats skeleton */}
          <div className="mb-6">
            <div className="w-16 h-6 bg-secondary rounded animate-pulse mb-3" />
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="w-20 h-3 bg-secondary rounded animate-pulse mb-1" />
                  <div className="w-16 h-5 bg-secondary rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* About skeleton */}
          <div className="mb-6">
            <div className="w-16 h-6 bg-secondary rounded animate-pulse mb-3" />
            <div className="w-full h-4 bg-secondary rounded animate-pulse mb-2" />
            <div className="w-3/4 h-4 bg-secondary rounded animate-pulse mb-2" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function FundraiserDetailPage() {
  const params = useParams();
  const address = (params?.address as string)?.toLowerCase() || "";
  const fundraiserAddress = address as `0x${string}`;

  // Farcaster context for connected wallet
  const { address: account, isConnected, isInFrame, isConnecting, connect } = useFarcaster();

  // Fetch fundraiser data from subgraph
  const { data: subgraphFundraiser, isLoading: isSubgraphLoading } = useQuery({
    queryKey: ["fundraiser", address],
    queryFn: () => getFundraiser(address),
    enabled: !!address,
    staleTime: 30_000,
  });

  // Fetch on-chain fundraiser state via multicall
  const {
    fundraiserState,
    claimableEpochs,
    totalPending,
    refetch: refetchFund,
    isLoading: isFundraiserStateLoading,
  } = useFundraiserState(fundraiserAddress, account);

  // Normalize fields
  const coinPrice = fundraiserState?.coinPrice;
  const fundraiserUri = fundraiserState?.fundraiserUri;
  const accountCoinBalance = fundraiserState?.accountCoinBalance;
  const accountQuoteBalance = fundraiserState?.accountQuoteBalance;
  const accountUsdcBalance = fundraiserState?.accountUsdcBalance;

  // Coin address from subgraph
  const coinAddress = subgraphFundraiser?.coin?.id as `0x${string}` | undefined;

  // Fetch token metadata from IPFS
  const { metadata, logoUrl } = useTokenMetadata(fundraiserUri);

  // Fetch DexScreener data for liquidity/volume/price change
  const { pairData } = useDexScreener(
    fundraiserAddress,
    coinAddress,
  );

  // Donation history and leaderboard
  const { donations, isLoading: isHistoryLoading } = useFundHistory(address, 10);

  // User totals for this fundraiser (total funded + total mined)
  const { data: userTotals } = useQuery({
    queryKey: ["userFundraiserTotals", fundraiserAddress, account],
    queryFn: () => getUserFundraiserTotals(fundraiserAddress!, account!),
    enabled: !!fundraiserAddress && !!account,
    staleTime: 30_000,
  });
  const {
    entries: leaderboardEntries,
    userRank,
    isLoading: isLeaderboardLoading,
  } = useRigLeaderboard(address, account, 10);

  // Claim transaction
  const {
    execute: executeClaim,
    status: claimStatus,
    error: claimError,
    reset: resetClaim,
  } = useBatchedTransaction();

  // Derived values
  const tokenName = subgraphFundraiser?.coin?.name || "Loading...";
  const tokenSymbol = subgraphFundraiser?.coin?.symbol || "--";

  // Price in USD = coinPrice (USDC, 18 dec) -- USDC ~= $1
  const priceUsd = coinPrice
    ? Number(formatEther(coinPrice))
    : 0;

  // Total supply from subgraph (coin.totalSupply includes initial LP tokens)
  const totalSupplyRaw = subgraphFundraiser?.coin?.totalSupply
    ? parseFloat(subgraphFundraiser.coin.totalSupply)
    : 0;
  const totalSupply = totalSupplyRaw;

  // Market cap = totalSupply * coinPrice (USDC ~= $1)
  const marketCapUsd =
    coinPrice && totalSupplyRaw > 0
      ? totalSupplyRaw * Number(formatEther(coinPrice))
      : 0;

  // User position
  const userCoinBalance = accountCoinBalance
    ? Number(formatEther(accountCoinBalance))
    : 0;
  const positionBalanceUsd = userCoinBalance * priceUsd;

  // User quote balance (USDC, 6 decimals)
  // User USDC balance (6 decimals)
  const userUsdcBalance = accountUsdcBalance
    ? Number(formatUnits(accountUsdcBalance, QUOTE_TOKEN_DECIMALS))
    : 0;

  // Stats from subgraph (primary) + DexScreener (fallback)
  // Multiply by 2 since subgraph liquidity is just USDC side of the pool
  const liquidityUsd = subgraphFundraiser?.coin?.liquidity
    ? parseFloat(subgraphFundraiser.coin.liquidity) * 2
    : (pairData?.liquidity?.usd ?? 0);
  const volume24h = pairData?.volume?.h24 ?? 0;

  // Revenue from subgraph (BigDecimal strings already in quote token units)
  const treasuryRevenue = subgraphFundraiser?.treasuryRevenue
    ? parseFloat(subgraphFundraiser.treasuryRevenue)
    : 0;
  const teamRevenue = subgraphFundraiser?.teamRevenue
    ? parseFloat(subgraphFundraiser.teamRevenue)
    : 0;

  // Launcher address from subgraph
  const launcherAddress = subgraphFundraiser?.launcher?.id || null;

  // Ownership check: compare connected wallet to launcher address
  const isOwner = !!(
    account &&
    launcherAddress &&
    account.toLowerCase() === launcherAddress.toLowerCase()
  );

  // Created date from subgraph (needed for chart)
  const createdAtTimestamp = subgraphFundraiser?.createdAt
    ? Number(subgraphFundraiser.createdAt)
    : undefined;
  const createdAt = createdAtTimestamp
    ? new Date(createdAtTimestamp * 1000)
    : null;
  const launchDateStr = createdAt ? getRelativeTime(createdAt) : "--";

  // Initial LP price: usdcAmount / coinAmount from launch params
  const initialPrice = useMemo(() => {
    const usdc = parseFloat(subgraphFundraiser?.usdcAmount ?? "0");
    const coin = parseFloat(subgraphFundraiser?.coinAmount ?? "0");
    if (coin > 0) return usdc / coin;
    return 0;
  }, [subgraphFundraiser?.usdcAmount, subgraphFundraiser?.coinAmount]);

  // Chart data from subgraph price history
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const { data: chartData } = usePriceHistory(
    fundraiserAddress,
    timeframe,
    coinAddress,
    priceUsd,
    createdAtTimestamp,
    initialPrice,
  );

  // Timeframe-based price change: compare first chart data point to current price
  const displayChange = useMemo(() => {
    if (!chartData || chartData.length === 0 || priceUsd === 0) return 0;
    const firstPoint = chartData.find(d => d.value > 0);
    if (!firstPoint || firstPoint.value === 0) return 0;
    return ((priceUsd - firstPoint.value) / firstPoint.value) * 100;
  }, [chartData, priceUsd]);
  const movementColor = displayChange >= 0 ? "#4ae183" : "#c9ce00";
  const movementClass = displayChange >= 0 ? "positive-value" : "negative-value";
  const isCoinPositive = displayChange >= 0;
  const coinActionButtonClass = isCoinPositive ? "slab-button" : "slab-button slab-button-loss";

  const [hoverData, setHoverData] = useState<HoverData>(null);
  const handleChartHover = useCallback((data: HoverData) => setHoverData(data), []);

  const [showHeaderPrice, setShowHeaderPrice] = useState(false);
  const [showMineModal, setShowMineModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tokenIdentityRef = useRef<HTMLDivElement>(null);

  // Epoch countdown
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const epochDuration = subgraphFundraiser?.epochDuration
    ? parseInt(subgraphFundraiser.epochDuration)
    : 86400;
  const startTime = fundraiserState ? Number(fundraiserState.startTime) : 0;
  const currentEpoch = fundraiserState ? Number(fundraiserState.currentEpoch) : 0;
  const epochEndTime = startTime > 0 ? startTime + (currentEpoch + 1) * epochDuration : 0;
  const epochEndsIn = Math.max(0, epochEndTime - now);

  // Mining pool stats
  const currentEpochTotalDonated = fundraiserState
    ? Number(formatUnits(fundraiserState.currentEpochTotalDonated, QUOTE_TOKEN_DECIMALS))
    : 0;
  const currentEpochEmission = fundraiserState
    ? Number(formatEther(fundraiserState.currentEpochEmission))
    : 0;
  const costPerToken = currentEpochTotalDonated > 0
    ? currentEpochTotalDonated / currentEpochEmission
    : 0;

  // Pending claims
  const pendingTokens = Number(formatEther(totalPending));
  const unclaimedEpochCount = claimableEpochs.length;

  // User's current epoch donation
  const userCurrentEpochDonation = fundraiserState
    ? Number(formatUnits(fundraiserState.accountCurrentEpochDonation, QUOTE_TOKEN_DECIMALS))
    : 0;
  const estimatedTokensFromEpoch =
    userCurrentEpochDonation > 0 && currentEpochTotalDonated > 0 && currentEpochEmission > 0
      ? (userCurrentEpochDonation / currentEpochTotalDonated) * currentEpochEmission
      : 0;

  // Show position section if user has any balance, pending, or epoch donation
  const hasPosition = userCoinBalance > 0 || pendingTokens > 0 || userCurrentEpochDonation > 0;

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const tokenIdentity = tokenIdentityRef.current;

    if (!scrollContainer || !tokenIdentity) return;

    const updateHeaderVisibility = () => {
      const identityBottom = tokenIdentity.getBoundingClientRect().bottom;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      setShowHeaderPrice(identityBottom <= containerTop + 8);
    };

    const frame = requestAnimationFrame(updateHeaderVisibility);
    scrollContainer.addEventListener("scroll", updateHeaderVisibility);
    window.addEventListener("resize", updateHeaderVisibility);

    return () => {
      cancelAnimationFrame(frame);
      scrollContainer.removeEventListener("scroll", updateHeaderVisibility);
      window.removeEventListener("resize", updateHeaderVisibility);
    };
  }, [tokenName, tokenSymbol]);

  // Epoch countdown timer
  useEffect(() => {
    if (!fundraiserState) return;
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fundraiserState]);

  // Auto-refetch after claim success, auto-reset after error
  useEffect(() => {
    if (claimStatus === "success") {
      const timer = setTimeout(() => {
        refetchFund();
        resetClaim();
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (claimStatus === "error") {
      const timer = setTimeout(() => resetClaim(), 2000);
      return () => clearTimeout(timer);
    }
  }, [claimStatus, refetchFund, resetClaim]);

  // Claim handler
  const handleClaim = useCallback(async () => {
    if (!account || claimableEpochs.length === 0 || claimStatus === "pending") return;
    const multicallAddr = CONTRACT_ADDRESSES.multicall as `0x${string}`;
    const epochIds = claimableEpochs.map((d) => d.epoch);
    const calls: Call[] = [
      encodeContractCall(
        multicallAddr,
        MULTICALL_ABI,
        "claimMultiple",
        [fundraiserAddress, account, epochIds]
      ),
    ];
    await executeClaim(calls);
  }, [account, claimableEpochs, fundraiserAddress, executeClaim, claimStatus]);

  // Show loading skeleton while critical data loads
  const isLoading = isSubgraphLoading || (!!address && isFundraiserStateLoading);

  if (isLoading && !subgraphFundraiser) {
    return <LoadingSkeleton />;
  }

  return (
    <main className="min-h-screen bg-background">
      <Particles className="!fixed inset-0 -z-10 bg-transparent" quantity={40} size={0.5} />
      <div
        className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Desktop spacer for fixed header */}
        <div className="hidden lg:block lg:pt-[72px]" />

        {/* Scroll container */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pt-12 pb-4 lg:pt-0 lg:pb-16">
          <div className="mx-auto w-full">

            {/* Two-column flex layout */}
            <div className="lg:flex lg:gap-6">

              {/* LEFT COLUMN */}
              <div className="lg:flex-1 lg:min-w-0">

                {/* Desktop: back + ticker left, price right */}
                <div className="hidden lg:flex lg:items-start lg:justify-between lg:mb-2">
                  <div className="flex items-center gap-2">
                    <Link href="/explore" className="p-1 transition-colors hover:bg-surface-high">
                      <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                      <div className="font-display text-[22px] font-semibold uppercase tracking-[-0.03em]">{tokenSymbol}</div>
                      <div className="text-[13px] text-muted-foreground">{tokenName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[26px] font-semibold tabular-nums leading-none tracking-[-0.02em]">
                      {hoverData && hoverData.value > 0 ? formatPrice(hoverData.value) : formatPrice(priceUsd)}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-3 text-[13px]">
                      <span className={`font-medium font-mono ${movementClass}`}>
                        {hoverData
                          ? new Date(hoverData.time * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : `${displayChange >= 0 ? "+" : ""}${displayChange.toFixed(2)}%`}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span className="text-muted-foreground">Mcap <span className="text-foreground font-mono">{formatMarketCap(marketCapUsd)}</span></span>
                    </div>
                  </div>
                </div>

                {/* Mobile: token info slab */}
                <div className="lg:hidden">
                  <div className={`${isCoinPositive ? "signal-slab-positive" : "signal-slab-negative"} slab-panel mb-3 flex items-center justify-between px-3 py-3`}>
                    <div className="flex items-center gap-3">
                      <TokenLogo name={tokenName} logoUrl={logoUrl} size="lg" />
                      <div ref={tokenIdentityRef}>
                        <div className="text-[13px] text-muted-foreground">{tokenName}</div>
                        <div className="font-display text-[15px] font-medium uppercase tracking-[-0.02em]">{tokenSymbol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="price-large">
                        {hoverData && hoverData.value > 0
                          ? formatPrice(hoverData.value)
                          : formatPrice(priceUsd)}
                      </div>
                      {hoverData ? (
                        <div className="text-[13px] font-medium font-mono text-muted-foreground">
                          {new Date(hoverData.time * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      ) : (
                        <div className={`text-[13px] font-medium font-mono ${movementClass}`}>
                          {`${displayChange >= 0 ? "+" : ""}${displayChange.toFixed(2)}%`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile chart */}
                <div className="mb-2 -mx-4 lg:hidden">
                  <PriceChart
                    data={chartData}
                    height={176}
                    color={movementColor}
                    onHover={handleChartHover}
                    tokenFirstActiveTime={timeframe !== "ALL" ? createdAtTimestamp : undefined}
                    initialPrice={timeframe !== "ALL" ? initialPrice : undefined}
                  />
                </div>

                {/* Desktop chart */}
                <div className="hidden lg:block lg:mb-0">
                  <PriceChart
                    data={chartData}
                    height={280}
                    color={movementColor}
                    onHover={handleChartHover}
                    tokenFirstActiveTime={timeframe !== "ALL" ? createdAtTimestamp : undefined}
                    initialPrice={timeframe !== "ALL" ? initialPrice : undefined}
                  />
                </div>

                {/* Timeframe buttons + desktop buy/sell */}
                <div className="mb-5 grid grid-cols-5 gap-2 lg:flex lg:items-center lg:justify-between lg:gap-4">
                  <div className="contents lg:flex lg:gap-2">
                    {(["1H", "1D", "1W", "1M", "ALL"] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`ghost-border px-2 py-2 text-[12px] font-medium font-mono transition-all ${
                          timeframe === tf
                            ? displayChange >= 0
                              ? "bg-primary text-primary-foreground shadow-slab"
                              : "bg-loss text-loss-foreground shadow-slab-loss"
                            : "bg-secondary text-muted-foreground hover:bg-surface-high hover:text-foreground"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  {/* Desktop: Buy/Sell inline */}
                  <div className="hidden lg:flex lg:gap-2">
                    {isConnected ? (
                      <>
                        <button onClick={() => { setTradeMode("buy"); setShowTradeModal(true); }} className="slab-button px-6 text-[11px]">Buy</button>
                        <button onClick={() => { setTradeMode("sell"); setShowTradeModal(true); }} disabled={userCoinBalance <= 0} className={`slab-button slab-button-loss px-6 text-[11px] ${userCoinBalance <= 0 ? "opacity-50" : ""}`}>Sell</button>
                      </>
                    ) : (
                      <button onClick={() => connect()} disabled={isConnecting || isInFrame === true} className="slab-button px-8 text-[11px] disabled:opacity-50">{isConnecting ? "Connecting..." : "Connect Wallet"}</button>
                    )}
                  </div>
                </div>

                {/* MOBILE ONLY sections */}
                <div className="lg:hidden">

                  {/* Mining Pool Section — mobile */}
                  <div className="slab-panel mb-6 px-3 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Today&apos;s Mining Pool</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">Fund USDC to earn a share of today&apos;s coin rewards</div>
                      </div>
                      <div className="text-[14px] tabular-nums font-mono text-muted-foreground">
                        {epochEndsIn > 0 ? formatCountdown(epochEndsIn) : "\u2014"}
                      </div>
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] text-muted-foreground mb-1">Funded</div>
                        <div className="text-[22px] font-bold tabular-nums font-mono">
                          ${currentEpochTotalDonated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[13px] text-muted-foreground tabular-nums font-mono mt-0.5">
                          {costPerToken > 0 ? `$${costPerToken.toFixed(4)}/token` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground mb-1">Emission</div>
                        <div className="text-[22px] font-bold tabular-nums font-mono flex items-center justify-end gap-1.5">
                          <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="sm" variant="circle" />
                          {currentEpochEmission >= 1_000_000 ? `${(currentEpochEmission / 1_000_000).toFixed(2)}M`
                            : currentEpochEmission >= 1_000 ? `${(currentEpochEmission / 1_000).toFixed(0)}K`
                            : currentEpochEmission.toFixed(0)}
                        </div>
                        <div className="text-[13px] text-muted-foreground tabular-nums font-mono mt-0.5">
                          {priceUsd > 0 ? `~$${formatNumber(currentEpochEmission * priceUsd)} value` : `${tokenSymbol}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMineModal(true)}
                      className={`${coinActionButtonClass} mt-4 w-full text-[11px]`}
                    >
                      Mine
                    </button>
                  </div>

                  {/* Your Position Section — mobile */}
                  {hasPosition && (
                    <div className="slab-panel mb-6 px-3 py-4">
                      <div className="mb-3">
                        <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Your Position</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">Your active mining and claimable coins from past days</div>
                      </div>
                      {(userCurrentEpochDonation > 0 || unclaimedEpochCount > 0) && (
                        <div className="mb-4">
                          <div className="ledger-list">
                            {userCurrentEpochDonation > 0 && (
                              <div className="flex items-center gap-3 px-0 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Day {currentEpoch}</span>
                                    <span className="text-xs uppercase tracking-[0.12em] text-primary">active</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                  <div>
                                    <div className="text-[12px] text-muted-foreground">Funded</div>
                                    <div className="text-[13px] font-medium">${userCurrentEpochDonation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  </div>
                                  <div>
                                    <div className="text-[12px] text-muted-foreground">Mined</div>
                                    <div className="text-[13px] font-medium flex items-center justify-end gap-1">
                                      <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="xs" variant="circle" />
                                      {estimatedTokensFromEpoch >= 1000
                                        ? `${(estimatedTokensFromEpoch / 1000).toFixed(1)}K`
                                        : formatNumber(estimatedTokensFromEpoch, 0)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {claimableEpochs.map((ep) => {
                              const epDonation = Number(formatUnits(ep.donation, QUOTE_TOKEN_DECIMALS));
                              const epReward = Number(formatEther(ep.pendingReward));
                              return (
                                <div key={ep.epoch.toString()} className="flex items-center gap-3 px-0 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Day {ep.epoch.toString()}</span>
                                      <span className="text-xs uppercase tracking-[0.12em] text-loss">claimable</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                    <div>
                                      <div className="text-[12px] text-muted-foreground">Funded</div>
                                      <div className="text-[13px] font-medium">${epDonation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                      <div className="text-[12px] text-muted-foreground">Mined</div>
                                      <div className="text-[13px] font-medium flex items-center justify-end gap-1">
                                        <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="xs" variant="circle" />
                                        {epReward >= 1000
                                          ? `${(epReward / 1000).toFixed(1)}K`
                                          : formatNumber(epReward, 0)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {unclaimedEpochCount > 0 && (
                            <button
                              onClick={handleClaim}
                              disabled={claimStatus === "pending" || claimStatus === "success"}
                              className={`mt-1 flex h-11 w-full items-center justify-center gap-1.5 px-4 text-[11px] ${
                                claimStatus === "success"
                                  ? `${coinActionButtonClass} opacity-70`
                                  : claimStatus === "error"
                                  ? "slab-button-ghost text-loss"
                                  : claimStatus === "pending"
                                  ? `${coinActionButtonClass} opacity-50`
                                  : coinActionButtonClass
                              }`}
                            >
                              {claimStatus === "pending" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              {claimStatus === "success" && <CheckCircle className="w-3.5 h-3.5" />}
                              {claimStatus === "pending"
                                ? "Claiming..."
                                : claimStatus === "success"
                                ? "Claimed!"
                                : claimStatus === "error"
                                ? claimError?.message?.includes("cancelled") ? "Rejected" : "Failed"
                                : `Claim all · ${unclaimedEpochCount} day${unclaimedEpochCount !== 1 ? "s" : ""}`}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-1">Balance</div>
                          <div className="font-semibold text-[15px] tabular-nums font-mono flex items-center gap-1.5">
                            <TokenLogo name={tokenName} logoUrl={logoUrl} size="sm" variant="circle" />
                            <span>{formatNumber(userCoinBalance)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-1">Value</div>
                          <div className="text-[15px] font-semibold tabular-nums font-mono text-foreground">
                            ${positionBalanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        {userTotals && userTotals.totalFunded > 0 && (
                          <>
                            <div>
                              <div className="text-muted-foreground text-[12px] mb-1">Total mined</div>
                              <div className="font-semibold text-[15px] tabular-nums font-mono flex items-center gap-1.5">
                                <TokenLogo name={tokenName} logoUrl={logoUrl} size="sm" variant="circle" />
                                <span>{formatNumber(userTotals.totalMined)}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[12px] mb-1">Total funded</div>
                              <div className="font-semibold text-[15px] tabular-nums font-mono">
                                ${formatNumber(userTotals.totalFunded)}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* About Section — mobile */}
                  <div className="slab-panel mb-6 px-3 py-4">
                    <div className="mb-3">
                      <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">About</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Fundraiser details, links, and team actions</div>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-2">
                      <span>Deployed by</span>
                      {launcherAddress ? (
                        <span className="text-foreground font-medium font-mono">
                          <AddressLink address={launcherAddress} />
                        </span>
                      ) : (
                        <span className="text-foreground font-medium">--</span>
                      )}
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-muted-foreground/60">{launchDateStr}</span>
                    </div>
                    {metadata?.description && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed mb-2">
                        {metadata.description}
                      </p>
                    )}
                    {!metadata?.description && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed mb-2">
                        A Karma Coin. Supporters fund and claim each day&apos;s coin rewards proportional to their share.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {coinAddress && (
                        <a
                          href={`https://basescan.org/token/${coinAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                        >
                          {tokenSymbol}
                        </a>
                      )}
                      {subgraphFundraiser?.coin?.lpPair && (
                        <a
                          href={`https://basescan.org/address/${subgraphFundraiser.coin.lpPair}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                        >
                          {tokenSymbol}-USDC LP
                        </a>
                      )}
                      {metadata?.links && metadata.links.length > 0 && metadata.links.map((link, i) => {
                        let label: string;
                        try {
                          const hostname = new URL(link).hostname.replace("www.", "");
                          if (hostname.includes("twitter.com") || hostname.includes("x.com")) label = "Twitter";
                          else if (hostname.includes("t.me") || hostname.includes("telegram")) label = "Telegram";
                          else if (hostname.includes("discord")) label = "Discord";
                          else if (hostname.includes("github.com")) label = "GitHub";
                          else if (hostname.includes("warpcast.com")) label = "Warpcast";
                          else label = hostname;
                        } catch {
                          label = link;
                        }
                        return (
                          <a
                            key={i}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                          >
                            {label}
                          </a>
                        );
                      })}
                    </div>
                    {isConnected && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowLiquidityModal(true)}
                          className={`${coinActionButtonClass} text-[11px]`}
                        >
                          Liquidity
                        </button>
                        <button
                          onClick={() => setShowAuctionModal(true)}
                          className={`${coinActionButtonClass} text-[11px]`}
                        >
                          Auction
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => setShowAdminModal(true)}
                            className={`${coinActionButtonClass} col-span-2 text-[11px]`}
                          >
                            Admin
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats Section — mobile */}
                  <div className="slab-panel mb-6 px-3 py-4">
                    <div className="mb-3">
                      <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Stats</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Key metrics and coin economics for this fundraiser</div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">Market cap</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">{formatMarketCap(marketCapUsd)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">Total supply</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">{formatNumber(totalSupply)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">Liquidity</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">${formatNumber(liquidityUsd)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">24h volume</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">${formatNumber(volume24h)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">
                          ${treasuryRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono">
                          ${teamRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {subgraphFundraiser && (
                        <>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Daily coins (start)</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono">{formatEmission(subgraphFundraiser.initialEmission)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Daily coins (min)</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono">{formatEmission(subgraphFundraiser.minEmission)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Halving</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono">
                              {formatPeriod(
                                String(
                                  parseInt(subgraphFundraiser.halvingPeriod) *
                                  parseInt(subgraphFundraiser.epochDuration)
                                )
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Epoch duration</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono">{formatPeriod(subgraphFundraiser.epochDuration)}</div>
                          </div>
                          {metadata?.recipientName && (
                            <div>
                              <div className="text-muted-foreground text-[12px] mb-0.5">Recipient</div>
                              <div className="font-semibold text-[15px]">{metadata.recipientName}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">
                              {metadata?.recipientName ? "Recipient address" : "Recipient"}
                            </div>
                            <div className="font-semibold text-[15px] font-mono">
                              <AddressLink address={fundraiserState?.recipient ?? null} />
                            </div>
                          </div>
                          {fundraiserState?.treasury && (
                            <div>
                              <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                              <div className="font-semibold text-[15px] font-mono">
                                <AddressLink address={fundraiserState.treasury} />
                              </div>
                            </div>
                          )}
                          {fundraiserState?.team && fundraiserState.team !== "0x0000000000000000000000000000000000000000" && (
                            <div>
                              <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                              <div className="font-semibold text-[15px] font-mono">
                                <AddressLink address={fundraiserState.team} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>{/* end mobile-only sections */}

                {/* Recent Funding */}
                <div className="slab-panel mb-6 px-3 py-3">
                  <div className="mb-2.5">
                    <h2 className="text-[18px] font-semibold font-display uppercase tracking-[-0.03em]">Recent Funding</h2>
                    <div className="text-[12px] text-muted-foreground mt-0.5">Latest contributions and estimated coin rewards</div>
                  </div>
                  {isHistoryLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : donations.length === 0 ? (
                    <div className="py-4 text-center text-[13px] text-muted-foreground">
                      No funding yet
                    </div>
                  ) : (
                    <div className="ledger-list">
                      {donations.map((donation, index) => (
                        <DonationHistoryItem
                          key={`${donation.donor}-${donation.timestamp}-${index}`}
                          donation={{
                            id: `${donation.donor}-${donation.timestamp}-${index}`,
                            donor: donation.donor,
                            uri: donation.uri,
                            amount: donation.amount,
                            estimatedTokens: currentEpochEmission > 0
                              ? BigInt(Math.floor((Number(formatUnits(donation.amount, QUOTE_TOKEN_DECIMALS)) / (currentEpochTotalDonated || 1)) * currentEpochEmission * 1e18))
                              : 0n,
                            timestamp: Number(donation.timestamp),
                          }}
                          timeAgo={timeAgo}
                          tokenSymbol={tokenSymbol}
                          logoUrl={logoUrl ?? undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Leaderboard */}
                <Leaderboard
                  entries={leaderboardEntries ?? []}
                  userRank={userRank ?? null}
                  tokenSymbol={tokenSymbol}
                  tokenName={tokenName}
                  fundraiserUrl={typeof window !== "undefined" ? `${window.location.origin}/fundraiser/${fundraiserAddress}` : ""}
                  isLoading={isLeaderboardLoading}
                />

              </div>{/* end left column */}

              {/* RIGHT COLUMN — desktop sidebar */}
              <div className="hidden lg:block lg:w-[380px] lg:shrink-0 lg:sticky lg:top-[72px] lg:self-start">

                {/* Fundraiser image — desktop only */}
                {logoUrl && (
                  <div className="slab-panel mb-4 overflow-hidden">
                    <img src={logoUrl} alt={tokenName} className="w-full h-auto object-cover" style={{ maxHeight: "220px" }} />
                  </div>
                )}

                {/* Mining Pool Section */}
                <div className="slab-panel mb-6 px-3 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Today&apos;s Mining Pool</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Fund USDC to earn a share of today&apos;s coin rewards</div>
                    </div>
                    <div className="text-[14px] tabular-nums font-mono text-muted-foreground">
                      {epochEndsIn > 0 ? formatCountdown(epochEndsIn) : "\u2014"}
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">Funded</div>
                      <div className="text-[22px] font-bold tabular-nums font-mono">
                        ${currentEpochTotalDonated.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[13px] text-muted-foreground tabular-nums font-mono mt-0.5">
                        {costPerToken > 0 ? `$${costPerToken.toFixed(4)}/token` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground mb-1">Emission</div>
                      <div className="text-[22px] font-bold tabular-nums font-mono flex items-center justify-end gap-1.5">
                        <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="sm" variant="circle" />
                        {currentEpochEmission >= 1_000_000 ? `${(currentEpochEmission / 1_000_000).toFixed(2)}M`
                          : currentEpochEmission >= 1_000 ? `${(currentEpochEmission / 1_000).toFixed(0)}K`
                          : currentEpochEmission.toFixed(0)}
                      </div>
                      <div className="text-[13px] text-muted-foreground tabular-nums font-mono mt-0.5">
                        {priceUsd > 0 ? `~$${formatNumber(currentEpochEmission * priceUsd)} value` : `${tokenSymbol}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMineModal(true)}
                    className={`${coinActionButtonClass} mt-4 w-full text-[11px]`}
                  >
                    Mine
                  </button>
                </div>

                {/* Your Position Section */}
                {hasPosition && (
                  <div className="slab-panel mb-6 px-3 py-4">
                    <div className="mb-3">
                      <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Your Position</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Your active mining and claimable coins from past days</div>
                    </div>
                    {(userCurrentEpochDonation > 0 || unclaimedEpochCount > 0) && (
                      <div className="mb-4">
                        <div className="ledger-list">
                          {userCurrentEpochDonation > 0 && (
                            <div className="flex items-center gap-3 px-0 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Day {currentEpoch}</span>
                                  <span className="text-xs uppercase tracking-[0.12em] text-primary">active</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                <div>
                                  <div className="text-[12px] text-muted-foreground">Funded</div>
                                  <div className="text-[13px] font-medium">${userCurrentEpochDonation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                  <div className="text-[12px] text-muted-foreground">Mined</div>
                                  <div className="text-[13px] font-medium flex items-center justify-end gap-1">
                                    <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="xs" variant="circle" />
                                    {estimatedTokensFromEpoch >= 1000
                                      ? `${(estimatedTokensFromEpoch / 1000).toFixed(1)}K`
                                      : formatNumber(estimatedTokensFromEpoch, 0)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {claimableEpochs.map((ep) => {
                            const epDonation = Number(formatUnits(ep.donation, QUOTE_TOKEN_DECIMALS));
                            const epReward = Number(formatEther(ep.pendingReward));
                            return (
                              <div key={ep.epoch.toString()} className="flex items-center gap-3 px-0 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Day {ep.epoch.toString()}</span>
                                    <span className="text-xs uppercase tracking-[0.12em] text-loss">claimable</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                  <div>
                                    <div className="text-[12px] text-muted-foreground">Funded</div>
                                    <div className="text-[13px] font-medium">${epDonation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  </div>
                                  <div>
                                    <div className="text-[12px] text-muted-foreground">Mined</div>
                                    <div className="text-[13px] font-medium flex items-center justify-end gap-1">
                                      <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="xs" variant="circle" />
                                      {epReward >= 1000
                                        ? `${(epReward / 1000).toFixed(1)}K`
                                        : formatNumber(epReward, 0)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {unclaimedEpochCount > 0 && (
                          <button
                            onClick={handleClaim}
                            disabled={claimStatus === "pending" || claimStatus === "success"}
                            className={`mt-1 flex h-11 w-full items-center justify-center gap-1.5 px-4 text-[11px] ${
                              claimStatus === "success"
                                ? `${coinActionButtonClass} opacity-70`
                                : claimStatus === "error"
                                ? "slab-button-ghost text-loss"
                                : claimStatus === "pending"
                                ? `${coinActionButtonClass} opacity-50`
                                : coinActionButtonClass
                            }`}
                          >
                            {claimStatus === "pending" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {claimStatus === "success" && <CheckCircle className="w-3.5 h-3.5" />}
                            {claimStatus === "pending"
                              ? "Claiming..."
                              : claimStatus === "success"
                              ? "Claimed!"
                              : claimStatus === "error"
                              ? claimError?.message?.includes("cancelled") ? "Rejected" : "Failed"
                              : `Claim all · ${unclaimedEpochCount} day${unclaimedEpochCount !== 1 ? "s" : ""}`}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-1">Balance</div>
                        <div className="font-semibold text-[15px] tabular-nums font-mono flex items-center gap-1.5">
                          <TokenLogo name={tokenName} logoUrl={logoUrl} size="sm" variant="circle" />
                          <span>{formatNumber(userCoinBalance)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[12px] mb-1">Value</div>
                        <div className="text-[15px] font-semibold tabular-nums font-mono text-foreground">
                          ${positionBalanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {userTotals && userTotals.totalFunded > 0 && (
                        <>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-1">Total mined</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono flex items-center gap-1.5">
                              <TokenLogo name={tokenName} logoUrl={logoUrl} size="sm" variant="circle" />
                              <span>{formatNumber(userTotals.totalMined)}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-1">Total funded</div>
                            <div className="font-semibold text-[15px] tabular-nums font-mono">
                              ${formatNumber(userTotals.totalFunded)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* About Section */}
                <div className="slab-panel mb-6 px-3 py-4">
                  <div className="mb-3">
                    <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">About</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">Fundraiser details, links, and team actions</div>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-2">
                    <span>Deployed by</span>
                    {launcherAddress ? (
                      <span className="text-foreground font-medium font-mono">
                        <AddressLink address={launcherAddress} />
                      </span>
                    ) : (
                      <span className="text-foreground font-medium">--</span>
                    )}
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-muted-foreground/60">{launchDateStr}</span>
                  </div>
                  {metadata?.description && (
                    <p className="text-[13px] text-muted-foreground leading-relaxed mb-2">
                      {metadata.description}
                    </p>
                  )}
                  {!metadata?.description && (
                    <p className="text-[13px] text-muted-foreground leading-relaxed mb-2">
                      A Karma Coin. Supporters fund and claim each day&apos;s coin rewards proportional to their share.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {coinAddress && (
                      <a
                        href={`https://basescan.org/token/${coinAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                      >
                        {tokenSymbol}
                      </a>
                    )}
                    {subgraphFundraiser?.coin?.lpPair && (
                      <a
                        href={`https://basescan.org/address/${subgraphFundraiser.coin.lpPair}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                      >
                        {tokenSymbol}-USDC LP
                      </a>
                    )}
                    {metadata?.links && metadata.links.length > 0 && metadata.links.map((link, i) => {
                      let label: string;
                      try {
                        const hostname = new URL(link).hostname.replace("www.", "");
                        if (hostname.includes("twitter.com") || hostname.includes("x.com")) label = "Twitter";
                        else if (hostname.includes("t.me") || hostname.includes("telegram")) label = "Telegram";
                        else if (hostname.includes("discord")) label = "Discord";
                        else if (hostname.includes("github.com")) label = "GitHub";
                        else if (hostname.includes("warpcast.com")) label = "Warpcast";
                        else label = hostname;
                      } catch {
                        label = link;
                      }
                      return (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-border flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                        >
                          {label}
                        </a>
                      );
                    })}
                  </div>
                  {isConnected && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShowLiquidityModal(true)}
                        className={`${coinActionButtonClass} text-[11px]`}
                      >
                        Liquidity
                      </button>
                      <button
                        onClick={() => setShowAuctionModal(true)}
                        className={`${coinActionButtonClass} text-[11px]`}
                      >
                        Auction
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => setShowAdminModal(true)}
                          className={`${coinActionButtonClass} col-span-2 text-[11px]`}
                        >
                          Admin
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats Section */}
                <div className="slab-panel mb-6 px-3 py-4">
                  <div className="mb-3">
                    <div className="font-semibold text-[18px] font-display uppercase tracking-[-0.03em]">Stats</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">Key metrics and coin economics for this fundraiser</div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Market cap</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">{formatMarketCap(marketCapUsd)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Total supply</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">{formatNumber(totalSupply)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Liquidity</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">${formatNumber(liquidityUsd)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">24h volume</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">${formatNumber(volume24h)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">
                        ${treasuryRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                      <div className="font-semibold text-[15px] tabular-nums font-mono">
                        ${teamRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    {subgraphFundraiser && (
                      <>
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-0.5">Daily coins (start)</div>
                          <div className="font-semibold text-[15px] tabular-nums font-mono">{formatEmission(subgraphFundraiser.initialEmission)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-0.5">Daily coins (min)</div>
                          <div className="font-semibold text-[15px] tabular-nums font-mono">{formatEmission(subgraphFundraiser.minEmission)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-0.5">Halving</div>
                          <div className="font-semibold text-[15px] tabular-nums font-mono">
                            {formatPeriod(
                              String(
                                parseInt(subgraphFundraiser.halvingPeriod) *
                                parseInt(subgraphFundraiser.epochDuration)
                              )
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-0.5">Epoch duration</div>
                          <div className="font-semibold text-[15px] tabular-nums font-mono">{formatPeriod(subgraphFundraiser.epochDuration)}</div>
                        </div>
                        {metadata?.recipientName && (
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Recipient</div>
                            <div className="font-semibold text-[15px]">{metadata.recipientName}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-muted-foreground text-[12px] mb-0.5">
                            {metadata?.recipientName ? "Recipient address" : "Recipient"}
                          </div>
                          <div className="font-semibold text-[15px] font-mono">
                            <AddressLink address={fundraiserState?.recipient ?? null} />
                          </div>
                        </div>
                        {fundraiserState?.treasury && (
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                            <div className="font-semibold text-[15px] font-mono">
                              <AddressLink address={fundraiserState.treasury} />
                            </div>
                          </div>
                        )}
                        {fundraiserState?.team && fundraiserState.team !== "0x0000000000000000000000000000000000000000" && (
                          <div>
                            <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                            <div className="font-semibold text-[15px] font-mono">
                              <AddressLink address={fundraiserState.team} />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>{/* end right column / desktop sidebar */}

            </div>{/* end two-column flex */}

          </div>{/* end max-width wrapper */}
        </div>{/* end scroll container */}

        {/* Mobile header — back arrow, ticker plaque, share */}
        <div className="flex items-center justify-between px-4 pb-2 lg:hidden" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)", background: "hsl(var(--background))" }}>
          <Link
            href="/explore"
            className="-ml-2 p-2 transition-colors hover:bg-surface-high"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div
            className={`pointer-events-none min-w-[144px] transition-opacity duration-500 ${
              showHeaderPrice ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className={`px-3 py-1.5 ${displayChange >= 0 ? "ticker-plaque-positive" : "ticker-plaque-negative"}`}>
              <div className="text-center text-current">
                <div className="font-display text-[11px] font-semibold uppercase leading-none tracking-[0.08em]">
                  {tokenSymbol}
                </div>
                <div className="mt-0.5 font-mono text-[13px] font-semibold leading-none tabular-nums">
                  {formatPrice(priceUsd)}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              composeCast({ text: `Check out $${tokenSymbol} on give.fun`, embeds: [url] });
            }}
            className="-mr-2 p-2 transition-colors hover:bg-surface-high"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center lg:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
          <div className="dock-panel -mb-px flex w-full max-w-[520px] items-center gap-2 px-4 py-3">
            {isConnected ? (
              <>
                {userCoinBalance > 0 && (
                  <button
                    onClick={() => {
                      setTradeMode("sell");
                      setShowTradeModal(true);
                    }}
                    className="slab-button slab-button-loss flex-1 text-[11px]"
                  >
                    Sell
                  </button>
                )}
                <button
                  onClick={() => {
                    setTradeMode("buy");
                    setShowTradeModal(true);
                  }}
                  className="slab-button flex-1 text-[11px]"
                >
                  Buy
                </button>
              </>
            ) : (
              <button
                onClick={() => connect()}
                disabled={isConnecting || isInFrame === true}
                className="slab-button flex-1 text-[11px] disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Mine Modal */}
      <MineModal
        isOpen={showMineModal}
        onClose={() => setShowMineModal(false)}
        fundraiserAddress={fundraiserAddress}
        tokenSymbol={tokenSymbol}
        onSuccess={() => refetchFund()}
        colorPositive={isCoinPositive}
      />

      {/* Trade Modal (Buy/Sell) */}
      <TradeModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        mode={tradeMode}
        tokenSymbol={tokenSymbol}
        unitAddress={(coinAddress ?? "0x0") as `0x${string}`}
        marketPrice={priceUsd}
        userQuoteBalance={accountQuoteBalance ?? 0n}
        userUnitBalance={accountCoinBalance ?? 0n}
        logoUrl={logoUrl ?? undefined}
        colorPositive={isCoinPositive}
      />

      {/* Auction Modal */}
      <AuctionModal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        fundraiserAddress={fundraiserAddress}
        tokenSymbol={tokenSymbol}
        colorPositive={isCoinPositive}
      />

      {/* Liquidity Modal */}
      <LiquidityModal
        isOpen={showLiquidityModal}
        onClose={() => setShowLiquidityModal(false)}
        unitAddress={(coinAddress ?? "0x0") as `0x${string}`}
        tokenSymbol={tokenSymbol}
        tokenBalance={userCoinBalance}
        usdcBalance={userUsdcBalance}
        tokenPrice={priceUsd}
        colorPositive={isCoinPositive}
      />

      {/* Admin Modal */}
      {showAdminModal && (
        <AdminModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          fundraiserAddress={fundraiserAddress}
          tokenSymbol={tokenSymbol}
          tokenName={tokenName}
          initialTreasury={fundraiserState?.treasury ?? ""}
          initialTeam={fundraiserState?.team ?? ""}
          initialRecipient={fundraiserState?.recipient ?? ""}
          initialMetadata={metadata ?? undefined}
          initialLogoUrl={logoUrl ?? undefined}
          colorPositive={isCoinPositive}
        />
      )}

    </main>
  );
}

/** Returns a relative time string like "2d ago", "3h ago", etc. */
function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}
