import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export default function CompareSlider({
  leftImage,
  rightImage,
  leftLabel = "Corrupted Input",
  rightLabel = "Restored",
  aspectRatio = "aspect-square"
}) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const position = Math.max(0, Math.min(100, (x / width) * 100));
    setSliderPosition(position);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !e.touches[0]) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div className="flex flex-col items-center w-full">
      <div
        ref={containerRef}
        className={`relative w-full max-w-[420px] ${aspectRatio} select-none overflow-hidden rounded-2xl border-2 border-purple-200/80 shadow-md bg-neutral-900 cursor-ew-resize touch-none`}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches[0]) handleMove(e.touches[0].clientX);
        }}
      >
        {/* Right image (base layer) */}
        <img
          src={rightImage}
          alt={rightLabel}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ imageRendering: 'auto' }}
        />

        {/* Left image (clipped layer) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={leftImage}
            alt={leftLabel}
            className="absolute inset-0 w-full h-full object-contain max-w-none"
            style={{
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
              height: '100%',
              imageRendering: 'auto'
            }}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none transform -translate-x-1/2 z-10"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white text-purple-700 rounded-full shadow-lg border-2 border-purple-300 flex items-center justify-center pointer-events-none">
            <SlidersHorizontal className="w-4 h-4 rotate-90" />
          </div>
        </div>

        {/* Floating Badges */}
        <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium z-20 pointer-events-none">
          {leftLabel}
        </span>
        <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium z-20 pointer-events-none">
          {rightLabel}
        </span>
      </div>

      {/* Accessible range input for keyboard / screen readers */}
      <div className="w-full max-w-[420px] mt-3 flex items-center gap-3 px-1">
        <label htmlFor="compare-range" className="text-xs font-medium text-studio-purple-900 sr-only">
          Comparison slider position
        </label>
        <span className="text-[11px] text-purple-700 font-medium">Input</span>
        <input
          id="compare-range"
          type="range"
          min="0"
          max="100"
          value={Math.round(sliderPosition)}
          onChange={(e) => setSliderPosition(Number(e.target.value))}
          className="w-full accent-purple-600 cursor-pointer h-2 bg-purple-200 rounded-lg"
          aria-label="Drag slider to compare before and after"
        />
        <span className="text-[11px] text-purple-700 font-medium">Restored</span>
      </div>
      <p className="text-[11px] text-purple-600/80 mt-1">
        Drag slider or use arrow keys to inspect
      </p>
    </div>
  );
}
