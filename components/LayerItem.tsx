import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical } from 'lucide-react';
import { Layer } from '../types';

interface LayerItemProps {
  layer: Layer;
  isActive: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeName: (id: string, name: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
}

export const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onChangeName,
  onReorder
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', layer.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId !== layer.id) {
      onReorder(draggedId, layer.id);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`group flex items-center p-2 mb-1 rounded-md cursor-pointer border transition-colors ${
        isActive ? 'bg-blue-900/40 border-blue-500/50' : 'bg-gray-800 border-transparent hover:bg-gray-750'
      }`}
      onClick={() => onSelect(layer.id)}
    >
      {/* Drag Handle */}
      <div className="mr-1 text-gray-600 cursor-grab active:cursor-grabbing hover:text-gray-300 flex-shrink-0">
        <GripVertical size={14} />
      </div>
      
      {/* Visibility Toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
        className={`mr-1 p-1 rounded hover:bg-gray-700 flex-shrink-0 ${layer.visible ? 'text-gray-300' : 'text-gray-600'}`}
        title={layer.visible ? "Masquer" : "Afficher"}
      >
        {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>

      {/* Lock Toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
        className={`mr-2 p-1 rounded hover:bg-gray-700 flex-shrink-0 ${layer.locked ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'}`}
        title={layer.locked ? "Déverrouiller" : "Verrouiller"}
      >
        {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>

      {/* Name Input */}
      <input
        type="text"
        value={layer.name}
        onChange={(e) => onChangeName(layer.id, e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 outline-none truncate border-b border-transparent focus:border-blue-500 px-1 mr-2"
        onClick={(e) => e.stopPropagation()} 
      />

      {/* Delete Button - Always visible and distinct */}
      <button
        onClick={(e) => { 
            e.stopPropagation(); 
            // Confirm delete only if locked or crucial? No, fast workflow preferred.
            onDelete(layer.id); 
        }}
        className="flex-shrink-0 p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
        title="Supprimer le calque"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};