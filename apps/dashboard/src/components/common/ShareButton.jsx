"use client";
import React, { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const ShareButton = ({
  title,
  text,
  url,
  className,
  style,
  iconOnly = false,
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleShare = async (e) => {
    e.stopPropagation(); // Prevent bubbling
    e.preventDefault();

    const shareData = {
      title: title || document.title,
      text: text || title || document.title,
      url: url || window.location.href,
    };

    // Try Native Share
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    }

    // Fallback to Clipboard
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      showToast("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = shareData.url;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        showToast("Link copied to clipboard", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        showToast("Could not copy link", "error");
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      type="button"
      className={`share-btn ${className || ""}`}
      onClick={handleShare}
      style={style}
      title="Share"
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
      {!iconOnly && (
        <span style={{ marginLeft: "4px", fontSize: "0.8rem" }}>
          {copied ? "Copied!" : "Share"}
        </span>
      )}
    </button>
  );
};

export default ShareButton;
