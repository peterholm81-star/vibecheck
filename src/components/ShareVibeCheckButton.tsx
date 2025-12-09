import { useState } from 'react';
import { Share2, Check, Copy } from 'lucide-react';

// ============================================
// SHARE VIBECHECK BUTTON
// Uses Web Share API when available, falls back to clipboard
// ============================================

interface ShareVibeCheckButtonProps {
  className?: string;
}

export function ShareVibeCheckButton({ className }: ShareVibeCheckButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    // Guard against SSR
    if (typeof window === 'undefined') {
      setIsSharing(false);
      return;
    }

    const shareUrl = window.location.origin;
    const shareText =
      'Bli med i VibeCheck 🔥 Sjekk stemningen på utestedene i sanntid – flere venner = bedre vibes!';
    const fullText = `${shareText} ${shareUrl}`;

    try {
      // Try native Web Share API first (works on mobile)
      if (navigator.share) {
        await navigator.share({
          title: 'VibeCheck',
          text: shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      } else {
        // Last resort: Show prompt for manual copy
        window.prompt('Kopier og del VibeCheck-lenken:', fullText);
      }
    } catch (error) {
      // User cancelled share dialog or other error
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Feil ved deling av VibeCheck:', error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleShare}
        disabled={isSharing}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-orange-500/20"
      >
        {copied ? (
          <>
            <Check size={18} />
            Lenke kopiert!
          </>
        ) : (
          <>
            <Share2 size={18} />
            🔥 Del VibeCheck med venner
          </>
        )}
      </button>

      {copied && (
        <p className="mt-2 text-center text-xs text-green-400 animate-fade-in">
          <Copy size={12} className="inline mr-1" />
          Tekst og lenke er kopiert til utklippstavlen ✅
        </p>
      )}
    </div>
  );
}

