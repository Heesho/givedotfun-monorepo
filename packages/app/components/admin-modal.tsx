"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { encodeFunctionData } from "viem";
import { useTokenMetadata } from "@/hooks/useMetadata";
import { useBatchedTransaction, type Call } from "@/hooks/useBatchedTransaction";
import { ipfsToHttp } from "@/lib/constants";

type AdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  rigAddress?: `0x${string}`;
  tokenSymbol?: string;
  tokenName?: string;
  currentConfig: {
    treasury: string;
    team: string | null;
    uri: string;
    recipient?: string | null;
  };
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
  rigAddress,
  tokenSymbol = "TOKEN",
  tokenName = "Token",
  currentConfig,
}: AdminModalProps) {
  // Fetch existing metadata from IPFS
  const { metadata: existingMetadata, logoUrl: existingLogoUrl } = useTokenMetadata(currentConfig.uri);

  // Metadata state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common state
  const [treasury, setTreasury] = useState(currentConfig.treasury);
  const [team, setTeam] = useState(currentConfig.team || "");

  // Recipient state
  const [recipient, setRecipient] = useState(currentConfig.recipient || "");

  // Transaction state
  const { execute, status: txStatus, reset: resetTx } = useBatchedTransaction();
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);

  // Track whether we've initialized from props to avoid resetting on every render
  const wasOpenRef = useRef(false);
  const metadataLoadedRef = useRef(false);

  // Reset state only when modal first opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      metadataLoadedRef.current = false;
      setTreasury(currentConfig.treasury);
      setTeam(currentConfig.team || "");
      setRecipient(currentConfig.recipient || "");
      setLogoFile(null);
      setLogoPreview(null);
      setDescription(existingMetadata?.description || "");
      setDefaultMessage(existingMetadata?.defaultMessage || "");
      setRecipientName(existingMetadata?.recipientName || "");
      setLinks(existingMetadata?.links || []);
    }
    if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, currentConfig, existingMetadata]);

  // Pre-populate metadata fields once they load (async from IPFS)
  useEffect(() => {
    if (isOpen && existingMetadata && !metadataLoadedRef.current) {
      metadataLoadedRef.current = true;
      setDescription(existingMetadata.description || "");
      setDefaultMessage(existingMetadata.defaultMessage || "");
      setRecipientName(existingMetadata.recipientName || "");
      setLinks(existingMetadata.links || []);
    }
  }, [isOpen, existingMetadata]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  // Check if metadata changed
  const metadataChanged =
    description !== (existingMetadata?.description || "") ||
    defaultMessage !== (existingMetadata?.defaultMessage || "") ||
    recipientName !== (existingMetadata?.recipientName || "") ||
    logoFile !== null ||
    JSON.stringify(links) !== JSON.stringify(existingMetadata?.links || []);

  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save metadata to IPFS then call setUri on-chain
  const handleSaveMetadata = async () => {
    if (!rigAddress) return;
    setPendingField("metadata");
    setIsUploadingMetadata(true);

    try {
      let imageIpfsUrl = existingMetadata?.image || "";

      // Upload new logo if changed
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

      // Upload metadata JSON
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

      // Call setUri on-chain
      const data = encodeFunctionData({
        abi: SET_URI_ABI,
        functionName: "setUri",
        args: [newUri],
      });

      await execute([{ to: rigAddress, data, value: 0n }]);
    } catch {
      setIsUploadingMetadata(false);
      setPendingField(null);
    }
  };

  // Generic save handler for contract calls
  const handleSave = async (field: string) => {
    if (!rigAddress) return;
    setPendingField(field);

    let call: Call | null = null;

    switch (field) {
      case "treasury": {
        const data = encodeFunctionData({
          abi: SET_TREASURY_ABI,
          functionName: "setTreasury",
          args: [treasury as `0x${string}`],
        });
        call = { to: rigAddress, data, value: 0n };
        break;
      }
      case "team": {
        const data = encodeFunctionData({
          abi: SET_TEAM_ABI,
          functionName: "setTeam",
          args: [team as `0x${string}`],
        });
        call = { to: rigAddress, data, value: 0n };
        break;
      }
      case "recipient": {
        const data = encodeFunctionData({
          abi: SET_RECIPIENT_ABI,
          functionName: "setRecipient",
          args: [recipient as `0x${string}`],
        });
        call = { to: rigAddress, data, value: 0n };
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
  const currentLogoUrl = logoPreview || existingLogoUrl;

  const saveBtnClass = (field: string, enabled: boolean) =>
    `px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      successField === field
        ? "bg-moss-300 text-concrete-800"
        : isSaving && pendingField === field
        ? "bg-concrete-600 text-[#8E8E8E]"
        : enabled
        ? "bg-moss-400 text-concrete-800 hover:bg-moss-300"
        : "bg-concrete-700 text-[#8E8E8E]"
    }`;

  const inputClass =
    "flex-1 bg-concrete-700 rounded-xl px-3 py-2.5 text-[14px] font-mono outline-none placeholder:text-[#8E8E8E] min-w-0";

  const labelClass = "text-muted-foreground text-[12px] mb-1.5 block";

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen justify-center bg-concrete-800">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col bg-background"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold">Admin</span>
          <div className="w-9" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4">

          {/* Logo + Name */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-14 h-14 rounded-2xl bg-concrete-700 flex items-center justify-center overflow-hidden flex-shrink-0 hover:bg-concrete-600 transition-colors"
            >
              {currentLogoUrl ? (
                <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-5 h-5 text-[#8E8E8E]" />
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">{tokenName}</div>
              <div className="text-[12px] text-muted-foreground">${tokenSymbol}</div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your fundraiser..."
              rows={3}
              className="w-full bg-concrete-700 rounded-xl px-3 py-2.5 text-[14px] outline-none placeholder:text-[#8E8E8E] resize-none"
            />
          </div>

          {/* Default Message */}
          <div className="mb-4">
            <label className={labelClass}>Default Message</label>
            <input
              type="text"
              value={defaultMessage}
              onChange={(e) => setDefaultMessage(e.target.value)}
              placeholder="gm"
              className="w-full bg-concrete-700 rounded-xl px-3 py-2.5 text-[14px] outline-none placeholder:text-[#8E8E8E]"
            />
          </div>

          {/* Recipient Name (stored in metadata) */}
          <div className="mb-4">
            <label className={labelClass}>Recipient Name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Who receives donations"
              className="w-full bg-concrete-700 rounded-xl px-3 py-2.5 text-[14px] outline-none placeholder:text-[#8E8E8E]"
            />
          </div>

          {/* Links */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>Links</label>
              {links.length < 5 && (
                <button
                  type="button"
                  onClick={() => setLinks([...links, ""])}
                  className="text-[12px] text-[#8E8E8E] hover:text-moss-400 transition-colors"
                >
                  + Add link
                </button>
              )}
            </div>
            {links.map((link, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => {
                    const updated = [...links];
                    updated[i] = e.target.value;
                    setLinks(updated);
                  }}
                  placeholder="https://..."
                  className="flex-1 bg-concrete-700 rounded-xl px-3 py-2.5 text-[14px] outline-none placeholder:text-[#8E8E8E]"
                />
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  className="px-2 text-[#8E8E8E] hover:text-moss-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {links.length === 0 && (
              <p className="text-[12px] text-[#8E8E8E]">No links added</p>
            )}
          </div>

          {/* Save Profile */}
          <button
            onClick={handleSaveMetadata}
            disabled={isSaving || !metadataChanged}
            className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all mb-6 ${
              successField === "metadata"
                ? "bg-moss-300 text-concrete-800"
                : isSaving && pendingField === "metadata"
                ? "bg-concrete-600 text-[#8E8E8E]"
                : metadataChanged
                ? "bg-moss-400 text-concrete-800 hover:bg-moss-300"
                : "bg-concrete-700 text-[#8E8E8E]"
            }`}
          >
            {successField === "metadata" ? (
              "Saved"
            ) : isSaving && pendingField === "metadata" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isUploadingMetadata ? "Uploading..." : "Confirming..."}
              </span>
            ) : metadataChanged ? (
              "Save"
            ) : (
              "Save"
            )}
          </button>

          {/* Recipient */}
          <div className="mb-4">
            <label className={labelClass}>Recipient</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
              <button
                onClick={() => handleSave("recipient")}
                disabled={isSaving || !isRecipientValid || recipient === currentConfig.recipient}
                className={saveBtnClass("recipient", isRecipientValid && recipient !== currentConfig.recipient)}
              >
                {successField === "recipient" ? "Saved" : isSaving && pendingField === "recipient" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : "Save"}
              </button>
            </div>
          </div>

          {/* Treasury */}
          <div className="mb-4">
            <label className={labelClass}>Treasury</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={treasury}
                onChange={(e) => setTreasury(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
              <button
                onClick={() => handleSave("treasury")}
                disabled={isSaving || !isTreasuryValid || treasury === currentConfig.treasury}
                className={saveBtnClass("treasury", isTreasuryValid && treasury !== currentConfig.treasury)}
              >
                {successField === "treasury" ? "Saved" : isSaving && pendingField === "treasury" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : "Save"}
              </button>
            </div>
          </div>

          {/* Team */}
          <div className="mb-4">
            <label className={labelClass}>Team</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
              <button
                onClick={() => handleSave("team")}
                disabled={isSaving || !isTeamValid || team === (currentConfig.team || "")}
                className={saveBtnClass("team", isTeamValid && team !== (currentConfig.team || ""))}
              >
                {successField === "team" ? "Saved" : isSaving && pendingField === "team" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : "Save"}
              </button>
            </div>
          </div>

          <div className="pb-6" />
        </div>
      </div>
    </div>
  );
}
