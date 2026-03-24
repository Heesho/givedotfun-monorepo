"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Flame, Clock, TrendingUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/nav-bar";
import { useExploreFundraisers, type SortOption } from "@/hooks/useAllFundraisers";
import { useSparklineData } from "@/hooks/useSparklineData";
import { useFarcaster } from "@/hooks/useFarcaster";
import { formatMarketCap } from "@/lib/format";
import { TokenLogo } from "@/components/token-logo";


/** Mini sparkline chart */
function Sparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const pad = 4; // padding so strokes aren't clipped at edges

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

function SkeletonRow() {
  return (
    <div className="slab-inset grid grid-cols-[1.2fr_1fr_0.8fr] items-center gap-2 px-3 py-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-secondary animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-16 bg-secondary animate-pulse" />
          <div className="h-3 w-24 bg-secondary animate-pulse" />
        </div>
      </div>
      <div className="flex justify-center">
        <div className="h-8 w-16 bg-secondary animate-pulse" />
      </div>
      <div className="text-right space-y-2">
        <div className="ml-auto h-4 w-14 bg-secondary animate-pulse" />
        <div className="ml-auto h-3 w-10 bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("bump");
  const { address: account } = useFarcaster();

  const { coins, isLoading } = useExploreFundraisers(sortBy, searchQuery, account);

  // Batch fetch hourly sparkline data (7 days, more granular than daily)
  const coinAddresses = coins.map((c) => c.coinAddress);
  const { getSparkline } = useSparklineData(coinAddresses);

  const isSearching = searchQuery.length > 0;
  const showEmpty = !isLoading && coins.length === 0;

  return (
    <main className="app-shell">
      <div
        className="app-frame"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {/* Header */}
        <div className="page-header">
          <div className="mb-4">
            <div className="section-kicker">Financial Intelligence</div>
            <h1 className="page-title mt-2">Explore</h1>
            <p className="page-subtitle">Discover fundraisers and mine coins by funding causes you care about.</p>
          </div>

          {/* Search + Sort */}
          <div className="slab-panel signal-slab-positive space-y-3 px-3 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field-input h-11 pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "bump" as const, label: "Bump", icon: Flame },
                { key: "new" as const, label: "New", icon: Clock },
                { key: "top" as const, label: "Top", icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSortBy(tab.key)}
                  className={`ghost-border flex h-10 items-center justify-center gap-1 px-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${
                    sortBy === tab.key
                      ? "bg-primary text-primary-foreground shadow-slab"
                      : "bg-muted text-muted-foreground hover:bg-surface-high hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-3">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )}

          {/* Loaded - render coin rows */}
          {!isLoading && coins.length > 0 && (
            <div>
              <AnimatePresence initial={false}>
                {coins.map((coin, index) => (
                  <motion.div
                    key={coin.address}
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Link
                      href={`/fundraiser/${coin.address}`}
                      className={`grid grid-cols-[1.2fr_1fr_0.8fr] items-center gap-2 px-3 py-4 transition-colors duration-200 ${
                        index % 2 === 0 ? "data-row" : "data-row data-row-alt"
                      } hover-slab`}
                    >
                      {/* Left side - Logo, Symbol, Name */}
                      <div className="flex items-center gap-3">
                        <TokenLogo
                          name={coin.tokenName}
                          logoUrl={coin.logoUrl}
                          size="md-lg"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-display text-[15px] font-semibold uppercase tracking-[-0.02em]">
                            {coin.tokenSymbol.length > 6
                              ? `${coin.tokenSymbol.slice(0, 6)}...`
                              : coin.tokenSymbol}
                          </div>
                          <div className="truncate text-[13px] text-muted-foreground">
                            {coin.tokenName.length > 12
                              ? `${coin.tokenName.slice(0, 12)}...`
                              : coin.tokenName}
                          </div>
                        </div>
                      </div>

                      {/* Middle - Sparkline */}
                      <div className="flex justify-end">
                        <Sparkline
                          data={(() => {
                            const hourly = getSparkline(coin.coinAddress, coin.priceUsd);
                            if (hourly.length > 1) return hourly;
                            if (coin.sparklinePrices.length > 1) return coin.sparklinePrices;
                            return [coin.priceUsd, coin.priceUsd];
                          })()}
                          isPositive={coin.change24h >= 0}
                        />
                      </div>

                      {/* Right side - Market cap and 24h change */}
                      <div className="text-right">
                        <div className="font-medium text-[15px] tabular-nums font-mono">
                          {coin.marketCapUsd > 0
                            ? formatMarketCap(coin.marketCapUsd)
                            : "--"}
                        </div>
                        <div className={`text-[13px] tabular-nums font-mono ${
                          coin.marketCapUsd > 0
                            ? coin.change24h >= 0 ? "positive-value" : "negative-value"
                            : "text-muted-foreground"
                        }`}>
                          {coin.marketCapUsd > 0
                            ? `${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                            : "--"}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Empty states */}
          {showEmpty && isSearching && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Search className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-[15px] font-medium">No coins found</p>
              <p className="text-[13px] mt-1 opacity-70">Try a different search term</p>
            </div>
          )}

          {showEmpty && !isSearching && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Flame className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-[15px] font-medium">No fundraisers yet</p>
              <p className="text-[13px] mt-1 opacity-70">Be the first to launch a fundraiser</p>
            </div>
          )}
        </div>
      </div>
      <NavBar />
    </main>
  );
}
