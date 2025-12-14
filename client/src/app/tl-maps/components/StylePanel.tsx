'use client';

import { useEditor, useValue, DefaultColorStyle, DefaultFillStyle, DefaultSizeStyle, DefaultFontStyle, DefaultHorizontalAlignStyle, DefaultVerticalAlignStyle, DefaultDashStyle } from 'tldraw';
import { useState, useRef, useEffect } from 'react';

// Available colors in tldraw
const COLORS = [
  { id: 'black', hex: '#1d1d1d', name: 'Black' },
  { id: 'grey', hex: '#9ea5b0', name: 'Grey' },
  { id: 'light-violet', hex: '#e0d3f1', name: 'Light Violet' },
  { id: 'violet', hex: '#9b7dde', name: 'Violet' },
  { id: 'blue', hex: '#4a90d9', name: 'Blue' },
  { id: 'light-blue', hex: '#a5d8ff', name: 'Light Blue' },
  { id: 'yellow', hex: '#f5d547', name: 'Yellow' },
  { id: 'orange', hex: '#f5a623', name: 'Orange' },
  { id: 'green', hex: '#4caf50', name: 'Green' },
  { id: 'light-green', hex: '#a7f3d0', name: 'Light Green' },
  { id: 'light-red', hex: '#fca5a5', name: 'Light Red' },
  { id: 'red', hex: '#e03131', name: 'Red' },
  { id: 'white', hex: '#ffffff', name: 'White' },
];

const FILLS = [
  { id: 'none', name: 'None' },
  { id: 'semi', name: 'Semi' },
  { id: 'solid', name: 'Solid' },
  { id: 'pattern', name: 'Pattern' },
];

const SIZES = [
  { id: 's', name: 'S' },
  { id: 'm', name: 'M' },
  { id: 'l', name: 'L' },
  { id: 'xl', name: 'XL' },
];

const FONTS = [
  { id: 'draw', name: 'Draw' },
  { id: 'sans', name: 'Sans' },
  { id: 'serif', name: 'Serif' },
  { id: 'mono', name: 'Mono' },
];

const ALIGNS = [
  { id: 'start', icon: 'left' },
  { id: 'middle', icon: 'center' },
  { id: 'end', icon: 'right' },
];

const DASHES = [
  { id: 'draw', name: 'Draw' },
  { id: 'solid', name: 'Solid' },
  { id: 'dashed', name: 'Dashed' },
  { id: 'dotted', name: 'Dotted' },
];

export function StylePanel() {
  const editor = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Get current styles reactively
  const currentColor = useValue('color', () => {
    return editor.getStyleForNextShape(DefaultColorStyle);
  }, [editor]);

  const currentFill = useValue('fill', () => {
    return editor.getStyleForNextShape(DefaultFillStyle);
  }, [editor]);

  const currentSize = useValue('size', () => {
    return editor.getStyleForNextShape(DefaultSizeStyle);
  }, [editor]);

  const currentFont = useValue('font', () => {
    return editor.getStyleForNextShape(DefaultFontStyle);
  }, [editor]);

  const currentAlign = useValue('align', () => {
    return editor.getStyleForNextShape(DefaultHorizontalAlignStyle);
  }, [editor]);

  const currentDash = useValue('dash', () => {
    return editor.getStyleForNextShape(DefaultDashStyle);
  }, [editor]);

  const currentOpacity = useValue('opacity', () => {
    return editor.getInstanceState().opacityForNextShape;
  }, [editor]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Style setters with proper typing
  type TLColor = 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' | 'light-red' | 'red' | 'white';
  type TLFill = 'none' | 'semi' | 'solid' | 'pattern';
  type TLSize = 's' | 'm' | 'l' | 'xl';
  type TLFont = 'draw' | 'sans' | 'serif' | 'mono';
  type TLAlign = 'start' | 'middle' | 'end';
  type TLDash = 'draw' | 'solid' | 'dashed' | 'dotted';

  const setColor = (colorId: TLColor) => {
    editor.setStyleForSelectedShapes(DefaultColorStyle, colorId);
    editor.setStyleForNextShapes(DefaultColorStyle, colorId);
  };

  const setFill = (fillId: TLFill) => {
    editor.setStyleForSelectedShapes(DefaultFillStyle, fillId);
    editor.setStyleForNextShapes(DefaultFillStyle, fillId);
  };

  const setSize = (sizeId: TLSize) => {
    editor.setStyleForSelectedShapes(DefaultSizeStyle, sizeId);
    editor.setStyleForNextShapes(DefaultSizeStyle, sizeId);
  };

  const setFont = (fontId: TLFont) => {
    editor.setStyleForSelectedShapes(DefaultFontStyle, fontId);
    editor.setStyleForNextShapes(DefaultFontStyle, fontId);
  };

  const setAlign = (alignId: TLAlign) => {
    editor.setStyleForSelectedShapes(DefaultHorizontalAlignStyle, alignId);
    editor.setStyleForNextShapes(DefaultHorizontalAlignStyle, alignId);
  };

  const setDash = (dashId: TLDash) => {
    editor.setStyleForSelectedShapes(DefaultDashStyle, dashId);
    editor.setStyleForNextShapes(DefaultDashStyle, dashId);
  };

  const setOpacity = (opacity: number) => {
    editor.setOpacityForSelectedShapes(opacity);
    editor.setOpacityForNextShapes(opacity);
  };

  const getColorHex = (colorId: string) => {
    return COLORS.find(c => c.id === colorId)?.hex || '#1d1d1d';
  };

  return (
    <div className="absolute top-5 right-5 z-[300]" ref={panelRef}>
      {/* Three-dot menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
        title="Style options"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-700">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Style panel dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64">
          {/* Color Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Color</div>
            <div className="grid grid-cols-7 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setColor(color.id as TLColor)}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${
                    currentColor === color.id ? 'border-blue-500 scale-110' : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Fill Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Fill</div>
            <div className="flex gap-1">
              {FILLS.map((fill) => (
                <button
                  key={fill.id}
                  onClick={() => setFill(fill.id as TLFill)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    currentFill === fill.id 
                      ? 'bg-gray-200 text-gray-900 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {fill.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dash/Stroke Style Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Stroke</div>
            <div className="flex gap-1">
              {DASHES.map((dash) => (
                <button
                  key={dash.id}
                  onClick={() => setDash(dash.id as TLDash)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    currentDash === dash.id 
                      ? 'bg-gray-200 text-gray-900 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {dash.name}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Opacity: {Math.round(currentOpacity * 100)}%
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={currentOpacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Size Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Size</div>
            <div className="flex gap-1">
              {SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSize(size.id as TLSize)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    currentSize === size.id 
                      ? 'bg-gray-200 text-gray-900 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>

          {/* Font Section */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Font</div>
            <div className="grid grid-cols-2 gap-1">
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  onClick={() => setFont(font.id as TLFont)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    currentFont === font.id 
                      ? 'bg-gray-200 text-gray-900 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{ fontFamily: font.id === 'draw' ? 'inherit' : font.id === 'sans' ? 'sans-serif' : font.id === 'serif' ? 'serif' : 'monospace' }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Alignment Section */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Text Align</div>
            <div className="flex gap-1">
              {ALIGNS.map((align) => (
                <button
                  key={align.id}
                  onClick={() => setAlign(align.id as TLAlign)}
                  className={`flex-1 px-3 py-1.5 rounded-md transition-colors ${
                    currentAlign === align.id 
                      ? 'bg-gray-200 text-gray-900' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={`Align ${align.icon}`}
                >
                  {align.icon === 'left' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="15" y2="12" />
                      <line x1="3" y1="18" x2="18" y2="18" />
                    </svg>
                  )}
                  {align.icon === 'center' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="6" y1="12" x2="18" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  )}
                  {align.icon === 'right' && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="9" y1="12" x2="21" y2="12" />
                      <line x1="6" y1="18" x2="21" y2="18" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StylePanel;








