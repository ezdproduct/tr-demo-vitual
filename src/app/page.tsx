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
  RotateCcw, 
  Sparkles, 
  Lock, 
  Laptop, 
  Compass,
  AlertCircle,
  Download,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const GUIDE_IMAGES = [
  'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-square.png?v=1781757878',
  'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-dinning_set_3.0-_American_Mahogany.png?v=1781758068'
];

const PRODUCTS = [
  {
    id: 0,
    name: 'Bàn gỗ vuông',
    collection: 'HCM SERIES',
    price: '$129.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-square.png?v=1781757878'
  },
  {
    id: 1,
    name: 'Bộ bàn ăn cao cấp',
    collection: 'MAHOGANY SERIES',
    price: '$599.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-dinning_set_3.0-_American_Mahogany.png?v=1781758068'
  },
  {
    id: 2,
    name: 'Sofa góc L hiện đại',
    collection: 'NORDIC SERIES',
    price: '$849.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-square.png?v=1781757878'
  },
  {
    id: 3,
    name: 'Tủ sách treo tường',
    collection: 'MINIMAL SERIES',
    price: '$249.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-dinning_set_3.0-_American_Mahogany.png?v=1781758068'
  },
  {
    id: 4,
    name: 'Đèn thả trần Decor',
    collection: 'LIGHT SERIES',
    price: '$189.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-square.png?v=1781757878'
  },
  {
    id: 5,
    name: 'Giường ngủ king size',
    collection: 'BEDROOM SERIES',
    price: '$1,299.00',
    url: 'https://cdn.shopify.com/s/files/1/0671/2793/5072/files/hcm-dinning_set_3.0-_American_Mahogany.png?v=1781758068'
  }
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
  
  // Positioning and arrangement states
  const [imageScale, setImageScale] = useState<number>(0.65);
  const [activeGuideIndex, setActiveGuideIndex] = useState<number>(0);
  const [furniturePos, setFurniturePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Drag and pinch gestures state mapping
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const furniturePosRef = useRef({ x: 0, y: 0 });
  furniturePosRef.current = furniturePos;
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const initialPinchRef = useRef<{ dist: number; scale: number } | null>(null);
  
  // Alignment & Capture states
  const [isAligned, setIsAligned] = useState<boolean>(false);
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [isBeautifying, setIsBeautifying] = useState<boolean>(false);
  const [autoCaptureTimer, setAutoCaptureTimer] = useState<number | null>(null); // countdown progress
  const [isDrawerExpanded, setIsDrawerExpanded] = useState<boolean>(true);

  // Computed phase state
  const phase = aiPhoto ? 'result' : (roomPhoto ? 'arrange' : 'capture');

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
      if (beepEnabled && phase === 'capture') {
        playAlignmentPing();
      }
      wasAlignedRef.current = true;
    } else if (!isAligned) {
      wasAlignedRef.current = false;
    }
  }, [isAligned, beepEnabled, phase]);

  // Handle Auto-Capture logic
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    let captureTimeout: NodeJS.Timeout;

    if (autoCapture && isAligned && !cameraError && phase === 'capture') {
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
  }, [isAligned, autoCapture, cameraError, phase]);

  // Pointer drag gestures
  const handleFurniturePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    
    pointersRef.current.set(e.pointerId, e.nativeEvent);
    
    if (pointersRef.current.size === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - furniturePosRef.current.x,
        y: e.clientY - furniturePosRef.current.y
      };
    } else if (pointersRef.current.size === 2) {
      setIsDragging(false);
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      initialPinchRef.current = { dist, scale: imageScale };
    }
  };

  const handleFurniturePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, e.nativeEvent);
    }

    if (pointersRef.current.size === 1 && isDragging) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setFurniturePos({ x: newX, y: newY });
    } else if (pointersRef.current.size === 2 && initialPinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      if (initialPinchRef.current.dist > 10) {
        const factor = dist / initialPinchRef.current.dist;
        const newScale = initialPinchRef.current.scale * factor;
        setImageScale(Math.max(0.15, Math.min(3.0, newScale)));
      }
    }
  };

  const handleFurniturePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    
    if (pointersRef.current.size === 0) {
      setIsDragging(false);
      initialPinchRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const remainingId = Array.from(pointersRef.current.keys())[0];
      const remainingEvent = pointersRef.current.get(remainingId);
      if (remainingEvent) {
        dragStartRef.current = {
          x: remainingEvent.clientX - furniturePosRef.current.x,
          y: remainingEvent.clientY - furniturePosRef.current.y
        };
        setIsDragging(true);
      }
      initialPinchRef.current = null;
    }
  };

  const handleFurnitureWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setImageScale(prev => Math.max(0.15, Math.min(3.0, prev + delta)));
  };

  const handleBeautify = async (originalDataUrl: string): Promise<string | null> => {
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
    }
  };

  // Handle image upload from library
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setRoomPhoto(dataUrl);
        setFurniturePos({ x: 0, y: 0 }); // reset layout offsets
        setImageScale(0.65); // reset scale
        toast.success('Đã tải ảnh phòng lên thành công!');
      }
    };
    reader.onerror = () => {
      toast.error('Lỗi khi đọc file ảnh!');
    };
    reader.readAsDataURL(file);
  };

  // Trigger capture event (captures raw room photo only)
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

    // Grab raw room frame from camera canvas
    const dataUrl = cameraRef.current.capture(null);
    if (dataUrl) {
      if (isAligned) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#ef4444', '#ffffff'],
        });
      }
      setRoomPhoto(dataUrl);
      setFurniturePos({ x: 0, y: 0 }); // reset drag offset to center
      setImageScale(0.65); // reset scale
    }
  };

  // Compose static room photo and draggable overlay onto final canvas for AI processing
  const handleRenderAI = async () => {
    if (!roomPhoto) {
      toast.error('No room capture photo found!');
      return;
    }

    setIsBeautifying(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create off-screen 2D canvas context');

      // Load background roomPhoto image
      const bgImg = new Image();
      bgImg.src = roomPhoto;
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = reject;
      });

      canvas.width = bgImg.naturalWidth;
      canvas.height = bgImg.naturalHeight;

      // Draw background roomPhoto on canvas
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      // Draw furniture overlay guide image if available
      const guideImgEl = document.getElementById('furniture-guide-image') as HTMLImageElement | null;
      const bgImgEl = document.getElementById('arrange-bg-image') as HTMLImageElement | null;

      if (guideImgEl && bgImgEl) {
        const bgRect = bgImgEl.getBoundingClientRect();
        const imgRect = guideImgEl.getBoundingClientRect();

        const vw = bgImg.naturalWidth;
        const vh = bgImg.naturalHeight;
        const sw = bgRect.width;
        const sh = bgRect.height;

        // object-cover scaling factor
        const actualScale = Math.max(sw / vw, sh / vh);

        // Displayed background dimensions on screen
        const displayedWidth = vw * actualScale;
        const displayedHeight = vh * actualScale;

        // Offset of the displayed background relative to its container
        const dx = (sw - displayedWidth) / 2;
        const dy = (sh - displayedHeight) / 2;

        // Bounding rect of guide image relative to the background container
        const relativeLeft = imgRect.left - bgRect.left;
        const relativeTop = imgRect.top - bgRect.top;

        // Map screen coordinates of the guide image to natural background coordinates
        const imgX = (relativeLeft - dx) / actualScale;
        const imgY = (relativeTop - dy) / actualScale;
        const imgW = imgRect.width / actualScale;
        const imgH = imgRect.height / actualScale;

        const computedStyle = window.getComputedStyle(guideImgEl);
        const opacity = parseFloat(computedStyle.opacity) || 1.0;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(guideImgEl, imgX, imgY, imgW, imgH);
        ctx.restore();
      }

      const mergedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Trigger AI beautification
      const beautifiedPhoto = await handleBeautify(mergedDataUrl);
      if (beautifiedPhoto) {
        setAiPhoto(beautifiedPhoto);
      }
    } catch (err) {
      console.error('Error combining images on canvas:', err);
      toast.error('An error occurred during canvas compilation.');
    } finally {
      setIsBeautifying(false);
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

      {/* 1. RESULT PHASE SCREEN */}
      {phase === 'result' && aiPhoto && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-30 p-4">
          <div className="relative max-w-full max-h-[75dvh] aspect-auto rounded-lg overflow-hidden border border-neutral-800 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={aiPhoto} 
              alt="Generated AI result" 
              className="max-w-full max-h-[75dvh] object-contain"
            />
          </div>

          {/* Result Actions Bar */}
          <div className="mt-6 flex gap-4 w-full max-w-md px-4">
            <Button
              onClick={() => {
                setAiPhoto(null);
                setRoomPhoto(null);
              }}
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
      )}

      {/* 2. ARRANGE PHASE SCREEN */}
      {phase === 'arrange' && roomPhoto && (
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-neutral-950 flex items-center justify-center">
          {/* Room Photo background overlay */}
          <img 
            id="arrange-bg-image"
            src={roomPhoto}
            className="w-full h-full object-cover select-none pointer-events-none"
            alt="Captured room background"
          />

          {/* Draggable & scalable furniture overlay block */}
          <div
            onPointerDown={handleFurniturePointerDown}
            onPointerMove={handleFurniturePointerMove}
            onPointerUp={handleFurniturePointerUp}
            onPointerCancel={handleFurniturePointerUp}
            onWheel={handleFurnitureWheel}
            className="absolute select-none pointer-events-auto touch-none cursor-move flex items-center justify-center"
            style={{
              left: '50%',
              top: '50%',
              width: '280px',
              height: '175px',
              transform: `translate(calc(-50% + ${furniturePos.x}px), calc(-50% + ${furniturePos.y}px))`,
              zIndex: 10,
            }}
          >
            {/* Furniture overlay silhouette */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              id="furniture-guide-image"
              crossOrigin="anonymous"
              src={GUIDE_IMAGES[activeGuideIndex]} 
              alt="Draggable layout guide" 
              style={{ width: `${imageScale * 100}%` }}
              className="h-auto aspect-square object-contain opacity-85 filter drop-shadow-[0_0_12px_rgba(239,68,68,0.4)] select-none pointer-events-none"
            />
          </div>

          {/* Bottom Dock Control containing catalog and scale sliders */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-16 pb-4 z-20 flex flex-col gap-3 pointer-events-auto">
            {/* Premium product catalog panel */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-5">
                <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Chọn sản phẩm</span>
                <span className="text-[10px] text-white/30">{PRODUCTS.length} sản phẩm</span>
              </div>
              <div className="flex gap-3 overflow-x-auto py-1 px-5 no-scrollbar">
                {PRODUCTS.map((product) => {
                  const guideIdx = product.id % GUIDE_IMAGES.length;
                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        setActiveGuideIndex(guideIdx);
                        setFurniturePos({ x: 0, y: 0 });
                        toast.success(`Đã chọn: ${product.name}`);
                      }}
                      className={`flex-shrink-0 flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 ${
                        activeGuideIndex === guideIdx && product.id < 2
                          ? 'border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.35)] scale-[1.03]'
                          : 'border-white/10 hover:border-white/25 hover:scale-[1.02]'
                      }`}
                      style={{ width: '130px', background: 'rgba(20,20,22,0.92)' }}
                    >
                      {/* Product image */}
                      <div className="relative w-full h-[88px] bg-neutral-900 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        {activeGuideIndex === guideIdx && product.id < 2 && (
                          <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      {/* Product info */}
                      <div className="flex flex-col px-2.5 pt-2 pb-2.5 gap-0.5 text-left">
                        <span className="text-[8px] font-bold tracking-[0.15em] text-red-400/80 uppercase truncate">{product.collection}</span>
                        <span className="text-[11px] font-semibold text-white leading-tight line-clamp-2">{product.name}</span>
                        <span className="text-[11px] font-bold text-white/70 mt-0.5">{product.price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizontal Scale Zoom control */}
            <div className="flex items-center gap-3 bg-black/75 backdrop-blur border border-white/10 px-4 py-2 rounded-full max-w-sm mx-auto w-full">
              <span className="text-[9px] font-bold text-white/50 tracking-wider uppercase select-none">TỶ LỆ</span>
              <Slider
                min={0.15}
                max={3.0}
                step={0.01}
                value={[imageScale]}
                onValueChange={(val) => setImageScale(Array.isArray(val) ? val[0] : val)}
                className="flex-1"
              />
              <span className="text-[9px] font-mono text-red-500 font-bold w-10 text-right select-none">{Math.round(imageScale * 100)}%</span>
            </div>

            {/* Action panel triggers */}
            <div className="flex gap-4 max-w-md mx-auto w-full mt-2">
              <Button
                onClick={() => setRoomPhoto(null)}
                variant="outline"
                className="flex-1 bg-neutral-900 border-neutral-800 hover:bg-neutral-855 text-white font-bold h-12 text-sm rounded-full cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Chụp lại (Retake)
              </Button>
              <Button
                onClick={handleRenderAI}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold h-12 text-sm rounded-full shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Tạo thiết kế AI
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CAPTURE PHASE SCREEN */}
      {phase === 'capture' && (
        <>
          {/* Camera Viewfinder layer */}
          <div className="absolute inset-0 w-full h-full z-0">
            <CameraView
              ref={cameraRef}
              facingMode={facingMode}
              isActive={true}
              onCapture={() => {}} 
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
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-4 pointer-events-auto w-[90vw] max-w-[360px]">
              
              <div className="flex items-center justify-between w-full">
                {/* Left: Upload Image Button */}
                <div className="w-14 h-14 flex items-center justify-center">
                  <input
                    type="file"
                    id="room-image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    size="icon"
                    onClick={() => document.getElementById('room-image-upload')?.click()}
                    className="h-12 w-12 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                </div>

                {/* Center: Shutter Button */}
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

                {/* Right: Toggle Front/Rear Camera */}
                <div className="w-14 h-14 flex items-center justify-center">
                  <Button
                    size="icon"
                    onClick={handleToggleCamera}
                    disabled={isSimulated || !!cameraError}
                    className="h-12 w-12 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-5 w-5 rotate-45" />
                  </Button>
                </div>
              </div>

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
