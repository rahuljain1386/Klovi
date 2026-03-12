'use client';

import { useState } from 'react';

export default function ShareButton({ businessName, tagline }: { businessName: string; tagline?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: businessName,
          text: tagline || businessName,
          url: window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="text-sm bg-black/30 backdrop-blur-sm w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
    >
      {copied ? '✓' : '📤'}
    </button>
  );
}
