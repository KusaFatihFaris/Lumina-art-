
import React, { useState } from 'react';
import { FilePlus, X, Monitor, Square, LayoutTemplate, Scroll, File } from 'lucide-react';
import { PaperType } from '../utils/canvasUtils';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (width: number, height: number, texture: PaperType) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [texture, setTexture] = useState<PaperType>('plain');

  if (!isOpen) return null;

  const presets = [
    { label: 'Full HD', w: 1920, h: 1080, icon: <Monitor size={18} /> },
    { label: '4K UHD', w: 3840, h: 2160, icon: <Monitor size={18} /> },
    { label: 'Carré (Insta)', w: 1080, h: 1080, icon: <Square size={18} /> },
    { label: 'Standard Web', w: 800, h: 600, icon: <LayoutTemplate size={18} /> },
  ];

  const textures: { id: PaperType, label: string, color: string }[] = [
      { id: 'plain', label: 'Blanc (Lisse)', color: '#ffffff' },
      { id: 'old_paper', label: 'Papier Ancien', color: '#f4e4bc' },
      { id: 'canvas', label: 'Toile', color: '#f0f0f0' }, // Texture simulation css needed usually
      { id: 'rough', label: 'Papier Grainé', color: '#e5e5e5' },
  ];

  const handleCreate = () => {
    if (width > 0 && height > 0) {
      onCreate(width, height, texture);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-lg font-semibold flex items-center text-white">
            <FilePlus className="mr-2 text-blue-400" size={20} />
            Nouveau Projet
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
          
          {/* Dimensions Section */}
          <div className="mb-6">
              <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Dimensions</label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => { setWidth(preset.w); setHeight(preset.h); }}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      width === preset.w && height === preset.h
                        ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                        : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="mb-1">{preset.icon}</div>
                    <span className="text-xs font-medium">{preset.label}</span>
                    <span className="text-[10px] text-gray-400">{preset.w} x {preset.h}</span>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">Largeur (px)</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">Hauteur (px)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
          </div>

          {/* Texture Section */}
          <div className="mb-6">
             <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Texture du Papier</label>
             <div className="grid grid-cols-2 gap-3">
                 {textures.map((tex) => (
                     <button
                        key={tex.id}
                        onClick={() => setTexture(tex.id)}
                        className={`relative flex items-center p-2 rounded-lg border transition-all overflow-hidden ${
                            texture === tex.id 
                            ? 'border-blue-500 ring-1 ring-blue-500' 
                            : 'border-gray-600 hover:bg-gray-700'
                        }`}
                     >
                        <div 
                            className="w-10 h-10 rounded shadow-inner mr-3 border border-gray-500/30 flex-shrink-0" 
                            style={{ 
                                backgroundColor: tex.color,
                                backgroundImage: tex.id === 'canvas' 
                                    ? 'radial-gradient(#ccc 1px, transparent 1px)' // Simple preview
                                    : 'none',
                                backgroundSize: tex.id === 'canvas' ? '4px 4px' : 'auto'
                            }}
                        />
                        <span className={`text-sm font-medium ${texture === tex.id ? 'text-white' : 'text-gray-300'}`}>
                            {tex.label}
                        </span>
                     </button>
                 ))}
             </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all"
            >
              Créer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
