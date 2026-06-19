'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface OrientationData {
  alpha: number; // 0 to 360 (compass direction)
  beta: number;  // -180 to 180 (front-back pitch)
  gamma: number; // -90 to 90 (left-right roll)
}

export interface CalibrationData {
  beta: number;
  gamma: number;
}

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<OrientationData>({ alpha: 0, beta: 0, gamma: 0 });
  const [calibration, setCalibration] = useState<CalibrationData>({ beta: 0, gamma: 0 });
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<PermissionState | 'not-requested' | 'unsupported'>('not-requested');
  const [error, setError] = useState<string | null>(null);
  
  // Simulation states
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [simulatedOrientation, setSimulatedOrientation] = useState<OrientationData>({ alpha: 0, beta: 0, gamma: 0 });

  // Use a ref to access the latest simulation state inside event listener
  const isSimulatedRef = useRef(isSimulated);
  isSimulatedRef.current = isSimulated;
  const simulatedRef = useRef(simulatedOrientation);
  simulatedRef.current = simulatedOrientation;

  // Check support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'DeviceOrientationEvent' in window;
      setIsSupported(supported);
      if (!supported) {
        setPermissionState('unsupported');
      } else {
        // If not iOS, permissions are usually granted implicitly
        // Check if Safari-style requestPermission exists
        const requestPermission = (DeviceOrientationEvent as any).requestPermission;
        if (typeof requestPermission !== 'function') {
          // Standard browser: check permission status if API exists, or assume granted
          setPermissionState('granted');
        }
      }
    }
  }, []);

  const handleOrientationChange = useCallback((event: DeviceOrientationEvent) => {
    if (isSimulatedRef.current) return;

    const { alpha, beta, gamma } = event;
    
    setOrientation({
      alpha: alpha ?? 0,
      beta: beta ?? 0,
      gamma: gamma ?? 0,
    });
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (isSimulated || permissionState !== 'granted') {
      window.removeEventListener('deviceorientation', handleOrientationChange);
      return;
    }

    window.addEventListener('deviceorientation', handleOrientationChange);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientationChange);
    };
  }, [permissionState, isSimulated, handleOrientationChange]);

  // Request permission (needed for iOS Safari)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isSimulated) {
      setPermissionState('granted');
      return true;
    }

    if (!isSupported) {
      setError('Cảm biến định hướng thiết bị không được hỗ trợ trên trình duyệt này.');
      return false;
    }

    const requestPermission = (DeviceOrientationEvent as any).requestPermission;
    if (typeof requestPermission === 'function') {
      try {
        const response = await requestPermission();
        setPermissionState(response);
        if (response === 'granted') {
          setError(null);
          return true;
        } else {
          setError('Quyền truy cập cảm biến bị từ chối.');
          return false;
        }
      } catch (err: any) {
        setError(`Lỗi khi yêu cầu quyền cảm biến: ${err?.message || err}`);
        setPermissionState('denied');
        return false;
      }
    } else {
      // Non-iOS: permission granted implicitly
      setPermissionState('granted');
      setError(null);
      return true;
    }
  }, [isSupported, isSimulated]);

  // Calibrate current orientation as 0-point offset
  const calibrate = useCallback(() => {
    const current = isSimulated ? simulatedRef.current : orientation;
    setCalibration({
      beta: current.beta,
      gamma: current.gamma,
    });
  }, [orientation, isSimulated]);

  // Reset calibration offsets
  const resetCalibration = useCallback(() => {
    setCalibration({ beta: 0, gamma: 0 });
  }, []);

  // Toggle simulation mode
  const toggleSimulation = useCallback((enable: boolean) => {
    setIsSimulated(enable);
    if (enable) {
      setPermissionState('granted'); // Allow simulation to display overlays
    }
  }, []);

  // Update simulated orientation values
  const setSimulatedValues = useCallback((values: Partial<OrientationData>) => {
    setSimulatedOrientation(prev => {
      const next = { ...prev, ...values };
      simulatedRef.current = next;
      return next;
    });
  }, []);

  // Compute calibrated values
  const currentRaw = isSimulated ? simulatedOrientation : orientation;
  
  // Calibrated values represent offset from calibrated position
  // Wrap angles properly within bounds if needed, but simple subtraction works for small deviations
  const calibratedBeta = currentRaw.beta - calibration.beta;
  const calibratedGamma = currentRaw.gamma - calibration.gamma;

  return {
    raw: currentRaw,
    calibrated: {
      alpha: currentRaw.alpha,
      beta: calibratedBeta,
      gamma: calibratedGamma,
    },
    calibration,
    isSupported,
    permissionState,
    error,
    isSimulated,
    requestPermission,
    calibrate,
    resetCalibration,
    toggleSimulation,
    setSimulatedValues,
  };
}
