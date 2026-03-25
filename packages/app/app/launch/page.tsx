"use client";

import { useEffect, useMemo, useState } from "react";
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

  const launchedFundraiserAddress = useMemo(() => {
    if (txReceipt?.logs) {
      const addr = extractFundraiserAddress(txReceipt.logs);
      if (addr) return addr;
    }

    if (!batchReceipts) return null;

    for (const receipt of batchReceipts) {
      if (receipt.logs) {
        const addr = extractFundraiserAddress(receipt.logs as never);
        if (addr) return addr;
      }
    }

    return null;
  }, [batchReceipts, txReceipt]);

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
      } catch {
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

  // Shared launch button JSX
  const launchButtonBlock = (
    <div className="flex items-center gap-4">
      <div className="flex shrink-0 items-center gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Pay</div>
          <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
            ${formatNumber(usdcAmount)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Balance</div>
          <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
            ${formatNumber(usdcBalance ? Number(formatUnits(usdcBalance, QUOTE_TOKEN_DECIMALS)) : 0)}
          </div>
        </div>
      </div>
      {!isConnected ? (
        <button
          onClick={() => connect()}
          disabled={isConnecting}
          className="slab-button flex-1 text-[11px] disabled:opacity-50"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <button
          onClick={handleLaunch}
          disabled={!isFormValid || isLaunching || isUploading}
          className={`flex-1 px-4 text-[11px] ${
            launchError || txStatus === "error"
              ? "slab-button-ghost text-muted-foreground"
              : !isFormValid || isLaunching || isUploading
              ? "slab-button opacity-50"
              : "slab-button"
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
  );

  // Shared recipient section JSX
  const recipientSection = (
    <div>
      <button
        type="button"
        onClick={() => setShowRecipient(!showRecipient)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="min-w-0 text-left">
          <div className="section-kicker">Recipient Split</div>
          <div className="mt-1 text-[13px] text-foreground font-display font-medium">Add recipient</div>
          <div className="text-[11px] text-muted-foreground">Receives 50% of all funding.</div>
        </div>
        <div className="toggle-track shrink-0" data-state={showRecipient ? "on" : "off"}>
          <div className="toggle-thumb" />
        </div>
      </button>

      {showRecipient && (
        <div className="mt-3 grid gap-2">
          <input
            type="text"
            placeholder="Recipient name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="field-input h-10 text-sm"
          />
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className={`field-input h-10 text-sm font-mono ${recipientAddress.length > 0 && !isValidAddress(recipientAddress) ? "field-input-invalid" : ""}`}
          />
          {recipientAddress.length > 0 && !isValidAddress(recipientAddress) && (
            <p className="text-[11px] text-loss">Enter a valid Ethereum address</p>
          )}
        </div>
      )}
    </div>
  );

  // Shared links section JSX
  const linksSection = (
    <div>
      <button
        type="button"
        onClick={() => {
          const next = !showLinks;
          setShowLinks(next);
          if (next && links.length === 0) setLinks([""]);
        }}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="min-w-0 text-left">
          <div className="section-kicker">Outbound Links</div>
          <div className="mt-1 text-[13px] text-foreground font-display font-medium">Add links</div>
          <div className="text-[11px] text-muted-foreground">Website, social profiles, or docs.</div>
        </div>
        <div className="toggle-track shrink-0" data-state={showLinks ? "on" : "off"}>
          <div className="toggle-thumb" />
        </div>
      </button>

      {showLinks && (
        <div className="mt-3 space-y-2">
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
                className="field-input h-10 flex-1 text-sm"
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
                className="ghost-border flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-loss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {links.length < 5 && (
            <button
              type="button"
              onClick={() => setLinks([...links, ""])}
              className="text-[12px] font-display uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary"
            >
              + Add another
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Identity section JSX (shared)
  const identitySection = (
    <div className="space-y-3">
      <div>
        <div className="section-kicker">Identity</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          Set the coin identity and the message supporters will see.
        </div>
      </div>

      <div className="flex items-start gap-3">
        <label className="cursor-pointer flex-shrink-0">
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />
          <div className="ghost-border flex h-[88px] w-[88px] items-center justify-center overflow-hidden bg-surface-lowest transition-colors hover:bg-surface-high">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Coin logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        </label>

        <div className="flex-1 min-w-0 space-y-2">
          <input
            type="text"
            placeholder="Coin name"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="field-input h-10 text-sm"
          />
          <input
            type="text"
            placeholder="SYMBOL"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            maxLength={10}
            className="field-input h-10 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <input
          type="text"
          placeholder="Description"
          value={tokenDescription}
          onChange={(e) => setTokenDescription(e.target.value)}
          className="field-input h-10 text-sm"
        />
        <input
          type="text"
          placeholder="Default message"
          value={donationMessage}
          onChange={(e) => setDonationMessage(e.target.value)}
          className="field-input h-10 text-sm"
        />
      </div>
    </div>
  );

  // Main form layout
  return (
    <main className="app-shell">
      <div
        className="app-frame lg:max-w-[1360px] xl:max-w-[1480px]"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 130px)",
        }}
      >
        {/* Header */}
        <div className="page-header lg:px-8 lg:pt-24 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px]">
            <h1 className="page-title">Launch</h1>
            <p className="page-subtitle">Create a fundraiser and start accepting funding.</p>
          </div>
        </div>

        {/* Mobile: single column */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 lg:hidden">
          <div className="mx-auto w-full max-w-[1040px] space-y-4 pb-6">
            {identitySection}
            <div className="border-t border-[hsl(var(--outline-variant)/0.1)] pt-4">
              {recipientSection}
            </div>
            <div className="border-t border-[hsl(var(--outline-variant)/0.1)] pt-4">
              {linksSection}
            </div>
          </div>
        </div>

        {/* Desktop: two-column layout */}
        <div className="hidden lg:block flex-1 overflow-y-auto scrollbar-hide px-8 pt-2 xl:px-10">
          <div className="mx-auto w-full max-w-[1360px] space-y-6 pb-10">
            <div className="grid grid-cols-2 gap-6">
              {/* Left column — Identity */}
              <div className="slab-panel px-5 py-5 space-y-4">
                {identitySection}
              </div>

              {/* Right column — Recipient, Links */}
              <div className="slab-panel px-5 py-5 space-y-5">
                {recipientSection}
                <div className="border-t border-[hsl(var(--outline-variant)/0.1)] pt-5">
                  {linksSection}
                </div>
              </div>
            </div>

            {/* Full-width Launch bar */}
            <div className="slab-panel px-5 py-5">
              {launchButtonBlock}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)" }}
      >
        <div className="dock-panel -mb-px flex w-full max-w-[520px] items-center gap-3 px-4 py-3">
          <div className="flex shrink-0 items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Pay</div>
              <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
                ${formatNumber(usdcAmount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Balance</div>
              <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
                ${formatNumber(usdcBalance ? Number(formatUnits(usdcBalance, QUOTE_TOKEN_DECIMALS)) : 0)}
              </div>
            </div>
          </div>
          {!isConnected ? (
            <button
              onClick={() => connect()}
              disabled={isConnecting}
              className="slab-button flex-1 text-[11px] disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={!isFormValid || isLaunching || isUploading}
              className={`flex-1 px-4 text-[11px] ${
                launchError || txStatus === "error"
                  ? "slab-button-ghost text-muted-foreground"
                  : !isFormValid || isLaunching || isUploading
                  ? "slab-button opacity-50"
                  : "slab-button"
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

      {/* Nav Bar */}
      <NavBar attachedTop desktopWide />

      {/* Success */}
      {txStatus === "success" && txHash && (
        <div className="fixed inset-0 bottom-[70px] z-[50] flex w-screen justify-center bg-background/80 backdrop-blur-xl">
          <div
            className="glass-panel relative flex h-full w-full max-w-[520px] flex-col items-center justify-center px-6"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
            }}
          >
            <div className="text-center space-y-6 max-w-xs">
              {/* Token preview */}
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt={tokenName} className="ghost-border h-24 w-24 object-cover" />
                </div>
              )}

              {/* Message */}
              <div>
                <h2 className="mb-2 font-display text-2xl font-bold uppercase tracking-[-0.04em] text-foreground">Fundraiser Launched!</h2>
                <p className="text-[15px] text-muted-foreground">
                  <span className="font-display font-semibold text-foreground">{tokenName}</span>
                  {" "}({tokenSymbol}) is now live
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2 w-full">
                <Link
                  href={launchedFundraiserAddress ? `/fundraiser/${launchedFundraiserAddress}` : "/explore"}
                  className="slab-button block w-full px-4 py-3.5 text-[11px]"
                >
                  View Fundraiser
                </Link>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="slab-button-ghost block w-full px-4 py-3.5 text-[11px]"
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
