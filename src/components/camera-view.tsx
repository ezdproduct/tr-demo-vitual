'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraViewProps {
  facingMode: 'user' | 'environment';
  onCapture: (dataUrl: string) => void;
  onError: (errorMsg: string | null) => void;
  isActive: boolean;
}

export interface CameraViewRef {
  capture: (guideImageEl?: HTMLImageElement | null) => string | null;
}

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(({
  facingMode,
  onCapture,
  onError,
  isActive
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [streamState, setStreamState] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVirtual, setIsVirtual] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startStream = async () => {
    if (!isActive) return;

    setStreamState('loading');
    setErrorMsg(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported on this browser.');
      }

      // Constraints for mobile devices
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false // No audio track needed
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for metadata to load to get natural dimensions
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setVideoDimensions({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight
            });
            videoRef.current.play().catch(e => {
              console.error("Video autoPlay failed:", e);
            });
            setStreamState('active');
          }
        };
      }
    } catch (err: any) {
      console.error('Error opening camera:', err);
      let message = 'Unable to access camera. Please check device permissions.';
      if (err.name === 'NotAllowedError') {
        message = 'Camera access denied. Please grant camera permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No compatible camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('in use') || err.message?.includes('Readable')) {
        message = 'Camera is already in use by another application or browser tab. Please close other apps using the camera and reload the page.';
      } else if (err.message) {
        message = err.message;
      }
      setErrorMsg(message);
      setStreamState('error');
      onError(message);
    }
  };

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [facingMode, isActive]);

  // Expose the capture function via ref
  useImperativeHandle(ref, () => ({
    capture: (guideImageEl?: HTMLImageElement | null) => {
      const video = videoRef.current;
      const isVirtualMode = isVirtual;
      if (!isVirtualMode && (!video || streamState !== 'active')) return null;

      try {
        const canvas = document.createElement('canvas');
        
        let vw = 1280;
        let vh = 720;
        if (!isVirtualMode && video) {
          vw = video.videoWidth;
          vh = video.videoHeight;
        }
        
        canvas.width = vw;
        canvas.height = vh;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let sw = 1280;
        let sh = 720;
        let relativeVideoLeft = 0;
        let relativeVideoTop = 0;

        if (isVirtualMode) {
          const virtualImg = document.getElementById('virtual-viewfinder-image') as HTMLImageElement | null;
          if (virtualImg) {
            ctx.drawImage(virtualImg, 0, 0, canvas.width, canvas.height);
            const virtualRect = virtualImg.getBoundingClientRect();
            sw = virtualRect.width;
            sh = virtualRect.height;
            relativeVideoLeft = virtualRect.left;
            relativeVideoTop = virtualRect.top;
          } else {
            ctx.fillStyle = '#171717';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        } else if (video) {
          // Draw video (mirroring if front camera)
          if (facingMode === 'user') {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          const videoRect = video.getBoundingClientRect();
          sw = videoRect.width;
          sh = videoRect.height;
          relativeVideoLeft = videoRect.left;
          relativeVideoTop = videoRect.top;
        }

        // Draw guide overlay image if provided
        if (guideImageEl) {
          const imgRect = guideImageEl.getBoundingClientRect();

          // object-cover scaling factor
          const actualScale = Math.max(sw / vw, sh / vh);

          // Displayed background dimensions on screen
          const displayedWidth = vw * actualScale;
          const displayedHeight = vh * actualScale;

          // Offset of the displayed background relative to the container
          const dx = (sw - displayedWidth) / 2;
          const dy = (sh - displayedHeight) / 2;

          // Bounding rect of guide image relative to the container
          const relativeLeft = imgRect.left - relativeVideoLeft;
          const relativeTop = imgRect.top - relativeVideoTop;

          // Map screen coordinates of the guide image to natural background coordinates
          const imgX = (relativeLeft - dx) / actualScale;
          const imgY = (relativeTop - dy) / actualScale;
          const imgW = imgRect.width / actualScale;
          const imgH = imgRect.height / actualScale;

          // Set globalAlpha to match the opacity of the guide image on screen
          const computedStyle = window.getComputedStyle(guideImageEl);
          const opacity = parseFloat(computedStyle.opacity) || 1.0;

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.drawImage(guideImageEl, imgX, imgY, imgW, imgH);
          ctx.restore();
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        onCapture(dataUrl);
        return dataUrl;
      } catch (err) {
        console.error('Failed to capture canvas frame:', err);
        return null;
      }
    }
  }));

  // Mirror effect for front camera CSS preview
  const isMirrored = facingMode === 'user';

  return (
    <div className="relative w-full h-full bg-neutral-950 overflow-hidden flex items-center justify-center">
      {/* Video Viewfinder */}
      {isActive && !isVirtual && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-200 ${
            isMirrored ? 'scale-x-[-1]' : ''
          }`}
        />
      )}

      {/* Virtual Viewfinder (Demo Mode) */}
      {isActive && isVirtual && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          id="virtual-viewfinder-image"
          crossOrigin="anonymous"
          src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1000&auto=format&fit=crop"
          alt="Virtual room viewfinder"
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      )}

      {/* Loading overlay */}
      {streamState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 text-white gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-emerald-400" />
          <p className="text-sm font-medium tracking-wider">OPENING CAMERA...</p>
        </div>
      )}

      {/* Error / Permission Prompt Overlay */}
      {streamState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 text-white p-6 text-center z-20 gap-4">
          <div className="bg-destructive/10 p-3 rounded-full border border-destructive/20 text-destructive">
            <AlertTriangle className="h-10 w-10 animate-bounce" />
          </div>
          <h3 className="font-semibold text-lg">Camera Error</h3>
          <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">
            {errorMsg}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[240px]">
            <Button 
              onClick={startStream}
              variant="outline"
              className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 py-2 h-9 text-xs"
            >
              Retry Connection
            </Button>
            <Button 
              onClick={() => {
                setIsVirtual(true);
                setStreamState('active');
                setErrorMsg(null);
                onError(null); // Clear error state in parent
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 h-9 text-xs cursor-pointer"
            >
              Use Virtual Camera (Demo)
            </Button>
          </div>
        </div>
      )}

      {/* Active Camera HUD display overlay (hidden values for UX, but nice diagnostics) */}
      {streamState === 'active' && (
        <div className="absolute top-4 left-4 text-[10px] font-mono text-white/50 bg-black/40 backdrop-blur px-2 py-1 rounded select-none pointer-events-none">
          {isVirtual 
            ? 'VIRTUAL VIEW | 1280x720' 
            : `CAM: ${facingMode.toUpperCase()} | ${videoDimensions.width}x${videoDimensions.height}`}
        </div>
      )}
    </div>
  );
});

CameraView.displayName = 'CameraView';
