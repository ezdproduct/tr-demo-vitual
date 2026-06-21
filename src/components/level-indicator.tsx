'use client';

import React from 'react';
import { OrientationData } from '@/hooks/use-device-orientation';

interface LevelIndicatorProps {
  raw: OrientationData;
  calibrated: OrientationData;
  isCalibrated: boolean;
  mode: 'flat' | 'upright';
  tolerance: number; // in degrees, e.g., 1.5
  onAlignmentChange: (isAligned: boolean) => void;
  showGrid?: boolean;
}

export function LevelIndicator({
  raw,
  calibrated,
  isCalibrated,
  mode,
  tolerance,
  onAlignmentChange,
  showGrid = true,
}: LevelIndicatorProps) {
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
    </div>
  );
}

