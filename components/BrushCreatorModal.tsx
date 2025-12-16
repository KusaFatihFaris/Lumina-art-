
import React, { useState, useRef } from 'react';
import { Brush, Upload, X, Loader2 } from 'lucide-react';
import { BrushPreset, BrushMode } from '../types';
import { imageToBrushTexture } from '../utils/brushUtils';

interface BrushCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (brush: BrushPreset) => void;
}

export const BrushCreatorModal: React.FC<BrushCreatorModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('Mon Pinceau');
  const [mode, setMode] = useState<BrushMode>('path');
  const [spacing, setSpacing] = useState(0.1);
  const [hardness, setHardness] = useState(1);
  const [texturePreview, setTexturePreview] = useState<string | null>(null);
  const [textureCanvas, setTextureCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // PSD Layer Selection State
  const [psdLayers, setPsdLayers] = useState<any[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(-1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const updateTextureFromLayer = (layer: any) => {
      if (!layer.canvas) return;
      const brushTex = imageToBrushTexture(layer.canvas);
      setTextureCanvas(brushTex);
      setTexturePreview(brushTex.toDataURL());
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    // Reset states
    setPsdLayers([]);
    setSelectedLayerIndex(-1);
    setTexturePreview(null);
    setTextureCanvas(null);

    try {
        if (file.name.toLowerCase().endsWith('.psd')) {
            try {
                // Access global agPsd object loaded via script tag
                const agPsd = (window as any).agPsd;

                if (!agPsd || !agPsd.readPsd) {
                    throw new Error("La bibliothèque ag-psd n'a pas pu être chargée.");
                }

                const readPsd = agPsd.readPsd;

                const arrayBuffer = await file.arrayBuffer();
                const psd = readPsd(arrayBuffer, { useCanvas: true });
                
                const availableLayers: any[] = [];

                // 1. Add Composite Image (if available)
                if (psd.canvas) {
                    availableLayers.push({ 
                        name: '(Image complète / Composite)', 
                        canvas: psd.canvas 
                    });
                }

                // 2. Recursively find all layers with canvas content
                const traverseLayers = (children: any[]) => {
                    children.forEach(child => {
                        if (child.canvas) {
                            availableLayers.push(child);
                        }
                        if (child.children) {
                            traverseLayers(child.children);
                        }
                    });
                };

                if (psd.children) {
                    traverseLayers(psd.children);
                }

                if (availableLayers.length > 0) {
                    setPsdLayers(availableLayers);
                    // Select the first one by default (usually composite or top layer)
                    setSelectedLayerIndex(0);
                    updateTextureFromLayer(availableLayers[0]);
                } else {
                    alert("Aucun calque contenant des pixels n'a été trouvé dans ce fichier PSD.");
                }

            } catch (err) {
                console.error("Failed to load ag-psd or parse file", err);
                alert("Erreur: Impossible de lire le fichier PSD. Assurez-vous que le fichier est valide.");
            }
            setIsLoading(false);
        } else {
            // Handle Images (PNG/JPG)
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                   const canvas = imageToBrushTexture(img);
                   setTextureCanvas(canvas);
                   setTexturePreview(canvas.toDataURL());
                   setIsLoading(false);
                };
                img.src = ev.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    } catch (error) {
        console.error("Erreur lors de la lecture du fichier:", error);
        alert("Erreur lors de la lecture du fichier.");
        setIsLoading(false);
    }
  };

  const handleLayerSelect = (idx: number) => {
      setSelectedLayerIndex(idx);
      if (psdLayers[idx]) {
          updateTextureFromLayer(psdLayers[idx]);
      }
  };

  const handleSave = () => {
    const newBrush: BrushPreset = {
      id: `custom-${Date.now()}`,
      name,
      mode,
      lineCap: 'round',
      hardness: mode === 'path' ? hardness : 1, // Hardness mainly relevant for path shadows
      spacing: mode === 'stamp' ? spacing : undefined,
      texture: mode === 'stamp' ? textureCanvas : undefined
    };
    onSave(newBrush);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-lg font-semibold flex items-center text-white">
            <Brush className="mr-2 text-blue-400" size={20} />
            Créer un Pinceau
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Nom du pinceau</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
             <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Type</label>
             <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                <button 
                    onClick={() => setMode('path')}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === 'path' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Tracé (Simple)
                </button>
                <button 
                    onClick={() => setMode('stamp')}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === 'stamp' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Tampon (Texture)
                </button>
             </div>
          </div>

          {mode === 'path' && (
             <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Dureté (0 = Flou, 1 = Net)</label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={hardness}
                    onChange={(e) => setHardness(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                />
             </div>
          )}

          {mode === 'stamp' && (
             <>
                <div>
                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Espacement</label>
                    <input
                        type="range"
                        min="0.05"
                        max="1.5"
                        step="0.05"
                        value={spacing}
                        onChange={(e) => setSpacing(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Texture (Image ou PSD)</label>
                    <div 
                        onClick={() => !isLoading && fileInputRef.current?.click()}
                        className={`w-full h-24 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-700/50 transition-colors ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isLoading ? (
                            <div className="flex flex-col items-center text-blue-400">
                                <Loader2 size={24} className="animate-spin mb-2" />
                                <span className="text-xs">Traitement...</span>
                            </div>
                        ) : texturePreview ? (
                            <img src={texturePreview} alt="Preview" className="h-20 w-20 object-contain opacity-80" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-500">
                                <Upload size={20} className="mb-1" />
                                <span className="text-xs text-center">Importer PNG, JPG ou PSD</span>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg, .psd" className="hidden" />
                    </div>
                </div>

                {/* PSD Layer Selector - Only visible if multiple layers found */}
                {psdLayers.length > 1 && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Sélectionner un calque</label>
                        <select 
                            value={selectedLayerIndex}
                            onChange={(e) => handleLayerSelect(parseInt(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm outline-none focus:border-blue-500 cursor-pointer"
                        >
                            {psdLayers.map((layer, idx) => (
                                <option key={idx} value={idx}>
                                    {layer.name || `Calque ${idx + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
             </>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || (mode === 'stamp' && !textureCanvas)}
              className={`px-6 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                isLoading || (mode === 'stamp' && !textureCanvas) 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
              }`}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
