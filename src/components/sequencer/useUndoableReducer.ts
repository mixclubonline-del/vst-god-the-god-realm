/**
 * useUndoableReducer — Generic undo/redo wrapper for React useReducer.
 *
 * Wraps any reducer with a past/future history stack.
 * Actions can be filtered to prevent noisy state (e.g. playhead ticks) from
 * filling the history.
 *
 * Usage:
 *   const { state, dispatch, undo, redo, canUndo, canRedo } =
 *     useUndoableReducer(reducer, initialState, { maxHistory: 50, ignoreActions: [...] });
 */
import { useReducer, useCallback, useRef } from 'react';

interface UndoableOptions<A> {
  /** Max number of past states to retain. Default: 50 */
  maxHistory?: number;
  /** Action types that should NOT push to history (noisy/transient actions). */
  ignoreActions?: string[];
  /** Extract the action type string from an action. Default: (a) => a.type */
  getActionType?: (action: A) => string;
}

interface UndoableState<S> {
  past: S[];
  present: S;
  future: S[];
}

interface UndoableResult<S, A> {
  state: S;
  dispatch: (action: A) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset history (e.g. after loading a project) */
  clearHistory: () => void;
}

type UndoMeta =
  | { type: '__UNDO__' }
  | { type: '__REDO__' }
  | { type: '__CLEAR_HISTORY__' }
  | { type: '__USER_ACTION__'; action: unknown; pushToHistory: boolean };

function undoableReducer<S, A>(
  reducer: (state: S, action: A) => S,
  maxHistory: number
) {
  return (undoState: UndoableState<S>, meta: UndoMeta): UndoableState<S> => {
    switch (meta.type) {
      case '__UNDO__': {
        if (undoState.past.length === 0) return undoState;
        const prev = undoState.past[undoState.past.length - 1];
        const newPast = undoState.past.slice(0, -1);
        return {
          past: newPast,
          present: prev,
          future: [undoState.present, ...undoState.future],
        };
      }
      case '__REDO__': {
        if (undoState.future.length === 0) return undoState;
        const next = undoState.future[0];
        const newFuture = undoState.future.slice(1);
        return {
          past: [...undoState.past, undoState.present].slice(-maxHistory),
          present: next,
          future: newFuture,
        };
      }
      case '__CLEAR_HISTORY__':
        return { past: [], present: undoState.present, future: [] };

      case '__USER_ACTION__': {
        const newPresent = reducer(undoState.present, meta.action as A);
        // If state didn't change, don't push
        if (newPresent === undoState.present) return undoState;

        if (meta.pushToHistory) {
          return {
            past: [...undoState.past, undoState.present].slice(-maxHistory),
            present: newPresent,
            future: [], // New action clears redo stack
          };
        }
        // Non-history action: update present only (no past/future change)
        return { ...undoState, present: newPresent };
      }
      default:
        return undoState;
    }
  };
}

export function useUndoableReducer<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  options: UndoableOptions<A> = {}
): UndoableResult<S, A> {
  const {
    maxHistory = 50,
    ignoreActions = [],
    getActionType = (a: A) => a.type,
  } = options;

  const ignoreSet = useRef(new Set(ignoreActions));

  const wrappedReducer = useRef(undoableReducer<S, A>(reducer, maxHistory));

  const [undoState, rawDispatch] = useReducer(wrappedReducer.current, {
    past: [],
    present: initialState,
    future: [],
  });

  const dispatch = useCallback((action: A) => {
    const actionType = getActionType(action);
    const pushToHistory = !ignoreSet.current.has(actionType);
    rawDispatch({
      type: '__USER_ACTION__',
      action,
      pushToHistory,
    });
  }, [getActionType]);

  const undo = useCallback(() => {
    rawDispatch({ type: '__UNDO__' });
  }, []);

  const redo = useCallback(() => {
    rawDispatch({ type: '__REDO__' });
  }, []);

  const clearHistory = useCallback(() => {
    rawDispatch({ type: '__CLEAR_HISTORY__' });
  }, []);

  return {
    state: undoState.present,
    dispatch,
    undo,
    redo,
    canUndo: undoState.past.length > 0,
    canRedo: undoState.future.length > 0,
    clearHistory,
  };
}
