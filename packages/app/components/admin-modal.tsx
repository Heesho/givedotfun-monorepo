"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2 } from "lucide-react";
import { encodeFunctionData } from "viem";
import type { TokenMetadata } from "@/hooks/useMetadata";
import { useBatchedTransaction, type Call } from "@/hooks/useBatchedTransaction";

type AdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fundraiserAddress: `0x${string}`;
  tokenSymbol?: string;
  tokenName?: string;
  // Pre-loaded data from the parent (already fetched)
  initialTreasury: string;
  initialTeam: string;
  initialRecipient: string;
  initialMetadata?: TokenMetadata;
  initialLogoUrl?: string;
  colorPositive?: boolean;
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ABI fragments for setter functions
const SET_URI_ABI = [
  {
    inputs: [{ internalType: "string", name: "_uri", type: "string" }],
    name: "setUri",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const SET_TREASURY_ABI = [
  {
    inputs: [{ internalType: "address", name: "_treasury", type: "address" }],
    name: "setTreasury",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const SET_TEAM_ABI = [
  {
    inputs: [{ internalType: "address", name: "_team", type: "address" }],
    name: "setTeam",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const SET_RECIPIENT_ABI = [
  {
    inputs: [{ internalType: "address", name: "_recipient", type: "address" }],
    name: "setRecipient",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function AdminModal({
  isOpen,
  onClose,
  fundraiserAddress,
  tokenSymbol = "TOKEN",
  tokenName = "Token",
  initialTreasury,
  initialTeam,
  initialRecipient,
  initialMetadata,
  initialLogoUrl,
  colorPositive = true,
}: AdminModalProps) {
  // Metadata fields — initialized from parent's already-loaded IPFS data
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState(initialMetadata?.description || "");
  const [defaultMessage, setDefaultMessage] = useState(initialMetadata?.defaultMessage || "");
  const [recipientName, setRecipientName] = useState(initialMetadata?.recipientName || "");
  const existingLinks = initialMetadata?.links || [];
  const [showLinks, setShowLinks] = useState(existingLinks.length > 0);
  const [links, setLinks] = useState<string[]>(existingLinks.length > 0 ? existingLinks : [""]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract config — initialized from parent's already-loaded on-chain data
  const [treasury, setTreasury] = useState(initialTreasury);
  const [team, setTeam] = useState(initialTeam);
  const [recipient, setRecipient] = useState(initialRecipient);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = "hidden";
      // Also lock all scrollable containers
      document.querySelectorAll("[class*=overflow-y-auto], [class*=overflow-auto]").forEach((el) => {
        (el as HTMLElement).style.overflow = "hidden";
      });
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.querySelectorAll("[class*=overflow-y-auto], [class*=overflow-auto]").forEach((el) => {
        (el as HTMLElement).style.overflow = "";
      });
    };
  }, [isOpen]);

  // Transaction state
  const { execute, status: txStatus, reset: resetTx } = useBatchedTransaction();
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);

  // Track which field just succeeded
  const [successField, setSuccessField] = useState<string | null>(null);

  // Handle successful tx
  useEffect(() => {
    if (txStatus === "success" && pendingField) {
      setSuccessField(pendingField);
      setPendingField(null);
      setTimeout(() => {
        setSuccessField(null);
        resetTx();
      }, 2000);
    } else if (txStatus === "error") {
      setPendingField(null);
      setSuccessField(null);
      resetTx();
    }
  }, [txStatus, pendingField, resetTx]);

  // Validation
  const isTreasuryValid = isValidAddress(treasury);
  const isTeamValid = team === "" || isValidAddress(team);
  const isRecipientValid = isValidAddress(recipient);

  // Check if metadata changed from what was loaded
  const metadataChanged =
    description !== (initialMetadata?.description || "") ||
    defaultMessage !== (initialMetadata?.defaultMessage || "") ||
    recipientName !== (initialMetadata?.recipientName || "") ||
    logoFile !== null ||
    JSON.stringify(links.filter(l => l.trim() !== "")) !== JSON.stringify(initialMetadata?.links || []);

  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save metadata to IPFS then call setUri on-chain
  const handleSaveMetadata = async () => {
    if (!fundraiserAddress) return;
    setPendingField("metadata");
    setIsUploadingMetadata(true);

    try {
      let imageIpfsUrl = initialMetadata?.image || "";

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        formData.append("tokenSymbol", tokenSymbol);

        const uploadRes = await fetch("/api/pinata/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload logo");
        const uploadData = await uploadRes.json();
        imageIpfsUrl = uploadData.ipfsUrl;
      }

      const metadataRes = await fetch("/api/pinata/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName,
          symbol: tokenSymbol,
          image: imageIpfsUrl,
          description,
          defaultMessage,
          ...(recipientName ? { recipientName } : {}),
          links: links.filter((l) => l.trim() !== ""),
        }),
      });

      if (!metadataRes.ok) throw new Error("Failed to upload metadata");
      const metadataData = await metadataRes.json();
      const newUri = metadataData.ipfsUrl;

      setIsUploadingMetadata(false);

      const data = encodeFunctionData({
        abi: SET_URI_ABI,
        functionName: "setUri",
        args: [newUri],
      });

      await execute([{ to: fundraiserAddress, data, value: 0n }]);
    } catch {
      setIsUploadingMetadata(false);
      setPendingField(null);
    }
  };

  // Generic save handler for contract calls
  const handleSave = async (field: string) => {
    if (!fundraiserAddress) return;
    setPendingField(field);

    let call: Call | null = null;

    switch (field) {
      case "treasury": {
        const data = encodeFunctionData({
          abi: SET_TREASURY_ABI,
          functionName: "setTreasury",
          args: [treasury as `0x${string}`],
        });
        call = { to: fundraiserAddress, data, value: 0n };
        break;
      }
      case "team": {
        const data = encodeFunctionData({
          abi: SET_TEAM_ABI,
          functionName: "setTeam",
          args: [team as `0x${string}`],
        });
        call = { to: fundraiserAddress, data, value: 0n };
        break;
      }
      case "recipient": {
        const data = encodeFunctionData({
          abi: SET_RECIPIENT_ABI,
          functionName: "setRecipient",
          args: [recipient as `0x${string}`],
        });
        call = { to: fundraiserAddress, data, value: 0n };
        break;
      }
    }

    if (call) {
      try {
        await execute([call]);
      } catch {
        setPendingField(null);
      }
    }
  };

  if (!isOpen) return null;

  const isSaving = txStatus === "pending" || txStatus === "confirming" || isUploadingMetadata;
  const currentLogoUrl = logoPreview || initialLogoUrl;

  const addressInputClass = (valid: boolean, value: string) =>
    `field-input flex-1 h-10 text-sm font-mono min-w-0 ${
      value.length > 0 && !valid
        ? "field-input-invalid"
        : ""
    }`;

  const saveBtnClass = (field: string, enabled: boolean) =>
    `h-10 px-4 text-[11px] flex-shrink-0 ${
      successField === field
        ? colorPositive ? "slab-button opacity-70" : "slab-button slab-button-loss opacity-70"
        : isSaving && pendingField === field
        ? colorPositive ? "slab-button opacity-50" : "slab-button slab-button-loss opacity-50"
        : enabled
        ? colorPositive ? "slab-button" : "slab-button slab-button-loss"
        : "slab-button-ghost text-muted-foreground"
    }`;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden overscroll-none bg-[hsl(var(--background)/0.6)] backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`${colorPositive ? "signal-theme-positive glass-panel glass-panel-positive" : "signal-theme-negative glass-panel glass-panel-negative"} relative flex w-full max-w-[520px] flex-col h-full lg:h-auto lg:max-h-[80vh] lg:overflow-y-auto lg:rounded-2xl`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={onClose}
            className="ghost-border -ml-2 p-2 transition-colors hover:bg-surface-high"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold font-display">Admin</span>
          <div className="w-9" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pt-2">
          <div className="space-y-4 pb-6">
            <div className="slab-panel px-3 py-3">
              <div className="section-kicker">Profile</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Update the coin identity, supporter message, and public links.
              </div>

              <div className="mt-3 flex items-start gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="ghost-border relative flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center overflow-hidden bg-surface-lowest transition-colors hover:bg-surface-high"
                >
                  {currentLogoUrl ? (
                    <img src={currentLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity hover:opacity-100">
                    <Camera className="h-4 w-4 text-foreground" />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                <div className="flex-1 min-w-0 pt-2">
                  <div className="text-[16px] font-semibold font-display">{tokenName}</div>
                  <div className="text-[13px] text-muted-foreground">{tokenSymbol}</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                <div>
                  <span className="mb-1 block text-[12px] text-muted-foreground font-display">Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your coin..."
                    rows={2}
                    className="field-input min-h-[88px] resize-none px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[12px] text-muted-foreground font-display">Default message</span>
                  <input
                    type="text"
                    value={defaultMessage}
                    onChange={(e) => setDefaultMessage(e.target.value)}
                    placeholder="gm"
                    className="field-input h-10 text-sm"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[12px] text-muted-foreground font-display">Recipient name</span>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Who receives donations"
                    className="field-input h-10 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowLinks(!showLinks)}
                  className="flex w-full items-center justify-between gap-3"
                >
                  <div className="min-w-0 text-left">
                    <div className="section-kicker">Outbound Links</div>
                    <div className="mt-1 text-[13px] text-foreground font-display font-medium">Add links</div>
                    <div className="text-[11px] text-muted-foreground">Website, socials, or docs.</div>
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
                          value={link}
                          onChange={(e) => {
                            const updated = [...links];
                            updated[i] = e.target.value;
                            setLinks(updated);
                          }}
                          placeholder="https://..."
                          className="field-input h-10 flex-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setLinks(links.filter((_, j) => j !== i))}
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
                        className="signal-hover text-[12px] font-display uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        + Add another
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveMetadata}
                disabled={isSaving || !metadataChanged}
                className={`mt-4 w-full px-4 text-[11px] ${
                  successField === "metadata"
                    ? colorPositive ? "slab-button opacity-70" : "slab-button slab-button-loss opacity-70"
                    : isSaving && pendingField === "metadata"
                    ? colorPositive ? "slab-button opacity-50" : "slab-button slab-button-loss opacity-50"
                    : metadataChanged
                    ? colorPositive ? "slab-button" : "slab-button slab-button-loss"
                    : "slab-button-ghost text-muted-foreground"
                }`}
              >
                {successField === "metadata" ? (
                  "Saved"
                ) : isSaving && pendingField === "metadata" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isUploadingMetadata ? "Uploading..." : "Confirming..."}
                  </span>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>

            <div className="slab-panel px-3 py-3">
              <div className="section-kicker">Contract Settings</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Update the on-chain payout and treasury routing addresses.
              </div>

              <div className="mt-3 space-y-3">
            {/* Recipient */}
                <div className="slab-inset px-3 py-3">
                  <span className="text-[12px] text-muted-foreground font-display">Recipient</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x..."
                      className={addressInputClass(isRecipientValid, recipient)}
                    />
                    <button
                      onClick={() => handleSave("recipient")}
                      disabled={isSaving || !isRecipientValid || recipient === initialRecipient}
                      className={saveBtnClass("recipient", isRecipientValid && recipient !== initialRecipient)}
                    >
                      {successField === "recipient" ? "Saved" : isSaving && pendingField === "recipient" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : "Save"}
                    </button>
                  </div>
                </div>

            {/* Treasury */}
                <div className="slab-inset px-3 py-3">
                  <span className="text-[12px] text-muted-foreground font-display">Treasury</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={treasury}
                      onChange={(e) => setTreasury(e.target.value)}
                      placeholder="0x..."
                      className={addressInputClass(isTreasuryValid, treasury)}
                    />
                    <button
                      onClick={() => handleSave("treasury")}
                      disabled={isSaving || !isTreasuryValid || treasury === initialTreasury}
                      className={saveBtnClass("treasury", isTreasuryValid && treasury !== initialTreasury)}
                    >
                      {successField === "treasury" ? "Saved" : isSaving && pendingField === "treasury" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : "Save"}
                    </button>
                  </div>
                </div>

            {/* Team */}
                <div className="slab-inset px-3 py-3">
                  <span className="text-[12px] text-muted-foreground font-display">Team</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      placeholder="0x..."
                      className={addressInputClass(isTeamValid, team)}
                    />
                    <button
                      onClick={() => handleSave("team")}
                      disabled={isSaving || !isTeamValid || team === initialTeam}
                      className={saveBtnClass("team", isTeamValid && team !== initialTeam)}
                    >
                      {successField === "team" ? "Saved" : isSaving && pendingField === "team" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
