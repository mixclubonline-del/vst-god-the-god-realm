/**
 * SelectionToolbar — Floating toolbar that appears when steps are selected.
 * Provides quick actions: Copy, Paste, Delete, Reverse, Double, Halve, Randomize Vel.
 */
import React from 'react';

interface SelectionToolbarProps {
  selectedCount: number;
  hasClipboard: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onReverse: () => void;
  onDouble: () => void;
  onHalve: () => void;
  onRandomizeVelocity: () => void;
  onClear: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = React.memo(({
  selectedCount,
  hasClipboard,
  onCopy,
  onPaste,
  onDelete,
  onReverse,
  onDouble,
  onHalve,
  onRandomizeVelocity,
  onClear,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="seq-sel-toolbar">
      <span className="seq-sel-toolbar__count">{selectedCount} selected</span>
      <div className="seq-sel-toolbar__divider" />
      <button className="seq-sel-toolbar__btn" onClick={onCopy} title="Copy (⌘C)">
        📋 Copy
      </button>
      {hasClipboard && (
        <button className="seq-sel-toolbar__btn" onClick={onPaste} title="Paste (⌘V)">
          📌 Paste
        </button>
      )}
      <button className="seq-sel-toolbar__btn seq-sel-toolbar__btn--danger" onClick={onDelete} title="Delete (⌫)">
        🗑 Delete
      </button>
      <div className="seq-sel-toolbar__divider" />
      <button className="seq-sel-toolbar__btn" onClick={onReverse} title="Reverse selected step order">
        🔄 Reverse
      </button>
      <button className="seq-sel-toolbar__btn" onClick={onDouble} title="Double pattern (fill next N steps)">
        ×2
      </button>
      <button className="seq-sel-toolbar__btn" onClick={onHalve} title="Halve pattern (every other step)">
        ÷2
      </button>
      <button className="seq-sel-toolbar__btn" onClick={onRandomizeVelocity} title="Randomize velocity of selected steps">
        🎲 Vel
      </button>
      <div className="seq-sel-toolbar__divider" />
      <button className="seq-sel-toolbar__btn seq-sel-toolbar__btn--dim" onClick={onClear} title="Deselect all (Esc)">
        ✕
      </button>
    </div>
  );
});

SelectionToolbar.displayName = 'SelectionToolbar';
