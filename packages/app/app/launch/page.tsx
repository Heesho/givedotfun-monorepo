"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, X } from "lucide-react";
import { parseUnits, formatUnits, parseEventLogs } from "viem";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { NavBar } from "@/components/nav-bar";
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

// Default values for fundraiser
const DEFAULTS = {
  usdcAmount: 1,
  unitAmount: 1000,
  initialEmission: 345600, // 345,600 tokens/day (4/sec, Bitcoin-style)
  minEmission: 3456, // 3,456 tokens/day tail (1% of initial, perpetual)
  halvingPeriod: 30 * 24 * 3600, // 30 days (monthly halving)
  epochDuration: 86400, // 1 day
  auctionEpochPeriod: 86400, // 1 day
  auctionPriceMultiplier: 1.2, // 1.2x
  auctionTargetUsd: 100, // target $100 min auction price
};

// ABI for parsing the Core__Launched event from tx receipts
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
      const launchedEvent = parsed.find((e) => e.eventName === "Core__Launched");
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

  // Recipient fields (optional)
  const [showRecipient, setShowRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // Links (websites, socials)
  const [showLinks, setShowLinks] = useState(false);
  const [links, setLinks] = useState<string[]>([""]);

  // Fundraiser parameters (using defaults)
  const usdcAmount = DEFAULTS.usdcAmount;
  const unitAmount = DEFAULTS.unitAmount;
  const initialEmission = DEFAULTS.initialEmission;
  const minEmission = DEFAULTS.minEmission;
  const halvingPeriod = DEFAULTS.halvingPeriod;
  const epochDuration = DEFAULTS.epochDuration;

  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Auto-reset error state so button reverts to normal
  const isUserRejection = txError?.message?.includes("User rejected") || txError?.message?.includes("User denied");
  useEffect(() => {
    if (txStatus !== "error" && !launchError) return;
    if (launchError) console.error("[Launch Error]", launchError);
    if (txStatus === "error") console.error("[Tx Error]", txError);
    const delay = isUserRejection ? 2000 : 10000;
    const timer = setTimeout(() => {
      resetTx();
      setLaunchError(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [txStatus, launchError, resetTx, txError, isUserRejection]);

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

  // Validate Ethereum address format
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Form validation (recipient is optional)
  const isFormValid = (() => {
    if (!logoFile) return false;
    if (!tokenName.trim().length || !tokenSymbol.trim().length) return false;
    if (!tokenDescription.trim().length || !donationMessage.trim().length) return false;
    // If recipient address is provided, it must be valid
    if (recipientAddress.trim().length > 0 && !isValidAddress(recipientAddress)) return false;
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
        recipientName: recipientName.trim() || "No recipient set",
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
      const unitAmountWei = parseUnits(unitAmount.toString(), 18);

      // Compute auction price in LP tokens to target a dollar value
      // Formula: auctionLpPrice = targetUsd / (2e6 * sqrt(usdcAmount / unitAmount))
      const auctionLpPrice = DEFAULTS.auctionTargetUsd / (2_000_000 * Math.sqrt(usdcAmount / unitAmount));
      const auctionInitPriceWei = parseUnits(auctionLpPrice.toFixed(18), 18);
      const auctionMinInitPriceWei = auctionInitPriceWei;
      const auctionEpochPeriodWei = BigInt(DEFAULTS.auctionEpochPeriod);
      const auctionPriceMultiplierWei = parseUnits(DEFAULTS.auctionPriceMultiplier.toString(), 18);

      const initialEmissionWei = parseUnits(initialEmission.toString(), 18);
      const minEmissionWei = parseUnits(minEmission.toString(), 18);
      const halvingPeriodEpochs = Math.max(1, Math.round(halvingPeriod / epochDuration));

      const quoteToken = CONTRACT_ADDRESSES.usdc as `0x${string}`;
      const multicallAddress = CONTRACT_ADDRESSES.multicall as `0x${string}`;

      const launchParams = {
        launcher,
        quoteToken,
        recipient: (recipientAddress.trim() && isValidAddress(recipientAddress) ? recipientAddress : "0x0000000000000000000000000000000000000000") as `0x${string}`,
        tokenName,
        tokenSymbol,
        uri,
        usdcAmount: usdcAmountWei,
        unitAmount: unitAmountWei,
        initialEmission: initialEmissionWei,
        minEmission: minEmissionWei,
        halvingPeriod: BigInt(halvingPeriodEpochs),
        epochDuration: BigInt(epochDuration),
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
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  // Main form layout
  return (
    <main className="flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)",
        }}
      >
        {/* Header */}
        <div className="px-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight font-display">Launch</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Create a fundraiser and start accepting funding</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2">
          {/* All form fields — uniform 8px gap */}
          <div className="space-y-2">
            {/* Logo + Name + Symbol Row */}
            <div className="flex items-start gap-2">
              <label className="cursor-pointer flex-shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <div className="w-[88px] h-[88px] rounded-none bg-secondary flex items-center justify-center overflow-hidden hover:bg-secondary/80 transition-colors">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Coin logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Upload className="w-6 h-6 text-zinc-500" />
                  )}
                </div>
              </label>
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  type="text"
                  placeholder="Coin name"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                />
                <input
                  type="text"
                  placeholder="SYMBOL"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Description"
              value={tokenDescription}
              onChange={(e) => setTokenDescription(e.target.value)}
              className="w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
            />
            <input
              type="text"
              placeholder="Default message"
              value={donationMessage}
              onChange={(e) => setDonationMessage(e.target.value)}
              className="w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
            />
          </div>

          {/* Recipient toggle */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowRecipient(!showRecipient)}
              className="flex items-center justify-between w-full py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-foreground font-display font-medium">Add recipient</span>
                <span className="text-[11px] text-muted-foreground">receives 50% of all funding</span>
              </div>
              <div className={`w-9 h-5 rounded-none transition-colors relative ${showRecipient ? "bg-white" : "bg-zinc-700"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-none transition-all ${showRecipient ? "left-[18px] bg-black" : "left-0.5 bg-zinc-500"}`} />
              </div>
            </button>

            {showRecipient && (
              <div className="space-y-2 mt-2">
                <input
                  type="text"
                  placeholder="Recipient name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                />
                <input
                  type="text"
                  placeholder="Wallet address (0x...)"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className={`w-full h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm font-mono`}
                />
                {recipientAddress.length > 0 && !isValidAddress(recipientAddress) && (
                  <p className="text-[11px] text-zinc-400">Enter a valid Ethereum address</p>
                )}
              </div>
            )}
          </div>

          {/* Links toggle */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                const next = !showLinks;
                setShowLinks(next);
                if (next && links.length === 0) setLinks([""]);
              }}
              className="flex items-center justify-between w-full py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-foreground font-display font-medium">Add links</span>
                <span className="text-[11px] text-muted-foreground">websites, socials</span>
              </div>
              <div className={`w-9 h-5 rounded-none transition-colors relative ${showLinks ? "bg-white" : "bg-zinc-700"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-none transition-all ${showLinks ? "left-[18px] bg-black" : "left-0.5 bg-zinc-500"}`} />
              </div>
            </button>

            {showLinks && (
              <div className="space-y-2 mt-2">
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
                      className="flex-1 h-10 px-3 rounded-none bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (links.length <= 1) {
                          setLinks([""]);
                          return;
                        }
                        setLinks(links.filter((_, j) => j !== i));
                      }}
                      className="px-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {links.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setLinks([...links, ""])}
                    className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    + Add another
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-auto px-4 py-3 bg-background">
          <div className="flex items-center gap-4 w-full">
            <div className="flex items-center gap-5 shrink-0">
              <div>
                <div className="text-muted-foreground text-[12px]">Pay</div>
                <div className="font-semibold text-[17px] tabular-nums font-mono">
                  ${formatNumber(usdcAmount)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-[12px]">Balance</div>
                <div className="font-semibold text-[17px] tabular-nums font-mono">
                  ${formatNumber(usdcBalance ? Number(formatUnits(usdcBalance, QUOTE_TOKEN_DECIMALS)) : 0)}
                </div>
              </div>
            </div>
            {!isConnected ? (
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="w-40 h-10 text-[14px] font-semibold font-display rounded-none bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={!isFormValid || isLaunching || isUploading}
                className={`flex-1 h-12 text-[15px] font-semibold font-display rounded-none transition-all ${
                  launchError || txStatus === "error"
                    ? "bg-zinc-700 text-zinc-300"
                    : !isFormValid || isLaunching || isUploading
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-zinc-200"
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

      {/* Nav Bar */}
      <NavBar />

      {/* Success */}
      {txStatus === "success" && txHash && (
        <div className="fixed inset-0 bottom-[70px] z-[50] flex w-screen justify-center bg-background">
          <div
            className="relative flex h-full w-full max-w-[520px] flex-col bg-background items-center justify-center px-6"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
            }}
          >
            <div className="text-center space-y-6 max-w-xs">
              {/* Token preview */}
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt={tokenName} className="w-24 h-24 rounded-none object-cover ring-2 ring-zinc-700" />
                </div>
              )}

              {/* Message */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 font-display">Fundraiser Launched!</h2>
                <p className="text-zinc-400 text-[15px]">
                  <span className="font-semibold text-white font-display">{tokenName}</span>
                  {" "}({tokenSymbol}) is now live
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2 w-full">
                <Link
                  href={launchedFundraiserAddress ? `/fundraiser/${launchedFundraiserAddress}` : "/explore"}
                  className="block w-full py-3.5 px-4 bg-white text-black font-semibold font-display text-[15px] rounded-none hover:bg-zinc-200 transition-colors"
                >
                  View Fundraiser
                </Link>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 px-4 bg-zinc-800 text-white font-semibold font-display text-[15px] rounded-none hover:bg-zinc-700 transition-colors"
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
