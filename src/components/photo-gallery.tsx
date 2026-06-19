'use client';

import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, Download, Eye, ExternalLink, X, Cloud, CloudOff, Link, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: number;
  r2Url?: string;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  isBeautified?: boolean;
}

interface PhotoGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Photo[];
  onDeletePhoto: (id: string) => void;
  onClearAll: () => void;
  onAddPhoto: (photo: Photo) => void;
}

export function PhotoGallery({
  isOpen,
  onClose,
  photos,
  onDeletePhoto,
  onClearAll,
  onAddPhoto,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isBeautifying, setIsBeautifying] = useState(false);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        toast.success('R2 Public Link copied to clipboard!');
      })
      .catch(() => {
        toast.error('Failed to copy link.');
      });
  };

  const handleBeautify = async (photo: Photo) => {
    setIsBeautifying(true);
    try {
      const res = await fetch('/api/beautify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo.dataUrl })
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
        return;
      }

      // Create new photo item
      const newPhoto: Photo = {
        id: Date.now().toString(),
        dataUrl: data.image,
        timestamp: Date.now(),
        isBeautified: true,
        uploadStatus: 'uploading'
      };

      onAddPhoto(newPhoto);
      setSelectedPhoto(newPhoto); // Focus on the new beautified photo!
      toast.success('AI Beautification completed! Saving to gallery...');
    } catch (err) {
      console.error('Beautify error:', err);
      toast.error('An error occurred during AI processing.');
    } finally {
      setIsBeautifying(false);
    }
  };

  const downloadPhoto = (photo: Photo) => {
    try {
      const link = document.createElement('a');
      link.href = photo.dataUrl;
      const date = new Date(photo.timestamp).toISOString().slice(0, 19).replace(/T|:/g, '-');
      link.download = `camera-level-${date}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded to device!');
    } catch (err) {
      toast.error('Failed to download image.');
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-white border-neutral-200 text-neutral-950 flex flex-col h-full z-50">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-xl font-bold tracking-tight text-neutral-900">Photo Gallery</SheetTitle>
            <SheetDescription className="text-neutral-500 text-xs">
              Photos are saved locally in your browser storage (Max 12 photos).
            </SheetDescription>
          </SheetHeader>

          {/* Storage capacity indicator */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 mb-4 flex justify-between items-center text-xs">
            <span className="text-neutral-500">Storage Capacity:</span>
            <span className="font-mono text-red-600 font-bold">
              {photos.length} / 12 photos ({Math.round((photos.length / 12) * 100)}%)
            </span>
          </div>

          {/* Photos Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {photos.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-neutral-400 gap-2">
                <p className="text-sm font-medium">No photos captured yet.</p>
                <p className="text-xs text-neutral-500">Hold the camera level and press the shutter button!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="group relative aspect-square bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden cursor-pointer hover:border-neutral-300 transition-all duration-300"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={photo.dataUrl} 
                      alt="Captured photo" 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    
                    {/* Cloud status icon */}
                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded flex items-center gap-1.5 text-[8px] pointer-events-none select-none z-10">
                      {photo.isBeautified && (
                        <span className="flex items-center gap-0.5 text-amber-300 font-bold border-r border-white/20 pr-1.5">
                          <Sparkles className="h-2.5 w-2.5 fill-amber-300/10" /> AI
                        </span>
                      )}
                      {photo.uploadStatus === 'uploading' && (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Cloud className="h-2.5 w-2.5 animate-pulse" /> SAVING
                        </span>
                      )}
                      {photo.uploadStatus === 'completed' && (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Cloud className="h-2.5 w-2.5" /> CLOUD
                        </span>
                      )}
                      {photo.uploadStatus === 'error' && (
                        <span className="flex items-center gap-1 text-red-400 font-bold">
                          <CloudOff className="h-2.5 w-2.5" /> ERROR
                        </span>
                      )}
                    </div>
                    
                    {/* Photo capture date tag */}
                    <div className="absolute bottom-1.5 left-1.5 text-[8px] font-mono bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>

                    {/* Quick actions overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-all duration-300">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(photo);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPhoto(photo);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {photo.r2Url && (
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(photo.r2Url!);
                          }}
                          title="Copy R2 Link"
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-8 w-8 rounded-full border-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePhoto(photo.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons at bottom */}
          {photos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-100 flex gap-3">
              <Button 
                variant="destructive" 
                className="w-full text-xs font-semibold"
                onClick={onClearAll}
              >
                Clear All
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Full screen photo view dialog */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all duration-200"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Expanded Image container */}
          <div className="relative max-w-full max-h-[80vh] aspect-auto rounded-lg overflow-hidden border border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedPhoto.dataUrl} 
              alt="Full size view" 
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>

          {/* Details & Actions Footer */}
          <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-sm">
            <span className="text-xs font-mono text-neutral-400">
              Captured on {new Date(selectedPhoto.timestamp).toLocaleString()}
            </span>
            {selectedPhoto.r2Url && (
              <div className="text-[10px] text-neutral-400 w-full text-center truncate bg-neutral-900 border border-neutral-800 rounded py-1.5 px-3 select-all">
                <span className="font-semibold text-neutral-500">R2:</span> {selectedPhoto.r2Url}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 w-full">
              {!selectedPhoto.isBeautified && (
                <Button 
                  onClick={() => handleBeautify(selectedPhoto)}
                  className="bg-amber-500 hover:bg-amber-450 text-black font-extrabold text-xs py-2 h-9 cursor-pointer col-span-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 fill-black/10" />
                  AI Beautify (Enhance Photo)
                </Button>
              )}
              {selectedPhoto.r2Url ? (
                <Button 
                  onClick={() => copyToClipboard(selectedPhoto.r2Url!)}
                  className="bg-neutral-800 hover:bg-neutral-750 text-white border border-neutral-700 font-semibold text-xs py-2 h-9 cursor-pointer"
                >
                  <Link className="h-3.5 w-3.5 mr-1.5" />
                  Copy Link
                </Button>
              ) : null}
              <Button 
                onClick={() => downloadPhoto(selectedPhoto)}
                className={`bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-2 h-9 cursor-pointer ${!selectedPhoto.r2Url ? 'col-span-2' : ''}`}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  onDeletePhoto(selectedPhoto.id);
                  setSelectedPhoto(null);
                }}
                className="text-xs py-2 h-9 cursor-pointer col-span-2"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Beautifying Loader Overlay */}
      {isBeautifying && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4 text-center">
          <div className="relative flex items-center justify-center h-20 w-20">
            <Sparkles className="h-10 w-10 text-amber-400 animate-pulse" />
            <div className="absolute inset-0 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          </div>
          <div className="space-y-1 px-6">
            <h3 className="font-bold text-sm tracking-widest text-amber-400 uppercase">AI is beautifying photo</h3>
            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
              GPT-4o is analyzing composition and DALL-E 3 is re-rendering the scene. This will take 10-20 seconds...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
