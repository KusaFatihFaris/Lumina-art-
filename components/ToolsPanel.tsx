
import React, { useState } from 'react';
import { ToolType, BrushPreset } from '../types';
import { Brush, Eraser, PaintBucket, Pipette, Square, Circle, Sparkles, BoxSelect, Droplets, Triangle, Minus, Shapes, PenTool, Type } from 'lucide-react';

interface ToolsPanelProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenAI: () => void;
  activeBrush: BrushPreset;
  setActiveBrush: (brush: BrushPreset) => void;
  allBrushes: BrushPreset[];
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ activeTool, onSelectTool, onOpenAI, activeBrush, setActiveBrush, allBrushes }) => {
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
  
  // Check if current active tool is one of the shapes
  const isShapeActive = [ToolType.RECTANGLE, ToolType.CIRCLE, ToolType.TRIANGLE, ToolType.LINE].includes(activeTool);

  const mainTools = [
    { type: ToolType.SELECT, icon: <BoxSelect size={20} />, label: "Sélection" },
    { type: ToolType.TEXT, icon: <Type size={20} />, label: "Texte" },
    // BRUSH is handled separately now
    { type: ToolType.ERASER, icon: <Eraser size={20} />, label: "Gomme" },
    { type: ToolType.BLUR, icon: <Droplets size={20} />, label: "Goutte" },
    { type: ToolType.FILL, icon: <PaintBucket size={20} />, label: "Pot" },
    { type: ToolType.PICKER, icon: <Pipette size={20} />, label: "Pipette" },
  ];

  const shapeTools = [
    { type: ToolType.RECTANGLE, icon: <Square size={18} />, label: "Rectangle" },
    { type: ToolType.CIRCLE, icon: <Circle size={18} />, label: "Cercle" },
    { type: ToolType.TRIANGLE, icon: <Triangle size={18} />, label: "Triangle" },
    { type: ToolType.LINE, icon: <Minus size={18} />, label: "Ligne" },
  ];

  // Helper to get icon for active shape
  const getActiveShapeIcon = () => {
      switch(activeTool) {
          case ToolType.CIRCLE: return <Circle size={20} />;
          case ToolType.TRIANGLE: return <Triangle size={20} />;
          case ToolType.LINE: return <Minus size={20} />;
          default: return <Square size={20} />; // Rectangle default or generic
      }
  };

  const toggleBrushMenu = () => {
      setIsBrushMenuOpen(!isBrushMenuOpen);
      setIsShapeMenuOpen(false);
      onSelectTool(ToolType.BRUSH);
  };

  return (
    <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 z-[90] h-full shadow-xl">
      <div className="space-y-4 w-full px-2">
        
        {/* BRUSH TOOL WITH POPOVER MENU */}
        <div className="relative w-full">
            <button
                onClick={toggleBrushMenu}
                className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all duration-200 ${
                  activeTool === ToolType.BRUSH || isBrushMenuOpen
                    ? 'bg-blue-600 text-white shadow-blue-900/50 shadow-md'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
                title="Pinceaux"
            >
                <Brush size={20} />
                <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-current opacity-60" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }}></div>
            </button>

            {/* BRUSH POPOVER */}
            {isBrushMenuOpen && (
                <div className="absolute left-full top-0 ml-3 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-72 h-[60vh] flex flex-col z-[100] animate-in slide-in-from-left-2 duration-150">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800">
                         <span className="text-xs font-bold text-gray-400 uppercase">Bibliothèque Pinceaux</span>
                         <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{allBrushes.length}</span>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 grid grid-cols-2 gap-2 content-start">
                        {allBrushes.map((brush) => (
                            <button
                                key={brush.id}
                                onClick={() => {
                                    setActiveBrush(brush);
                                    onSelectTool(ToolType.BRUSH);
                                    setIsBrushMenuOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                    activeBrush.id === brush.id
                                    ? 'bg-blue-900/30 border-blue-500 text-blue-300'
                                    : 'bg-gray-800 border-transparent hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <div className="mb-1.5">
                                    {brush.mode === 'stamp' ? <Brush size={18} /> : <PenTool size={18} />}
                                </div>
                                <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                                    {brush.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* OTHER TOOLS */}
        {mainTools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => {
                onSelectTool(tool.type);
                setIsShapeMenuOpen(false);
                setIsBrushMenuOpen(false);
            }}
            className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all duration-200 ${
              activeTool === tool.type
                ? 'bg-blue-600 text-white shadow-blue-900/50 shadow-md'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        {/* Shape Group Button */}
        <div className="relative w-full">
            <button
                onClick={() => {
                    setIsShapeMenuOpen(!isShapeMenuOpen);
                    setIsBrushMenuOpen(false);
                }}
                className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all duration-200 ${
                isShapeActive || isShapeMenuOpen
                    ? 'bg-blue-600 text-white shadow-blue-900/50 shadow-md'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
                title="Formes Géométriques"
            >
                {isShapeActive ? getActiveShapeIcon() : <Shapes size={20} />}
                <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-current opacity-60" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }}></div>
            </button>

            {/* Shape Submenu Popover */}
            {isShapeMenuOpen && (
                <div className="absolute left-full top-0 ml-3 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 grid grid-cols-2 gap-2 w-32 z-[100] animate-in slide-in-from-left-2 duration-150">
                    {shapeTools.map((tool) => (
                        <button
                            key={tool.type}
                            onClick={() => {
                                onSelectTool(tool.type);
                                setIsShapeMenuOpen(false);
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-md transition-colors ${
                                activeTool === tool.type
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                            title={tool.label}
                        >
                            {tool.icon}
                            <span className="text-[10px] mt-1">{tool.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="h-px bg-gray-700 my-2 w-full"></div>

        <button
          onClick={onOpenAI}
          className="w-full aspect-square flex flex-col items-center justify-center rounded-lg text-purple-400 hover:bg-purple-900/30 hover:text-purple-300 transition-all border border-transparent hover:border-purple-500/30"
          title="Générateur IA"
        >
          <Sparkles size={20} />
          <span className="text-[9px] font-bold mt-1">IA</span>
        </button>
      </div>
    </div>
  );
};
