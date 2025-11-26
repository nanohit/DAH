'use client';

import { useState, useCallback, useRef } from 'react';

interface TextEditModalState {
  id: string;
  text: string;
  selectDefault?: boolean;
}

export const useModalState = () => {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showMapNameDialog, setShowMapNameDialog] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [textEditModal, setTextEditModal] = useState<TextEditModalState | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const openSearchModal = useCallback(() => setIsSearchModalOpen(true), []);
  const closeSearchModal = useCallback(() => setIsSearchModalOpen(false), []);

  const openMapNameDialog = useCallback(() => setShowMapNameDialog(true), []);
  const closeMapNameDialog = useCallback(() => setShowMapNameDialog(false), []);

  const openDropdown = useCallback(() => setShowDropdown(true), []);
  const closeDropdown = useCallback(() => setShowDropdown(false), []);

  const showLinkCopiedToast = useCallback(() => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const openDeleteConfirmModal = useCallback(() => setShowDeleteConfirm(true), []);
  const closeDeleteConfirmModal = useCallback(() => setShowDeleteConfirm(false), []);

  const toggleFormatToolbar = useCallback(() => setShowFormatToolbar((prev) => !prev), []);

  const openTextEditModal = useCallback((id: string, text: string, selectDefault?: boolean) => {
    setTextEditModal({ id, text, selectDefault });
  }, []);

  const closeTextEditModal = useCallback(() => {
    setTextEditModal(null);
  }, []);

  const updateTextEditModal = useCallback((updates: Partial<TextEditModalState>) => {
    setTextEditModal((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const formatText = useCallback(
    (type: 'bold' | 'italic' | 'link' | 'clear', selection: { start: number; end: number }) => {
      if (!textEditModal) return;
      const { start, end } = selection;
      const currentText = textEditModal.text;
      let formattedText = currentText;

      switch (type) {
        case 'bold':
          formattedText =
            currentText.substring(0, start) + '**' + currentText.substring(start, end) + '**' + currentText.substring(end);
          break;
        case 'italic':
          formattedText =
            currentText.substring(0, start) + '*' + currentText.substring(start, end) + '*' + currentText.substring(end);
          break;
        case 'link':
          formattedText =
            currentText.substring(0, start) + '[' + currentText.substring(start, end) + '](url)' + currentText.substring(end);
          break;
        case 'clear':
          const selectionText = currentText.substring(start, end)
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/\[|\]\(.*?\)/g, '');
          formattedText = currentText.substring(0, start) + selectionText + currentText.substring(end);
          break;
      }

      setTextEditModal({ ...textEditModal, text: formattedText });
    },
    [textEditModal],
  );

  return {
    isSearchModalOpen,
    showMapNameDialog,
    showDropdown,
    linkCopied,
    showDeleteConfirm,
    showFormatToolbar,
    textEditModal,
    dropdownRef,
    openSearchModal,
    closeSearchModal,
    openMapNameDialog,
    closeMapNameDialog,
    openDropdown,
    closeDropdown,
    showLinkCopiedToast,
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    toggleFormatToolbar,
    openTextEditModal,
    closeTextEditModal,
    setTextEditModal,
    updateTextEditModal,
    formatText,
  };
};
