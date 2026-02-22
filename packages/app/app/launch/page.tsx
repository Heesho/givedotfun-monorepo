"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, ChevronDown, ChevronUp, X, Heart } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { parseUnits, formatUnits, parseEventLogs } from "viem";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { useFarcaster } from "@/hooks/useFarcaster";
import {
  useBatchedTransaction,
  encodeApproveCall,
  encodeContractCall,
  type Call,
} from "@/hooks/useBatchedTransaction";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  QUOTE_TOKEN_DECIMALS,
  ERC20_ABI,
} from "@/lib/contracts";

// USDC token icon - blue circle with $ sign
function UsdcIcon({ size = 20 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-[#2775CA] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-bold text-white"
        style={{ fontSize: size * 0.5 }}
      >
        $
      </span>
    </div>
  );
}

// Bounds matching smart contract validation (for UI enforcement)
const BOUNDS = {
  // Auction-specific bounds (LP token units, 18 decimals)
  auctionEpochPeriod: { min: 3600, max: 31536000 }, // 1 hour - 365 days
  auctionPriceMultiplier: { min: 1.1, max: 3 },
  auctionMinInitPrice: { min: 0.000001, max: 1e12 },
  auctionInitPrice: { min: 0.000001, max: 1e12 },

  // Fundraiser: Time-based halving
  halvingPeriod: { min: 604800, max: 31536000 }, // 7 days - 365 days (in seconds)

  // Fundraiser: Daily emission
  initialEmission: { min: 1, max: 1e12 }, // Contract: 1e18 - 1e30 wei/day (1 - 1e12 tokens/day)
  minEmission: { min: 1 }, // Must be > 0 and <= initialEmission
};

// Default values for fundraiser launch
const DEFAULTS = {
  usdcAmount: 1,
  coinAmount: 1000,
  initialEmission: 50000, // 50,000 tokens/day
  minEmission: 5000, // 5,000 tokens/day floor
  halvingPeriod: 30 * 24 * 3600, // 30 days
  epochDuration: 86400, // 1 day
  auctionEpochPeriod: 86400, // 1 day
  auctionPriceMultiplier: 1.2, // 1.2x
  auctionTargetUsd: 100, // target $100 min auction price
};

// Emission preview component
function EmissionPreview({
  initialEmission,
  minEmission,
  halvingPeriod,
  compact = false,
}: {
  initialEmission: number;
  minEmission: number;
  halvingPeriod: number;
  compact?: boolean;
}) {
  const formatSupply = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    if (n >= 1) return n.toFixed(0);
    return n.toFixed(2);
  };

  const formatTime = (days: number) => {
    if (days >= 365) {
      const years = days / 365;
      return years >= 10 ? `${Math.round(years)}y` : `${years.toFixed(1)}y`;
    }
    return `${Math.round(days)}d`;
  };

  // Time-based halving: daily emission, we know time, calculate supply
  const initialPerSec = initialEmission / 86400;
  const tailPerSec = minEmission / 86400;

  // Calculate halvings to reach tail
  let totalHalvings = 0;
  let currentRate = initialPerSec;
  while (currentRate > tailPerSec && totalHalvings < 64) {
    totalHalvings++;
    currentRate = initialPerSec / Math.pow(2, totalHalvings);
  }

  const halvingPeriodDays = halvingPeriod / 86400;

  // First halving
  const firstHalvingDays = halvingPeriodDays;
  const firstHalvingSupply = initialPerSec * halvingPeriod;

  // 50% to floor (halfway through halvings)
  const halfHalvings = Math.floor(totalHalvings / 2);
  let halfwaySupply = 0;
  for (let i = 0; i < halfHalvings; i++) {
    halfwaySupply += (initialPerSec / Math.pow(2, i)) * halvingPeriod;
  }

  // Floor reached
  const floorDays = totalHalvings * halvingPeriodDays;
  let floorSupply = 0;
  for (let i = 0; i < totalHalvings; i++) {
    floorSupply += (initialPerSec / Math.pow(2, i)) * halvingPeriod;
  }

  // After floor
  const afterFloorPerYear = tailPerSec * 86400 * 365;

  const content = (
    <>
      <div className="text-[13px] font-semibold text-foreground">Emission Schedule</div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">First halving</span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatTime(firstHalvingDays)} · {formatSupply(firstHalvingSupply)} coins
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Floor reached</span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatTime(floorDays)} · {formatSupply(floorSupply)} coins
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">After floor</span>
          <span className="text-foreground font-semibold tabular-nums">
            +{formatSupply(afterFloorPerYear)}/year forever
          </span>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground pt-1">
        {totalHalvings} halvings
      </div>
    </>
  );

  if (compact) {
    return <div className="space-y-2">{content}</div>;
  }

  return <div className="rounded-xl ring-1 ring-concrete-600 bg-concrete-800/40 p-3 space-y-2">{content}</div>;
}

// Settings summary component
function SettingsSummary({
  usdcAmount,
  coinAmount,
  initialEmission,
  minEmission,
  halvingPeriod,
}: {
  usdcAmount: number;
  coinAmount: number;
  initialEmission: number;
  minEmission: number;
  halvingPeriod: number;
}) {
  const formatNum = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    if (n >= 1) return n.toFixed(0);
    return n.toFixed(2);
  };

  const formatDur = (seconds: number) => {
    if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
    if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <div className="bg-concrete-800/50 rounded-lg p-3 space-y-3">
      <div className="text-[13px] font-medium text-[#8E8E8E]">Current Parameters</div>

      {/* All settings as bullet points */}
      <div className="space-y-1">
        <div className="text-[12px] text-[#8E8E8E] flex items-center gap-2">
          <span className="text-concrete-500">•</span>
          Initial LP: ${formatNum(usdcAmount)} + {formatNum(coinAmount)} coins
        </div>
        <div className="text-[12px] text-[#8E8E8E] flex items-center gap-2">
          <span className="text-concrete-500">•</span>
          Starting price: ${(usdcAmount / coinAmount).toFixed(6)}
        </div>
        <div className="text-[12px] text-[#8E8E8E] flex items-center gap-2">
          <span className="text-concrete-500">•</span>
          Emission: {formatNum(initialEmission)}/day initial → {formatNum(minEmission)}/day floor
        </div>
        <div className="text-[12px] text-[#8E8E8E] flex items-center gap-2">
          <span className="text-concrete-500">•</span>
          Halving every {formatDur(halvingPeriod)}
        </div>
        <div className="text-[12px] text-[#8E8E8E] flex items-center gap-2">
          <span className="text-concrete-500">•</span>
          Donation split: 50% recipient, 45% treasury, 4% team, 1% protocol
        </div>
      </div>

      {/* Emission Schedule */}
      <div className="pt-3">
        <EmissionPreview
          initialEmission={initialEmission}
          minEmission={minEmission}
          halvingPeriod={halvingPeriod}
          compact
        />
      </div>
    </div>
  );
}

// Slider component
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue,
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  description?: string;
}) {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-[13px] font-medium tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-concrete-600 rounded-full appearance-none cursor-pointer accent-moss-400"
      />
      {description && (
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

// Minimal ABI for parsing Core__Launched event from tx receipt
const LAUNCHED_EVENT_ABI = [
  {
    type: "event",
    name: "Core__Launched",
    inputs: [
      { name: "launcher", type: "address", indexed: true },
      { name: "fundraiser", type: "address", indexed: true },
      { name: "coin", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: false },
      { name: "auction", type: "address", indexed: false },
      { name: "lpToken", type: "address", indexed: false },
      { name: "quoteToken", type: "address", indexed: false },
      { name: "tokenName", type: "string", indexed: false },
      { name: "tokenSymbol", type: "string", indexed: false },
      { name: "uri", type: "string", indexed: false },
      { name: "usdcAmount", type: "uint256", indexed: false },
      { name: "coinAmount", type: "uint256", indexed: false },
      { name: "initialEmission", type: "uint256", indexed: false },
      { name: "minEmission", type: "uint256", indexed: false },
      { name: "halvingPeriod", type: "uint256", indexed: false },
      { name: "epochDuration", type: "uint256", indexed: false },
      { name: "auctionInitPrice", type: "uint256", indexed: false },
      { name: "auctionEpochPeriod", type: "uint256", indexed: false },
      { name: "auctionPriceMultiplier", type: "uint256", indexed: false },
      { name: "auctionMinInitPrice", type: "uint256", indexed: false },
    ],
  },
] as const;

export default function LaunchPage() {
  const router = useRouter();
  const { address: account, isConnected, isConnecting, connect } = useFarcaster();
  const { execute, status: txStatus, txHash, batchReceipts, error: txError, reset: resetTx } = useBatchedTransaction();

  // Extract fundraiser address from tx receipt
  const [launchedFundraiserAddress, setLaunchedFundraiserAddress] = useState<string | null>(null);
  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  // Helper to extract fundraiser address from parsed logs
  const extractFundraiserAddress = (logs: readonly { address: string; topics: readonly string[]; data: string }[]) => {
    try {
      const parsed = parseEventLogs({
        abi: LAUNCHED_EVENT_ABI,
        logs: logs as Parameters<typeof parseEventLogs>["0"]["logs"],
      });
      const launchedEvent = parsed.find(
        (e) => e.eventName === "Core__Launched"
      );
      if (launchedEvent?.args && "fundraiser" in launchedEvent.args) {
        return launchedEvent.args.fundraiser as string;
      }
    } catch (err) {
      console.error("Failed to parse launch event logs:", err);
    }
    return null;
  };

  // Parse from sequential tx receipt
  useEffect(() => {
    if (!txReceipt?.logs || launchedFundraiserAddress) return;
    const addr = extractFundraiserAddress(txReceipt.logs);
    if (addr) setLaunchedFundraiserAddress(addr);
  }, [txReceipt, launchedFundraiserAddress]);

  // Parse from EIP-5792 batch receipts (batch mode may not populate txHash)
  useEffect(() => {
    if (!batchReceipts || launchedFundraiserAddress) return;
    for (const receipt of batchReceipts) {
      if (receipt.logs) {
        const addr = extractFundraiserAddress(receipt.logs as never);
        if (addr) {
          setLaunchedFundraiserAddress(addr);
          break;
        }
      }
    }
  }, [batchReceipts, launchedFundraiserAddress]);

  // Read user's USDC balance
  const { data: usdcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: !!account },
  });

  // Basic info
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [donationMessage, setDonationMessage] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Recipient fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // Links (websites, socials)
  const [links, setLinks] = useState<string[]>([]);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Liquidity
  const [usdcAmount, setUsdcAmount] = useState(DEFAULTS.usdcAmount);
  const [coinAmount, setCoinAmount] = useState(DEFAULTS.coinAmount);

  // Emission
  const [initialEmission, setInitialEmission] = useState(DEFAULTS.initialEmission);
  const [minEmission, setMinEmission] = useState(DEFAULTS.minEmission);
  const [halvingPeriod, setHalvingPeriod] = useState(DEFAULTS.halvingPeriod);

  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Auto-reset error state after 10 seconds so button reverts to normal
  useEffect(() => {
    if (txStatus !== "error" && !launchError) return;
    if (launchError) console.error("[Launch Error]", launchError);
    if (txStatus === "error") console.error("[Tx Error]", txStatus);
    const timer = setTimeout(() => {
      resetTx();
      setLaunchError(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [txStatus, launchError, resetTx]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAdvancedToDefaults = () => {
    setUsdcAmount(DEFAULTS.usdcAmount);
    setCoinAmount(DEFAULTS.coinAmount);
    setInitialEmission(DEFAULTS.initialEmission);
    setMinEmission(DEFAULTS.minEmission);
    setHalvingPeriod(DEFAULTS.halvingPeriod);
  };

  // Validate Ethereum address format
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Form validation
  const isFormValid = (() => {
    if (!logoFile) return false;
    if (!tokenName.trim().length || !tokenSymbol.trim().length) return false;
    if (!tokenDescription.trim().length || !donationMessage.trim().length) return false;
    if (!recipientName.trim().length) return false;
    if (!isValidAddress(recipientAddress)) return false;
    return true;
  })();

  const isLaunching = txStatus === "pending" || txStatus === "confirming";

  const uploadLogoToPinata = async (): Promise<string> => {
    if (!logoFile) return "";
    const formData = new FormData();
    formData.append("file", logoFile);
    formData.append("tokenSymbol", tokenSymbol);

    const res = await fetch("/api/pinata/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data?.ipfsUrl) {
      throw new Error(data?.error || "Logo upload failed");
    }
    return data.ipfsUrl as string;
  };

  const uploadMetadataToPinata = async (imageUrl: string): Promise<string> => {
    const res = await fetch("/api/pinata/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tokenName,
        symbol: tokenSymbol,
        image: imageUrl,
        description: tokenDescription,
        defaultMessage: donationMessage || "gm",
        recipientName: recipientName || undefined,
        links: links.filter((l) => l.trim() !== ""),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ipfsUrl) {
      throw new Error(data?.error || "Metadata upload failed");
    }
    return data.ipfsUrl as string;
  };

  const handleLaunch = async () => {
    if (!isFormValid || isLaunching) return;

    setLaunchError(null);

    let launcher = account;
    if (!launcher) {
      try {
        launcher = await connect();
      } catch (err) {
        setLaunchError("Wallet connection failed.");
        return;
      }
    }

    if (!launcher) {
      setLaunchError("Wallet not connected.");
      return;
    }

    try {
      // Upload metadata
      setIsUploading(true);
      const logoIpfsUrl = await uploadLogoToPinata();
      const uri = await uploadMetadataToPinata(logoIpfsUrl);
      setIsUploading(false);

      const usdcAmountWei = parseUnits(usdcAmount.toString(), QUOTE_TOKEN_DECIMALS);
      const coinAmountWei = parseUnits(coinAmount.toString(), 18);

      // Compute auction price in LP tokens to target a dollar value
      // Formula: auctionLpPrice = targetUsd / (2e6 * sqrt(usdcAmount / coinAmount))
      const auctionLpPrice = DEFAULTS.auctionTargetUsd / (2_000_000 * Math.sqrt(usdcAmount / coinAmount));
      const auctionInitPriceWei = parseUnits(auctionLpPrice.toFixed(18), 18);
      const auctionMinInitPriceWei = auctionInitPriceWei;
      const auctionEpochPeriodWei = BigInt(DEFAULTS.auctionEpochPeriod);
      const auctionPriceMultiplierWei = parseUnits(DEFAULTS.auctionPriceMultiplier.toString(), 18);

      const quoteToken = CONTRACT_ADDRESSES.usdc as `0x${string}`;

      const initialEmissionWei = parseUnits(initialEmission.toString(), 18);
      const minEmissionWei = parseUnits(minEmission.toString(), 18);
      const epochDurationSecs = DEFAULTS.epochDuration;
      const halvingPeriodEpochs = Math.max(1, Math.round(halvingPeriod / epochDurationSecs));

      const multicallAddress = CONTRACT_ADDRESSES.multicall as `0x${string}`;
      const launchParams = {
        launcher,
        quoteToken,
        recipient: recipientAddress as `0x${string}`,
        tokenName,
        tokenSymbol,
        uri,
        usdcAmount: usdcAmountWei,
        coinAmount: coinAmountWei,
        initialEmission: initialEmissionWei,
        minEmission: minEmissionWei,
        halvingPeriod: BigInt(halvingPeriodEpochs),
        epochDuration: BigInt(epochDurationSecs),
        auctionInitPrice: auctionInitPriceWei,
        auctionEpochPeriod: auctionEpochPeriodWei,
        auctionPriceMultiplier: auctionPriceMultiplierWei,
        auctionMinInitPrice: auctionMinInitPriceWei,
      };

      const calls: Call[] = [
        encodeApproveCall(quoteToken, multicallAddress, usdcAmountWei),
        encodeContractCall(multicallAddress, MULTICALL_ABI, "launch", [launchParams]),
      ];

      await execute(calls);
    } catch (err) {
      setIsUploading(false);
      setLaunchError(err instanceof Error ? err.message : "Launch failed.");
    }
  };

  // Format helpers
  const formatDuration = (seconds: number) => {
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDailyRate = (n: number) => `${formatNumber(n)}/day`;

  // Launch form
  return (
    <main className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-concrete-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 120px)",
        }}
      >
        {/* Corner moss decoration */}
        <img
          src="/botanicals/corner-moss.svg"
          className="absolute top-4 right-4 w-16 opacity-40 pointer-events-none select-none"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <Link
            href="/explore"
            className="p-2 -ml-2 rounded-xl hover:bg-concrete-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </Link>
          <div className="text-center">
            <h1 className="headline-brutal text-xl">CREATE A FUNDRAISER</h1>
            <p className="text-[#8E8E8E] text-[14px] mt-1">Launch a perpetual funding campaign on Base</p>
          </div>
          <div className="w-9" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2">
          {/* Token Details Form */}
            <div className="space-y-3">
              {/* Slab 1: Token Identity */}
              <div className="slab p-4">
                <h3 className="headline-brutal text-[13px] text-[#8E8E8E] mb-4 border-l-[3px] border-moss-400 pl-3">TOKEN IDENTITY</h3>
                {/* Logo + Name + Symbol Row */}
                <div className="flex items-start gap-4">
                  {/* Logo Upload */}
                  <label className="cursor-pointer flex-shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <div className="w-[88px] h-[88px] rounded-xl border-2 border-dashed border-moss-400/50 bg-concrete-800 flex items-center justify-center overflow-hidden hover:border-moss-400 hover:shadow-glow transition-all">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Coin logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Upload className="w-6 h-6 text-[#8E8E8E]" />
                      )}
                    </div>
                  </label>

                  {/* Name + Symbol */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">NAME</label>
                      <input
                        type="text"
                        placeholder="Coin name"
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        className="input-recessed w-full h-10 px-3 text-white placeholder:text-concrete-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">SYMBOL</label>
                      <input
                        type="text"
                        placeholder="SYMBOL"
                        value={tokenSymbol}
                        onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="input-recessed w-full h-10 px-3 text-white placeholder:text-concrete-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-3" aria-hidden="true" />

              {/* Slab 2: Your Cause */}
              <div className="slab p-4">
                <h3 className="headline-brutal text-[13px] text-[#8E8E8E] mb-4 border-l-[3px] border-moss-400 pl-3">YOUR CAUSE</h3>

                {/* Description */}
                <div className="mb-3">
                  <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">DESCRIPTION</label>
                  <textarea
                    placeholder="Description"
                    value={tokenDescription}
                    onChange={(e) => setTokenDescription(e.target.value)}
                    rows={2}
                    className="input-recessed w-full px-3 py-2 text-white placeholder:text-concrete-500 resize-none text-sm"
                  />
                </div>

                {/* Donation Message */}
                <div className="mb-3">
                  <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">DEFAULT MESSAGE</label>
                  <input
                    type="text"
                    placeholder="Donation message"
                    value={donationMessage}
                    onChange={(e) => setDonationMessage(e.target.value)}
                    className="input-recessed w-full h-10 px-3 text-white placeholder:text-concrete-500 text-sm"
                  />
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="headline-brutal text-[11px] text-[#8E8E8E]">LINKS</label>
                    {links.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setLinks([...links, ""])}
                        className="text-[12px] text-moss-400 hover:text-moss-300 transition-colors"
                      >
                        + Add link
                      </button>
                    )}
                  </div>
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={link}
                        onChange={(e) => {
                          const updated = [...links];
                          updated[i] = e.target.value;
                          setLinks(updated);
                        }}
                        className="input-recessed flex-1 h-10 px-3 text-white placeholder:text-concrete-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setLinks(links.filter((_, j) => j !== i))}
                        className="px-2 text-[#8E8E8E] hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-3" aria-hidden="true" />

              {/* Slab 3: Recipient */}
              <div className="slab p-4">
                <h3 className="headline-brutal text-[13px] text-[#8E8E8E] mb-4 border-l-[3px] border-moss-400 pl-3">RECIPIENT</h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  The wallet that receives 50% of every donation.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">NAME</label>
                    <input
                      type="text"
                      placeholder="Recipient name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="input-recessed w-full h-10 px-3 text-white placeholder:text-concrete-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="headline-brutal text-[11px] text-[#8E8E8E] mb-1 block">WALLET ADDRESS</label>
                    <input
                      type="text"
                      placeholder="Recipient wallet address (0x...)"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className={`input-recessed w-full h-10 px-3 text-white placeholder:text-concrete-500 text-sm ${
                        recipientAddress.length > 0 && !isValidAddress(recipientAddress)
                          ? "!border-red-500/50 focus:!border-red-500"
                          : ""
                      }`}
                    />
                  </div>
                  {recipientAddress.length > 0 && !isValidAddress(recipientAddress) && (
                    <p className="text-[11px] text-[#8E8E8E]">Enter a valid Ethereum address</p>
                  )}
                </div>
              </div>

              <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-3" aria-hidden="true" />

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between bg-concrete-600 hover:bg-concrete-500 text-[#8E8E8E] rounded-lg px-4 py-2 text-sm transition-colors"
              >
                <span className="headline-brutal text-[12px]">ADVANCED PARAMETERS</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Settings Summary (only when Advanced collapsed) */}
              {!showAdvanced && (
                <SettingsSummary
                  usdcAmount={usdcAmount}
                  coinAmount={coinAmount}
                  initialEmission={initialEmission}
                  minEmission={minEmission}
                  halvingPeriod={halvingPeriod}
                />
              )}

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-3 pb-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={resetAdvancedToDefaults}
                      className="text-[12px] text-moss-400 hover:text-moss-300 transition-colors"
                    >
                      Reset to defaults
                    </button>
                  </div>

                  {/* Slab 4: Liquidity */}
                  <div className="slab p-4">
                    <h3 className="headline-brutal text-[13px] text-[#8E8E8E] mb-4 border-l-[3px] border-moss-400 pl-3">LAUNCH LIQUIDITY</h3>
                    <p className="text-muted-foreground text-[11px] mb-2">
                      Sets the initial coin/USDC pool and starting market price. Initial LP is locked at launch.
                    </p>
                    <Slider
                      label="USDC Side"
                      value={usdcAmount}
                      onChange={setUsdcAmount}
                      min={1}
                      max={1000}
                      step={1}
                      formatValue={formatNumber}
                      description="USDC paired into the initial LP."
                    />
                    <Slider
                      label="Coin Side"
                      value={coinAmount}
                      onChange={setCoinAmount}
                      min={100}
                      max={100000000}
                      step={100}
                      formatValue={formatNumber}
                      description="Coin amount paired against USDC in the initial LP."
                    />
                    {/* Initial LP Summary */}
                    {(() => {
                      const initialPriceUsdc = usdcAmount / coinAmount;
                      const initialPriceUsd = initialPriceUsdc;
                      const marketCapUsd = coinAmount * initialPriceUsd;

                      const formatUsd = (n: number) => {
                        if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
                        if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
                        if (n >= 1) return `$${n.toFixed(2)}`;
                        if (n >= 0.01) return `$${n.toFixed(4)}`;
                        return `$${n.toFixed(6)}`;
                      };

                      return (
                        <div className="rounded-xl ring-1 ring-concrete-600 bg-concrete-800/40 p-3 space-y-2 mt-3">
                          <div className="text-[13px] font-semibold text-foreground">Launch Snapshot</div>
                          <div className="space-y-1.5 text-[12px]">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Initial Price</span>
                              <div className="text-right">
                                <span className="font-semibold text-foreground tabular-nums">
                                  ${initialPriceUsdc.toFixed(6)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Initial Liquidity</span>
                              <div className="text-right">
                                <span className="font-semibold text-foreground tabular-nums">
                                  ${formatNumber(usdcAmount)} + {formatNumber(coinAmount)} coins
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Initial Market Cap</span>
                              <span className="font-semibold text-foreground tabular-nums">{formatUsd(marketCapUsd)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <img src="/botanicals/vine-divider.svg" className="w-full h-4 opacity-30 my-3" aria-hidden="true" />

                  {/* Slab 5: Emission */}
                  <div className="slab p-4">
                    <h3 className="headline-brutal text-[13px] text-[#8E8E8E] mb-4 border-l-[3px] border-moss-400 pl-3">EMISSION SCHEDULE</h3>
                    <p className="text-muted-foreground text-[11px] mb-2">
                      Daily emissions distributed to donors based on contribution share.
                    </p>
                    <Slider
                      label="Starting Emission"
                      value={initialEmission}
                      onChange={(v) => {
                        setInitialEmission(v);
                        if (minEmission > v) setMinEmission(v);
                      }}
                      min={1000}
                      max={500000}
                      step={1000}
                      formatValue={formatDailyRate}
                      description="Initial daily coin emission before halvings."
                    />
                    <Slider
                      label="Floor Emission"
                      value={minEmission}
                      onChange={setMinEmission}
                      min={100}
                      max={initialEmission}
                      step={100}
                      formatValue={formatDailyRate}
                      description="Lowest daily emission after all halvings."
                    />
                    <Slider
                      label="Halving Interval"
                      value={halvingPeriod}
                      onChange={setHalvingPeriod}
                      min={BOUNDS.halvingPeriod.min}
                      max={BOUNDS.halvingPeriod.max}
                      step={86400}
                      formatValue={formatDuration}
                      description="Days between daily emission halvings."
                    />

                    {/* Emission Preview */}
                    <EmissionPreview
                      initialEmission={initialEmission}
                      minEmission={minEmission}
                      halvingPeriod={halvingPeriod}
                    />
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Bottom Action Bar */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-background flex justify-center"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}
        >
            <div className="flex items-center justify-between w-full max-w-[520px] px-4 py-3 bg-background">
              <div className="flex items-center gap-5">
                <div>
                  <div className="text-muted-foreground text-[12px]">Pay</div>
                  <div className="font-semibold text-[17px] tabular-nums">
                    ${formatNumber(usdcAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[12px]">Balance</div>
                  <div className="font-semibold text-[17px] tabular-nums">
                    ${formatNumber(usdcBalance ? Number(formatUnits(usdcBalance, QUOTE_TOKEN_DECIMALS)) : 0)}
                  </div>
                </div>
              </div>
              {!isConnected ? (
                <button
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="w-40 h-10 text-[14px] font-bold uppercase tracking-wider rounded-lg bg-moss-400 text-concrete-800 hover:bg-moss-300 hover:shadow-glow transition-all disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  disabled={!isFormValid || isLaunching || isUploading}
                  className={`w-32 h-10 text-[14px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    launchError || txStatus === "error"
                      ? "bg-concrete-700 text-[#8E8E8E]"
                      : !isFormValid || isLaunching || isUploading
                      ? "bg-concrete-800 text-concrete-500 cursor-not-allowed"
                      : "bg-moss-400 text-concrete-800 hover:bg-moss-300 hover:shadow-glow"
                  }`}
                >
                  {launchError || txStatus === "error"
                    ? txError?.message?.includes("cancelled") ? "Rejected" : "Failed"
                    : isUploading
                    ? "Uploading..."
                    : isLaunching
                    ? "Launching..."
                    : "Launch"}
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Success */}
      {txStatus === "success" && txHash && (
        <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-concrete-800">
          <div
            className="relative flex h-full w-full max-w-[520px] flex-col bg-background items-center justify-center px-6"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
            }}
          >
            <div className="text-center space-y-6 max-w-xs">
              {/* Token preview first for visual hierarchy */}
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt={tokenName} className="w-24 h-24 rounded-full object-cover ring-2 ring-moss-400" />
                </div>
              )}

              {/* Message */}
              <div>
                <h2 className="headline-brutal text-2xl text-white mb-2">FUNDRAISER LAUNCHED!</h2>
                <p className="text-[#8E8E8E] text-[15px]">
                  <span className="font-semibold text-white">{tokenName}</span>
                  {" "}({tokenSymbol}) is now live
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2 w-full">
                <Link
                  href={launchedFundraiserAddress ? `/fundraiser/${launchedFundraiserAddress}` : "/explore"}
                  className="block w-full py-3.5 px-4 bg-moss-400 text-concrete-800 font-bold uppercase tracking-wider text-[15px] rounded-lg hover:bg-moss-300 hover:shadow-glow transition-all"
                >
                  View Fundraiser
                </Link>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 px-4 bg-concrete-700 text-white font-semibold text-[15px] rounded-lg hover:bg-concrete-600 transition-colors"
                >
                  View on Basescan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
