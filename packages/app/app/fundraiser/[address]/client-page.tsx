"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits } from "viem";
import { NavBar } from "@/components/nav-bar";
import { DonateModal } from "@/components/donate-modal";
import { TradeModal } from "@/components/trade-modal";
import { AuctionModal } from "@/components/auction-modal";
import { LiquidityModal } from "@/components/liquidity-modal";
import { AdminModal } from "@/components/admin-modal";
import { useRigInfo } from "@/hooks/useRigState";
import { useFundraiserState } from "@/hooks/useFundraiserState";
import { useTokenMetadata } from "@/hooks/useMetadata";
import { useFarcaster, composeCast } from "@/hooks/useFarcaster";
import { useDexScreener } from "@/hooks/useDexScreener";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import {
  CONTRACT_ADDRESSES,
  QUOTE_TOKEN_DECIMALS,
  getMulticallAddress,
  RIG_ABI,
} from "@/lib/contracts";
import { getRig } from "@/lib/subgraph-launchpad";
import { truncateAddress, formatPrice, formatNumber, formatMarketCap } from "@/lib/format";
import { PriceChart, type HoverData } from "@/components/price-chart";
import { TokenLogo } from "@/components/token-logo";

type Timeframe = "1H" | "1D" | "1W" | "1M" | "ALL";

// Clickable address component
function AddressLink({ address }: { address: string | null }) {
  if (!address) return <span>None</span>;
  return (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline hover:text-white transition-colors"
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

// Loading skeleton for the page
function LoadingSkeleton() {
  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <Link
            href="/explore"
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-center opacity-0">
            <div className="text-[15px] font-semibold">--</div>
          </div>
          <div className="p-2 -mr-2" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary animate-pulse" />
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
          <div className="h-44 mb-2 -mx-4 bg-secondary/30 animate-pulse rounded" />
          <div className="flex justify-between mb-5 px-2">
            {["1H", "1D", "1W", "1M", "ALL"].map((tf) => (
              <div key={tf} className="px-3.5 py-1.5 rounded-lg bg-secondary/50 text-[13px] text-muted-foreground">
                {tf}
              </div>
            ))}
          </div>
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
        </div>
      </div>
    </main>
  );
}

export default function RigDetailPage() {
  const params = useParams();
  const address = (params?.address as string)?.toLowerCase() || "";
  const rigAddress = address as `0x${string}`;

  // Farcaster context for connected wallet
  const { address: account, isConnected, isInFrame, isConnecting, connect } = useFarcaster();

  // Fetch rig data from subgraph
  const { data: subgraphRig, isLoading: isSubgraphLoading } = useQuery({
    queryKey: ["rig", address],
    queryFn: () => getRig(address),
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const rig = query.state.data;
      if (!rig) return 3000;
      if (!rig.fundraiser) return 3000;
      return false;
    },
  });

  const multicallAddress = getMulticallAddress();
  const coreAddress = CONTRACT_ADDRESSES.fundraiserCore as `0x${string}`;

  // Fetch fundraiser state
  const { fundraiserState, isLoading: isFundLoading } = useFundraiserState(
    rigAddress,
    account,
    true
  );

  // Fetch rig info (unit/auction/LP addresses, token name/symbol, launcher)
  const { rigInfo, isLoading: isRigInfoLoading } = useRigInfo(
    rigAddress,
    coreAddress,
  );

  // Normalize fields
  const unitPrice = fundraiserState?.unitPrice;
  const rigUri = fundraiserState?.rigUri;
  const accountQuoteBalance = fundraiserState?.accountQuoteBalance;
  const accountUsdcBalance = fundraiserState?.accountUsdcBalance;
  const accountUnitBalance = fundraiserState?.accountUnitBalance;

  // Fetch token metadata from IPFS
  const { metadata, logoUrl } = useTokenMetadata(rigUri);

  // Fetch DexScreener data for liquidity/volume/price change
  const { pairData } = useDexScreener(
    rigAddress,
    rigInfo?.unitAddress,
    coreAddress,
  );

  // Derived values
  const tokenName = rigInfo?.tokenName || subgraphRig?.unit?.name || "Loading...";
  const tokenSymbol = rigInfo?.tokenSymbol || subgraphRig?.unit?.symbol || "--";

  const priceUsd = unitPrice
    ? Number(formatEther(unitPrice))
    : 0;

  const totalSupplyRaw = subgraphRig?.unit?.totalSupply
    ? parseFloat(subgraphRig.unit.totalSupply)
    : 0;
  const totalSupply = totalSupplyRaw;

  const marketCapUsd =
    unitPrice && totalSupplyRaw > 0
      ? totalSupplyRaw * Number(formatEther(unitPrice))
      : 0;

  const userUnitBalance = accountUnitBalance
    ? Number(formatEther(accountUnitBalance))
    : 0;
  const positionBalanceUsd = userUnitBalance * priceUsd;
  const hasPosition = userUnitBalance > 0;

  const userQuoteBalance = accountQuoteBalance
    ? Number(formatUnits(accountQuoteBalance, QUOTE_TOKEN_DECIMALS))
    : 0;

  const userUsdcBalance = accountUsdcBalance
    ? Number(formatUnits(accountUsdcBalance, QUOTE_TOKEN_DECIMALS))
    : 0;

  const liquidityUsd = subgraphRig?.unit?.liquidity
    ? parseFloat(subgraphRig.unit.liquidity) * 2
    : (pairData?.liquidity?.usd ?? 0);
  const volume24h = pairData?.volume?.h24 ?? 0;

  const treasuryRevenue = subgraphRig?.treasuryRevenue
    ? parseFloat(subgraphRig.treasuryRevenue)
    : 0;
  const teamRevenue = subgraphRig?.teamRevenue
    ? parseFloat(subgraphRig.teamRevenue)
    : 0;

  // Launcher address from useRigInfo
  const launcherAddress = rigInfo?.launcher || null;

  // Ownership check
  const isOwner = !!(
    account &&
    launcherAddress &&
    account.toLowerCase() === launcherAddress.toLowerCase()
  );

  // Created date from subgraph
  const createdAtTimestamp = subgraphRig?.createdAt
    ? Number(subgraphRig.createdAt)
    : undefined;
  const createdAt = createdAtTimestamp
    ? new Date(createdAtTimestamp * 1000)
    : null;
  const launchDateStr = createdAt ? getRelativeTime(createdAt) : "--";

  // Initial LP price
  const initialPrice = useMemo(() => {
    const usdc = parseFloat(subgraphRig?.usdcAmount ?? "0");
    const unit = parseFloat(subgraphRig?.unitAmount ?? "0");
    if (unit > 0) return usdc / unit;
    return 0;
  }, [subgraphRig?.usdcAmount, subgraphRig?.unitAmount]);

  // Chart data
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const { data: chartData } = usePriceHistory(
    rigAddress,
    timeframe,
    rigInfo?.unitAddress,
    priceUsd,
    createdAtTimestamp,
    initialPrice,
  );

  const displayChange = useMemo(() => {
    if (!chartData || chartData.length === 0 || priceUsd === 0) return 0;
    const firstPoint = chartData.find(d => d.value > 0);
    if (!firstPoint || firstPoint.value === 0) return 0;
    return ((priceUsd - firstPoint.value) / firstPoint.value) * 100;
  }, [chartData, priceUsd]);

  const [hoverData, setHoverData] = useState<HoverData>(null);
  const handleChartHover = useCallback((data: HoverData) => setHoverData(data), []);

  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showHeaderPrice, setShowHeaderPrice] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tokenInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const tokenInfo = tokenInfoRef.current;

    if (!scrollContainer || !tokenInfo) return;

    const handleScroll = () => {
      const tokenInfoBottom = tokenInfo.getBoundingClientRect().bottom;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      setShowHeaderPrice(tokenInfoBottom < containerTop + 10);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const isLoading = isSubgraphLoading || (!!address && isFundLoading && isRigInfoLoading);

  if (isLoading && !subgraphRig) {
    return <LoadingSkeleton />;
  }

  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <Link
            href="/explore"
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className={`text-center transition-opacity duration-200 ${showHeaderPrice ? "opacity-100" : "opacity-0"}`}>
            <div className="text-[15px] font-semibold">{formatPrice(priceUsd)}</div>
            <div className="text-[11px] text-muted-foreground">{tokenSymbol}</div>
          </div>
          <button
            onClick={() => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              composeCast({ text: `Check out $${tokenSymbol} on give.fun`, embeds: [url] });
            }}
            className="p-2 -mr-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4">
          {/* Token Info Section */}
          <div ref={tokenInfoRef} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <TokenLogo name={tokenName} logoUrl={logoUrl} size="lg" />
              <div>
                <div className="text-[13px] text-muted-foreground">{tokenName}</div>
                <div className="text-[15px] font-medium">{tokenSymbol}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="price-large">
                {hoverData && hoverData.value > 0
                  ? formatPrice(hoverData.value)
                  : formatPrice(priceUsd)}
              </div>
              {hoverData ? (
                <div className="text-[13px] font-medium text-zinc-400">
                  {new Date(hoverData.time * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : (
                <div className="text-[13px] font-medium text-zinc-400">
                  {`${displayChange >= 0 ? "+" : ""}${displayChange.toFixed(2)}%`}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="mb-2 -mx-4">
            <PriceChart
              data={chartData}
              height={176}
              onHover={handleChartHover}
              tokenFirstActiveTime={timeframe !== "ALL" ? createdAtTimestamp : undefined}
              initialPrice={timeframe !== "ALL" ? initialPrice : undefined}
            />
          </div>

          {/* Timeframe Selector */}
          <div className="flex justify-between mb-5 px-2">
            {(["1H", "1D", "1W", "1M", "ALL"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                  timeframe === tf
                    ? "bg-zinc-700 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* User Position Section */}
          {hasPosition && (
            <div className="mb-6">
              <div className="font-semibold text-[18px] mb-3">Your position</div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <div className="text-muted-foreground text-[12px] mb-1">Balance</div>
                  <div className="font-semibold text-[15px] tabular-nums flex items-center gap-1.5">
                    <TokenLogo name={tokenName} logoUrl={logoUrl} size="sm" />
                    <span>{formatNumber(userUnitBalance)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px] mb-1">Value</div>
                  <div className="font-semibold text-[15px] tabular-nums text-white">
                    ${positionBalanceUsd.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Global Stats Grid */}
          <div className="mb-6">
            <div className="font-semibold text-[18px] mb-3">Stats</div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Market cap</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  {formatMarketCap(marketCapUsd)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Total supply</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  {formatNumber(totalSupply)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Liquidity</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${formatNumber(liquidityUsd)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">24h volume</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${formatNumber(volume24h)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${treasuryRevenue.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                <div className="font-semibold text-[15px] tabular-nums">
                  ${teamRevenue.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="mb-6">
            <div className="font-semibold text-[18px] mb-3">About</div>

            <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-2">
              <span className="text-zinc-400">Fundraiser</span>
              <span className="text-muted-foreground/60">·</span>
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
                A fundraiser coin. Contributors donate daily and claim each day&apos;s emission proportional to their share.
              </p>
            )}

            {/* Address + link buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {rigInfo?.unitAddress && (
                <a
                  href={`https://basescan.org/token/${rigInfo.unitAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[12px] text-muted-foreground hover:bg-secondary/80 transition-colors"
                >
                  {tokenSymbol}
                </a>
              )}
              {rigInfo?.lpAddress && (
                <a
                  href={`https://basescan.org/address/${rigInfo.lpAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[12px] text-muted-foreground hover:bg-secondary/80 transition-colors"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[12px] text-muted-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            {/* Fundraiser Parameters */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              {!subgraphRig?.fundraiser && (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                      <div className="w-20 h-3 bg-secondary rounded animate-pulse mb-1" />
                      <div className="w-16 h-5 bg-secondary rounded animate-pulse" />
                    </div>
                  ))}
                </>
              )}
              {subgraphRig?.fundraiser && (
                <>
                  <div>
                    <div className="text-muted-foreground text-[12px] mb-0.5">Initial emission</div>
                    <div className="font-semibold text-[14px]">{formatEmission(subgraphRig.fundraiser.initialEmission)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[12px] mb-0.5">Min emission</div>
                    <div className="font-semibold text-[14px]">{formatEmission(subgraphRig.fundraiser.minEmission)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[12px] mb-0.5">Halving</div>
                    <div className="font-semibold text-[14px]">{formatPeriod(String(parseInt(subgraphRig.fundraiser.halvingPeriod) * parseInt(subgraphRig.fundraiser.epochDuration)))}</div>
                  </div>
                  {metadata?.recipientName && (
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Recipient</div>
                      <div className="font-semibold text-[14px]">{metadata.recipientName}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground text-[12px] mb-0.5">{metadata?.recipientName ? "Recipient address" : "Recipient"}</div>
                    <div className="font-semibold text-[14px] font-mono">
                      <AddressLink address={subgraphRig.fundraiser.recipients?.[0]?.recipient ?? null} />
                    </div>
                  </div>
                  {fundraiserState?.treasury && (
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Treasury</div>
                      <div className="font-semibold text-[14px] font-mono">
                        <AddressLink address={fundraiserState.treasury} />
                      </div>
                    </div>
                  )}
                  {fundraiserState?.team && fundraiserState.team !== "0x0000000000000000000000000000000000000000" && (
                    <div>
                      <div className="text-muted-foreground text-[12px] mb-0.5">Team</div>
                      <div className="font-semibold text-[14px] font-mono">
                        <AddressLink address={fundraiserState.team} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* Darkened overlay when menu is open */}
        {showActionMenu && (
          <div
            className="fixed inset-0 z-40 flex justify-center"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
            onClick={() => setShowActionMenu(false)}
          >
            <div className="w-full max-w-[520px] h-full bg-black/50" />
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 flex justify-center" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}>
          <div className="flex items-center justify-between w-full max-w-[520px] px-4 py-3 bg-background">
            <div>
              <div className="text-muted-foreground text-[12px]">Market Cap</div>
              <div className="font-semibold text-[17px] tabular-nums">
                {formatMarketCap(marketCapUsd)}
              </div>
            </div>
            <div className="relative">
              {isConnected ? (
                <>
                  {showActionMenu && (
                    <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1.5">
                      <button
                        onClick={() => {
                          setShowActionMenu(false);
                          setTradeMode("buy");
                          setShowTradeModal(true);
                        }}
                        className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => {
                          setShowActionMenu(false);
                          setTradeMode("sell");
                          setShowTradeModal(true);
                        }}
                        className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                      >
                        Sell
                      </button>
                      <button
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowDonateModal(true);
                        }}
                        className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                      >
                        Donate
                      </button>
                      <button
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowAuctionModal(true);
                        }}
                        className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                      >
                        Auction
                      </button>
                      <button
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowLiquidityModal(true);
                        }}
                        className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                      >
                        Liquidity
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            setShowAdminModal(true);
                          }}
                          className="w-32 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[14px] transition-colors"
                        >
                          Admin
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className={`w-32 h-10 text-[14px] font-semibold rounded-xl transition-all ${
                      showActionMenu
                        ? "bg-black border-2 border-white text-white"
                        : "bg-white text-black"
                    }`}
                  >
                    {showActionMenu ? "\u2715" : "Actions"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => connect()}
                  disabled={isConnecting || isInFrame === true}
                  className="w-40 h-10 text-[14px] font-semibold rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <NavBar />

      {/* Donate Modal */}
      <DonateModal
        isOpen={showDonateModal}
        onClose={() => setShowDonateModal(false)}
        rigAddress={rigAddress}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        tokenLogoUrl={logoUrl}
        recipientName={metadata?.recipientName}
      />

      {/* Trade Modal (Buy/Sell) */}
      <TradeModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        mode={tradeMode}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        unitAddress={(rigInfo?.unitAddress ?? "0x0") as `0x${string}`}
        marketPrice={priceUsd}
        userQuoteBalance={accountQuoteBalance ?? 0n}
        userUnitBalance={accountUnitBalance ?? 0n}
      />

      {/* Auction Modal */}
      <AuctionModal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        rigAddress={rigAddress}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        multicallAddress={multicallAddress}
      />

      {/* Liquidity Modal */}
      <LiquidityModal
        isOpen={showLiquidityModal}
        onClose={() => setShowLiquidityModal(false)}
        unitAddress={(rigInfo?.unitAddress ?? "0x0") as `0x${string}`}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        tokenBalance={userUnitBalance}
        usdcBalance={userUsdcBalance}
        tokenPrice={priceUsd}
      />

      {/* Admin Modal */}
      <AdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        rigAddress={rigAddress}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        currentConfig={{
          treasury: fundraiserState?.treasury ?? "",
          team: fundraiserState?.team ?? null,
          uri: rigUri ?? "",
          recipient: subgraphRig?.fundraiser?.recipients?.[0]?.recipient ?? null,
        }}
      />

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
