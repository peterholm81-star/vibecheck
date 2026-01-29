/**
 * InteractionPanel Component
 * 
 * Shows Wave / Wink / Poke signal buttons.
 * Used when an avatar is selected in VenueRoom.
 * 
 * CHECKPOINT 1: UI-only, no backend wiring.
 */

import { SIGNAL_LABELS, type SignalType } from '../../config/venueRoomChoices';
import styles from './venueRoomMutualMoment.module.css';

interface InteractionPanelProps {
  /** Index of selected avatar (for display purposes) */
  selectedAvatarIndex: number;
  /** Which signals have already been sent to this avatar */
  sentSignals: SignalType[];
  /** Callback when user sends a signal */
  onSendSignal: (type: SignalType) => void;
  /** Callback to close the panel */
  onClose: () => void;
}

export function InteractionPanel({
  selectedAvatarIndex,
  sentSignals,
  onSendSignal,
  onClose,
}: InteractionPanelProps) {
  const allSignals: SignalType[] = ['wave', 'wink', 'poke'];
  const allSent = allSignals.every((s) => sentSignals.includes(s));

  return (
    <div className={styles.interactionPanel}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-300">
          Send a signal to Avatar #{selectedAvatarIndex + 1}
        </p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-sm"
        >
          Close
        </button>
      </div>

      <div className={styles.signalButtonGroup}>
        {allSignals.map((signalType) => {
          const { emoji, label } = SIGNAL_LABELS[signalType];
          const alreadySent = sentSignals.includes(signalType);

          return (
            <button
              key={signalType}
              className={styles.signalButton}
              onClick={() => onSendSignal(signalType)}
              disabled={alreadySent}
              title={alreadySent ? 'Already sent' : `Send ${label}`}
            >
              <span className={styles.signalButtonEmoji}>{emoji}</span>
              <span className={styles.signalButtonLabel}>
                {alreadySent ? 'Sent' : label}
              </span>
            </button>
          );
        })}
      </div>

      {allSent && (
        <p className="text-xs text-slate-500 text-center mt-3">
          All signals sent to this person
        </p>
      )}
    </div>
  );
}

export default InteractionPanel;
