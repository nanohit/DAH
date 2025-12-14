'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import equal from 'fast-deep-equal';
import { MapElement, Connection } from '../types';

interface MapHistorySnapshot {
  elements: MapElement[];
  connections: Connection[];
}

interface UseMapHistoryArgs {
  elements: MapElement[];
  connections: Connection[];
  setElements: Dispatch<SetStateAction<MapElement[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
}

interface UseMapHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => boolean;
  redo: () => boolean;
  resetBaseline: () => void;
  prepareExternalUpdate: () => void;
  beginBatch: () => void;
  endBatch: () => void;
}

const MAX_HISTORY_LENGTH = 3;

const cloneDeep = <T,>(value: T): T => {
  const globalClone = (globalThis as typeof globalThis & { structuredClone?: <U>(input: U) => U }).structuredClone;
  if (typeof globalClone === 'function') {
    return globalClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const getComparableSnapshot = (snapshot: MapHistorySnapshot) => ({
  elements: snapshot.elements,
  connections: snapshot.connections,
});

export const useMapHistory = ({
  elements,
  connections,
  setElements,
  setConnections,
}: UseMapHistoryArgs): UseMapHistoryResult => {
  const historyRef = useRef<MapHistorySnapshot[]>([]);
  const redoRef = useRef<MapHistorySnapshot[]>([]);
  const previousSnapshotRef = useRef<MapHistorySnapshot | null>(null);
  const isUndoingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const skipNextSnapshotRef = useRef(false);
  const isBatchingRef = useRef(false);
  const batchBaselineRef = useRef<MapHistorySnapshot | null>(null);
  const [canRedo, setCanRedo] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const getCurrentSnapshot = useCallback((): MapHistorySnapshot =>
    cloneDeep({
      elements,
      connections,
    }),
  [elements, connections]);

  useEffect(() => {
    const currentSnapshot = getCurrentSnapshot();

    if (!isInitializedRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      isInitializedRef.current = true;
      setCanUndo(historyRef.current.length > 0);
      return;
    }

    if (skipNextSnapshotRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      skipNextSnapshotRef.current = false;
      setCanUndo(historyRef.current.length > 0);
      return;
    }

    if (isUndoingRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      isUndoingRef.current = false;
      setCanUndo(historyRef.current.length > 0);
      return;
    }

    if (isBatchingRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      return;
    }

    const previousSnapshot = previousSnapshotRef.current;

    if (previousSnapshot && !equal(getComparableSnapshot(previousSnapshot), getComparableSnapshot(currentSnapshot))) {
      const nextHistory = [cloneDeep(previousSnapshot), ...historyRef.current].slice(0, MAX_HISTORY_LENGTH);
      historyRef.current = nextHistory;
      redoRef.current = [];
      setCanUndo(nextHistory.length > 0);
      setCanRedo(false);
    }

    previousSnapshotRef.current = currentSnapshot;
  }, [getCurrentSnapshot]);

  const resetBaseline = useCallback(() => {
    historyRef.current = [];
    redoRef.current = [];
    previousSnapshotRef.current = getCurrentSnapshot();
    skipNextSnapshotRef.current = true;
    isBatchingRef.current = false;
    batchBaselineRef.current = null;
    setCanUndo(false);
    setCanRedo(false);
  }, [getCurrentSnapshot]);

  const prepareExternalUpdate = useCallback(() => {
    skipNextSnapshotRef.current = true;
  }, []);

  const beginBatch = useCallback(() => {
    if (isBatchingRef.current) {
      return;
    }

    const baseline = previousSnapshotRef.current ?? getCurrentSnapshot();
    batchBaselineRef.current = cloneDeep(baseline);
    isBatchingRef.current = true;
  }, [getCurrentSnapshot]);

  const endBatch = useCallback(() => {
    if (!isBatchingRef.current) {
      batchBaselineRef.current = null;
      return;
    }

    isBatchingRef.current = false;

    const baseline = batchBaselineRef.current;
    const current = getCurrentSnapshot(); // Get actual current state, not stale ref
    batchBaselineRef.current = null;

    if (!baseline) {
      return;
    }

    if (equal(getComparableSnapshot(baseline), getComparableSnapshot(current))) {
      return;
    }

    const nextHistory = [cloneDeep(baseline), ...historyRef.current].slice(0, MAX_HISTORY_LENGTH);
    historyRef.current = nextHistory;
    redoRef.current = [];
    previousSnapshotRef.current = current; // Update ref to match actual state
    setCanUndo(nextHistory.length > 0);
    setCanRedo(false);
  }, [getCurrentSnapshot]);

  const undo = useCallback(() => {
    const [snapshot, ...remaining] = historyRef.current;
    if (!snapshot) {
      return false;
    }

    historyRef.current = remaining;
    isUndoingRef.current = true;

    const currentSnapshot = getCurrentSnapshot();
    const restored = cloneDeep(snapshot);
    previousSnapshotRef.current = restored;
    setCanUndo(remaining.length > 0);
    redoRef.current = [cloneDeep(currentSnapshot), ...redoRef.current].slice(0, MAX_HISTORY_LENGTH);
    setCanRedo(redoRef.current.length > 0);

    setElements(() => restored.elements);
    setConnections(() => restored.connections);

    return true;
  }, [getCurrentSnapshot, setElements, setConnections]);

  const redo = useCallback(() => {
    const [snapshot, ...remaining] = redoRef.current;
    if (!snapshot) {
      return false;
    }

    const currentSnapshot = getCurrentSnapshot();
    redoRef.current = remaining;

    const restored = cloneDeep(snapshot);
    previousSnapshotRef.current = restored;

    const nextHistory = [cloneDeep(currentSnapshot), ...historyRef.current].slice(0, MAX_HISTORY_LENGTH);
    historyRef.current = nextHistory;

    setCanUndo(nextHistory.length > 0);
    setCanRedo(remaining.length > 0);

    setElements(() => restored.elements);
    setConnections(() => restored.connections);

    return true;
  }, [getCurrentSnapshot, setConnections, setElements]);

  return useMemo(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      resetBaseline,
      prepareExternalUpdate,
      beginBatch,
      endBatch,
    }),
    [beginBatch, canRedo, canUndo, endBatch, prepareExternalUpdate, redo, resetBaseline, undo],
  );
};

export type UseMapHistoryReturn = ReturnType<typeof useMapHistory>;
