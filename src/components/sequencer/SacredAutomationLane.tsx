/**
 * SacredAutomationLane — Drawable SVG Breakpoint Automation Editor
 * Phase 7: Enhanced Pencil Tool + Live Preview
 *
 * Features:
 *  - SVG canvas matching step grid width
 *  - Click-to-add breakpoints, drag-to-move, right-click to delete
 *  - Pencil freehand draw mode with LIVE polyline preview (rAF-throttled)
 *  - Value tooltip showing step + value near cursor during draw/drag
 *  - Visual armed indicator (pulse animation on pencil button)
 *  - Curve interpolation: linear / step / smooth
 *  - Parameter selector dropdown
 *  - Enable/disable toggle per lane
 *  - Gradient fill under curve with track color tint
 *  - Playhead indicator synced with sequencer step
 */
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import type {
  AutomationLane,
  AutomationParam,
  AutomationPoint,
} from './useSequencerEngine';
import { getAutomationValue } from './useSequencerEngine';

/* ═══ Parameter metadata ═══ */
const PARAM_META: Record<AutomationParam, { label: string; emoji: string; group: string }> = {
  volume:        { label: 'Volume',     emoji: '🔊', group: 'Mix' },
  pan:           { label: 'Pan',        emoji: '↔️', group: 'Mix' },
  fxReverb:      { label: 'Reverb',     emoji: '🌊', group: 'FX' },
  fxChorus:      { label: 'Chorus',     emoji: '🌀', group: 'FX' },
  fxDelay:       { label: 'Delay',      emoji: '📡', group: 'FX' },
  fxSaturation:  { label: 'Saturate',   emoji: '🔥', group: 'FX' },
  synthEnergy:   { label: 'Energy',     emoji: '⚡', group: 'Synth' },
  synthDivinity: { label: 'Divinity',   emoji: '✨', group: 'Synth' },
  synthWidth:    { label: 'Width',      emoji: '🌐', group: 'Synth' },
  synthRealm:    { label: 'Realm',      emoji: '🏛️', group: 'Synth' },
};

const ALL_PARAMS: AutomationParam[] = Object.keys(PARAM_META) as AutomationParam[];

interface SacredAutomationLaneProps {
  lane: AutomationLane;
  trackIndex: number;
  trackColor: string;
  stepCount: number;
  currentStep: number;
  isPlaying: boolean;
  isRecording?: boolean;
  onSetPoint: (param: AutomationParam, point: AutomationPoint) => void;
  onRemovePoint: (param: AutomationParam, pointIndex: number) => void;
  onSetPoints: (param: AutomationParam, points: AutomationPoint[]) => void;
  onToggleEnabled: (param: AutomationParam) => void;
  onSetCurveType: (param: AutomationParam, curveType: AutomationLane['curveType']) => void;
  onRemoveLane: (param: AutomationParam) => void;
}

const LANE_HEIGHT = 80;
const POINT_RADIUS = 5;
const PADDING_X = 2; // small padding on edges

export const SacredAutomationLane: React.FC<SacredAutomationLaneProps> = ({
  lane,
  trackIndex,
  trackColor,
  stepCount,
  currentStep,
  isPlaying,
  isRecording,
  onSetPoint,
  onRemovePoint,
  onSetPoints,
  onToggleEnabled,
  onSetCurveType,
  onRemoveLane,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // ═══ Phase 7: Live pencil preview state ═══
  // High-frequency capture goes to ref, rAF syncs to state for rendering
  const pencilRawRef = useRef<AutomationPoint[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<AutomationPoint[]>([]);
  const rafIdRef = useRef<number>(0);

  // ═══ Phase 7: Value tooltip state ═══
  const [tooltip, setTooltip] = useState<{ x: number; y: number; step: number; value: number } | null>(null);

  const meta = PARAM_META[lane.param];

  // SVG coordinate helpers
  const getWidth = useCallback(() => {
    return svgRef.current?.clientWidth ?? 600;
  }, []);

  const stepToX = useCallback((step: number) => {
    const w = getWidth();
    const usable = w - PADDING_X * 2;
    return PADDING_X + (step / stepCount) * usable;
  }, [stepCount, getWidth]);

  const valueToY = useCallback((value: number) => {
    return LANE_HEIGHT * (1 - value); // 0 at bottom, 1 at top
  }, []);

  const xToStep = useCallback((x: number) => {
    const w = getWidth();
    const usable = w - PADDING_X * 2;
    const step = ((x - PADDING_X) / usable) * stepCount;
    return Math.max(0, Math.min(stepCount - 0.01, step));
  }, [stepCount, getWidth]);

  const yToValue = useCallback((y: number) => {
    return Math.max(0, Math.min(1, 1 - y / LANE_HEIGHT));
  }, []);

  const getSVGCoords = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  /* ═══ rAF-throttled preview sync ═══ */
  const schedulePreviewSync = useCallback(() => {
    if (rafIdRef.current) return; // already scheduled
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      setDrawingPoints([...pencilRawRef.current]);
    });
  }, []);

  /* ═══ Build SVG path from points ═══ */
  const curvePath = useMemo(() => {
    if (lane.points.length === 0) return '';
    const pts = lane.points;

    if (pts.length === 1) {
      // Single point — horizontal line
      const y = valueToY(pts[0].value);
      return `M ${stepToX(0)},${y} L ${stepToX(stepCount)},${y}`;
    }

    let d = '';

    // Lead-in: hold first value from step 0
    d += `M ${stepToX(0)},${valueToY(pts[0].value)}`;
    d += ` L ${stepToX(pts[0].step)},${valueToY(pts[0].value)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];

      if (lane.curveType === 'step') {
        d += ` L ${stepToX(p1.step)},${valueToY(p0.value)}`;
        d += ` L ${stepToX(p1.step)},${valueToY(p1.value)}`;
      } else if (lane.curveType === 'smooth') {
        // Cubic bezier for smoothstep feel
        const x0 = stepToX(p0.step);
        const y0 = valueToY(p0.value);
        const x1 = stepToX(p1.step);
        const y1 = valueToY(p1.value);
        const cx = (x0 + x1) / 2;
        d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
      } else {
        // linear
        d += ` L ${stepToX(p1.step)},${valueToY(p1.value)}`;
      }
    }

    // Lead-out: hold last value to end
    d += ` L ${stepToX(stepCount)},${valueToY(pts[pts.length - 1].value)}`;

    return d;
  }, [lane.points, lane.curveType, stepCount, stepToX, valueToY]);

  // Fill path (closes to bottom)
  const fillPath = useMemo(() => {
    if (!curvePath) return '';
    return curvePath + ` L ${stepToX(stepCount)},${LANE_HEIGHT} L ${stepToX(0)},${LANE_HEIGHT} Z`;
  }, [curvePath, stepCount, stepToX]);

  /* ═══ Mouse/Pointer Handlers ═══ */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 2) return; // right-click handled by context menu

    const { x, y } = getSVGCoords(e);
    const step = xToStep(x);
    const value = yToValue(y);

    // Show tooltip
    setTooltip({ x, y, step, value });

    if (isPencilMode) {
      // Start freehand drawing
      setIsDrawing(true);
      pencilRawRef.current = [{ step, value }];
      setDrawingPoints([{ step, value }]);
      (e.target as Element)?.setPointerCapture(e.pointerId);
      return;
    }

    // Check if clicking near an existing point (for drag)
    const hitIdx = lane.points.findIndex(p => {
      const px = stepToX(p.step);
      const py = valueToY(p.value);
      const dx = x - px;
      const dy = y - py;
      return Math.sqrt(dx * dx + dy * dy) < POINT_RADIUS * 2.5;
    });

    if (hitIdx >= 0) {
      setDraggingIdx(hitIdx);
      (e.target as Element)?.setPointerCapture(e.pointerId);
    } else {
      // Click to add a new point
      onSetPoint(lane.param, { step: Math.round(step * 4) / 4, value }); // snap to 1/4 step
    }
  }, [isPencilMode, lane.points, lane.param, getSVGCoords, xToStep, yToValue, stepToX, valueToY, onSetPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const { x, y } = getSVGCoords(e);
    const step = xToStep(x);
    const value = yToValue(y);

    if (isPencilMode && isDrawing) {
      // Capture point and schedule rAF preview sync
      pencilRawRef.current.push({ step, value });
      schedulePreviewSync();
      // Update tooltip
      setTooltip({ x, y, step, value });
      return;
    }

    if (draggingIdx !== null) {
      const snappedStep = Math.round(step * 4) / 4; // snap to 1/4 step
      onSetPoint(lane.param, { step: snappedStep, value });
      // Update tooltip
      setTooltip({ x, y, step: snappedStep, value });
      return;
    }

    // Clear tooltip if not interacting
    setTooltip(null);
  }, [isPencilMode, isDrawing, draggingIdx, lane.param, getSVGCoords, xToStep, yToValue, onSetPoint, schedulePreviewSync]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Clear tooltip
    setTooltip(null);

    if (isPencilMode && isDrawing) {
      setIsDrawing(false);
      // Downsample pencil points to ~1 per quarter step
      const raw = pencilRawRef.current;
      if (raw.length === 0) return;
      const sampled: AutomationPoint[] = [];
      let lastStep = -Infinity;
      for (const p of raw) {
        if (p.step - lastStep >= 0.25) {
          sampled.push({ step: Math.round(p.step * 4) / 4, value: p.value });
          lastStep = p.step;
        }
      }
      // Merge with existing points (pencil overwrites in range)
      const minStep = sampled[0]?.step ?? 0;
      const maxStep = sampled[sampled.length - 1]?.step ?? stepCount;
      const kept = lane.points.filter(p => p.step < minStep || p.step > maxStep);
      const merged = [...kept, ...sampled].sort((a, b) => a.step - b.step);
      onSetPoints(lane.param, merged);
      pencilRawRef.current = [];
      setDrawingPoints([]);
      return;
    }
    setDraggingIdx(null);
  }, [isPencilMode, isDrawing, lane.points, lane.param, stepCount, onSetPoints]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Find nearest point and delete it
    const { x, y } = getSVGCoords(e);
    const hitIdx = lane.points.findIndex(p => {
      const px = stepToX(p.step);
      const py = valueToY(p.value);
      const dx = x - px;
      const dy = y - py;
      return Math.sqrt(dx * dx + dy * dy) < POINT_RADIUS * 3;
    });
    if (hitIdx >= 0) {
      onRemovePoint(lane.param, hitIdx);
    }
  }, [lane.points, lane.param, getSVGCoords, stepToX, valueToY, onRemovePoint]);

  /* ═══ Playhead position ═══ */
  const playheadX = useMemo(() => {
    if (currentStep < 0) return null;
    return stepToX(currentStep);
  }, [currentStep, stepToX]);

  /* ═══ Current interpolated value display ═══ */
  const currentValue = useMemo(() => {
    if (currentStep < 0 || lane.points.length === 0) return null;
    return getAutomationValue(lane, currentStep);
  }, [lane, currentStep]);

  const curveTypes: AutomationLane['curveType'][] = ['linear', 'step', 'smooth'];
  const curveIcons: Record<AutomationLane['curveType'], string> = {
    linear: '╱', step: '⌐', smooth: '∿',
  };

  /* ═══ Live pencil preview polyline ═══ */
  const pencilPreviewPolyline = useMemo(() => {
    if (!isDrawing || drawingPoints.length < 2) return null;
    return drawingPoints.map(p =>
      `${stepToX(p.step)},${valueToY(p.value)}`
    ).join(' ');
  }, [isDrawing, drawingPoints, stepToX, valueToY]);

  return (
    <div
      className={`sacred-automation-lane ${lane.enabled ? '' : 'disabled'} ${isDrawing ? 'drawing' : ''} ${isRecording ? 'recording' : ''}`}
      style={{ '--auto-color': trackColor } as React.CSSProperties}
    >
      {/* ─── Lane Header ─── */}
      <div className="sacred-auto-lane-header">
        <button
          className={`sacred-auto-toggle ${lane.enabled ? 'active' : ''}`}
          onClick={() => onToggleEnabled(lane.param)}
          title={lane.enabled ? 'Disable lane' : 'Enable lane'}
        >
          {meta.emoji}
        </button>

        <span className="sacred-auto-param-label">{meta.label}</span>

        {/* Curve type toggle */}
        <div className="sacred-auto-curve-btns">
          {curveTypes.map(ct => (
            <button
              key={ct}
              className={`sacred-auto-curve-btn ${lane.curveType === ct ? 'active' : ''}`}
              onClick={() => onSetCurveType(lane.param, ct)}
              title={ct}
            >
              {curveIcons[ct]}
            </button>
          ))}
        </div>

        {/* Pencil mode toggle — Phase 7: armed indicator */}
        <button
          className={`sacred-auto-pencil ${isPencilMode ? 'active armed' : ''}`}
          onClick={() => setIsPencilMode(!isPencilMode)}
          title={isPencilMode ? 'Switch to point mode' : 'Pencil freehand draw'}
        >
          ✏️
        </button>

        {/* Current value display */}
        {currentValue !== null && (
          <span className="sacred-auto-value-display">
            {Math.round(currentValue * 100)}%
          </span>
        )}

        {/* Remove lane */}
        <button
          className="sacred-auto-remove"
          onClick={() => onRemoveLane(lane.param)}
          title="Remove automation lane"
        >
          ✕
        </button>
      </div>

      {/* ─── SVG Canvas ─── */}
      <svg
        ref={svgRef}
        className={`sacred-auto-canvas ${isDrawing ? 'drawing' : ''}`}
        width="100%"
        height={LANE_HEIGHT}
        viewBox={`0 0 ${600} ${LANE_HEIGHT}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        style={{ cursor: isPencilMode ? 'crosshair' : 'pointer' }}
      >
        <defs>
          <linearGradient id={`autoFill-${trackIndex}-${lane.param}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={trackColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={trackColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Step grid lines */}
        {Array.from({ length: stepCount + 1 }, (_, i) => {
          const x = stepToX(i);
          return (
            <line
              key={i}
              x1={x} y1={0} x2={x} y2={LANE_HEIGHT}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          );
        })}

        {/* Center guide line (50%) */}
        <line
          x1={PADDING_X} y1={LANE_HEIGHT / 2}
          x2={600 - PADDING_X} y2={LANE_HEIGHT / 2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />

        {/* Gradient fill under curve */}
        {fillPath && (
          <path
            d={fillPath}
            fill={`url(#autoFill-${trackIndex}-${lane.param})`}
            pointerEvents="none"
          />
        )}

        {/* Curve path */}
        {curvePath && (
          <path
            d={curvePath}
            fill="none"
            stroke={trackColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
            opacity={lane.enabled ? 1 : 0.3}
          />
        )}

        {/* Breakpoints */}
        {lane.points.map((p, idx) => (
          <circle
            key={idx}
            cx={stepToX(p.step)}
            cy={valueToY(p.value)}
            r={draggingIdx === idx ? POINT_RADIUS * 1.5 : POINT_RADIUS}
            fill={trackColor}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1.5}
            style={{
              filter: draggingIdx === idx ? `drop-shadow(0 0 6px ${trackColor})` : 'none',
              transition: 'r 0.1s ease',
            }}
            pointerEvents="none"
          />
        ))}

        {/* Playhead */}
        {isPlaying && playheadX !== null && (
          <line
            x1={playheadX} y1={0}
            x2={playheadX} y2={LANE_HEIGHT}
            stroke={isRecording ? "rgba(239, 68, 68, 0.8)" : "rgba(255,200,60,0.8)"}
            strokeWidth={1.5}
            pointerEvents="none"
          />
        )}

        {/* ═══ Phase 7: Live pencil preview polyline ═══ */}
        {pencilPreviewPolyline && (
          <polyline
            points={pencilPreviewPolyline}
            fill="none"
            stroke={trackColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
            pointerEvents="none"
            style={{ filter: `drop-shadow(0 0 4px ${trackColor})` }}
          />
        )}
      </svg>

      {/* ═══ Phase 7: Value Tooltip ═══ */}
      {tooltip && (isDrawing || draggingIdx !== null) && (
        <div
          className="sacred-auto-tooltip"
          style={{
            left: `${Math.min(tooltip.x + 12, (svgRef.current?.clientWidth ?? 600) - 80)}px`,
            top: `${Math.max(tooltip.y - 28, 0) + 20}px`,
          }}
        >
          <span className="sacred-auto-tooltip__step">
            {tooltip.step.toFixed(2)}
          </span>
          <span className="sacred-auto-tooltip__value">
            {Math.round(tooltip.value * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

/* ═══ Add-Lane Selector ═══ */

interface AddAutomationLaneSelectorProps {
  existingParams: AutomationParam[];
  trackSourceType: 'sample' | 'synth' | 'bus';
  onAddLane: (param: AutomationParam) => void;
}

export const AddAutomationLaneSelector: React.FC<AddAutomationLaneSelectorProps> = ({
  existingParams,
  trackSourceType,
  onAddLane,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const availableParams = ALL_PARAMS.filter(p => {
    // Don't show already-added
    if (existingParams.includes(p)) return false;
    // Don't show synth params for non-synth tracks
    if (p.startsWith('synth') && trackSourceType !== 'synth') return false;
    return true;
  });

  if (availableParams.length === 0) return null;

  return (
    <div className="sacred-auto-add-lane">
      <button
        className="sacred-auto-add-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Add automation lane"
      >
        <span>+ Automation</span>
      </button>
      {isOpen && (
        <div className="sacred-auto-add-dropdown">
          {availableParams.map(param => {
            const m = PARAM_META[param];
            return (
              <button
                key={param}
                className="sacred-auto-add-option"
                onClick={() => { onAddLane(param); setIsOpen(false); }}
              >
                {m.emoji} {m.label}
                <span className="sacred-auto-add-group">{m.group}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
