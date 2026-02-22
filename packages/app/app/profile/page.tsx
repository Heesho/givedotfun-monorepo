"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { NavBar } from "@/components/nav-bar";
import { useFarcaster } from "@/hooks/useFarcaster";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTokenMetadata } from "@/hooks/useMetadata";
import { CONTRACT_ADDRESSES, ERC20_ABI, MOCK_MINT_ABI, QUOTE_TOKEN_DECIMALS } from "@/lib/contracts";
import type { UserHolding, UserLaunchedFundraiser } from "@/hooks/useUserProfile";
import { formatNumber } from "@/lib/format";
import { TokenLogo } from "@/components/token-logo";

type Tab = "holdings" | "launched";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  if (value > 0) return `<$0.01`;
  return "$0.00";
}

// ---------------------------------------------------------------------------
// HoldingRow
// ---------------------------------------------------------------------------

function HoldingRow({ holding }: { holding: UserHolding }) {
  const { logoUrl } = useTokenMetadata(holding.fundraiserUri);

  return (
    <Link href={`/fundraiser/${holding.address}`} className="block">
      <div className="flex items-center justify-between py-3 hover:bg-secondary/30 -mx-4 px-4 transition-colors rounded-lg">
        <div className="flex items-center gap-3 min-w-0">
          <TokenLogo name={holding.tokenName} logoUrl={logoUrl} size="md-lg" />
          <div className="min-w-0">
            <div className="text-[15px] font-medium truncate">
              {holding.tokenName}
            </div>
            <div className="text-[12px] text-muted-foreground flex items-center gap-1">
              <img src="/botanicals/leaf-prism.svg" className="w-3.5 h-3.5" alt="" />
              <span className="shimmer-iridescent font-medium">
                {formatNumber(holding.balanceNum)} {holding.tokenSymbol}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-[15px] font-semibold tabular-nums">
            {holding.valueUsd > 0 ? formatUsd(holding.valueUsd) : "--"}
          </div>
          <div className="text-[12px] text-muted-foreground tabular-nums">
            {holding.priceUsd > 0
              ? `$${holding.priceUsd >= 0.01 ? holding.priceUsd.toFixed(4) : holding.priceUsd.toFixed(6)}`
              : "--"}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LaunchedRow
// ---------------------------------------------------------------------------

function LaunchedRow({ fundraiser }: { fundraiser: UserLaunchedFundraiser }) {
  const { logoUrl } = useTokenMetadata(fundraiser.fundraiserUri);

  return (
    <Link href={`/fundraiser/${fundraiser.address}`} className="block">
      <div className="flex items-center justify-between py-3 hover:bg-secondary/30 -mx-4 px-4 transition-colors rounded-lg">
        <div className="flex items-center gap-3 min-w-0">
          <TokenLogo name={fundraiser.tokenName} logoUrl={logoUrl} size="md-lg" />
          <div className="min-w-0">
            <div className="text-[15px] font-medium truncate">
              {fundraiser.tokenName}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {fundraiser.tokenSymbol}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-[15px] font-semibold tabular-nums">
            {fundraiser.marketCapUsd > 0 ? formatUsd(fundraiser.marketCapUsd) : "--"}
          </div>
          <div className="text-[12px] text-muted-foreground tabular-nums">
            Mcap
          </div>
        </div>
      </div>
      <div className="w-full mt-1">
        <img
          src="/botanicals/growth-vine.svg"
          className="h-2 opacity-60"
          style={{ width: `${Math.min(100, Math.max(10, (fundraiser.marketCapUsd / 10000) * 100))}%` }}
          alt=""
        />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <main className="flex h-screen w-screen justify-center bg-concrete-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-concrete-700 animate-pulse" />
            <div>
              <div className="w-28 h-5 bg-concrete-700 rounded animate-pulse mb-1" />
              <div className="w-20 h-4 bg-concrete-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex border-b border-secondary mx-4 mb-4">
          <div className="w-24 h-8 bg-concrete-700 rounded animate-pulse mr-4" />
          <div className="w-24 h-8 bg-concrete-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 px-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-full bg-concrete-700 animate-pulse" />
              <div className="flex-1">
                <div className="w-24 h-4 bg-concrete-700 rounded animate-pulse mb-1" />
                <div className="w-16 h-3 bg-concrete-700 rounded animate-pulse" />
              </div>
              <div className="text-right">
                <div className="w-16 h-4 bg-concrete-700 rounded animate-pulse mb-1" />
                <div className="w-12 h-3 bg-concrete-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <NavBar />
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
    <main className="flex h-screen w-screen justify-center bg-concrete-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-concrete-700 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
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
              <div className="text-[17px] font-semibold mb-1">
                Connecting...
              </div>
              <div className="text-[14px] text-muted-foreground">
                Connecting your Farcaster wallet
              </div>
            </>
          ) : (
            <>
              <div className="text-[17px] font-semibold mb-1">
                Connect your wallet
              </div>
              <div className="text-[14px] text-muted-foreground mb-4">
                Connect a browser wallet to continue
              </div>
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="px-6 py-2.5 rounded-xl bg-moss-400 text-concrete-800 text-[14px] font-bold uppercase tracking-wider hover:bg-moss-300 transition-colors disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}
        </div>
        <NavBar />
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
    <main className="flex h-screen w-screen justify-center bg-concrete-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header with fern-hero backdrop */}
        <div className="relative overflow-hidden">
          <img
            src="/botanicals/fern-hero.svg"
            className="absolute top-0 left-0 w-full h-48 object-cover opacity-[0.12] pointer-events-none select-none"
            aria-hidden="true"
          />
          <div className="relative z-10 px-4 pb-2">
            <div className="mb-3">
              <h1 className="headline-brutal text-xl">Profile</h1>
            </div>
            <div className="flex items-center gap-3 py-3">
              <div className="relative inline-flex items-center justify-center w-24 h-24">
                <img
                  src="/botanicals/vine-ring.svg"
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                />
                <div className="relative z-10">
                  {pfpUrl ? (
                    <img
                      src={pfpUrl}
                      alt={displayName}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl ${
                        isAddressFallbackAvatar
                          ? "font-mono tracking-wide bg-gradient-to-br from-moss-400 to-moss-600"
                          : "font-semibold bg-gradient-to-br from-moss-400 to-moss-600"
                      }`}
                    >
                      {avatarFallback}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[17px] font-semibold">{displayName}</div>
                {username && (
                  <div className="text-[13px] text-muted-foreground">
                    {username}
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio value */}
            <div className="slab slab-accent p-4 mb-3">
              <div className="headline-brutal text-[11px] text-[#8E8E8E] mb-0.5">PORTFOLIO VALUE</div>
              <div className="text-[28px] font-bold tabular-nums">
                {totalValueUsd > 0 ? formatUsd(totalValueUsd) : "$0.00"}
              </div>
            </div>

            {/* Cash Balance */}
            <div className="pb-3">
              <div className="text-[12px] text-muted-foreground mb-1">
                Cash Balance
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[18px] font-semibold tabular-nums">
                  ${formattedUsdc}
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
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isUsdcMinting ? "Minting..." : "Mint 1000"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Heartbeat ticker */}
        <div className="px-4 py-2 mb-1">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {holdings.length > 0 ? (
              holdings.map((h) => (
                <Link key={h.coinAddress} href={`/fundraiser/${h.address}`}>
                  <div
                    className="w-3 h-3 rounded-full bg-moss-400 animate-pulse-glow flex-shrink-0"
                    title={h.tokenName}
                  />
                </Link>
              ))
            ) : (
              <p className="text-[#8E8E8E] text-[13px] italic">Start your garden — donate to a fundraiser</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-secondary px-4">
          <button
            onClick={() => setActiveTab("holdings")}
            className={`pb-2.5 px-1 mr-6 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === "holdings"
                ? "border-moss-400 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Your Garden
            {holdings.length > 0 && (
              <span className="ml-1.5 text-[12px] text-muted-foreground">
                {holdings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("launched")}
            className={`pb-2.5 px-1 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === "launched"
                ? "border-moss-400 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Your Fundraisers
            {launchedFundraisers.length > 0 && (
              <span className="ml-1.5 text-[12px] text-muted-foreground">
                {launchedFundraisers.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4">
          {activeTab === "holdings" && (
            <>
              {holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <img src="/botanicals/empty-garden.svg" className="w-20 h-20 mb-3 opacity-60" alt="" />
                  <div className="headline-brutal text-[15px] mb-1">Your garden is empty</div>
                  <div className="text-[13px] text-[#8E8E8E] mb-4">Donate to grow it</div>
                  <Link
                    href="/explore"
                    className="px-4 py-2 bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider rounded-xl hover:bg-moss-300 transition-colors text-[13px]"
                  >
                    EXPLORE FUNDRAISERS
                  </Link>
                </div>
              ) : (
                <div className="py-1">
                  {holdings.map((holding) => (
                    <HoldingRow
                      key={holding.coinAddress}
                      holding={holding}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "launched" && (
            <>
              {launchedFundraisers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <img src="/botanicals/empty-garden.svg" className="w-20 h-20 mb-3 opacity-60" alt="" />
                  <div className="headline-brutal text-[15px] mb-1">No fundraisers yet</div>
                  <div className="text-[13px] text-[#8E8E8E] mb-4">Plant your first fundraiser</div>
                  <Link
                    href="/launch"
                    className="px-4 py-2 bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider rounded-xl hover:bg-moss-300 transition-colors text-[13px]"
                  >
                    PLANT A FUNDRAISER
                  </Link>
                </div>
              ) : (
                <div className="py-1">
                  {launchedFundraisers.map((fundraiser) => (
                    <LaunchedRow
                      key={fundraiser.address}
                      fundraiser={fundraiser}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <NavBar />
      </div>
    </main>
  );
}
