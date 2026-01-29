/**
 * FindEachOtherSheet Component
 * 
 * Bottom sheet shown when both users chose MEET.
 * Shows location hints:
 * - "At the bar"
 * - "By the entrance"
 * - "Outside for air"
 * 
 * Shows expiry text: "This expires in 10 minutes"
 * 
 * CHECKPOINT 1: UI-only, no timer logic yet.
 */

import { MEET_HINTS, type HintKey } from '../../config/venueRoomChoices';
import styles from './venueRoomMutualMoment.module.css';

interface FindEachOtherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickHint: (hintKey: HintKey) => void;
}

export function FindEachOtherSheet({
  isOpen,
  onClose,
  onPickHint,
}: FindEachOtherSheetProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const hintKeys: HintKey[] = ['BAR', 'ENTRANCE', 'OUTSIDE'];

  return (
    <div className={styles.sheetBackdrop} onClick={handleBackdropClick}>
      <div className={styles.sheetContainer}>
        <div className={styles.sheetHandle} />

        <h3 className="text-lg font-semibold text-white text-center mb-4">
          Find each other
        </h3>

        <div className={styles.hintButtonGroup}>
          {hintKeys.map((hintKey) => (
            <button
              key={hintKey}
              className={styles.hintButton}
              onClick={() => onPickHint(hintKey)}
            >
              {MEET_HINTS[hintKey].label}
            </button>
          ))}
        </div>

        <p className={styles.expiryText}>
          This expires in 10 minutes
        </p>
      </div>
    </div>
  );
}

export default FindEachOtherSheet;
