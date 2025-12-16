
import React, { useEffect, useRef } from 'react';
import { BrushPreset } from '../types';
import { X, Check, Plus, Trash2 } from 'lucide-react';

interface BrushLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  activeBrushId: string;
  onSelectBrush: (brush: BrushPreset) => void;
  allBrushes: BrushPreset[];
  onOpenCreator: () => void;
  onDeleteBrush: (id: string) => void;
}

const BrushPreview: React.FC<{ brush: BrushPreset, selected: boolean }> = ({ brush, selected }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Settings
        ctx.strokeStyle = selected ? '#60a5fa' : '#9ca3af';
        ctx.fillStyle = selected ? '#60a5fa' : '#9ca3af';
        const size = 6;

        // Draw a sine wave
        const points = [];
        for(let i=10; i<canvas.width-10; i+=2) {
            points.push({
                x: i,
                y: canvas.height/2 + Math.sin(i * 0.1) * 8
            });
        }

        if (brush.mode === 'path') {
            ctx.lineCap = brush.lineCap;
            ctx.lineWidth = size;
            ctx.shadowBlur = brush.hardness === 0 ? size : 0;
            ctx.shadowColor = ctx.strokeStyle as string;
            
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for(let i=0; i<points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        } else if (brush.mode === 'stamp' && brush.texture) {
            ctx.globalAlpha = 0.5;
            ctx.drawImage(brush.texture, 0, 0, 64, 64, 10, canvas.height/2 - 10, 20, 20);
            ctx.drawImage(brush.texture, 0, 0, 64, 64, 40, canvas.height/2 - 10, 20, 20);
            ctx.drawImage(brush.texture, 0, 0, 64, 64, 70, canvas.height/2 - 10, 20, 20);
            ctx.globalAlpha = 1;
        }

    }, [brush, selected]);

    return <canvas ref={canvasRef} width={120} height={40} className="w-full h-10 pointer-events-none" />;
}

export const BrushLibrary: React.FC<BrushLibraryProps> = ({ isOpen, onClose, activeBrushId, onSelectBrush, allBrushes, onOpenCreator, onDeleteBrush }) => {
  if (!isOpen) return null;

  const handleSelect = (e: React.MouseEvent, brush: BrushPreset) => {
      e.stopPropagation();
      onSelectBrush(brush);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      onDeleteBrush(id);
  };

  return (
    <div className="absolute top-full mt-2 left-0 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[150] overflow-hidden flex flex-col max-h-[calc(100vh-100px)] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Bibliothèque</h3>
        <div className="flex items-center space-x-1">
            <button 
                onClick={onOpenCreator}
                className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
                title="Créer un pinceau"
            >
                <Plus size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <X size={16} />
            </button>
        </div>
      </div>
      
      <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar flex-1">
        {allBrushes.map((brush) => (
            <div 
                key={brush.id}
                className={`flex items-stretch rounded-lg border transition-all overflow-hidden ${
                    activeBrushId === brush.id 
                    ? 'bg-blue-900/30 border-blue-500/50 shadow-sm' 
                    : 'bg-gray-800/50 border-gray-800 hover:border-gray-600'
                }`}
            >
                {/* Zone de sélection du pinceau (Gauche) */}
                <div 
                    onClick={(e) => handleSelect(e, brush)}
                    className="flex-1 p-2 cursor-pointer hover:bg-white/5 transition-colors flex flex-col justify-center min-w-0"
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium truncate pr-2 ${activeBrushId === brush.id ? 'text-blue-200' : 'text-gray-300'}`}>
                            {brush.name}
                        </span>
                        {activeBrushId === brush.id && <Check size={14} className="text-blue-400 flex-shrink-0" />}
                    </div>
                    <div className="bg-gray-950/50 rounded p-1 border border-gray-800/50">
                        <BrushPreview brush={brush} selected={activeBrushId === brush.id} />
                    </div>
                </div>

                {/* Bouton de suppression séparé (Droite) - Uniquement pour les brushs custom */}
                {brush.id.startsWith('custom-') && (
                    <div className="flex items-center border-l border-gray-700 bg-gray-900/30">
                        <button
                            type="button"
                            onClick={(e) => handleDelete(e, brush.id)}
                            onMouseDown={(e) => e.stopPropagation()} // Empêche le focus de changer
                            className="h-full px-3 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                            title="Supprimer ce pinceau"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};
