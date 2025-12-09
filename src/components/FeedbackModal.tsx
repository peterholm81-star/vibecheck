/**
 * FeedbackModal - Modal for users to submit feedback
 * 
 * Opens when user clicks "Gi tilbakemelding" button.
 * Submits feedback to Supabase via the feedback helper.
 */

import { useState } from 'react';
import { X, Send, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import {
  submitFeedback,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
} from '../lib/feedback';

// ============================================
// TYPES
// ============================================

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  // Form state
  const [category, setCategory] = useState<FeedbackCategory>('forslag');
  const [message, setMessage] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Validation
  const isValid = message.trim().length >= 10;

  // Reset form
  const resetForm = () => {
    setCategory('forslag');
    setMessage('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitFeedback({
      category,
      message: message.trim(),
    });

    setIsSubmitting(false);

    if (result.success) {
      setSubmitSuccess(true);
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      setSubmitError(result.error ?? 'Kunne ikke sende tilbakemelding. Prøv igjen.');
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#11121b] border border-neutral-800/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <MessageSquare size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Gi tilbakemelding</h2>
              <p className="text-xs text-slate-500">Hjelp oss å forbedre VibeCheck</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {submitSuccess ? (
            // Success state
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Takk for tilbakemeldingen! 🙌
              </h3>
              <p className="text-sm text-slate-400">
                Vi setter stor pris på at du tar deg tid til å hjelpe oss.
              </p>
            </div>
          ) : (
            // Form
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category select */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                  disabled={isSubmitting}
                  className="w-full bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
                >
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {FEEDBACK_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message textarea */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Din melding
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Beskriv hva du opplevde, eller hva du ønsker deg..."
                  rows={5}
                  className="w-full bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors resize-none disabled:opacity-50"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  {message.length < 10
                    ? `Minst 10 tegn (${10 - message.length} igjen)`
                    : `${message.length} tegn`}
                </p>
              </div>

              {/* Error message */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-xl">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{submitError}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send tilbakemelding
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;

