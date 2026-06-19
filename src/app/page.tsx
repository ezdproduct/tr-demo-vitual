'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import { CameraView, CameraViewRef } from '@/components/camera-view';
import { LevelIndicator } from '@/components/level-indicator';
import { 
  resumeAudioContext, 
  playAlignmentPing, 
  playCameraShutter 
} from '@/lib/audio-feedback';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  RotateCcw, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Grid, 
  Lock, 
  Unlock, 
  Laptop, 
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const GUIDE_IMAGES = [
  'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-square.png?v=1781757878',
  'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-dinning_set_3.0-_American_Mahogany.png?v=1781758068'
];

export default function Home() {
  const cameraRef = useRef<CameraViewRef | null>(null);
  
  // Custom Hook for Device Orientation
  const {
    raw,
    calibrated,
    calibration,
    isSupported,
    permissionState,
    error: orientationError,
    isSimulated,
    requestPermission,
    calibrate,
    resetCalibration,
    toggleSimulation,
    setSimulatedValues,
  } = useDeviceOrientation();

  // App settings & features states
  const [levelMode, setLevelMode] = useState<'flat' | 'upright'>('flat');
  const [tolerance, setTolerance] = useState<number>(1.5);
  const [lockShutter, setLockShutter] = useState<boolean>(false);
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [beepEnabled, setBeepEnabled] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [imageScale, setImageScale] = useState<number>(0.65);
  const [activeGuideIndex, setActiveGuideIndex] = useState<number>(0);
  const [isBeautifying, setIsBeautifying] = useState<boolean>(false);
  
  // Alignment & Capture states
  const [isAligned, setIsAligned] = useState<boolean>(false);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [autoCaptureTimer, setAutoCaptureTimer] = useState<number | null>(null); // countdown progress

  // Track calibration status
  const isCalibrated = calibration.beta !== 0 || calibration.gamma !== 0;

  // Calculate deviations based on mode for bottom display
  const devBeta = levelMode === 'flat' 
    ? calibrated.beta 
    : (isCalibrated ? calibrated.beta : raw.beta - 90);
    
  const devGamma = levelMode === 'flat' 
    ? calibrated.gamma 
    : (isCalibrated ? calibrated.gamma : raw.gamma - (isCalibrated ? 0 : Math.round(raw.gamma / 90) * 90));

  // Single beep tracking on entering alignment
  const wasAlignedRef = useRef<boolean>(false);

  // Play audio ping when entering aligned zone
  useEffect(() => {
    if (isAligned && !wasAlignedRef.current) {
      if (beepEnabled) {
        playAlignmentPing();
      }
      wasAlignedRef.current = true;
    } else if (!isAligned) {
      wasAlignedRef.current = false;
    }
  }, [isAligned, beepEnabled]);

  // Handle Auto-Capture logic
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    let captureTimeout: NodeJS.Timeout;

    if (autoCapture && isAligned && !cameraError) {
      // Start a 1s stability timer
      const startTime = Date.now();
      const targetTime = startTime + 1000;
      setAutoCaptureTimer(1.0);

      countdownInterval = setInterval(() => {
        const remaining = Math.max(0, (targetTime - Date.now()) / 1000);
        setAutoCaptureTimer(Number(remaining.toFixed(1)));
        if (remaining <= 0) {
          clearInterval(countdownInterval);
        }
      }, 50);

      captureTimeout = setTimeout(() => {
        setAutoCaptureTimer(null);
        handleCapture();
      }, 1000);
    } else {
      setAutoCaptureTimer(null);
    }

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(captureTimeout);
    };
  }, [isAligned, autoCapture, cameraError]);

  const handleBeautify = async (originalDataUrl: string): Promise<string | null> => {
    setIsBeautifying(true);
    try {
      const res = await fetch('/api/beautify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: originalDataUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.needsConfig) {
          toast.error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file.', {
            duration: 6000
          });
        } else {
          toast.error(data.error || 'AI Beautification failed.');
        }
        return null;
      }

      toast.success('AI Beautification completed!');
      return data.image;
    } catch (err) {
      console.error('Beautify error:', err);
      toast.error('An error occurred during AI processing.');
      return null;
    } finally {
      setIsBeautifying(false);
    }
  };

  // Trigger capture event
  const handleCapture = () => {
    if (lockShutter && !isAligned) {
      toast.error('Please level the device before capturing!');
      return;
    }

    if (!cameraRef.current) {
      toast.error('Camera is not ready!');
      return;
    }

    // Trigger visual screen flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    // Play synthesized mechanical camera shutter click
    playCameraShutter();

    // Grab frame from canvas (merging camera background and guide image overlay)
    const guideImageEl = document.getElementById('furniture-guide-image') as HTMLImageElement | null;
    const dataUrl = cameraRef.current.capture(guideImageEl);
    if (dataUrl) {
      if (isAligned) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#ef4444', '#ffffff'],
        });
      }

      // Immediately trigger AI beautification
      handleBeautify(dataUrl).then((beautifiedPhoto) => {
        if (beautifiedPhoto) {
          setAiPhoto(beautifiedPhoto);
        }
      });
    }
  };

  // Download photo helper
  const downloadPhoto = (dataUrl: string) => {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      const date = new Date().toISOString().slice(0, 19).replace(/T|:/g, '-');
      link.download = `camera-level-${date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded to device!');
    } catch (err) {
      toast.error('Failed to download image.');
    }
  };

  // Switch camera facing mode
  const handleToggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    toast.success(`Switched to ${facingMode === 'environment' ? 'front' : 'rear'} camera`);
  };

  // Initialize Web Audio Context on first interactive gesture
  const triggerAudioInit = async () => {
    await resumeAudioContext();
  };

  return (
    <main 
      className="relative flex flex-col w-screen h-dvh bg-neutral-950 text-white overflow-hidden select-none font-sans"
      onClick={triggerAudioInit}
      onTouchStart={triggerAudioInit}
    >
      <Toaster position="top-center" />

      {/* Shutter flash screen overlay */}
      {flashActive && (
        <div className="absolute inset-0 bg-white z-40 transition-opacity duration-75 animate-flash" />
      )}

      {/* If AI Photo is generated, show the single download/retake screen */}
      {aiPhoto ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-30 p-4">
          {/* Generated image preview */}
          <div className="relative max-w-full max-h-[75dvh] aspect-auto rounded-lg overflow-hidden border border-neutral-800 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={aiPhoto} 
              alt="Generated AI result" 
              className="max-w-full max-h-[75dvh] object-contain"
            />
          </div>

          {/* Actions Bar */}
          <div className="mt-6 flex gap-4 w-full max-w-md px-4">
            <Button
              onClick={() => setAiPhoto(null)}
              variant="outline"
              className="flex-1 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white font-bold h-12 text-sm rounded-full cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Chụp lại (Retake)
            </Button>
            <Button
              onClick={() => downloadPhoto(aiPhoto)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold h-12 text-sm rounded-full shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer"
            >
              <Download className="h-4 w-4 mr-2" />
              Tải về (Download)
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Camera Viewfinder layer */}
          <div className="absolute inset-0 w-full h-full z-0">
            <CameraView
              ref={cameraRef}
              facingMode={facingMode}
              isActive={true}
              onCapture={() => {}} // Done in parent with return value
              onError={(msg) => setCameraError(msg)}
            />
          </div>

          {/* Leveling overlay layer */}
          {!cameraError && (
            <LevelIndicator
              raw={raw}
              calibrated={calibrated}
              isCalibrated={isCalibrated}
              mode={levelMode}
              tolerance={tolerance}
              onAlignmentChange={setIsAligned}
              showGrid={showGrid}
              imageScale={imageScale}
              onImageScaleChange={setImageScale}
              guideImages={GUIDE_IMAGES}
              activeGuideIndex={activeGuideIndex}
              onActiveGuideIndexChange={setActiveGuideIndex}
            />
          )}

          {/* iOS Gyroscope Permission Banner Overlay */}
          {isSupported && (permissionState === 'not-requested' || permissionState === 'denied') && (
            <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center z-30 p-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center max-w-sm flex flex-col items-center gap-4">
                <div className={`p-3 rounded-full ${permissionState === 'denied' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  {permissionState === 'denied' ? <AlertCircle className="h-10 w-10 animate-bounce" /> : <Compass className="h-10 w-10 animate-pulse" />}
                </div>
                <h3 className="font-semibold text-lg text-white">
                  {permissionState === 'denied' ? 'Permission Denied' : 'Sensor Permission Required'}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {permissionState === 'denied' 
                    ? 'Device motion sensor access was denied. Please click Retry to grant permission, or use Simulation mode.'
                    : 'This web app requires access to your device motion sensors (gyroscope) to show the leveling indicators.'}
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <Button 
                    onClick={requestPermission}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-5"
                  >
                    {permissionState === 'denied' ? 'Retry' : 'Enable Sensors'}
                  </Button>
                  {permissionState === 'denied' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        toggleSimulation(true);
                        toast.info('Simulation mode enabled.');
                      }}
                      className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 font-normal py-5"
                    >
                      Use Simulation Mode
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Auto-capture Active Counter Indicator */}
          {autoCaptureTimer !== null && (
            <div className="absolute top-[28%] inset-x-0 flex flex-col items-center justify-center z-20 pointer-events-none">
              <div className="bg-red-600/95 border border-red-500/30 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur animate-pulse">
                <Sparkles className="h-4 w-4 text-amber-300 animate-spin-slow" />
                AUTO-CAPTURE IN {autoCaptureTimer.toFixed(1)}s (HOLD STEADY)
              </div>
            </div>
          )}

          {/* Bottom Simulated Orientation Dashboard Slider */}
          {isSimulated && (
            <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-black/80 backdrop-blur-md border border-amber-500/20 rounded-xl p-4 z-20 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1">
                  <Laptop className="h-3.5 w-3.5" /> ORIENTATION SIMULATOR
                </span>
                <button 
                  onClick={() => {
                    setSimulatedValues({ beta: 0, gamma: 0 });
                    toast.info('Simulated angles reset to 0°');
                  }}
                  className="text-[10px] bg-neutral-800 text-white px-2 py-0.5 rounded border border-neutral-700 hover:bg-neutral-700"
                >
                  Reset (0°)
                </button>
              </div>

              {/* Pitch Beta Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-300">
                  <span>PITCH (BETA AXIS)</span>
                  <span className="font-mono text-red-500">{raw.beta.toFixed(1)}°</span>
                </div>
                <Slider
                  min={levelMode === 'flat' ? -45 : 45}
                  max={levelMode === 'flat' ? 45 : 135}
                  step={0.5}
                  value={[raw.beta]}
                  onValueChange={(val) => setSimulatedValues({ beta: Array.isArray(val) ? val[0] : val })}
                />
              </div>

              {/* Roll Gamma Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-300">
                  <span>ROLL (GAMMA AXIS)</span>
                  <span className="font-mono text-red-500">{raw.gamma.toFixed(1)}°</span>
                </div>
                <Slider
                  min={-45}
                  max={45}
                  step={0.5}
                  value={[raw.gamma]}
                  onValueChange={(val) => setSimulatedValues({ gamma: Array.isArray(val) ? val[0] : val })}
                />
              </div>
              <span className="text-[9px] text-neutral-500 leading-normal text-center block">
                Drag the sliders to adjust simulated pitch and roll angles to match target leveling.
              </span>
            </div>
          )}

          {/* Shutter Control dock at bottom */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-12 pb-6 px-6 min-h-[140px] z-20 pointer-events-none">
            {/* Center: Controls Stack (HUD Panel -> Shutter & Arrows) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-3 pointer-events-auto w-[90vw] max-w-[420px]">
              {/* Row 1: Symmetrical Alignment Stats and Horizontal Zoom Side-by-Side */}
              <div className="flex flex-wrap justify-center items-center gap-2 select-none w-full">
                {/* Numeric degrees display */}
                <div className="whitespace-nowrap bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-bold font-mono text-white/95 flex gap-2 shadow-lg">
                  <div className="flex items-center gap-1">
                    <span className="text-white/40">PITCH:</span>
                    <span className={isAligned ? 'text-red-500 font-bold' : 'text-white'}>
                      {devBeta > 0 ? '+' : ''}{devBeta.toFixed(1)}°
                    </span>
                  </div>
                  <div className="w-px h-3 bg-white/20 my-auto" />
                  <div className="flex items-center gap-1">
                    <span className="text-white/40">ROLL:</span>
                    <span className={isAligned ? 'text-red-500 font-bold' : 'text-white'}>
                      {devGamma > 0 ? '+' : ''}{devGamma.toFixed(1)}°
                    </span>
                  </div>
                </div>

                {/* Horizontal Zoom Slider */}
                <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full shadow-lg w-40 h-8">
                  <span className="text-[8px] font-bold text-white/50 tracking-wider select-none uppercase">ZOOM</span>
                  <Slider
                    min={0.15}
                    max={3.0}
                    step={0.01}
                    value={[imageScale]}
                    onValueChange={(val) => setImageScale(Array.isArray(val) ? val[0] : val)}
                    className="flex-1 w-20"
                  />
                  <span className="text-[8px] font-mono text-red-500 font-bold w-8 text-right select-none">{Math.round(imageScale * 100)}%</span>
                </div>
              </div>

              {/* Row 2: Navigation Arrows & Shutter button */}
              <div className="flex items-center gap-4">
                {/* Arrow Left (Previous Guide) */}
                <Button
                  size="icon"
                  onClick={() => {
                    const prevIndex = (activeGuideIndex - 1 + GUIDE_IMAGES.length) % GUIDE_IMAGES.length;
                    setActiveGuideIndex(prevIndex);
                  }}
                  className="h-10 w-10 rounded-full bg-neutral-900/80 hover:bg-neutral-855 border border-white/10 text-white shadow-lg transition-transform active:scale-95 pointer-events-auto"
                >
                  <ArrowLeft className="h-5 w-5 text-white" strokeWidth={2.5} />
                </Button>

                {/* Shutter Button Wrapper */}
                <div className="relative flex items-center justify-center">
                  <button
                    onClick={handleCapture}
                    disabled={lockShutter && !isAligned}
                    className={`relative flex items-center justify-center h-20 w-20 rounded-full border-4 backdrop-blur-sm transition-all duration-300 shadow-2xl ${
                      isAligned 
                        ? 'border-red-500 bg-red-500/10' 
                        : lockShutter 
                          ? 'border-neutral-800 bg-black/40 opacity-40 cursor-not-allowed'
                          : 'border-white bg-black/20 hover:bg-black/35'
                    }`}
                  >
                    <div className={`h-13 w-13 rounded-full transition-all duration-300 ${
                      isAligned 
                        ? 'bg-red-500' 
                        : lockShutter 
                          ? 'bg-neutral-800 flex items-center justify-center text-neutral-400'
                          : 'bg-red-500'
                    }`}>
                      {lockShutter && !isAligned && (
                        <Lock className="h-5 w-5 text-white/80" />
                      )}
                    </div>
                  </button>
                </div>

                {/* Arrow Right (Next Guide) */}
                <Button
                  size="icon"
                  onClick={() => {
                    const nextIndex = (activeGuideIndex + 1) % GUIDE_IMAGES.length;
                    setActiveGuideIndex(nextIndex);
                  }}
                  className="h-10 w-10 rounded-full bg-neutral-900/80 hover:bg-neutral-855 border border-white/10 text-white shadow-lg transition-transform active:scale-95 pointer-events-auto"
                >
                  <ArrowRight className="h-5 w-5 text-white" strokeWidth={2.5} />
                </Button>
              </div>
            </div>

            {/* Right Side: Toggle Front/Rear Camera */}
            <div className="absolute right-6 bottom-6 w-14 h-14 flex items-center justify-center pointer-events-auto">
              <Button
                size="icon"
                onClick={handleToggleCamera}
                disabled={isSimulated || !!cameraError}
                className="h-12 w-12 rounded-full bg-neutral-900 hover:bg-neutral-855 border border-white/10 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-5 w-5 rotate-45" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* AI Beautifying Loader Overlay */}
      {isBeautifying && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4 text-center">
          <div className="relative flex items-center justify-center h-20 w-20">
            <Sparkles className="h-10 w-10 text-amber-400 animate-pulse" />
            <div className="absolute inset-0 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          </div>
          <div className="space-y-1 px-6">
            <h3 className="font-bold text-sm tracking-widest text-amber-400 uppercase animate-pulse">AI is beautifying photo</h3>
            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
              GPT-4o is analyzing composition and DALL-E 3 is re-rendering the scene. This will take 10-20 seconds...
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
