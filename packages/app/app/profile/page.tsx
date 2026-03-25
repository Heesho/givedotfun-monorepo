"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { NavBar } from "@/components/nav-bar";
import { useFarcaster } from "@/hooks/useFarcaster";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CONTRACT_ADDRESSES, ERC20_ABI, MOCK_MINT_ABI, QUOTE_TOKEN_DECIMALS } from "@/lib/contracts";
import type { UserHolding, UserLaunchedFundraiser } from "@/hooks/useUserProfile";
import { Wallet, Rocket } from "lucide-react";
import { TokenLogo } from "@/components/token-logo";
import { useSparklineData } from "@/hooks/useSparklineData";

type Tab = "holdings" | "launched";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 0.01) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value > 0) return `<$0.01`;
  return "$0.00";
}

/** Mini sparkline chart */
function Sparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const pad = 4;

  const divisor = data.length > 1 ? data.length - 1 : 1;
  const points = data
    .map((value, i) => {
      const x = pad + (i / divisor) * (300 - pad * 2);
      const y = range === 0 ? 50 : pad + (1 - (value - min) / range) * (100 - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 300 100"
      className={`h-8 w-24 ${isPositive ? "positive-value" : "negative-value"}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// HoldingRow
// ---------------------------------------------------------------------------

function HoldingRow({
  holding,
  sparklineData,
  isAlt = false,
}: {
  holding: UserHolding;
  sparklineData: number[];
  isAlt?: boolean;
}) {
  const isPositive = holding.change24h >= 0;

  return (
    <Link
      href={`/fundraiser/${holding.address}`}
      className={`grid grid-cols-[1.2fr_1fr_0.8fr] items-center gap-2 py-4 transition-colors duration-200 ${
        isAlt ? "border-t border-[hsl(var(--outline-variant)/0.1)]" : ""
      } hover-slab`}
    >
      <div className="flex items-center gap-3">
        <TokenLogo name={holding.tokenName} logoUrl={holding.logoUrl} size="md-lg" />
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-semibold uppercase tracking-[-0.02em]">
            {holding.tokenSymbol.length > 6
              ? `${holding.tokenSymbol.slice(0, 6)}...`
              : holding.tokenSymbol}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {holding.tokenName.length > 12
              ? `${holding.tokenName.slice(0, 12)}...`
              : holding.tokenName}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Sparkline data={sparklineData} isPositive={isPositive} />
      </div>
      <div className="text-right">
        <div className="font-medium text-[15px] tabular-nums font-mono">
          {holding.valueUsd > 0 ? formatUsd(holding.valueUsd) : "--"}
        </div>
        <div className={`text-[13px] tabular-nums font-mono ${
          holding.priceUsd > 0
            ? isPositive ? "positive-value" : "negative-value"
            : "text-muted-foreground"
        }`}>
          {holding.priceUsd > 0
            ? `${isPositive ? "+" : ""}${holding.change24h.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
            : "--"}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LaunchedRow
// ---------------------------------------------------------------------------

function LaunchedRow({
  fundraiser,
  sparklineData,
  isAlt = false,
}: {
  fundraiser: UserLaunchedFundraiser;
  sparklineData: number[];
  isAlt?: boolean;
}) {
  const isPositive = fundraiser.change24h >= 0;

  return (
    <Link
      href={`/fundraiser/${fundraiser.address}`}
      className={`grid grid-cols-[1.2fr_1fr_0.8fr] items-center gap-2 py-4 transition-colors duration-200 ${
        isAlt ? "border-t border-[hsl(var(--outline-variant)/0.1)]" : ""
      } hover-slab`}
    >
      <div className="flex items-center gap-3">
        <TokenLogo name={fundraiser.tokenName} logoUrl={fundraiser.logoUrl} size="md-lg" />
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-semibold uppercase tracking-[-0.02em]">
            {fundraiser.tokenSymbol.length > 6
              ? `${fundraiser.tokenSymbol.slice(0, 6)}...`
              : fundraiser.tokenSymbol}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {fundraiser.tokenName.length > 12
              ? `${fundraiser.tokenName.slice(0, 12)}...`
              : fundraiser.tokenName}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Sparkline data={sparklineData} isPositive={isPositive} />
      </div>
      <div className="text-right">
        <div className="font-medium text-[15px] tabular-nums font-mono">
          {fundraiser.marketCapUsd > 0 ? formatUsd(fundraiser.marketCapUsd) : "--"}
        </div>
        <div className={`text-[13px] tabular-nums font-mono ${
          fundraiser.coinPrice > 0
            ? isPositive ? "positive-value" : "negative-value"
            : "text-muted-foreground"
        }`}>
          {fundraiser.coinPrice > 0
            ? `${isPositive ? "+" : ""}${fundraiser.change24h.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
            : "--"}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <main className="app-shell">
      <div
        className="app-frame lg:max-w-[1360px] xl:max-w-[1480px]"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="page-header lg:px-8 lg:pt-24 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px]">
            <div className="mb-3">
              <div className="mb-2 h-3 w-24 bg-secondary animate-pulse" />
              <div className="mb-2 h-10 w-32 bg-secondary animate-pulse" />
              <div className="h-4 w-56 bg-secondary animate-pulse" />
            </div>
            <div className="slab-panel signal-slab-positive space-y-3 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-secondary animate-pulse" />
                <div className="flex-1">
                  <div className="mb-1 h-5 w-28 bg-secondary animate-pulse" />
                  <div className="h-4 w-20 bg-secondary animate-pulse" />
                </div>
                <div className="h-4 w-20 bg-secondary animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="slab-inset px-3 py-3">
                  <div className="mb-1 h-3 w-20 bg-secondary animate-pulse" />
                  <div className="h-8 w-24 bg-secondary animate-pulse" />
                </div>
                <div className="slab-inset px-3 py-3">
                  <div className="mb-1 h-3 w-16 bg-secondary animate-pulse" />
                  <div className="h-8 w-24 bg-secondary animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-9 bg-secondary animate-pulse" />
                <div className="h-9 bg-secondary animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2 px-4 lg:px-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px] space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="slab-inset flex items-center gap-3 px-3 py-3">
                <div className="h-10 w-10 bg-secondary animate-pulse" />
                <div className="flex-1">
                  <div className="mb-1 h-4 w-24 bg-secondary animate-pulse" />
                  <div className="h-3 w-16 bg-secondary animate-pulse" />
                </div>
                <div className="text-right">
                  <div className="mb-1 h-4 w-16 bg-secondary animate-pulse" />
                  <div className="h-3 w-12 bg-secondary animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <NavBar desktopWide />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Not Connected state
// ---------------------------------------------------------------------------

function NotConnected() {
  const { isInFrame, isConnecting, connect } = useFarcaster();

  return (
    <main className="app-shell">
      <div
        className="app-frame lg:max-w-[1360px] xl:max-w-[1480px]"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="slab-panel mb-4 flex h-16 w-16 items-center justify-center">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          {isInFrame ? (
            <>
              <div className="text-[17px] font-semibold mb-1 font-display">
                Connecting...
              </div>
              <div className="text-[14px] text-muted-foreground">
                Connecting your Farcaster wallet
              </div>
            </>
          ) : (
            <>
              <div className="text-[17px] font-semibold mb-1 font-display">
                Connect your wallet
              </div>
              <div className="text-[14px] text-muted-foreground mb-4">
                Connect a browser wallet to continue
              </div>
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="slab-button px-6 text-[11px] disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}
        </div>
        <NavBar desktopWide />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Main Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("holdings");

  // Data hooks
  const { user, address } = useFarcaster();
  const { holdings, launchedFundraisers, totalHoldingsValueUsd, isLoading } = useUserProfile(address);

  // Sparkline data for holdings + launched
  const allCoinAddresses = [
    ...holdings.map((h) => h.coinAddress),
    ...launchedFundraisers.map((f) => f.coinAddress),
  ];
  const { getSparkline } = useSparklineData(allCoinAddresses);

  // USDC balance
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Mock USDC mint (staging only)
  const {
    writeContract: mintUsdc,
    data: usdcTxHash,
    isPending: isUsdcMintPending,
    reset: resetUsdcMint,
  } = useWriteContract();

  const { isLoading: isUsdcTxConfirming, isSuccess: isUsdcTxSuccess } =
    useWaitForTransactionReceipt({ hash: usdcTxHash });

  useEffect(() => {
    if (isUsdcTxSuccess) {
      refetchUsdc();
      resetUsdcMint();
    }
  }, [isUsdcTxSuccess, refetchUsdc, resetUsdcMint]);

  if (!address) {
    return <NotConnected />;
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const usdcNum = usdcBalance != null ? Number(formatUnits(usdcBalance as bigint, QUOTE_TOKEN_DECIMALS)) : 0;
  const formattedUsdc = usdcBalance != null
    ? usdcNum.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "--";

  const isUsdcMinting = isUsdcMintPending || isUsdcTxConfirming;
  const totalValueUsd = usdcNum + totalHoldingsValueUsd;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayName = user?.displayName || user?.username || shortAddress;
  const pfpUrl = user?.pfpUrl || null;
  const username = user?.username ? `@${user.username}` : null;
  const isAddressFallbackAvatar = !user?.displayName && !user?.username;
  const avatarFallback = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.username
      ? user.username.charAt(0).toUpperCase()
      : address.slice(-2).toUpperCase();

  return (
    <main className="app-shell">
      <div
        className="app-frame lg:max-w-[1360px] xl:max-w-[1480px]"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header */}
        <div className="page-header lg:px-8 lg:pt-24 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px]">
            <div className="mb-3">
              <h1 className="page-title">Profile</h1>
              <p className="page-subtitle">Your portfolio, holdings, and launched fundraisers.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {pfpUrl ? (
                  <img
                    src={pfpUrl}
                    alt={displayName}
                    className="ghost-border h-10 w-10 object-cover"
                  />
                ) : (
                  <div
                    className={`ghost-border flex h-10 w-10 items-center justify-center text-foreground ${
                      isAddressFallbackAvatar
                        ? "bg-surface-lowest font-mono text-[14px] tracking-wide"
                        : "bg-surface-lowest text-base font-semibold"
                    }`}
                  >
                    {avatarFallback}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold font-display">{displayName}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {username || shortAddress}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="section-kicker">Wallet</div>
                  <div className="mt-1 font-mono text-[12px] text-muted-foreground">{shortAddress}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="slab-inset px-3 py-3">
                  <div className="section-kicker">Portfolio</div>
                  <div className="mt-1 text-[22px] font-bold tabular-nums font-mono leading-none sm:text-[24px]">
                    {totalValueUsd > 0 ? formatUsd(totalValueUsd) : "$0.00"}
                  </div>
                </div>
                <div className="slab-inset px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="section-kicker">Cash</div>
                      <div className="mt-1 text-[20px] font-semibold tabular-nums font-mono leading-none sm:text-[22px]">
                        ${formattedUsdc}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        mintUsdc({
                          address: CONTRACT_ADDRESSES.usdc as `0x${string}`,
                          abi: MOCK_MINT_ABI,
                          functionName: "mint",
                          args: [address!, parseUnits("1000", QUOTE_TOKEN_DECIMALS)],
                        })
                      }
                      disabled={isUsdcMinting}
                      className="mt-0.5 text-right text-[10px] font-display uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                    >
                      {isUsdcMinting ? "Minting..." : "Mint 1000"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab("holdings")}
                  className={`ghost-border flex h-9 items-center justify-center gap-2 px-3 font-display text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${
                    activeTab === "holdings"
                      ? "bg-primary text-primary-foreground shadow-slab"
                      : "bg-muted text-muted-foreground hover:bg-surface-high hover:text-foreground"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Coins
                </button>
                <button
                  onClick={() => setActiveTab("launched")}
                  className={`ghost-border flex h-9 items-center justify-center gap-2 px-3 font-display text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${
                    activeTab === "launched"
                      ? "bg-primary text-primary-foreground shadow-slab"
                      : "bg-muted text-muted-foreground hover:bg-surface-high hover:text-foreground"
                  }`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Fundraisers
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-2 lg:px-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px]">
          {activeTab === "holdings" && (
            <>
              {holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="slab-panel mb-3 flex h-12 w-12 items-center justify-center">
                    <svg
                      className="w-6 h-6 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 9h16.5m-16.5 6h16.5m-15-9h13.5A2.25 2.25 0 0121 8.25v7.5A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75v-7.5A2.25 2.25 0 015.25 6z"
                      />
                    </svg>
                  </div>
                  <div className="text-[15px] font-medium mb-1 font-display">
                    No holdings yet
                  </div>
                  <div className="text-[13px] text-muted-foreground mb-4">
                    Fund a cause or trade to earn coins
                  </div>
                  <Link
                    href="/explore"
                    className="slab-button px-4 text-[11px]"
                  >
                    Explore coins
                  </Link>
                </div>
              ) : (
                <div>
                  {holdings.map((holding, index) => {
                    const hourly = getSparkline(holding.coinAddress, holding.priceUsd);
                    const sparklineData = hourly.length > 1 ? hourly
                      : holding.sparklinePrices.length > 1 ? holding.sparklinePrices
                      : [holding.priceUsd, holding.priceUsd];
                    return (
                      <HoldingRow
                        key={holding.coinAddress}
                        holding={holding}
                        sparklineData={sparklineData}
                        isAlt={index % 2 === 1}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "launched" && (
            <>
              {launchedFundraisers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="slab-panel mb-3 flex h-12 w-12 items-center justify-center">
                    <svg
                      className="w-6 h-6 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                      />
                    </svg>
                  </div>
                  <div className="text-[15px] font-medium mb-1 font-display">
                    No launches yet
                  </div>
                  <div className="text-[13px] text-muted-foreground mb-4">
                    You haven&apos;t launched any fundraisers yet
                  </div>
                  <Link
                    href="/launch"
                    className="slab-button px-4 text-[11px]"
                  >
                    Launch a fundraiser
                  </Link>
                </div>
              ) : (
                <div>
                  {launchedFundraisers.map((fundraiser, index) => {
                    const hourly = getSparkline(fundraiser.coinAddress, fundraiser.coinPrice);
                    const sparklineData = hourly.length > 1 ? hourly
                      : fundraiser.sparklinePrices.length > 1 ? fundraiser.sparklinePrices
                      : [fundraiser.coinPrice, fundraiser.coinPrice];
                    return (
                      <LaunchedRow
                        key={fundraiser.address}
                        fundraiser={fundraiser}
                        sparklineData={sparklineData}
                        isAlt={index % 2 === 1}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
          </div>
        </div>

        <NavBar desktopWide />
      </div>
    </main>
  );
}
