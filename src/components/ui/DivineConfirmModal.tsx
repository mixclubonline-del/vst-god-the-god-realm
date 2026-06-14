import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import './DivineConfirmModal.css';

interface DivineConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export const DivineConfirmModal: React.FC<DivineConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  isDestructive = false
}) => {
  const handleConfirmClick = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="divine-modal-overlay">
          {/* Backdrop Blur */}
          <motion.div
            className="divine-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            className={`divine-confirm-container glass-panel ${isDestructive ? 'destructive' : ''}`}
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            {/* Ambient Top Border Glow */}
            <div className="divine-confirm-glow" />

            {/* Close Button */}
            <button className="divine-modal-close divine-confirm-close" onClick={onClose} aria-label="Close">
              <X size={14} />
            </button>

            {/* Warning Icon Banner */}
            <div className="divine-confirm-icon-wrap">
              <AlertTriangle className={`w-8 h-8 ${isDestructive ? 'text-red-500' : 'text-yellow-500'} animate-bounce-slow`} />
            </div>

            {/* Text details */}
            <div className="text-center mb-6">
              <h2 className="divine-confirm-title">{title}</h2>
              <p className="divine-confirm-desc">{description}</p>
            </div>

            {/* Buttons */}
            <div className="divine-confirm-actions">
              <button className="divine-btn divine-btn--cancel" onClick={onClose}>
                {cancelLabel}
              </button>
              <button 
                className={`divine-btn ${isDestructive ? 'divine-confirm-btn--destructive' : 'divine-confirm-btn--gold'}`}
                onClick={handleConfirmClick}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
