/**
 * ConnectionActionsSheet Component
 * 
 * Bottom sheet showing two choices after a "Connected" moment:
 * - "Just saying hi" (HI)
 * - "Want to meet tonight" (MEET)
 * 
 * No headings per spec.
 * 
 * CHECKPOINT 1: UI-only, no backend wiring.
 */

import { CHOICES, type ChoiceKey } from '../../config/venueRoomChoices';
import styles from './venueRoomMutualMoment.module.css';

interface ConnectionActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choiceKey: ChoiceKey) => void;
}

export function ConnectionActionsSheet({
  isOpen,
  onClose,
  onChoose,
}: ConnectionActionsSheetProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.sheetBackdrop} onClick={handleBackdropClick}>
      <div className={styles.sheetContainer}>
        <div className={styles.sheetHandle} />

        {/* No heading per spec - just the choice cards */}
        <button
          className={styles.choiceCard}
          onClick={() => onChoose('HI')}
        >
          {CHOICES.HI.label}
        </button>

        <button
          className={styles.choiceCard}
          onClick={() => onChoose('MEET')}
        >
          {CHOICES.MEET.label}
        </button>
      </div>
    </div>
  );
}

export default ConnectionActionsSheet;
