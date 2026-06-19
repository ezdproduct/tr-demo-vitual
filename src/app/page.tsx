'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDeviceOrientation } from '@/hooks/use-device-orientation';
import { CameraView, CameraViewRef } from '@/components/camera-view';
import { LevelIndicator } from '@/components/level-indicator';
import { PhotoGallery, Photo } from '@/components/photo-gallery';
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
  SlidersHorizontal, 
  Image as ImageIcon, 
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
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetTrigger
} from '@/components/ui/sheet';

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
  const [lockShutter, setLockShutter] = useState<boolean>(true);
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [beepEnabled, setBeepEnabled] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [imageScale, setImageScale] = useState<number>(0.65);
  const [activeGuideIndex, setActiveGuideIndex] = useState<number>(0);
  
  // Alignment & Capture states
  const [isAligned, setIsAligned] = useState<boolean>(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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

  // Load photos from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('captured_photos');
    if (saved) {
      try {
        setPhotos(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved photos:', e);
      }
    }
  }, []);

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
      const newPhoto: Photo = {
        id: Date.now().toString(),
        dataUrl,
        timestamp: Date.now(),
        uploadStatus: 'uploading'
      };

      // Cap at 12 photos in LocalStorage to prevent browser size exception
      const updatedPhotos = [newPhoto, ...photos.slice(0, 11)];
      setPhotos(updatedPhotos);
      localStorage.setItem('captured_photos', JSON.stringify(updatedPhotos));

      // Trigger standard success message (immediately showing preview)
      toast.success(
        autoCapture 
          ? 'Auto-captured successfully!' 
          : 'Photo captured and saved to gallery!'
      );

      // Start background upload to Cloudflare R2
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      })
        .then(res => {
          if (!res.ok) throw new Error('R2 upload failed');
          return res.json();
        })
        .then(data => {
          setPhotos(prev => {
            const updated = prev.map(p => 
              p.id === newPhoto.id 
                ? { ...p, r2Url: data.publicUrl, uploadStatus: 'completed' as const } 
                : p
            );
            localStorage.setItem('captured_photos', JSON.stringify(updated));
            return updated;
          });
        })
        .catch(err => {
          console.error('Failed to upload captured image to R2:', err);
          setPhotos(prev => {
            const updated = prev.map(p => 
              p.id === newPhoto.id 
                ? { ...p, uploadStatus: 'error' as const } 
                : p
            );
            localStorage.setItem('captured_photos', JSON.stringify(updated));
            return updated;
          });
        });

      // Trigger red & white alignment celebration confetti burst!
      if (isAligned) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#ef4444', '#ffffff'],
        });
      }
    }
  };

  // Delete individual photo
  const handleDeletePhoto = (id: string) => {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    localStorage.setItem('captured_photos', JSON.stringify(updated));
    toast.success('Photo deleted.');
  };

  // Clear all photos
  const handleClearAllPhotos = () => {
    if (confirm('Are you sure you want to delete all photos?')) {
      setPhotos([]);
      localStorage.removeItem('captured_photos');
      toast.success('Photo gallery cleared.');
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

      {/* Top HUD Overlay (DSLR style layout) */}
      <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-end items-start z-20 pointer-events-none">
        {/* Settings control */}
        <div className="flex gap-2 pointer-events-auto">
          {/* Settings Drawer */}
          <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <SheetTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-black/50 hover:bg-black/70 border border-white/10 text-white rounded-full h-9 w-9"
                />
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="left" className="bg-white border-neutral-200 text-neutral-950 flex flex-col h-full z-50">
              <SheetHeader>
                <SheetTitle className="text-neutral-900">Camera Settings</SheetTitle>
                <SheetDescription className="text-neutral-500 text-xs">
                  Adjust sensor tolerance and auto-capture preferences.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 py-6">
                {/* Leveling Mode select */}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold tracking-widest text-neutral-500 block">LEVEL MODE</label>
                  <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-0.5 rounded-md border border-neutral-200">
                    <button
                      className={`py-1 rounded text-xs font-semibold transition-all ${
                        levelMode === 'flat' 
                          ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/50' 
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                      onClick={() => setLevelMode('flat')}
                    >
                      Flat
                    </button>
                    <button
                      className={`py-1 rounded text-xs font-semibold transition-all ${
                        levelMode === 'upright' 
                          ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/50' 
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                      onClick={() => setLevelMode('upright')}
                    >
                      Upright
                    </button>
                  </div>
                </div>

                {/* Tolerance slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold tracking-widest text-neutral-500">
                    <span>ALIGNMENT TOLERANCE</span>
                    <span className="text-red-600 font-mono font-bold">±{tolerance.toFixed(1)}°</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={0.5}
                      max={5.0}
                      step={0.1}
                      value={[tolerance]}
                      onValueChange={(val) => setTolerance(Array.isArray(val) ? val[0] : val)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Guide Scale Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold tracking-widest text-neutral-500">
                    <span>GUIDE IMAGE SCALE</span>
                    <span className="text-red-600 font-mono font-bold">{Math.round(imageScale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={0.15}
                      max={3.0}
                      step={0.01}
                      value={[imageScale]}
                      onValueChange={(val) => setImageScale(Array.isArray(val) ? val[0] : val)}
                      className="flex-1"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500 block leading-normal">
                    Resize the centered guide image overlay. You can also drag/pinch directly on the guide box to zoom.
                  </span>
                </div>

                <hr className="border-neutral-100" />

                {/* Lock shutter toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block text-neutral-800">Lock Shutter</span>
                    <span className="text-[10px] text-neutral-500 block max-w-[220px]">
                      Only allow capturing photos when the camera is fully leveled.
                    </span>
                  </div>
                  <Switch 
                    checked={lockShutter}
                    onCheckedChange={setLockShutter}
                  />
                </div>

                {/* Auto Capture toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block text-neutral-800">Auto-Capture</span>
                    <span className="text-[10px] text-neutral-500 block max-w-[220px]">
                      Automatically snap a photo when held level for 1 second.
                    </span>
                  </div>
                  <Switch 
                    checked={autoCapture}
                    onCheckedChange={setAutoCapture}
                  />
                </div>

                {/* Show Grid toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block text-neutral-800">Grid Layout (3x3)</span>
                    <span className="text-[10px] text-neutral-500 block">
                      Display standard rule-of-thirds composition grid.
                    </span>
                  </div>
                  <Switch 
                    checked={showGrid}
                    onCheckedChange={setShowGrid}
                  />
                </div>

                {/* Audio Feedback toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block text-neutral-800">Audio Feedback</span>
                    <span className="text-[10px] text-neutral-500 block max-w-[220px]">
                      Play an alignment ping sound when held perfectly level.
                    </span>
                  </div>
                  <Switch 
                    checked={beepEnabled}
                    onCheckedChange={(checked) => {
                      setBeepEnabled(checked);
                      toast.success(checked ? 'Audio feedback enabled' : 'Audio feedback disabled');
                    }}
                  />
                </div>

                {/* Calibration Section */}
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <div className="flex justify-between items-center text-[10px] font-bold tracking-widest text-neutral-500">
                    <span>SENSOR CALIBRATION</span>
                    {isCalibrated && <span className="text-amber-600 font-bold">CALIBRATED</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        calibrate();
                        toast.success('Zero-point calibrated!');
                      }}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-2 text-xs h-9 cursor-pointer"
                    >
                      Calibrate
                    </Button>
                    {isCalibrated && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetCalibration();
                          toast.info('Calibration offsets reset.');
                        }}
                        className="flex-1 bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800 py-2 text-xs h-9 cursor-pointer"
                      >
                        Reset Offsets
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 block leading-normal">
                    Calibrates the zero-point alignment offsets using the current orientation.
                  </span>
                </div>

                {/* Simulated Mode Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold block text-red-600 flex items-center gap-1">
                      <Laptop className="h-3.5 w-3.5" />
                      Simulate Orientation
                    </span>
                    <span className="text-[10px] text-neutral-500 block max-w-[220px]">
                      Enable to simulate motion sensors on desktop environments.
                    </span>
                  </div>
                  <Switch 
                    checked={isSimulated}
                    onCheckedChange={(checked) => {
                      toggleSimulation(checked);
                      toast.success(checked ? 'Simulation mode enabled!' : 'Simulation mode disabled.');
                    }}
                  />
                </div>
              </div>

              {/* Version Info */}
              <div className="text-[9px] font-mono text-neutral-600 text-center py-2">
                Antigravity Levelling Engine v1.0.0
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>



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
              min={levelMode === 'flat' ? -45 : 45} // For flat, target is 0. For upright, target is 90
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

      {/* Shutter & Gallery Control dock at bottom */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-12 pb-6 px-6 min-h-[140px] z-20 pointer-events-none">
        
        {/* Left Side: Photo Gallery Trigger & Preview */}
        <div className="absolute left-6 bottom-6 w-14 h-14 flex items-center justify-center pointer-events-auto">
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="group relative h-12 w-12 rounded-xl bg-neutral-900 border border-white/10 overflow-hidden shadow-lg transition-transform active:scale-95"
          >
            {photos.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={photos[0].dataUrl} 
                alt="Last photo" 
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500 hover:text-white transition-colors">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            {photos.length > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-600 text-[9px] font-bold text-white h-4.5 w-4.5 rounded-full flex items-center justify-center border border-black shadow">
                {photos.length}
              </div>
            )}
          </button>
        </div>

        {/* Center: Controls Stack (HUD Panel -> Shutter & Arrows) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-3 pointer-events-auto w-[90vw] max-w-[420px]">
          {/* Row 1: Symmetrical Alignment Stats and Horizontal Zoom Side-by-Side (responsive wrapping) */}
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

            {/* Horizontal Zoom Slider (Narrower for perfect mobile fits) */}
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
              {/* Shutter outer ring */}
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
                {/* Shutter inner circle */}
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
            className="h-12 w-12 rounded-full bg-neutral-900 hover:bg-neutral-850 border border-white/10 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-5 w-5 rotate-45" />
          </Button>
        </div>
      </div>

      {/* Slideout Gallery Sheet */}
      <PhotoGallery
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={photos}
        onDeletePhoto={handleDeletePhoto}
        onClearAll={handleClearAllPhotos}
        onAddPhoto={(newPhoto) => {
          setPhotos(prev => {
            const updated = [newPhoto, ...prev.slice(0, 11)];
            localStorage.setItem('captured_photos', JSON.stringify(updated));
            return updated;
          });

          // Upload the beautified photo to R2 in the background
          fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: newPhoto.dataUrl })
          })
            .then(res => {
              if (!res.ok) throw new Error('R2 upload failed');
              return res.json();
            })
            .then(data => {
              setPhotos(prev => {
                const updated = prev.map(p => 
                  p.id === newPhoto.id 
                    ? { ...p, r2Url: data.publicUrl, uploadStatus: 'completed' as const } 
                    : p
                );
                localStorage.setItem('captured_photos', JSON.stringify(updated));
                return updated;
              });
            })
            .catch(err => {
              console.error('Failed to upload beautified image to R2:', err);
              setPhotos(prev => {
                const updated = prev.map(p => 
                  p.id === newPhoto.id 
                    ? { ...p, uploadStatus: 'error' as const } 
                    : p
                );
                localStorage.setItem('captured_photos', JSON.stringify(updated));
                return updated;
              });
            });
        }}
      />
    </main>
  );
}
