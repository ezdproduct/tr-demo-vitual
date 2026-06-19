'use client';

import React, { useRef } from 'react';
import { OrientationData } from '@/hooks/use-device-orientation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LevelIndicatorProps {
  raw: OrientationData;
  calibrated: OrientationData;
  isCalibrated: boolean;
  mode: 'flat' | 'upright';
  tolerance: number; // in degrees, e.g., 1.5
  onAlignmentChange: (isAligned: boolean) => void;
  showGrid?: boolean;
  imageScale: number;
  onImageScaleChange: (scale: number) => void;
  guideImages: string[];
  activeGuideIndex: number;
  onActiveGuideIndexChange: (index: number) => void;
}

export function LevelIndicator({
  raw,
  calibrated,
  isCalibrated,
  mode,
  tolerance,
  onAlignmentChange,
  showGrid = true,
  imageScale,
  onImageScaleChange,
  guideImages,
  activeGuideIndex,
  onActiveGuideIndexChange,
}: LevelIndicatorProps) {
  // Pointer refs for Drag/Pinch to zoom gesture
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const initialDragRef = useRef<{ x: number; y: number; scale: number; hasSwiped: boolean } | null>(null);
  const initialPinchRef = useRef<{ dist: number; scale: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent event propagation if clicking on arrow navigation buttons
    if ((e.target as HTMLElement).closest('.carousel-nav-btn')) {
      return;
    }

    // Only handle primary mouse button or touch events
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    
    pointersRef.current.set(e.pointerId, e.nativeEvent);
    
    if (pointersRef.current.size === 1) {
      initialDragRef.current = { x: e.clientX, y: e.clientY, scale: imageScale, hasSwiped: false };
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      initialPinchRef.current = { dist, scale: imageScale };
      initialDragRef.current = null; // Disable single pointer drag while pinching
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    
    pointersRef.current.set(e.pointerId, e.nativeEvent);
    
    if (pointersRef.current.size === 1 && initialDragRef.current) {
      if (initialDragRef.current.hasSwiped) return;

      const deltaX = e.clientX - initialDragRef.current.x;
      const deltaY = initialDragRef.current.y - e.clientY;

      // Check for horizontal swipe gesture (threshold: 60px)
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX > 60) {
          // Swipe right: previous image
          const prevIndex = (activeGuideIndex - 1 + guideImages.length) % guideImages.length;
          onActiveGuideIndexChange(prevIndex);
          initialDragRef.current.hasSwiped = true;
        } else if (deltaX < -60) {
          // Swipe left: next index
          const nextIndex = (activeGuideIndex + 1) % guideImages.length;
          onActiveGuideIndexChange(nextIndex);
          initialDragRef.current.hasSwiped = true;
        }
        return;
      }

      // Dragging up by 400px increases scale by 0.5
      const newScale = initialDragRef.current.scale + (deltaY / 400);
      onImageScaleChange(Math.max(0.15, Math.min(3.0, newScale)));
    } else if (pointersRef.current.size === 2 && initialPinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (initialPinchRef.current.dist > 10) {
        const factor = dist / initialPinchRef.current.dist;
        const newScale = initialPinchRef.current.scale * factor;
        onImageScaleChange(Math.max(0.15, Math.min(3.0, newScale)));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore errors if pointer capture already released
    }
    
    if (pointersRef.current.size === 0) {
      initialDragRef.current = null;
      initialPinchRef.current = null;
    } else if (pointersRef.current.size === 1) {
      // Reset drag starting point for the remaining pointer
      const remainingId = Array.from(pointersRef.current.keys())[0];
      const remainingEvent = pointersRef.current.get(remainingId);
      if (remainingEvent) {
        initialDragRef.current = {
          x: remainingEvent.clientX,
          y: remainingEvent.clientY,
          scale: imageScale,
          hasSwiped: false,
        };
      }
      initialPinchRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newScale = imageScale + delta;
    onImageScaleChange(Math.max(0.15, Math.min(3.0, newScale)));
  };

  // 1. Calculate deviations based on mode
  let devBeta = 0; // pitch deviation
  let devGamma = 0; // roll deviation
  let targetRoll = 0; // nearest 90-deg roll target for display

  if (mode === 'flat') {
    // Flat mode: Target beta = 0, gamma = 0
    devBeta = calibrated.beta;
    devGamma = calibrated.gamma;
  } else {
    // Upright mode:
    // Pitch: target is vertical (beta = 90). If calibrated, calibrated.beta measures offset from calibrated point.
    devBeta = isCalibrated ? calibrated.beta : raw.beta - 90;
    
    // Roll: target is nearest 90-degree angle (0 for landscape, -90/90 for portrait)
    if (isCalibrated) {
      devGamma = calibrated.gamma;
    } else {
      targetRoll = Math.round(raw.gamma / 90) * 90;
      devGamma = raw.gamma - targetRoll;
    }
  }

  // Calculate overall error distance
  // In flat mode, we use circular distance. In upright, we can check both separately.
  const isAligned = mode === 'flat' 
    ? Math.sqrt(devBeta * devBeta + devGamma * devGamma) <= tolerance
    : Math.abs(devBeta) <= tolerance && Math.abs(devGamma) <= tolerance;

  // Notify parent component on alignment status changes
  React.useEffect(() => {
    onAlignmentChange(isAligned);
  }, [isAligned, onAlignmentChange]);

  // SVG parameters
  const viewSize = 300;
  const center = viewSize / 2;
  const maxDegrees = 10; // Degrees represented by the outer boundary
  const maxOffset = 30;  // Maximum offset in pixels (keeps bubble inside outer circle)

  // Map degree deviation to pixel offset
  const getOffset = (deg: number) => {
    const ratio = Math.max(-1, Math.min(1, deg / maxDegrees));
    return ratio * maxOffset;
  };

  // Coordinates for flat mode bubble
  // gamma maps to x-axis, beta maps to y-axis
  const bubbleX = center + getOffset(devGamma);
  const bubbleY = center + getOffset(devBeta);

  // Upright mode values
  // Roll dictates the rotation of the horizon line (in opposite direction to maintain horizontal orientation)
  // Pitch dictates the vertical shift of the horizon line
  const horizonRoll = mode === 'upright' ? (isCalibrated ? -calibrated.gamma : -raw.gamma) : 0;
  const horizonYOffset = getOffset(-devBeta); // Move line up when tilted forward, down when tilted back

  // Colors based on alignment state (Red & White branding)
  const strokeColor = isAligned ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.4)';
  const fillColor = isAligned ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)';
  const activeColor = isAligned ? 'rgb(239, 68, 68)' : 'rgb(255, 255, 255)';
  const bubbleFill = isAligned ? 'rgba(239, 68, 68, 0.95)' : 'rgba(255, 255, 255, 0.8)';
  const shadowColor = isAligned ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 0, 0, 0.3)';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
      {/* 3x3 Camera Grid overlay */}
      {showGrid && (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-white/10" />
          <div className="border-r border-white/10" />
          <div className="border-transparent" />
        </div>
      )}

      {/* Central Rectangular Bounding Box (Furniture Preview style) */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`absolute w-[88%] max-w-[520px] aspect-[1.6] border border-dashed rounded-lg transition-all duration-300 pointer-events-auto cursor-ns-resize touch-none flex items-center justify-center select-none ${
          isAligned 
            ? 'border-red-500/30 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
            : 'border-white/10 bg-transparent hover:border-white/20 hover:bg-white/[0.02]'
        }`}
      >
        {/* L-bracket Corners */}
        <div className={`absolute -top-1 -left-1 w-5 h-5 border-t-[3px] border-l-[3px] rounded-tl transition-colors duration-300 ${isAligned ? 'border-red-500' : 'border-white/30'}`} />
        <div className={`absolute -top-1 -right-1 w-5 h-5 border-t-[3px] border-r-[3px] rounded-tr transition-colors duration-300 ${isAligned ? 'border-red-500' : 'border-white/30'}`} />
        <div className={`absolute -bottom-1 -left-1 w-5 h-5 border-b-[3px] border-l-[3px] rounded-bl transition-colors duration-300 ${isAligned ? 'border-red-500' : 'border-white/30'}`} />
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 border-b-[3px] border-r-[3px] rounded-br transition-colors duration-300 ${isAligned ? 'border-red-500' : 'border-white/30'}`} />
        {/* Central target guide image (Larger and responsive) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          id="furniture-guide-image"
          crossOrigin="anonymous"
          src={guideImages[activeGuideIndex]} 
          alt="Alignment target guide" 
          style={{ width: `${imageScale * 100}%` }}
          className={`h-auto aspect-square object-contain transition-[opacity,filter] duration-300 ${
            isAligned ? 'opacity-85 filter drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'opacity-30'
          }`}
        />

        {/* Carousel Pagination Dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-auto z-10">
          {guideImages.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onActiveGuideIndexChange(idx);
              }}
              className={`carousel-nav-btn w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                idx === activeGuideIndex 
                  ? 'bg-red-500 w-3' 
                  : 'bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* SVG Leveler Overlay (Unified, clean bubble level) */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="max-w-[200px] max-h-[200px] absolute pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-300 z-20"
      >
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Crosshair guidelines */}
        <line 
          x1={center - 50} y1={center} 
          x2={center + 50} y2={center} 
          stroke={strokeColor} 
          strokeWidth="1" 
          strokeDasharray="2 3" 
        />
        <line 
          x1={center} y1={center - 50} 
          x2={center} y2={center + 50} 
          stroke={strokeColor} 
          strokeWidth="1" 
          strokeDasharray="2 3" 
        />

        {/* Outer target boundary circle */}
        <circle
          cx={center}
          cy={center}
          r={35}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          className="transition-colors duration-300"
        />

        {/* Center alignment target circle (small) */}
        <circle
          cx={center}
          cy={center}
          r={8}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          className="transition-colors duration-300"
        />

        {/* Dynamic moving bubble Level */}
        <circle
          cx={bubbleX}
          cy={bubbleY}
          r={6}
          fill={activeColor}
          filter={isAligned ? 'url(#glow)' : undefined}
          style={{
            transition: 'transform 0.05s linear',
          }}
          className="transition-all duration-200"
        />
      </svg>
    </div>
  );
}
