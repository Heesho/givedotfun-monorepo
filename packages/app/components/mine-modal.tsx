"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, Delete, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatUnits, formatEther, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { useFarcaster } from "@/hooks/useFarcaster";
import { useFundraiserState } from "@/hooks/useFundraiserState";
import { useTokenMetadata } from "@/hooks/useMetadata";
import {
  useBatchedTransaction,
  encodeApproveCall,
  encodeContractCall,
  type Call,
} from "@/hooks/useBatchedTransaction";
import {
  CONTRACT_ADDRESSES,
  ERC20_ABI,
  MULTICALL_ABI,
  QUOTE_TOKEN_DECIMALS,
} from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MineModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fundraiserAddress: `0x${string}`;
  tokenSymbol?: string;
  onSuccess?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addCommas(s: string): string {
  const [whole, dec] = s.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
}

function NumPadButton({
  value,
  onClick,
  children,
}: {
  value: string;
  onClick: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className="flex-1 h-14 flex items-center justify-center text-xl font-mono font-medium text-white hover:bg-zinc-800/50 active:bg-zinc-800/50 rounded-none transition-colors"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MineModal({
  isOpen,
  onClose,
  fundraiserAddress,
  tokenSymbol = "TOKEN",
  onSuccess,
}: MineModalProps) {
  const [amount, setAmount] = useState("0");
  const [message, setMessage] = useState("");

  const { address: account } = useFarcaster();
  const { execute, status, txHash, error: txError, reset } = useBatchedTransaction();

  const { fundraiserState } = useFundraiserState(fundraiserAddress, account);
  const { metadata } = useTokenMetadata(fundraiserState?.fundraiserUri);
  const defaultMessage = metadata?.defaultMessage || "gm";

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount("0");
      setMessage("");
      reset();
    }
  }, [isOpen, reset]);

  // Auto-reset on error (fast for user rejection, slower for real errors)
  useEffect(() => {
    if (status !== "error") return;
    const isRejection = txError?.message?.includes("User rejected") || txError?.message?.includes("User denied");
    const timer = setTimeout(() => reset(), isRejection ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, [status, txError, reset]);

  // ---- Derived amounts ----------------------------------------------------
  const parsedInput = useMemo(() => {
    try {
      if (!amount || amount === "0" || amount === "0.") return 0n;
      return parseUnits(amount, QUOTE_TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  // User USDC balance
  const userBalance = fundraiserState?.accountQuoteBalance ?? 0n;
  const displayBalance = Number(formatUnits(userBalance, QUOTE_TOKEN_DECIMALS));
  const insufficientBalance = parsedInput > 0n && parsedInput > userBalance;

  // Current epoch pool stats
  const todayTotalDonated = fundraiserState
    ? Number(formatUnits(fundraiserState.currentEpochTotalDonated, QUOTE_TOKEN_DECIMALS))
    : 0;
  const todayEmission = fundraiserState
    ? Number(formatEther(fundraiserState.currentEpochEmission))
    : 0;
  const parsedAmount = parseFloat(amount) || 0;
  const costPerToken = todayEmission > 0 ? (todayTotalDonated + parsedAmount) / todayEmission : 0;
  const estimatedTokens =
    parsedAmount > 0 && todayEmission > 0
      ? (parsedAmount / (todayTotalDonated + parsedAmount)) * todayEmission
      : 0;

  // ---- Allowance check ----------------------------------------------------
  const multicallAddr = CONTRACT_ADDRESSES.multicall as `0x${string}`;
  const { data: currentAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account!, multicallAddr],
    query: {
      enabled: !!account && parsedInput > 0n,
    },
  });

  // ---- Number pad ---------------------------------------------------------
  const handleNumPadPress = useCallback(
    (value: string) => {
      if (status === "pending") return;
      setAmount((prev) => {
        if (value === "backspace") {
          if (prev.length <= 1) return "0";
          return prev.slice(0, -1);
        }
        if (value === ".") {
          if (prev.includes(".")) return prev;
          return prev + ".";
        }
        // Limit to 2 decimal places for USD
        const decimalIndex = prev.indexOf(".");
        if (decimalIndex !== -1) {
          const decimals = prev.length - decimalIndex - 1;
          if (decimals >= 2) return prev;
        }
        // Replace initial 0
        if (prev === "0" && value !== ".") return value;
        // Limit total length
        if (prev.length >= 12) return prev;
        return prev + value;
      });
    },
    [status]
  );

  // ---- Execute mine -------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (!account || !fundraiserState || status === "pending") return;
    const amt = parseUnits(amount || "0", QUOTE_TOKEN_DECIMALS);
    if (amt <= 0n) return;

    const calls: Call[] = [];

    // Approve USDC for multicall if needed
    const needsApproval = currentAllowance === undefined || currentAllowance < amt;
    if (needsApproval) {
      calls.push(
        encodeApproveCall(
          CONTRACT_ADDRESSES.usdc as `0x${string}`,
          multicallAddr,
          amt
        )
      );
    }

    // Fund call
    calls.push(
      encodeContractCall(
        multicallAddr,
        MULTICALL_ABI,
        "fund",
        [fundraiserAddress, account, amt, message || defaultMessage]
      )
    );

    await execute(calls);
  }, [account, fundraiserState, amount, fundraiserAddress, execute, status, currentAllowance, multicallAddr, message, defaultMessage]);

  // Notify parent on success
  useEffect(() => {
    if (status === "success") onSuccess?.();
  }, [status, onSuccess]);

  // Auto-close on success after short delay
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (status === "success") {
      const id = setTimeout(() => onCloseRef.current(), 2000);
      return () => clearTimeout(id);
    }
  }, [status]);

  // ---- Button state -------------------------------------------------------
  const buttonDisabled =
    parsedInput === 0n ||
    insufficientBalance ||
    status === "pending";

  const buttonLabel = useMemo(() => {
    if (status === "pending") return "Mining...";
    if (status === "success") return "Success!";
    if (status === "error") return "Try Again";
    if (insufficientBalance) return "Insufficient balance";
    if (parsedInput === 0n) return "Mine";
    return "Mine";
  }, [status, insufficientBalance, parsedInput]);

  // ---- Render -------------------------------------------------------------
  if (!isOpen) return null;

  const isPending = status === "pending";
  const isSuccess = status === "success";

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-zinc-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-none hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold font-display">Mine</span>
          <div className="w-9" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-4">
          {/* Balance */}
          <div className="mt-4 mb-6">
            <h1 className="text-2xl font-semibold font-display tracking-tight">
              Mine {tokenSymbol}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1 font-mono tabular-nums">
              ${displayBalance.toFixed(2)} available
            </p>
          </div>

          {/* Amount input display */}
          <div className="py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground font-display">Pay</span>
              <span className="text-lg font-semibold font-mono tabular-nums">
                ${addCommas(amount)}
              </span>
            </div>
          </div>

          {/* Cost per coin */}
          <div className="py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground font-display">Cost per coin</span>
              <span className="text-[13px] font-medium font-mono tabular-nums">
                {costPerToken > 0 ? `$${costPerToken.toFixed(6)}` : "\u2014"}
              </span>
            </div>
          </div>

          {/* Estimated coins */}
          <div className="py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground font-display">Est. coins</span>
              <span className="text-[13px] font-medium font-mono tabular-nums">
                {estimatedTokens > 0
                  ? `${estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenSymbol}`
                  : "\u2014"}
              </span>
            </div>
          </div>

          {/* Error messages */}
          {txError && (
            <div className="px-3 py-2 rounded-none bg-zinc-800/10 border border-zinc-800/20 flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
              <span className="text-[12px] text-zinc-400">
                {(() => {
                  const msg = txError?.message || "";
                  if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) return "Transaction cancelled";
                  if (msg.includes("insufficient")) return "Insufficient balance";
                  return "Something went wrong";
                })()}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Message input */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={defaultMessage}
            maxLength={100}
            className="w-full bg-zinc-800 rounded-none px-4 py-2.5 text-[14px] outline-none placeholder:text-zinc-400 mb-3"
          />

          {/* Action button */}
          <button
            disabled={buttonDisabled}
            onClick={handleConfirm}
            className={`w-full h-11 rounded-none font-semibold font-display text-[14px] transition-all mb-4 flex items-center justify-center gap-2 ${
              buttonDisabled
                ? "bg-zinc-800 text-zinc-400 cursor-not-allowed"
                : isSuccess
                ? "bg-zinc-300 text-black"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSuccess && <CheckCircle className="w-4 h-4" />}
            {buttonLabel}
          </button>

          {/* Number pad */}
          <div
            className="pb-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}
          >
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map(
                (key) => (
                  <NumPadButton key={key} value={key} onClick={handleNumPadPress}>
                    {key === "backspace" ? (
                      <Delete className="w-6 h-6" />
                    ) : (
                      key
                    )}
                  </NumPadButton>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
