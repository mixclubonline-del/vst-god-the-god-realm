/**
 * AstralThrone — Individual Pad Cell on the Astral Dais
 *
 * Visual states:
 *  - Sealed (empty): sigil pulses, domain label visible
 *  - Claimed (loaded): sigil bright, sample name shown
 *  - Selected: glowing border, detail panel active
 *  - Ignited: 100ms trigger flash on sequencer/MIDI hit
 */
import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { ThroneDomain } from '../data/throneDomains';

interface AstralThroneProps {
  index: number;
  domain: ThroneDomain;
  sampleName: string;
  isLoaded: boolean;
  isSelected: boolean;
  isTriggered: boolean;
  level: number;               // 0-1 real-time audio level
  hasSequencerPattern: boolean; // true if sequencer track has active steps
  onSelect: () => void;
  onTrigger: () => void;
  onFileDrop: (file: File) => void;
  onRelicDrop?: (relic: { path: string; name: string }) => void;
}

export const AstralThrone: React.FC<AstralThroneProps> = React.memo(({
  index,
  domain,
  sampleName,
  isLoaded,
  isSelected,
  isTriggered,
  level,
  hasSequencerPattern,
  onSelect,
  onTrigger,
  onFileDrop,
  onRelicDrop,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didTrigger = useRef(false);

  // Build class list
  const stateClass = isLoaded ? 'astral-throne--claimed' : 'astral-throne--sealed';
  const selectedClass = isSelected ? 'astral-throne--selected' : '';
  const ignitedClass = isTriggered ? 'astral-throne--ignited' : '';
  const dragClass = isDragOver ? 'astral-throne--drag-over' : '';

  // Click = select, hold = trigger/audition
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    didTrigger.current = false;
    holdTimer.current = setTimeout(() => {
      didTrigger.current = true;
      onTrigger();
    }, 200);
  }, [onTrigger]);

  const handlePointerUp = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (!didTrigger.current) {
      onSelect();
    }
  }, [onSelect]);

  const handlePointerLeave = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  // Double-click = file picker
  const handleDoubleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.wav,.mp3,.ogg,.flac,.aif,.aiff';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onFileDrop(file);
    };
    input.click();
  }, [onFileDrop]);

  // Drag & drop — accepts both files and relic data from Archive
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-god-relic')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Check for relic data from Archive first
    const relicData = e.dataTransfer.getData('application/x-god-relic');
    if (relicData && onRelicDrop) {
      try {
        const relic = JSON.parse(relicData);
        onRelicDrop(relic);
        return;
      } catch {}
    }

    // Fall back to file drop
    const files = Array.from(e.dataTransfer.files);
    const audio = files.find(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(f.name)
    );
    if (audio) onFileDrop(audio);
  }, [onFileDrop, onRelicDrop]);

  // Cleanup hold timer
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  return (
    <div
      className={`astral-throne ${stateClass} ${selectedClass} ${ignitedClass} ${dragClass}`}
      style={{ '--throne-color': domain.color } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={isLoaded ? `${domain.name}: ${sampleName}` : `${domain.name} — ${domain.lore}`}
    >
      {/* Trigger flash overlay — always present, CSS controls visibility */}
      <div className="astral-throne__flash" />

      {/* Sequencer dot — top-left */}
      {hasSequencerPattern && (
        <div className="astral-throne__seq-dot" />
      )}

      {/* Pad number — top-right */}
      <span className="astral-throne__number">{String(index + 1).padStart(2, '0')}</span>

      {/* Sigil image */}
      <img
        className="astral-throne__sigil"
        src={domain.sigilImage}
        alt={domain.name}
        draggable={false}
      />

      {/* Domain label — visible when empty */}
      <span className="astral-throne__domain">{domain.name.toUpperCase()}</span>

      {/* Sample name — visible when loaded */}
      {isLoaded && (
        <span className="astral-throne__name">{sampleName}</span>
      )}

      {/* Level meter bar — bottom */}
      <div
        className="astral-throne__level"
        style={{ '--level-width': `${Math.min(100, level * 100)}%` } as React.CSSProperties}
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="astral-throne__drop-overlay">
          <span>DROP</span>
        </div>
      )}
    </div>
  );
});

AstralThrone.displayName = 'AstralThrone';
