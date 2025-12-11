/**
 * AdminFeedbackPanel - Admin panel for viewing and managing user feedback
 * 
 * Displays feedback in a table with:
 * - Date, Category, Status, Message preview
 * - Click to view details
 * - Status update functionality
 * - Filter by status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  MoreHorizontal,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  fetchFeedback,
  updateFeedbackStatus,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  type Feedback,
  type FeedbackStatus,
  type FeedbackCategory,
} from '../../lib/feedback';

// ============================================
// TYPES
// ============================================

interface AdminFeedbackPanelProps {
  adminPin: string; // Reserved for future use with edge functions
}

// ============================================
// HELPER: Get icon for category
// ============================================

function getCategoryIcon(category: FeedbackCategory) {
  switch (category) {
    case 'bug':
      return <Bug size={14} className="text-red-400" />;
    case 'forslag':
      return <Lightbulb size={14} className="text-amber-400" />;
    case 'spørsmål':
      return <HelpCircle size={14} className="text-sky-400" />;
    default:
      return <MoreHorizontal size={14} className="text-slate-400" />;
  }
}

// ============================================
// HELPER: Get status badge styling
// ============================================

function getStatusBadgeClass(status: FeedbackStatus): string {
  switch (status) {
    case 'åpen':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'under_arbeid':
      return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'løst':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

// ============================================
// HELPER: Format date
// ============================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// FEEDBACK DETAIL MODAL
// ============================================

interface FeedbackDetailModalProps {
  feedback: Feedback;
  onClose: () => void;
  onStatusChange: (feedbackId: string, newStatus: FeedbackStatus) => Promise<void>;
}

function FeedbackDetailModal({ feedback, onClose, onStatusChange }: FeedbackDetailModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (newStatus === feedback.status) {
      setShowStatusDropdown(false);
      return;
    }
    
    setIsUpdating(true);
    await onStatusChange(feedback.id, newStatus);
    setIsUpdating(false);
    setShowStatusDropdown(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#11121b] border border-neutral-800/50 rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              {getCategoryIcon(feedback.category)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {FEEDBACK_CATEGORY_LABELS[feedback.category]}
              </h2>
              <p className="text-xs text-slate-500">{formatDate(feedback.created_at)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Status section */}
          <div className="mb-5">
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              Status
            </label>
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={isUpdating}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${getStatusBadgeClass(feedback.status)} ${isUpdating ? 'opacity-50' : 'hover:opacity-80'}`}
              >
                {isUpdating ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    {FEEDBACK_STATUS_LABELS[feedback.status]}
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
              
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-[#1a1b2b] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-10">
                  {FEEDBACK_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                        status === feedback.status ? 'bg-slate-700/50 text-white' : 'text-slate-300'
                      }`}
                    >
                      {FEEDBACK_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          <div className="mb-5">
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              Melding
            </label>
            <div className="bg-[#1a1b2b] border border-neutral-700 rounded-xl p-4">
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{feedback.message}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                Bruker ID
              </label>
              <p className="text-slate-400 font-mono text-xs truncate">
                {feedback.user_id ?? 'Anonym'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
                Kilde
              </label>
              <p className="text-slate-400">{feedback.source}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AdminFeedbackPanel({ adminPin: _adminPin }: AdminFeedbackPanelProps) {
  // State
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch feedback
  const loadFeedback = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    const result = await fetchFeedback({ status: statusFilter });

    if (result.error) {
      setError(result.error);
    } else {
      setFeedbackList(result.data);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [statusFilter]);

  // Load on mount and filter change
  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Handle status change
  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackStatus) => {
    setUpdateError(null);
    const result = await updateFeedbackStatus(feedbackId, newStatus);
    
    if (result.success) {
      // Update local state
      setFeedbackList((prev) =>
        prev.map((f) =>
          f.id === feedbackId ? { ...f, status: newStatus } : f
        )
      );
      
      // Update selected feedback if it's the one being changed
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } else {
      // Show error in UI
      const errorMsg = result.error || 'Kunne ikke oppdatere status';
      setUpdateError(errorMsg);
      console.error('Failed to update status:', result.error);
      
      // Clear error after 5 seconds
      setTimeout(() => setUpdateError(null), 5000);
    }
  };

  // Filter counts
  const openCount = feedbackList.filter((f) => f.status === 'åpen').length;

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageSquare size={20} className="text-violet-400" />
          Tilbakemeldinger
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Se og administrer bruker-feedback
        </p>
      </div>

      {/* Filters and refresh */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')}
          className="bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
        >
          <option value="all">Alle statuser</option>
          <option value="åpen">Åpne ({openCount})</option>
          <option value="under_arbeid">Under arbeid</option>
          <option value="løst">Løste</option>
        </select>

        {/* Refresh button */}
        <button
          onClick={loadFeedback}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1b2b] border border-neutral-700 rounded-xl text-sm text-slate-300 hover:text-white hover:border-violet-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Oppdater
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Update error state */}
      {updateError && (
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">Feil ved statusoppdatering: {updateError}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-8">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <RefreshCw size={20} className="animate-spin" />
            <span>Laster tilbakemeldinger...</span>
          </div>
        </div>
      ) : feedbackList.length === 0 ? (
        // Empty state
        <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-8 text-center">
          <MessageSquare size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Ingen tilbakemeldinger funnet</p>
          <p className="text-slate-500 text-sm mt-1">
            {statusFilter !== 'all' ? 'Prøv å endre filteret' : 'Brukere har ikke sendt inn noe enda'}
          </p>
        </div>
      ) : (
        // Feedback list
        <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800/50">
                  <th className="text-left text-xs text-slate-500 uppercase tracking-wider px-4 py-3 font-medium">
                    Dato
                  </th>
                  <th className="text-left text-xs text-slate-500 uppercase tracking-wider px-4 py-3 font-medium">
                    Kategori
                  </th>
                  <th className="text-left text-xs text-slate-500 uppercase tracking-wider px-4 py-3 font-medium">
                    Status
                  </th>
                  <th className="text-left text-xs text-slate-500 uppercase tracking-wider px-4 py-3 font-medium">
                    Melding
                  </th>
                </tr>
              </thead>
              <tbody>
                {feedbackList.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedFeedback(item)}
                    className="border-b border-neutral-800/30 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <span className="text-sm text-slate-300">
                          {FEEDBACK_CATEGORY_LABELS[item.category]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                      >
                        {item.status === 'løst' && <CheckCircle size={12} />}
                        {item.status === 'under_arbeid' && <Clock size={12} />}
                        {FEEDBACK_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                      {item.message.length > 80
                        ? `${item.message.slice(0, 80)}...`
                        : item.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export default AdminFeedbackPanel;

