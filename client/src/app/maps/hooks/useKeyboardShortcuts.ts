'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsArgs {
  onSave: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSpace: () => void;
  onSpaceWithSelection: () => void;
  selectedElement: string | null;
  setIsAltKeyPressed: (value: boolean) => void;
  setIsDuplicating: (value: boolean) => void;
  shouldIgnoreShortcuts: () => boolean;
}

export const useKeyboardShortcuts = ({
  onSave,
  onDeleteSelected,
  onUndo,
  onRedo,
  onSpace,
  onSpaceWithSelection,
  selectedElement,
  setIsAltKeyPressed,
  setIsDuplicating,
  shouldIgnoreShortcuts,
}: UseKeyboardShortcutsArgs) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setIsAltKeyPressed(true);
      }

      if (shouldIgnoreShortcuts()) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!e.repeat) {
          onRedo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!e.repeat) {
          onUndo();
        }
      }

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }

        e.preventDefault();

        if (e.repeat) {
          return;
        }

        if (selectedElement) {
          onSpaceWithSelection();
        } else {
          onSpace();
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        onDeleteSelected();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        setIsAltKeyPressed(false);
        setIsDuplicating(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onRedo, onSave, onDeleteSelected, onUndo, onSpace, onSpaceWithSelection, selectedElement, setIsAltKeyPressed, setIsDuplicating, shouldIgnoreShortcuts]);
};

export type UseKeyboardShortcutsReturn = ReturnType<typeof useKeyboardShortcuts>;

