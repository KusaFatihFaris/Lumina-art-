
import React, { useState } from 'react';
import { BrushSettings, ToolType, BrushPreset } from '../types';
import { Download, Undo2, Redo2, Upload, FilePlus, ChevronDown, FlipHorizontal } from 'lucide-react';
import { BrushLibrary } from './BrushLibrary';

interface TopBarProps {
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  activeTool: ToolType;
  activeBrush: BrushPreset;
  setActiveBrush: (brush: BrushPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onImport: () => void;
  onNewProject: () => void;
  allBrushes: BrushPreset[];
  onOpenBrushCreator: () => void;
  onDeleteBrush: (id: string) => void;
  isSymmetryActive: boolean;
  toggleSymmetry: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  brushSettings,
  setBrushSettings,
  activeTool,
  activeBrush,
  setActiveBrush,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onImport,
  onNewProject,
  allBrushes,
  onOpenBrushCreator,
  onDeleteBrush,
  isSymmetryActive,
  toggleSymmetry
}) => {
  const [isBrushLibOpen, setIsBrushLibOpen] = useState(false);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushSettings(prev => ({ ...prev, color: e.target.value }));
  };

  const toggleBrushLib = () => setIsBrushLibOpen(!isBrushLibOpen);

  return (
    <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-[100] shadow-md relative">
      <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
        <h1 className="hidden md:block text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mr-2">
          Lumina
        </h1>

        <button
            onClick={onNewProject}
            className="flex items-center space-x-1 text-gray-400 hover:text-white hover:bg-gray-800 px-2 py-1 rounded transition-colors"
            title="Nouveau Projet"
        >
            <FilePlus size={18} />
            <span className="hidden sm:inline text-xs font-medium">Nouveau</span>
        </button>

        <div className="h-6 w-px bg-gray-700 mx-1"></div>

        <div className="flex items-center space-x-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-colors ${canUndo ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-colors ${canRedo ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            title="Rétablir (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-700 mx-1"></div>

        {(activeTool === ToolType.BRUSH || activeTool === ToolType.ERASER) && (
          <div className="flex items-center space-x-2 md:space-x-4">
            
            {activeTool === ToolType.BRUSH && (
                <div className="relative">
                    <button 
                        onClick={toggleBrushLib}
                        className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors min-w-[140px]"
                    >
                        <span className="text-sm text-gray-200 font-medium truncate flex-1 text-left">{activeBrush.name}</span>
                        <ChevronDown size={14} className="text-gray-500" />
                    </button>
                    
                    <BrushLibrary 
                        isOpen={isBrushLibOpen} 
                        onClose={() => setIsBrushLibOpen(false)}
                        activeBrushId={activeBrush.id}
                        onSelectBrush={(brush) => {
                            setActiveBrush(brush);
                            setIsBrushLibOpen(false);
                        }}
                        allBrushes={allBrushes}
                        onOpenCreator={onOpenBrushCreator}
                        onDeleteBrush={onDeleteBrush}
                    />
                </div>
            )}

            <button
                onClick={toggleSymmetry}
                className={`p-2 rounded-lg border transition-all ${
                    isSymmetryActive 
                    ? 'bg-blue-900/40 border-blue-500 text-blue-400' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
                title="Symétrie (Miroir)"
            >
                <FlipHorizontal size={18} />
            </button>
            
             <div className="flex items-center space-x-2 ml-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-600 cursor-pointer shadow-inner hover:scale-110 transition-transform">
                <input
                  type="color"
                  value={brushSettings.color}
                  onChange={handleColorChange}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
        <button
          onClick={onImport}
          className="p-2 md:px-3 md:py-1.5 md:flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-sm font-medium transition-colors border border-gray-700"
          title="Importer"
        >
          <Upload size={18} className="md:w-4 md:h-4" />
          <span className="hidden md:inline">Importer</span>
        </button>
        <button
          onClick={onExport}
          className="p-2 md:px-3 md:py-1.5 md:flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          title="Exporter"
        >
          <Download size={18} className="md:w-4 md:h-4" />
          <span className="hidden md:inline">Exporter</span>
        </button>
      </div>
    </div>
  );
};
