import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CropImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: string | null;
  onCropComplete: (croppedImage: string) => Promise<void>;
  isSaving?: boolean;
}

export default function CropImageModal({ isOpen, onClose, image, onCropComplete, isSaving = false }: CropImageModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    );

    // set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // translate canvas context to a central point and draw image
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // draw rotated image
    ctx.drawImage(image, 0, 0);

    // croppedAreaPixels values are bounding box relative
    // extract the cropped image using these values
    const data = ctx.getImageData(
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height
    );

    // set canvas width to final desired crop size - also clears canvas
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // paste generated rotate image with correct offsets for x,y crop values.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pixelCrop.width;
    tempCanvas.height = pixelCrop.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(data, 0, 0);
    }

    // Resize if too large
    const MAX_SIZE = 300; // Reduced from 400
    let targetWidth = pixelCrop.width;
    let targetHeight = pixelCrop.height;
    
    if (targetWidth > MAX_SIZE || targetHeight > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / targetWidth, MAX_SIZE / targetHeight);
      targetWidth = targetWidth * ratio;
      targetHeight = targetHeight * ratio;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    // As Base64 string with lower quality to ensure it fits in Firestore
    return canvas.toDataURL('image/jpeg', 0.6); // Reduced from 0.8
  };

  const rotateSize = (width: number, height: number, rotation: number) => {
    const rotRad = (rotation * Math.PI) / 180;

    return {
      width:
        Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height:
        Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
  };

  const handleConfirm = async () => {
    if (image && croppedAreaPixels && !isSaving) {
      try {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
        await onCropComplete(croppedImage);
        // onClose is called by handleCropComplete in Settings.tsx if successful
      } catch (e) {
        console.error("Crop error:", e);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-proc-bg/95 backdrop-blur-xl"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative w-full max-w-md bg-proc-secondary border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-proc-secondary/50 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Ajustar Perfil</h3>
              <button 
                onClick={onClose} 
                className="p-2 -mr-2 rounded-xl hover:bg-white/5 text-proc-text-sec transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cropper Area */}
            <div className="relative w-full aspect-square bg-black/60 overflow-hidden">
              {image && (
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={onCropChange}
                  onCropComplete={onCropCompleteInternal}
                  onZoomChange={onZoomChange}
                  classes={{
                    containerClassName: "rounded-none",
                  }}
                  style={{
                    containerStyle: {
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0
                    }
                  }}
                />
              )}
            </div>

            {/* Controls */}
            <div className="p-6 space-y-5 bg-proc-secondary shrink-0">
              <div className="space-y-4">
                {/* Zoom Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest text-proc-text-sec font-bold">Zoom</span>
                    <span className="text-[10px] font-mono text-proc-cyan">{Math.round(zoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                      className="p-1 text-proc-text-sec hover:text-white transition-colors"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(e) => onZoomChange(Number(e.target.value))}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-proc-cyan"
                    />
                    <button 
                      onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                      className="p-1 text-proc-text-sec hover:text-white transition-colors"
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>
                </div>

                {/* Rotation Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest text-proc-text-sec font-bold">Rotação</span>
                    <span className="text-[10px] font-mono text-proc-cyan">{rotation}°</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setRotation((rotation - 90 + 360) % 360)}
                      className="p-1 text-proc-text-sec hover:text-white transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <input
                      type="range"
                      value={rotation}
                      min={0}
                      max={360}
                      step={1}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-proc-cyan"
                    />
                    <div className="w-6" /> {/* Spacer to align with zoom buttons */}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSaving}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-proc-cyan to-proc-green text-proc-bg text-xs font-bold shadow-[0_0_20px_rgba(0,209,255,0.3)] hover:shadow-[0_0_30px_rgba(0,209,255,0.5)] transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-proc-bg/30 border-t-proc-bg rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
