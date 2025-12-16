
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ToolsPanel } from './components/ToolsPanel';
import { TopBar } from './components/TopBar';
import { LayerItem } from './components/LayerItem';
import { AIModal } from './components/AIModal';
import { NewProjectModal } from './components/NewProjectModal';
import { BrushCreatorModal } from './components/BrushCreatorModal';
import { TextToolModal } from './components/TextToolModal';
import { ToolType, Layer, BrushSettings, Point, BrushPreset, ViewportTransform, SelectionState } from './types';
import { getCoordinates, floodFill, createSoftBrushTip, generatePaperTexture, PaperType } from './utils/canvasUtils';
import { BRUSH_PRESETS } from './utils/brushUtils';
import { generateImageFromPrompt } from './services/geminiService';
import { Layers, Plus, MoveHorizontal, Sliders, Paintbrush, TrendingUp, Wand2, Zap, CloudFog, PenTool, Hand, Ruler, Circle as CircleIcon, MousePointer2, Move, Image as ImageIcon, Upload, FlipHorizontal, FlipVertical, Scaling, ArrowDownToLine, Copy } from 'lucide-react';

// History Types
type HistoryAction = 
  | { type: 'DRAW'; layerId: string; before: ImageData; after: ImageData }
  | { type: 'LAYER_ADD'; layerId: string }
  | { type: 'LAYER_DELETE'; layer: Layer; index: number; imageData: ImageData }
  | { type: 'LAYER_REORDER'; before: Layer[]; after: Layer[] }
  | { type: 'LAYER_MERGE'; topLayer: Layer; topImageData: ImageData; bottomLayerId: string; beforeBottomData: ImageData; afterBottomData: ImageData; index: number }
  | { type: 'LAYER_DUPLICATE'; layerId: string; layer: Layer; index: number; imageData: ImageData };

function App() {
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1, rotation: 0 });

  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Arrière-plan', visible: true, opacity: 1, locked: true }, 
    { id: '2', name: 'Calque 1', visible: true, opacity: 1, locked: false }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('2');
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.BRUSH);
  
  // Sidebar State
  // 'tools' refers to Settings/Réglages, 'guides' refers to the new Outils tab
  const [activeSidebarTab, setActiveSidebarTab] = useState<'tools' | 'layers' | 'fx' | 'guides'>('layers');

  // Symmetry State
  const [isSymmetryActive, setIsSymmetryActive] = useState(false);
  const [symmetryAxisX, setSymmetryAxisX] = useState(400); // Defaults to center
  const [isDraggingAxis, setIsDraggingAxis] = useState(false);
  
  // Pen Mode State
  const [onlyPenMode, setOnlyPenMode] = useState(false);

  // Drawing Guides State
  const [activeGuide, setActiveGuide] = useState<'none' | 'ruler' | 'circle'>('none');
  const [guideConfig, setGuideConfig] = useState({
      centerX: 400,
      centerY: 300,
      angle: 45, // Degrees for ruler
      radius: 200 // Radius for circle
  });
  const isDraggingGuide = useRef(false);
  
  const [selection, setSelection] = useState<SelectionState>({
    isActive: false, x: 0, y: 0, w: 0, h: 0, content: null, isDragging: false, dragStartX: 0, dragStartY: 0
  });

  const [customBrushes, setCustomBrushes] = useState<BrushPreset[]>([]);
  const [activeBrush, setActiveBrush] = useState<BrushPreset>(BRUSH_PRESETS[0]);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 20,
    opacity: 100,
    flow: 50, // Default Flow
    color: '#000000',
    hardness: 0.8,
    stabilizerLevel: 3,
    isStabilizerEnabled: true,
    isDynamicsEnabled: true,
    taperStart: 0,
    taperEnd: 0,
    strokeBlur: 0
  });
  
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0); 

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isBrushCreatorOpen, setIsBrushCreatorOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textStartPos, setTextStartPos] = useState<{x: number, y: number} | null>(null);

  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const tempCanvasRef = useRef<HTMLCanvasElement>(null); 
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const drawingStartData = useRef<ImageData | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRestoration = useRef<{ layerId: string; data: ImageData } | null>(null);
  const pendingImage = useRef<{ id: string; img: HTMLImageElement } | null>(null);
  const pendingTexture = useRef<HTMLCanvasElement | null>(null); // For new project textures
  const clipboardRef = useRef<HTMLCanvasElement | null>(null);

  // Advanced Drawing Engine Refs
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const points = useRef<Point[]>([]); 
  const lastStabilizedPoint = useRef<Point | null>(null);
  const spacingRemainder = useRef(0); // For correct spacing interpolation
  const strokeDistance = useRef(0); // For taper calculation
  const brushTipCache = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const gestureStart = useRef<{x: number, y: number, dist: number, angle: number} | null>(null);
  const initialTransform = useRef<ViewportTransform>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const isGestureActive = useRef(false);

  useEffect(() => {
    // Reset symmetry and guides to center when canvas size changes
    setSymmetryAxisX(canvasSize.width / 2);
    setGuideConfig(prev => ({
        ...prev,
        centerX: canvasSize.width / 2,
        centerY: canvasSize.height / 2
    }));
    
    // Initial Background Fill or Texture Application
    const timer = setTimeout(() => {
        const bgCanvas = canvasRefs.current.get('1');
        if (bgCanvas) {
            const ctx = bgCanvas.getContext('2d');
            if (ctx) {
                if (pendingTexture.current) {
                    ctx.drawImage(pendingTexture.current, 0, 0);
                    pendingTexture.current = null;
                } else {
                    // Default White if no texture
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
                }
            }
        }
    }, 50);
    return () => clearTimeout(timer);
  }, [canvasSize]); // Depends on canvasSize change

  useEffect(() => {
    if (pendingRestoration.current) {
        const { layerId, data } = pendingRestoration.current;
        const canvas = canvasRefs.current.get(layerId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.putImageData(data, 0, 0);
            pendingRestoration.current = null;
        }
    }
  }, [layers]); 

  // Handle Pending Image Import
  useEffect(() => {
    if (pendingImage.current) {
        const { id, img } = pendingImage.current;
        const canvas = canvasRefs.current.get(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                let drawWidth = img.width;
                let drawHeight = img.height;
                const scale = Math.min(canvasSize.width / img.width, canvasSize.height / img.height);
                if (scale < 1) {
                    drawWidth = img.width * scale;
                    drawHeight = img.height * scale;
                }
                const x = (canvasSize.width - drawWidth) / 2;
                const y = (canvasSize.height - drawHeight) / 2;
                ctx.drawImage(img, x, y, drawWidth, drawHeight);
                
                // Record History
                const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
                const emptyData = new ImageData(canvasSize.width, canvasSize.height);
                const action: HistoryAction = {
                    type: 'DRAW',
                    layerId: id,
                    before: emptyData,
                    after: afterData
                };
                setHistory(prev => {
                   const h = prev.slice(0, historyIndex);
                   h.push(action);
                   if (h.length > 30) h.shift();
                   return h;
                });
                setHistoryIndex(prev => Math.min(prev + 1, 30));
            }
            pendingImage.current = null;
        }
    }
  }, [layers, canvasSize]);


  const getActiveContext = () => {
    const canvas = canvasRefs.current.get(activeLayerId);
    return canvas?.getContext('2d', { willReadFrequently: true });
  };

  const getTempContext = () => {
    return tempCanvasRef.current?.getContext('2d');
  };

  const handleCreateBrush = (newBrush: BrushPreset) => {
    setCustomBrushes(prev => [...prev, newBrush]);
    setActiveBrush(newBrush);
  };

  const handleDeleteBrush = (id: string) => {
      setCustomBrushes(prev => prev.filter(b => b.id !== id));
      if (activeBrush.id === id) {
          setActiveBrush(BRUSH_PRESETS[0]);
      }
  };

  const allBrushes = [...BRUSH_PRESETS, ...customBrushes];

  const addToHistory = useCallback((action: HistoryAction) => {
    setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex);
        newHistory.push(action);
        if (newHistory.length > 30) newHistory.shift();
        return newHistory;
    });
    setHistoryIndex(prev => {
        const newLen = Math.min(prev + 1, 30);
        return history.length >= 30 && prev >= 30 ? 30 : newLen;
    });
  }, [historyIndex, history.length]);

  const commitSelection = useCallback(() => {
    if (!selection.isActive || !selection.content) return;
    
    const ctx = getActiveContext();
    if (!ctx) return;

    ctx.drawImage(selection.content, selection.x, selection.y);
    
    if (drawingStartData.current) {
        const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
        addToHistory({
            type: 'DRAW',
            layerId: activeLayerId,
            before: drawingStartData.current,
            after: afterData
        });
        drawingStartData.current = null;
    } 
    
    setSelection({
        isActive: false, x: 0, y: 0, w: 0, h: 0,
        content: null, isDragging: false, dragStartX: 0, dragStartY: 0
    });
    
    const tempCtx = getTempContext();
    if (tempCtx) tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
  }, [selection, activeLayerId, canvasSize, addToHistory]);

  const deleteSelection = useCallback(() => {
    if (!selection.isActive) return;
    
    if (drawingStartData.current) {
        const ctx = getActiveContext();
        if (ctx) {
            const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
            addToHistory({
                type: 'DRAW',
                layerId: activeLayerId,
                before: drawingStartData.current,
                after: afterData
            });
        }
        drawingStartData.current = null;
    }

    setSelection({ isActive: false, x: 0, y: 0, w: 0, h: 0, content: null, isDragging: false, dragStartX: 0, dragStartY: 0 });
    const tempCtx = getTempContext();
    if (tempCtx) tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
  }, [selection, activeLayerId, canvasSize, addToHistory]);

  const handleToolSelect = (tool: ToolType) => {
    if (activeTool === ToolType.SELECT && selection.isActive) commitSelection();
    setActiveTool(tool);
  };

  const createNewProject = (width: number, height: number, textureType: PaperType) => {
    // Generate texture first
    const texCanvas = generatePaperTexture(textureType, width, height);
    pendingTexture.current = texCanvas;

    setCanvasSize({ width, height });
    setSymmetryAxisX(width / 2);
    setGuideConfig({ centerX: width/2, centerY: height/2, angle: 45, radius: 200 });
    setLayers([
        { id: '1', name: 'Arrière-plan', visible: true, opacity: 1, locked: true }, 
        { id: '2', name: 'Calque 1', visible: true, opacity: 1, locked: false }
    ]);
    setActiveLayerId('2');
    setHistory([]);
    setHistoryIndex(0);
    setSelection({ isActive: false, x: 0, y: 0, w: 0, h: 0, content: null, isDragging: false, dragStartX: 0, dragStartY: 0 });
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setIsNewProjectModalOpen(false);
  };

  const undo = useCallback(() => {
    if (selection.isActive) commitSelection();
    if (historyIndex === 0) return;
    const action = history[historyIndex - 1];
    
    if (action.type === 'DRAW') {
        const ctx = canvasRefs.current.get(action.layerId)?.getContext('2d');
        if (ctx) ctx.putImageData(action.before, 0, 0);
    } 
    else if (action.type === 'LAYER_ADD' || action.type === 'LAYER_DUPLICATE') {
        setLayers(prev => prev.filter(l => l.id !== action.layerId));
        if (activeLayerId === action.layerId) {
            setActiveLayerId(layers[0]?.id || '1'); 
        }
    }
    else if (action.type === 'LAYER_DELETE') {
        const { layer, index, imageData } = action;
        setLayers(prev => {
            const newL = [...prev];
            newL.splice(index, 0, layer);
            return newL;
        });
        pendingRestoration.current = { layerId: layer.id, data: imageData };
        setActiveLayerId(layer.id);
    }
    else if (action.type === 'LAYER_MERGE') {
        const { topLayer, topImageData, bottomLayerId, beforeBottomData, index } = action;
        
        // 1. Restore bottom layer data
        const bottomCtx = canvasRefs.current.get(bottomLayerId)?.getContext('2d');
        if (bottomCtx) bottomCtx.putImageData(beforeBottomData, 0, 0);

        // 2. Add top layer back
        setLayers(prev => {
            const newL = [...prev];
            newL.splice(index, 0, topLayer);
            return newL;
        });
        
        // 3. Queue data restoration for top layer (needs to wait for React render)
        pendingRestoration.current = { layerId: topLayer.id, data: topImageData };
        setActiveLayerId(topLayer.id);
    }

    setHistoryIndex(prev => prev - 1);
  }, [history, historyIndex, activeLayerId, layers, selection, commitSelection]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length) return;
    const action = history[historyIndex];
    
    if (action.type === 'DRAW') {
        const ctx = canvasRefs.current.get(action.layerId)?.getContext('2d');
        if (ctx) ctx.putImageData(action.after, 0, 0);
    }
    else if (action.type === 'LAYER_DELETE') {
        setLayers(prev => prev.filter(l => l.id !== action.layer.id));
    }
    else if (action.type === 'LAYER_DUPLICATE') {
        const { layer, index, imageData } = action;
        setLayers(prev => {
            const newL = [...prev];
            newL.splice(index, 0, layer);
            return newL;
        });
        pendingRestoration.current = { layerId: layer.id, data: imageData };
        setActiveLayerId(layer.id);
    }
    else if (action.type === 'LAYER_MERGE') {
        const { topLayer, bottomLayerId, afterBottomData } = action;
        
        // 1. Remove top layer
        setLayers(prev => prev.filter(l => l.id !== topLayer.id));
        
        // 2. Update bottom layer with merged result
        const bottomCtx = canvasRefs.current.get(bottomLayerId)?.getContext('2d');
        if (bottomCtx) bottomCtx.putImageData(afterBottomData, 0, 0);
        
        setActiveLayerId(bottomLayerId);
    }

    setHistoryIndex(prev => prev + 1);
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Copy / Cut / Paste / Delete... (Same as before)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
         if (selection.isActive && selection.content) {
             const c = document.createElement('canvas');
             c.width = selection.content.width;
             c.height = selection.content.height;
             c.getContext('2d')?.drawImage(selection.content, 0, 0);
             clipboardRef.current = c;
         }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selection.isActive && selection.content) {
            const c = document.createElement('canvas');
            c.width = selection.content.width;
            c.height = selection.content.height;
            c.getContext('2d')?.drawImage(selection.content, 0, 0);
            clipboardRef.current = c;
            deleteSelection();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
         if (clipboardRef.current) {
             if (selection.isActive) commitSelection();

             const content = clipboardRef.current;
             const newContent = document.createElement('canvas');
             newContent.width = content.width;
             newContent.height = content.height;
             newContent.getContext('2d')?.drawImage(content, 0, 0);

             const x = Math.floor((canvasSize.width - content.width) / 2);
             const y = Math.floor((canvasSize.height - content.height) / 2);
             
             const ctx = getActiveContext();
             if (ctx) {
                 drawingStartData.current = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
             }

             setSelection({
                 isActive: true,
                 x, y, w: content.width, h: content.height,
                 content: newContent,
                 isDragging: false, dragStartX: 0, dragStartY: 0
             });
             setActiveTool(ToolType.SELECT);

             const tCtx = getTempContext();
             if (tCtx) {
                 tCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
                 tCtx.drawImage(newContent, x, y);
                 
                 // Selection visual feedback
                 tCtx.fillStyle = 'rgba(0, 100, 255, 0.15)';
                 tCtx.fillRect(x, y, content.width, content.height);

                 const scaledLineWidth = 2 / transform.scale;
                 tCtx.lineWidth = scaledLineWidth;
                 tCtx.strokeStyle = '#fff'; tCtx.setLineDash([4, 4]); tCtx.strokeRect(x, y, content.width, content.height);
                 tCtx.strokeStyle = '#000'; tCtx.lineDashOffset = 4; tCtx.strokeRect(x, y, content.width, content.height);
                 tCtx.setLineDash([]);
             }
         }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isAIModalOpen && !isNewProjectModalOpen && !isBrushCreatorOpen && !isTextModalOpen) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
        
        if (selection.isActive) {
            e.preventDefault();
            deleteSelection();
        } else {
            deleteLayerRef.current(activeLayerId);
        }
      }

      if (e.key === 'Enter' && selection.isActive) commitSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, isAIModalOpen, isNewProjectModalOpen, isBrushCreatorOpen, isTextModalOpen, activeLayerId, selection, commitSelection, deleteSelection, canvasSize, transform.scale]);

  // Axis Dragging
  const handleAxisPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingAxis(true);
  };
  
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (isDraggingAxis) {
          const canvas = tempCanvasRef.current;
          if (canvas) {
              const coords = getCoordinates(e, canvas, transform);
              if (coords) {
                  setSymmetryAxisX(coords.x);
              }
          }
      }
    };
    const handleWindowPointerUp = () => {
        setIsDraggingAxis(false);
    };

    if (isDraggingAxis) {
        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerUp);
    }
    return () => {
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [isDraggingAxis, transform]);


  const getDistance = (t1: React.Touch, t2: React.Touch) => {
     return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
  };

  const getAngle = (t1: React.Touch, t2: React.Touch) => {
      return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey) {
          e.preventDefault();
          const zoomSensitivity = 0.001;
          const delta = -e.deltaY * zoomSensitivity;
          const newScale = Math.min(Math.max(0.1, transform.scale + delta), 10);
          setTransform(prev => ({ ...prev, scale: newScale }));
      } else if (e.shiftKey) {
           setTransform(prev => ({ ...prev, x: prev.x - e.deltaY }));
      } else {
           setTransform(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
  };

  // --------------------------------------------------------------------------
  // DRAWING ASSISTANT LOGIC (Guides)
  // --------------------------------------------------------------------------
  
  const applyGuideConstraint = (p: Point): Point => {
    if (activeGuide === 'none') return p;

    if (activeGuide === 'ruler') {
        // Line equation from point (cx, cy) with angle theta
        const rad = guideConfig.angle * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        
        // Project cursor point P onto the line passing through Center with direction (dx, dy)
        // P_proj = Center + Direction * ((P - Center) . Direction)
        
        const vx = p.x - guideConfig.centerX;
        const vy = p.y - guideConfig.centerY;
        const dot = vx * dx + vy * dy;
        
        return {
            ...p,
            x: guideConfig.centerX + dx * dot,
            y: guideConfig.centerY + dy * dot
        };
    }
    
    if (activeGuide === 'circle') {
        const dx = p.x - guideConfig.centerX;
        const dy = p.y - guideConfig.centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist === 0) return p;
        
        const scale = guideConfig.radius / dist;
        return {
            ...p,
            x: guideConfig.centerX + dx * scale,
            y: guideConfig.centerY + dy * scale
        };
    }
    return p;
  };

  // --------------------------------------------------------------------------
  // PROFESSIONAL BRUSH ENGINE (Stamp-based)
  // --------------------------------------------------------------------------

  const getBrushTip = (brush: BrushPreset, color: string, hardness: number, size: number) => {
      const key = `${brush.id}-${color}-${hardness}-${brush.mode}`;
      if (brushTipCache.current.has(key) && brush.mode === 'path') {
          return brushTipCache.current.get(key);
      }

      let canvas: HTMLCanvasElement;
      
      if (brush.mode === 'stamp' && brush.texture) {
          canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(brush.texture, 0, 0, 64, 64);
             ctx.globalCompositeOperation = 'source-in';
             ctx.fillStyle = color;
             ctx.fillRect(0, 0, 64, 64);
          }
      } else {
          canvas = createSoftBrushTip(64, hardness, color);
      }
      
      if (brush.mode === 'path') {
         brushTipCache.current.set(key, canvas);
      }
      return canvas;
  };

  const flipLayer = (direction: 'horizontal' | 'vertical') => {
    if (selection.isActive) commitSelection();

    const canvas = canvasRefs.current.get(activeLayerId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture state before flip
    const beforeData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);

    // Create temp copy
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize.width;
    tempCanvas.height = canvasSize.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.drawImage(canvas, 0, 0);

    // Clear and draw flipped
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.save();
    
    if (direction === 'horizontal') {
        ctx.translate(canvasSize.width, 0);
        ctx.scale(-1, 1);
    } else {
        ctx.translate(0, canvasSize.height);
        ctx.scale(1, -1);
    }
    
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    // Capture state after flip and add to history
    const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
    
    addToHistory({
        type: 'DRAW',
        layerId: activeLayerId,
        before: beforeData,
        after: afterData
    });
  };

  const duplicateLayer = () => {
    if (selection.isActive) commitSelection();

    const index = layers.findIndex(l => l.id === activeLayerId);
    if (index === -1) return;

    const sourceLayer = layers[index];
    const sourceCanvas = canvasRefs.current.get(sourceLayer.id);
    if (!sourceCanvas) return;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return;

    // Capture pixel data
    const imageData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
    
    const newId = Date.now().toString();
    const newLayer: Layer = {
        ...sourceLayer,
        id: newId,
        name: `${sourceLayer.name} (Copie)`
    };

    const newLayers = [...layers];
    // Insert ABOVE the current layer
    newLayers.splice(index + 1, 0, newLayer);
    
    setLayers(newLayers);
    setActiveLayerId(newId);

    // Queue painting the pixel data to the new canvas (once React renders it)
    pendingRestoration.current = { layerId: newId, data: imageData };

    addToHistory({
        type: 'LAYER_DUPLICATE',
        layerId: newId,
        layer: newLayer,
        index: index + 1,
        imageData: imageData
    });
  };

  const mergeLayerDown = () => {
    if (selection.isActive) commitSelection();

    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    // Can't merge if it's the bottom layer (index 0) or not found
    if (activeIndex <= 0) return;

    const topLayer = layers[activeIndex];
    const bottomLayer = layers[activeIndex - 1];
    
    const topCanvas = canvasRefs.current.get(topLayer.id);
    const bottomCanvas = canvasRefs.current.get(bottomLayer.id);
    
    if (!topCanvas || !bottomCanvas) return;
    
    const topCtx = topCanvas.getContext('2d');
    const bottomCtx = bottomCanvas.getContext('2d');
    if (!topCtx || !bottomCtx) return;

    // 1. Capture states for History (Undo)
    const topImageData = topCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);
    const beforeBottomData = bottomCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);

    // 2. Perform Merge: Draw Top onto Bottom
    // We must respect the opacity of the top layer during the merge
    bottomCtx.save();
    bottomCtx.globalAlpha = topLayer.opacity;
    bottomCtx.drawImage(topCanvas, 0, 0);
    bottomCtx.restore();

    // 3. Capture result state for History (Redo)
    const afterBottomData = bottomCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);

    // 4. Update Application State
    setLayers(prev => prev.filter(l => l.id !== topLayer.id));
    setActiveLayerId(bottomLayer.id);

    // 5. Add to History
    addToHistory({
        type: 'LAYER_MERGE',
        topLayer: topLayer,
        topImageData: topImageData,
        bottomLayerId: bottomLayer.id,
        beforeBottomData: beforeBottomData,
        afterBottomData: afterBottomData,
        index: activeIndex
    });
  };

  // ... (No changes to text logic or drawing logic) ...
  const handleInsertText = (text: string, font: string, size: number, color: string, bold: boolean, italic: boolean) => {
      if (!textStartPos) return;
      
      const ctx = getActiveContext();
      if (!ctx) return;

      const beforeData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);

      ctx.save();
      const fontStyle = `${italic ? 'italic' : ''} ${bold ? 'bold' : ''} ${size}px ${font}`;
      ctx.font = fontStyle;
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      
      // Handle multi-line
      const lines = text.split('\n');
      const lineHeight = size * 1.2;
      
      lines.forEach((line, index) => {
          ctx.fillText(line, textStartPos.x, textStartPos.y + (index * lineHeight));
      });
      
      ctx.restore();

      const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
      addToHistory({ type: 'DRAW', layerId: activeLayerId, before: beforeData, after: afterData });
      
      // Switch back to brush after text insertion for workflow
      setActiveTool(ToolType.BRUSH);
  };

  const startDrawing = (e: React.PointerEvent<HTMLDivElement> | React.TouchEvent) => {
    // Basic Touch/Gesture Filtering
    if ('touches' in e && e.touches.length === 2) {
        isGestureActive.current = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        gestureStart.current = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2,
            dist: getDistance(t1, t2),
            angle: getAngle(t1, t2)
        };
        initialTransform.current = { ...transform };
        return;
    }

    const nativeEvent = (e as any).nativeEvent || e;

    // --- PEN ONLY MODE (PALM REJECTION) ---
    // If onlyPenMode is active, and the event is 'touch' (finger), we ignore drawing.
    // We only allow 'pen' or 'mouse'.
    if (onlyPenMode) {
        const isTouch = nativeEvent.pointerType === 'touch' || ('touches' in e && !('pointerType' in e));
        if (isTouch) {
            return;
        }
    }
    // --------------------------------------

    // Check if clicking on Guide Handle to move it
    if (activeGuide !== 'none') {
        const canvas = tempCanvasRef.current || canvasRefs.current.get(activeLayerId);
        if (canvas) {
            const coords = getCoordinates(e, canvas, transform);
            if (coords) {
                const dx = coords.x - guideConfig.centerX;
                const dy = coords.y - guideConfig.centerY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Hitbox for guide center handle (30px radius for easy touch)
                if (dist < 30) {
                    isDraggingGuide.current = true;
                    return; // Stop drawing, start dragging guide
                }
            }
        }
    }

    if (activeTool !== ToolType.MOVE && activeTool !== ToolType.SELECT && activeTool !== ToolType.BLUR && activeTool !== ToolType.TEXT && (nativeEvent.buttons !== 1 && nativeEvent.type !== 'touchstart')) return;
    
    const canvas = tempCanvasRef.current || canvasRefs.current.get(activeLayerId);
    if (!canvas) return;
    const coords = getCoordinates(e, canvas, transform);
    if (!coords) return;

    if (activeTool === ToolType.TEXT) {
        setTextStartPos({ x: coords.x, y: coords.y });
        setIsTextModalOpen(true);
        return;
    }

    if (activeTool === ToolType.SELECT && selection.isActive && selection.content) {
         if (coords.x >= selection.x && coords.x <= selection.x + selection.w && coords.y >= selection.y && coords.y <= selection.y + selection.h) {
            setSelection(prev => ({ ...prev, isDragging: true, dragStartX: coords.x, dragStartY: coords.y }));
            isDrawing.current = true;
            return;
         } else {
            commitSelection();
         }
    }
    // Handle Shapes Start
    if (activeTool === ToolType.SELECT || activeTool === ToolType.RECTANGLE || activeTool === ToolType.CIRCLE || activeTool === ToolType.TRIANGLE || activeTool === ToolType.LINE) {
        points.current = [coords];
        isDrawing.current = true;
        return;
    }
    
    if (selection.isActive) { commitSelection(); return; }

    isDrawing.current = true;

    // Apply Guide Constraints right at start
    const constrainedCoords = (activeTool === ToolType.BRUSH || activeTool === ToolType.ERASER) 
                              ? applyGuideConstraint(coords) 
                              : coords;

    lastPoint.current = constrainedCoords;
    lastStabilizedPoint.current = constrainedCoords;
    points.current = [constrainedCoords];
    spacingRemainder.current = 0; 
    strokeDistance.current = 0; // Reset stroke distance

    const ctx = getActiveContext();
    if (ctx && !drawingStartData.current) {
        drawingStartData.current = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
    }

    if (activeTool === ToolType.FILL) {
      if (ctx) {
         floodFill(ctx, coords.x, coords.y, brushSettings.color); 
         if (drawingStartData.current) {
            const afterData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
            addToHistory({ type: 'DRAW', layerId: activeLayerId, before: drawingStartData.current, after: afterData });
            drawingStartData.current = null;
         }
      }
      isDrawing.current = false;
      return;
    } else if (activeTool === ToolType.PICKER) {
      if (ctx) {
        const p = ctx.getImageData(coords.x, coords.y, 1, 1).data;
        const hex = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6);
        setBrushSettings(prev => ({ ...prev, color: hex }));
        setActiveTool(ToolType.BRUSH);
      }
      isDrawing.current = false;
      return;
    }

    const tempCtx = getTempContext();
    if (tempCtx) {
        tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    }
  };

  const draw = (e: React.PointerEvent<HTMLDivElement> | React.TouchEvent) => {
    if (isGestureActive.current && 'touches' in e && e.touches.length === 2 && gestureStart.current) {
        e.preventDefault(); 
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        const currentDist = getDistance(t1, t2);
        const currentAngle = getAngle(t1, t2);
        const deltaX = currentCenter.x - gestureStart.current.x;
        const deltaY = currentCenter.y - gestureStart.current.y;
        const scaleMultiplier = currentDist / gestureStart.current.dist;
        const rotationDelta = currentAngle - gestureStart.current.angle;
        setTransform({
            x: initialTransform.current.x + deltaX,
            y: initialTransform.current.y + deltaY,
            scale: Math.min(Math.max(0.1, initialTransform.current.scale * scaleMultiplier), 10),
            rotation: initialTransform.current.rotation + rotationDelta
        });
        return;
    }

    // Handle Guide Dragging
    if (isDraggingGuide.current) {
        const canvas = tempCanvasRef.current;
        if (canvas) {
            const coords = getCoordinates(e, canvas, transform);
            if (coords) {
                 setGuideConfig(prev => ({
                     ...prev,
                     centerX: coords.x,
                     centerY: coords.y
                 }));
            }
        }
        return;
    }

    if (!isDrawing.current) return;
    const canvas = tempCanvasRef.current;
    if (!canvas) return;
    
    let targetCoords = getCoordinates(e, canvas, transform);
    if (!targetCoords) return;

    if (activeTool === ToolType.SELECT) {
        const tempCtx = getTempContext();
        if (!tempCtx) return;
        tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        
        // Calculate dynamic line width to prevent distortion (always 2px on screen for better visibility)
        const scaledLineWidth = 2 / transform.scale;
        
        // Reset styles for selection outline
        tempCtx.lineJoin = 'miter';
        tempCtx.lineCap = 'butt';

        if (selection.isDragging && selection.content) {
            const dx = Math.round(targetCoords.x - selection.dragStartX);
            const dy = Math.round(targetCoords.y - selection.dragStartY);
            const newX = Math.round(selection.x + dx);
            const newY = Math.round(selection.y + dy);
            
            tempCtx.drawImage(selection.content, newX, newY);
            
            // Add Blue Overlay while dragging
            tempCtx.fillStyle = 'rgba(0, 100, 255, 0.15)';
            tempCtx.fillRect(newX, newY, selection.w, selection.h);

            // Fix Distortion: Force scaled line width
            tempCtx.lineWidth = scaledLineWidth;
            tempCtx.strokeStyle = '#fff'; tempCtx.setLineDash([4, 4]); tempCtx.strokeRect(newX, newY, selection.w, selection.h);
            tempCtx.strokeStyle = '#000'; tempCtx.lineDashOffset = 4; tempCtx.strokeRect(newX, newY, selection.w, selection.h);
            tempCtx.setLineDash([]);
        } else if (!selection.isActive && points.current.length > 0) {
            const start = points.current[0];
            // Snap to pixels to avoid blurring
            const startX = Math.round(start.x);
            const startY = Math.round(start.y);
            const endX = Math.round(targetCoords.x);
            const endY = Math.round(targetCoords.y);
            const w = endX - startX;
            const h = endY - startY;
            
            // Fix Distortion: Force scaled line width
            tempCtx.lineWidth = scaledLineWidth;
            tempCtx.strokeStyle = '#fff'; tempCtx.setLineDash([4, 4]); tempCtx.strokeRect(startX, startY, w, h);
            tempCtx.strokeStyle = '#000'; tempCtx.lineDashOffset = 4; tempCtx.strokeRect(startX, startY, w, h);
            tempCtx.setLineDash([]);
            tempCtx.fillStyle = 'rgba(0, 100, 255, 0.15)'; tempCtx.fillRect(startX, startY, w, h);
        }
        return;
    }

    // --- APPLY GUIDE CONSTRAINTS ---
    if ((activeTool === ToolType.BRUSH || activeTool === ToolType.ERASER) && activeGuide !== 'none') {
        targetCoords = applyGuideConstraint(targetCoords);
    }
    // ---------------------------------

    if (brushSettings.isStabilizerEnabled && lastStabilizedPoint.current && activeTool !== ToolType.BLUR) {
         const level = Math.max(1, Math.min(10, brushSettings.stabilizerLevel));
         const factor = Math.max(0.05, 1 - (level * 0.08)); 
         const last = lastStabilizedPoint.current;
         targetCoords.x = last.x + (targetCoords.x - last.x) * factor;
         targetCoords.y = last.y + (targetCoords.y - last.y) * factor;
         targetCoords.pressure = last.pressure * (1 - factor) + targetCoords.pressure * factor;
         lastStabilizedPoint.current = targetCoords;
         
         // Re-apply constraint after stabilization to keep line clean
         if ((activeTool === ToolType.BRUSH || activeTool === ToolType.ERASER) && activeGuide !== 'none') {
            targetCoords = applyGuideConstraint(targetCoords);
         }
    }

    // --- BLUR TOOL LOGIC ---
    if (activeTool === ToolType.BLUR) {
        const activeCtx = getActiveContext();
        if (!activeCtx) return;

        const size = brushSettings.size;
        const radius = size / 2;
        const blurIntensity = Math.max(2, brushSettings.flow / 5);

        if (lastPoint.current) {
             const dist = Math.sqrt(Math.pow(targetCoords.x - lastPoint.current.x, 2) + Math.pow(targetCoords.y - lastPoint.current.y, 2));
             if (dist < 3) return; 
        }

        const x = targetCoords.x - radius;
        const y = targetCoords.y - radius;

        const scratchCanvas = document.createElement('canvas');
        scratchCanvas.width = size;
        scratchCanvas.height = size;
        const sCtx = scratchCanvas.getContext('2d');
        if (!sCtx) return;

        sCtx.drawImage(canvasRefs.current.get(activeLayerId)!, x, y, size, size, 0, 0, size, size);

        const blurredCanvas = document.createElement('canvas');
        blurredCanvas.width = size;
        blurredCanvas.height = size;
        const bCtx = blurredCanvas.getContext('2d');
        if (!bCtx) return;

        bCtx.filter = `blur(${blurIntensity}px)`;
        bCtx.drawImage(scratchCanvas, 0, 0);
        bCtx.filter = 'none';

        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = size;
        compositeCanvas.height = size;
        const cCtx = compositeCanvas.getContext('2d');
        
        if (cCtx) {
            cCtx.drawImage(blurredCanvas, 0, 0);
            const gradient = cCtx.createRadialGradient(radius, radius, radius * 0.2, radius, radius, radius);
            const alphaStrength = (brushSettings.opacity / 100); 
            gradient.addColorStop(0, `rgba(0,0,0,${alphaStrength})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            cCtx.globalCompositeOperation = 'destination-in';
            cCtx.fillStyle = gradient;
            cCtx.fillRect(0, 0, size, size);
        }
        activeCtx.drawImage(compositeCanvas, x, y);
        lastPoint.current = targetCoords;
        return;
    }
    // --- END BLUR TOOL LOGIC ---

    const tempCtx = getTempContext();
    if (!tempCtx) return;

    if (activeTool === ToolType.BRUSH || activeTool === ToolType.ERASER) {
        if (!lastPoint.current) {
            lastPoint.current = targetCoords;
            return;
        }

        const isEraser = activeTool === ToolType.ERASER;
        // Direct drawing for eraser OR brushes with blend modes (like Watercolor/Multiply)
        const isDirectDraw = isEraser || (activeTool === ToolType.BRUSH && activeBrush.blendMode === 'multiply');
        
        const renderCtx = isDirectDraw ? getActiveContext() : tempCtx;
        if (!renderCtx) return;

        const p1 = lastPoint.current;
        const p2 = targetCoords;
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        
        const spacingFactor = activeBrush.spacing || 0.1;
        const baseSize = brushSettings.size;
        const stepSize = Math.max(1, baseSize * spacingFactor);
        
        const tip = getBrushTip(
            isEraser ? { ...activeBrush, mode: 'path' } : activeBrush, 
            brushSettings.color, 
            isEraser ? brushSettings.hardness : (activeBrush.mode === 'path' ? brushSettings.hardness : 1), 
            64
        );
        
        if (!tip) return;

        if (isEraser) {
            renderCtx.globalCompositeOperation = 'destination-out';
        } else if (activeBrush.blendMode) {
            renderCtx.globalCompositeOperation = activeBrush.blendMode;
        } else {
            renderCtx.globalCompositeOperation = 'source-over';
        }

        // --- APPLY STROKE BLUR (Real-time Filter) ---
        // If strokeBlur is active, apply it to the drawing context before drawing stamps
        if (brushSettings.strokeBlur > 0 && !isEraser) {
            renderCtx.filter = `blur(${brushSettings.strokeBlur}px)`;
        }

        let distanceCovered = spacingRemainder.current;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        const drawStamp = (x: number, y: number, pressure: number) => {
            let currentSize = baseSize;
            let currentAlpha = brushSettings.flow / 100;

            // --- TAPER LOGIC (FINESSE) - REWORKED FOR DIRECT ACCESS ---
            
            // Start Taper (Fade in)
            if (brushSettings.taperStart > 0) {
                const taperLen = brushSettings.taperStart * 5; // Multiplier to make 0-100 meaningful
                const taperFactor = Math.min(1, Math.max(0, strokeDistance.current / taperLen));
                currentSize *= (0.2 + 0.8 * taperFactor); // Don't start at absolute 0, start at 20%
                currentAlpha *= taperFactor;
            }

            // End Taper (Influence Pressure Curve)
            if (brushSettings.taperEnd > 0) {
                // Adjust pressure curve: Higher taperEnd means pressure falls off faster
                // We map taperEnd 0-100 to an exponent 1.0 - 4.0
                const exponent = 1 + (brushSettings.taperEnd / 25);
                pressure = Math.pow(pressure, exponent);
            }

            if (isDirectDraw) {
                // For direct brushes (Eraser or Watercolor), we must apply opacity per stamp
                // to allow buildup or proper erasure.
                currentAlpha *= (brushSettings.opacity / 100);
            }

            if (pressure > 0) {
                currentSize = currentSize * (0.5 + 0.5 * pressure);
                currentAlpha *= pressure;
            }
            
            if (activeBrush.id === 'pencil' || activeBrush.id === 'charcoal') {
                renderCtx.save();
                renderCtx.translate(x, y);
                renderCtx.rotate(Math.random() * Math.PI * 2);
                renderCtx.globalAlpha = currentAlpha;
                renderCtx.drawImage(tip, -currentSize/2, -currentSize/2, currentSize, currentSize);
                renderCtx.restore();
            } else {
                renderCtx.globalAlpha = currentAlpha;
                renderCtx.drawImage(tip, x - currentSize/2, y - currentSize/2, currentSize, currentSize);
            }
        };

        while (distanceCovered <= dist) {
             const t = distanceCovered / dist;
             const x = p1.x + dx * t;
             const y = p1.y + dy * t;
             const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
             
             // Update global stroke distance
             strokeDistance.current += stepSize;

             drawStamp(x, y, pressure);
             if (isSymmetryActive) {
                 const symX = symmetryAxisX + (symmetryAxisX - x);
                 drawStamp(symX, y, pressure);
             }

             distanceCovered += stepSize;
        }

        spacingRemainder.current = distanceCovered - dist;
        lastPoint.current = targetCoords;
        points.current.push(targetCoords);
        
        // Reset Filter
        renderCtx.filter = 'none';

        if (isEraser) {
            renderCtx.globalCompositeOperation = 'source-over';
            renderCtx.globalAlpha = 1.0;
        } else if (isDirectDraw) {
            // Reset for next drawing operations
            renderCtx.globalCompositeOperation = 'source-over';
            renderCtx.globalAlpha = 1.0;
        } else {
            tempCtx.globalCompositeOperation = 'source-over';
        }
    } 
    else if (activeTool === ToolType.RECTANGLE || activeTool === ToolType.CIRCLE || activeTool === ToolType.TRIANGLE || activeTool === ToolType.LINE) {
        // Shapes
        const start = points.current[0];
        tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        tempCtx.strokeStyle = brushSettings.color;
        tempCtx.lineWidth = brushSettings.size;
        tempCtx.lineJoin = 'round';
        tempCtx.lineCap = 'round';

        const drawShape = (sX: number, sY: number, eX: number, eY: number) => {
             tempCtx.beginPath();
             if (activeTool === ToolType.RECTANGLE) {
                tempCtx.strokeRect(sX, sY, eX - sX, eY - sY);
             } else if (activeTool === ToolType.CIRCLE) {
                const r = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eY - sY, 2));
                tempCtx.arc(sX, sY, r, 0, 2 * Math.PI);
                tempCtx.stroke();
             } else if (activeTool === ToolType.LINE) {
                tempCtx.moveTo(sX, sY);
                tempCtx.lineTo(eX, eY);
                tempCtx.stroke();
             } else if (activeTool === ToolType.TRIANGLE) {
                // Triangle: Top Middle, Bottom Left, Bottom Right
                const w = eX - sX;
                const h = eY - sY;
                tempCtx.moveTo(sX + w/2, sY); // Top
                tempCtx.lineTo(sX, eY);       // Bottom Left
                tempCtx.lineTo(eX, eY);       // Bottom Right
                tempCtx.closePath();
                tempCtx.stroke();
             }
        };

        drawShape(start.x, start.y, targetCoords.x, targetCoords.y);

        if (isSymmetryActive) {
            const symStartX = symmetryAxisX + (symmetryAxisX - start.x);
            const symEndX = symmetryAxisX + (symmetryAxisX - targetCoords.x);
            drawShape(symStartX, start.y, symEndX, targetCoords.y);
        }
    }
  };

  const stopDrawing = (e: React.PointerEvent<HTMLDivElement> | React.TouchEvent) => {
    isGestureActive.current = false;
    
    if (isDraggingGuide.current) {
        isDraggingGuide.current = false;
        return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;
    spacingRemainder.current = 0;
    strokeDistance.current = 0;
    lastPoint.current = null;
    
    const activeCtx = getActiveContext();
    const tempCanvas = tempCanvasRef.current;

    // Record history for Blur tool which applies directly to activeCtx
    if (activeTool === ToolType.BLUR) {
         if (activeCtx && drawingStartData.current) {
            const afterData = activeCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);
            addToHistory({ type: 'DRAW', layerId: activeLayerId, before: drawingStartData.current, after: afterData });
            drawingStartData.current = null;
        }
        return;
    }

    if (activeTool === ToolType.SELECT) {
        if (!tempCanvas) return;
        // Use last valid point if coords cannot be determined (touchend)
        let coords = getCoordinates(e, tempCanvas, transform);
        if (!coords && points.current.length > 0) {
             // Fallback for touchend if needed, or just let drag logic fail gracefully
        }
        
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        if (selection.isDragging && selection.content && coords) {
            const dx = Math.round(coords.x - selection.dragStartX);
            const dy = Math.round(coords.y - selection.dragStartY);
            const finalX = Math.round(selection.x + dx);
            const finalY = Math.round(selection.y + dy);
            
            setSelection(prev => ({ ...prev, isDragging: false, x: finalX, y: finalY }));
            
            // FORCE REDRAW STATIC SELECTION ON TEMP CANVAS TO PREVENT DISAPPEARANCE
            tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
            tempCtx.drawImage(selection.content, finalX, finalY);
            
            tempCtx.fillStyle = 'rgba(0, 100, 255, 0.15)';
            tempCtx.fillRect(finalX, finalY, selection.w, selection.h);

            const scaledLineWidth = 2 / transform.scale;
            tempCtx.lineWidth = scaledLineWidth;
            tempCtx.lineJoin = 'miter';
            tempCtx.lineCap = 'butt';
            tempCtx.strokeStyle = '#fff'; tempCtx.setLineDash([4, 4]); tempCtx.strokeRect(finalX, finalY, selection.w, selection.h);
            tempCtx.strokeStyle = '#000'; tempCtx.lineDashOffset = 4; tempCtx.strokeRect(finalX, finalY, selection.w, selection.h);
            tempCtx.setLineDash([]);
        } 
        else if (!selection.isActive && points.current.length > 0 && coords) {
            const start = points.current[0];
            const end = coords;
            // Snap to pixels
            const x = Math.round(Math.min(start.x, end.x));
            const y = Math.round(Math.min(start.y, end.y));
            const w = Math.round(Math.abs(end.x - start.x));
            const h = Math.round(Math.abs(end.y - start.y));
            
            if (w > 2 && h > 2 && activeCtx) {
                if (!drawingStartData.current) {
                    drawingStartData.current = activeCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);
                }

                const imageData = activeCtx.getImageData(x, y, w, h);
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                c.getContext('2d')?.putImageData(imageData, 0, 0);
                
                activeCtx.clearRect(x, y, w, h);
                
                setSelection({ isActive: true, x, y, w, h, content: c, isDragging: false, dragStartX: 0, dragStartY: 0 });
                
                if (tempCtx) {
                    tempCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
                    tempCtx.drawImage(c, x, y);

                    // Add Blue Overlay persisting after release
                    tempCtx.fillStyle = 'rgba(0, 100, 255, 0.15)';
                    tempCtx.fillRect(x, y, w, h);

                    // Force 2px line width relative to zoom
                    const scaledLineWidth = 2 / transform.scale;
                    tempCtx.lineWidth = scaledLineWidth;
                    // Reset line styles
                    tempCtx.lineJoin = 'miter';
                    tempCtx.lineCap = 'butt';
                    tempCtx.strokeStyle = '#fff'; tempCtx.setLineDash([4, 4]); tempCtx.strokeRect(x, y, w, h);
                    tempCtx.strokeStyle = '#000'; tempCtx.lineDashOffset = 4; tempCtx.strokeRect(x, y, w, h);
                    tempCtx.setLineDash([]);
                }
            }
        }
        points.current = [];
        return;
    }
    
    if (activeCtx && tempCanvas && activeTool !== ToolType.FILL && activeTool !== ToolType.PICKER && activeTool !== ToolType.TEXT) {
        
        const isEraser = activeTool === ToolType.ERASER;
        const isDirectDraw = isEraser || (activeTool === ToolType.BRUSH && activeBrush.blendMode === 'multiply');

        // If Eraser or DirectDraw brush, we drew directly on activeCtx, so we skip the composition step
        if (isDirectDraw) {
             // Nothing to composite, drawing is already on canvas
        } else {
             // Standard Brush Composition
            activeCtx.globalAlpha = brushSettings.opacity / 100;
            
            if (activeBrush.blendMode === 'multiply') {
                activeCtx.globalCompositeOperation = 'multiply';
            }

            activeCtx.drawImage(tempCanvas, 0, 0);
            
            activeCtx.globalAlpha = 1.0;
            activeCtx.globalCompositeOperation = 'source-over';
        }
        
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx?.clearRect(0, 0, canvasSize.width, canvasSize.height);
    }
    
    if (activeCtx && drawingStartData.current) {
        const afterData = activeCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);
        addToHistory({ type: 'DRAW', layerId: activeLayerId, before: drawingStartData.current, after: afterData });
        drawingStartData.current = null;
    }
    points.current = [];
  };

  // ... (Keep existing Layer Management, Export, Import, AI handlers identical)
  const addLayer = useCallback(() => {
    if (selection.isActive) commitSelection();

    const newId = Date.now().toString();
    const newLayer: Layer = { id: newId, name: `Calque ${layers.length + 1}`, visible: true, opacity: 1, locked: false };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
    setHistory(prev => {
        const h = prev.slice(0, historyIndex);
        h.push({ type: 'LAYER_ADD', layerId: newId });
        if (h.length > 30) h.shift();
        return h;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 30));
  }, [layers.length, historyIndex, selection, commitSelection]); 

  const handleDeleteLayer = useCallback((id: string) => {
    if (layers.length <= 1) { alert("Impossible de supprimer le dernier calque."); return; }
    if (selection.isActive) commitSelection();

    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;
    const layerToDelete = layers[index];
    const canvas = canvasRefs.current.get(id);
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newLayers = layers.filter(l => l.id !== id);
        setLayers(newLayers);
        if (activeLayerId === id) {
            const newIndex = Math.max(0, index - 1);
            setActiveLayerId(newLayers[Math.min(newIndex, newLayers.length - 1)].id);
        }
        setHistory(prev => {
            const h = prev.slice(0, historyIndex);
            h.push({ type: 'LAYER_DELETE', layer: layerToDelete, index: index, imageData: imageData });
            if (h.length > 30) h.shift();
            return h;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 30));
    }
  }, [layers, activeLayerId, historyIndex, selection, commitSelection]);

  const deleteLayerRef = useRef(handleDeleteLayer);
  useEffect(() => { deleteLayerRef.current = handleDeleteLayer; }, [handleDeleteLayer]);

  const toggleLayerVisibility = (id: string) => setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  const toggleLayerLock = (id: string) => setLayers(layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  const updateLayerName = (id: string, name: string) => setLayers(layers.map(l => l.id === id ? { ...l, name } : l));
  
  const updateLayerOpacity = (id: string, opacity: number) => {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const reorderLayers = (draggedId: string, targetId: string) => {
    const dragIndex = layers.findIndex(l => l.id === draggedId);
    const targetIndex = layers.findIndex(l => l.id === targetId);
    if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return;
    const newLayers = [...layers];
    const [draggedLayer] = newLayers.splice(dragIndex, 1);
    newLayers.splice(targetIndex, 0, draggedLayer);
    setLayers(newLayers);
  };

  const handleExport = () => {
    if (selection.isActive) commitSelection();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize.width; tempCanvas.height = canvasSize.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.fillStyle = '#ffffff'; tempCtx.fillRect(0,0,canvasSize.width, canvasSize.height);
      layers.forEach(layer => {
        if (layer.visible) {
            const layerCanvas = canvasRefs.current.get(layer.id);
            if (layerCanvas) {
                tempCtx.globalAlpha = layer.opacity;
                tempCtx.drawImage(layerCanvas, 0, 0);
            }
        }
      });
      const link = document.createElement('a'); link.download = 'projet-lumina.png'; link.href = tempCanvas.toDataURL('image/png'); link.click();
    }
  };

  const handleImportClick = () => { if (selection.isActive) commitSelection(); fileInputRef.current?.click(); }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const newId = Date.now().toString();
        const newLayer: Layer = { id: newId, name: file.name.slice(0, 20), visible: true, opacity: 1, locked: false };
        setLayers(prev => [...prev, newLayer]);
        setActiveLayerId(newId);
        setHistory(prev => { const h = prev.slice(0, historyIndex); h.push({ type: 'LAYER_ADD', layerId: newId }); if (h.length > 30) h.shift(); return h; });
        setHistoryIndex(prev => Math.min(prev + 1, 30));
        pendingImage.current = { id: newId, img };
        setCanvasSize(prev => ({...prev})); // Trigger redraw
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file); e.target.value = ''; 
  };

  const handleAIGeneration = async (prompt: string) => {
    if (selection.isActive) commitSelection();
    setIsGeneratingAI(true);
    const imageUrl = await generateImageFromPrompt(prompt);
    setIsGeneratingAI(false);
    setIsAIModalOpen(false);
    if (imageUrl) {
        const newId = Date.now().toString();
        const newLayer: Layer = { id: newId, name: `IA: ${prompt.slice(0, 10)}...`, visible: true, opacity: 1, locked: false };
        setLayers([...layers, newLayer]);
        setActiveLayerId(newId);
        setTimeout(() => {
            const canvas = canvasRefs.current.get(newId);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => { ctx?.drawImage(img, 0, 0, canvasSize.width, canvasSize.height); };
                img.src = imageUrl;
            }
        }, 100);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overscroll-none">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg" className="hidden" />

      <TopBar 
        brushSettings={brushSettings} 
        setBrushSettings={setBrushSettings} 
        activeTool={activeTool}
        activeBrush={activeBrush}
        setActiveBrush={setActiveBrush}
        onUndo={undo} 
        onRedo={redo} 
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length}
        onExport={handleExport}
        onImport={handleImportClick}
        onNewProject={() => setIsNewProjectModalOpen(true)}
        allBrushes={allBrushes}
        onOpenBrushCreator={() => setIsBrushCreatorOpen(true)}
        onDeleteBrush={handleDeleteBrush}
        isSymmetryActive={isSymmetryActive}
        toggleSymmetry={() => setIsSymmetryActive(!isSymmetryActive)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <ToolsPanel 
            activeTool={activeTool} 
            onSelectTool={handleToolSelect} 
            onOpenAI={() => setIsAIModalOpen(true)}
            activeBrush={activeBrush}
            setActiveBrush={setActiveBrush}
            allBrushes={allBrushes}
        />

        <div 
            className="flex-1 bg-[#1a1a1a] overflow-hidden flex items-center justify-center p-0 relative touch-none" 
            ref={mainContainerRef}
            onWheel={handleWheel}
        >
           <div 
             className="relative bg-white shadow-2xl shadow-black/80 cursor-crosshair ring-1 ring-gray-800"
             style={{ 
                 width: canvasSize.width, 
                 height: canvasSize.height,
                 transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                 transformOrigin: 'center center',
                 transition: isGestureActive.current ? 'none' : 'transform 0.1s ease-out'
             }}
             onPointerDown={startDrawing}
             onPointerMove={draw}
             onPointerUp={stopDrawing}
             onPointerLeave={stopDrawing}
             onPointerCancel={stopDrawing}
             onTouchStart={startDrawing}
             onTouchMove={draw}
             onTouchEnd={stopDrawing}
           >
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  opacity: 0.2,
                  zIndex: 0
                }}
              />
              
              {/* Guides Overlay (SVG) */}
              <svg className="absolute inset-0 pointer-events-none z-[500]" width={canvasSize.width} height={canvasSize.height}>
                  {activeGuide === 'ruler' && (
                      <g>
                        {/* The Ruler Line */}
                        <line 
                            x1={guideConfig.centerX - 1000 * Math.cos(guideConfig.angle * Math.PI / 180)}
                            y1={guideConfig.centerY - 1000 * Math.sin(guideConfig.angle * Math.PI / 180)}
                            x2={guideConfig.centerX + 1000 * Math.cos(guideConfig.angle * Math.PI / 180)}
                            y2={guideConfig.centerY + 1000 * Math.sin(guideConfig.angle * Math.PI / 180)}
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeDasharray="10, 10"
                            opacity="0.8"
                        />
                        {/* Handle for Dragging */}
                        <g transform={`translate(${guideConfig.centerX}, ${guideConfig.centerY})`} className="cursor-move">
                            <circle r="12" fill="rgba(59, 130, 246, 0.5)" stroke="white" strokeWidth="2" />
                            <circle r="4" fill="white" />
                        </g>
                      </g>
                  )}
                  {activeGuide === 'circle' && (
                      <g>
                        {/* The Circle Guide */}
                        <circle 
                            cx={guideConfig.centerX}
                            cy={guideConfig.centerY}
                            r={guideConfig.radius}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeDasharray="10, 10"
                            opacity="0.8"
                        />
                        {/* Handle for Dragging */}
                        <g transform={`translate(${guideConfig.centerX}, ${guideConfig.centerY})`} className="cursor-move">
                            <circle r="12" fill="rgba(59, 130, 246, 0.5)" stroke="white" strokeWidth="2" />
                            <circle r="4" fill="white" />
                        </g>
                      </g>
                  )}
              </svg>

              {/* Symmetry Axis Line */}
              {isSymmetryActive && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-500/80 z-[99999] cursor-col-resize group"
                    style={{ left: symmetryAxisX }}
                    onPointerDown={handleAxisPointerDown}
                  >
                      {/* Hover Handle area */}
                      <div className="absolute top-0 bottom-0 -left-4 w-8 bg-transparent group-hover:bg-blue-500/10 transition-colors"></div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-blue-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                         Axe Symétrie
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/80 p-1 rounded-full shadow-lg cursor-col-resize">
                        <MoveHorizontal size={14} className="text-white" />
                      </div>
                  </div>
              )}

              {layers.map((layer, index) => (
                <canvas
                  key={layer.id}
                  ref={(el) => {
                    if (el) canvasRefs.current.set(layer.id, el);
                    else canvasRefs.current.delete(layer.id);
                  }}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className={`absolute top-0 left-0 transition-opacity duration-200 ${!layer.visible ? 'pointer-events-none opacity-0' : ''}`}
                  style={{ 
                      opacity: layer.visible ? layer.opacity : 0, 
                      zIndex: index + 1
                  }}
                />
              ))}

              <canvas
                ref={tempCanvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ 
                    zIndex: 9999,
                    opacity: activeTool === ToolType.BRUSH ? brushSettings.opacity / 100 : 1
                }}
              />
           </div>
        </div>

        {/* Updated Sidebar with Tabs */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-[90] shadow-xl">
          
          {/* Tabs Header */}
          <div className="flex border-b border-gray-800 bg-gray-950">
             <button 
                onClick={() => setActiveSidebarTab('layers')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide flex items-center justify-center transition-colors ${
                    activeSidebarTab === 'layers' 
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
                }`}
                title="Calques"
             >
                <Layers size={14} className="mr-2" />
                Calques
             </button>
             <button 
                onClick={() => setActiveSidebarTab('tools')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide flex items-center justify-center transition-colors ${
                    activeSidebarTab === 'tools' 
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
                }`}
                title="Réglages du Pinceau"
             >
                <Sliders size={14} className="mr-2" />
                Réglages
             </button>
             <button 
                onClick={() => setActiveSidebarTab('guides')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide flex items-center justify-center transition-colors ${
                    activeSidebarTab === 'guides' 
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
                }`}
                title="Assistants de Dessin"
             >
                <Ruler size={14} className="mr-2" />
                Outils
             </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            
            {/* Layers Content */}
            {activeSidebarTab === 'layers' && (
                <div className="flex flex-col h-full">
                    {/* Layer Header with Opacity Control */}
                    <div className="p-3 bg-gray-900/50 backdrop-blur sticky top-0 z-10 border-b border-gray-800 space-y-3">
                         <div className="flex justify-between items-center">
                             <h3 className="text-xs font-bold text-gray-400 uppercase">Liste des calques</h3>
                             <div className="flex items-center space-x-1">
                                <button
                                    onClick={mergeLayerDown}
                                    disabled={layers.findIndex(l => l.id === activeLayerId) <= 0}
                                    className={`p-1.5 rounded-md transition-all shadow-sm border border-gray-700 ${
                                        layers.findIndex(l => l.id === activeLayerId) > 0
                                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                                        : 'bg-gray-900 text-gray-600 border-transparent cursor-not-allowed'
                                    }`}
                                    title="Fusionner vers le bas"
                                >
                                    <ArrowDownToLine size={16} />
                                </button>
                                <button
                                    onClick={duplicateLayer}
                                    className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300 hover:text-white transition-all shadow-sm border border-gray-700"
                                    title="Dupliquer le calque"
                                >
                                    <Copy size={16} />
                                </button>
                                <button onClick={addLayer} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300 hover:text-white transition-all shadow-sm border border-gray-700">
                                <Plus size={16} />
                                </button>
                             </div>
                         </div>
                         
                         {/* Opacity Slider for Selected Layer */}
                         {layers.find(l => l.id === activeLayerId) && (
                            <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs text-gray-400 font-medium">Opacité</label>
                                    <span className="text-xs font-mono text-blue-400">
                                        {Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)}%
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={(layers.find(l => l.id === activeLayerId)?.opacity || 0) * 100}
                                    onChange={(e) => updateLayerOpacity(activeLayerId, parseInt(e.target.value) / 100)}
                                    className="w-full accent-blue-500 h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>
                         )}
                    </div>

                    <div className="flex-1 p-2 space-y-1">
                        {[...layers].reverse().map((layer) => (
                          <LayerItem
                            key={layer.id}
                            layer={layer}
                            isActive={activeLayerId === layer.id}
                            onSelect={setActiveLayerId}
                            onToggleVisibility={toggleLayerVisibility}
                            onToggleLock={toggleLayerLock}
                            onDelete={handleDeleteLayer}
                            onChangeName={updateLayerName}
                            onReorder={reorderLayers}
                          />
                        ))}
                    </div>
                </div>
            )}

            {/* Guides / Tools Content */}
            {activeSidebarTab === 'guides' && (
                <div className="p-4 space-y-6">
                     <div className="flex items-center space-x-3 pb-4 border-b border-gray-800">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                             <Ruler size={20} className="text-blue-400" />
                        </div>
                        <div>
                             <h4 className="text-sm font-bold text-white">Assistants de Dessin</h4>
                             <p className="text-xs text-gray-500">Guides visuels et contraintes</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setActiveGuide('none')}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                activeGuide === 'none'
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            <MousePointer2 size={18} className="mb-1" />
                            <span className="text-[10px] font-bold">Aucun</span>
                        </button>
                        <button
                            onClick={() => setActiveGuide('ruler')}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                activeGuide === 'ruler'
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            <Ruler size={18} className="mb-1" />
                            <span className="text-[10px] font-bold">Règle</span>
                        </button>
                        <button
                            onClick={() => setActiveGuide('circle')}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                activeGuide === 'circle'
                                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            <CircleIcon size={18} className="mb-1" />
                            <span className="text-[10px] font-bold">Cercle</span>
                        </button>
                    </div>

                    {activeGuide === 'ruler' && (
                         <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                             <div>
                                <div className="flex justify-between mb-1 items-center">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Angle</label>
                                    <span className="text-xs text-blue-400 font-mono">{guideConfig.angle}°</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    value={guideConfig.angle}
                                    onChange={(e) => setGuideConfig(prev => ({ ...prev, angle: parseInt(e.target.value) }))}
                                    className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                             </div>
                             <div className="p-2 bg-blue-900/30 rounded border border-blue-500/20">
                                 <p className="text-[10px] text-blue-200 flex items-start">
                                     <Move size={12} className="mr-1 mt-0.5 flex-shrink-0" />
                                     Glissez la poignée blanche au centre de la règle pour la déplacer.
                                 </p>
                             </div>
                         </div>
                    )}

                    {activeGuide === 'circle' && (
                         <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                             <div>
                                <div className="flex justify-between mb-1 items-center">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Rayon</label>
                                    <span className="text-xs text-blue-400 font-mono">{guideConfig.radius}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="500"
                                    value={guideConfig.radius}
                                    onChange={(e) => setGuideConfig(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                                    className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                             </div>
                             <div className="p-2 bg-blue-900/30 rounded border border-blue-500/20">
                                 <p className="text-[10px] text-blue-200 flex items-start">
                                     <Move size={12} className="mr-1 mt-0.5 flex-shrink-0" />
                                     Glissez la poignée blanche au centre du cercle pour le déplacer.
                                 </p>
                             </div>
                         </div>
                    )}

                    {/* Layer Transformation Section */}
                    <div className="pt-6 border-t border-gray-800">
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 text-orange-400">
                                <Scaling size={16} />
                            </div>
                            <h4 className="text-sm font-bold text-white">Transformations du Calque</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                             <button
                                onClick={() => flipLayer('horizontal')}
                                className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all text-gray-300 hover:text-white"
                                title="Miroir Horizontal"
                             >
                                <FlipHorizontal size={20} className="mb-2" />
                                <span className="text-[10px] font-medium">Miroir H</span>
                             </button>

                             <button
                                onClick={() => flipLayer('vertical')}
                                className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all text-gray-300 hover:text-white"
                                title="Miroir Vertical"
                             >
                                <FlipVertical size={20} className="mb-2" />
                                <span className="text-[10px] font-medium">Miroir V</span>
                             </button>
                        </div>

                         <p className="text-[10px] text-gray-500 mt-2">
                            Transformez le calque actif.
                        </p>
                    </div>

                    {/* Image Import Section */}
                    <div className="pt-6 border-t border-gray-800">
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 text-green-400">
                                    <ImageIcon size={16} />
                            </div>
                            <h4 className="text-sm font-bold text-white">Images</h4>
                        </div>
                        
                        <button
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-200 py-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-all group"
                        >
                            <Upload size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                            <span className="text-sm font-medium">Importer un Calque</span>
                        </button>
                        <p className="text-[10px] text-gray-500 mt-2">
                            Importe une image (JPG, PNG) depuis votre appareil dans un nouveau calque.
                        </p>
                    </div>
                </div>
            )}

            {/* Brush Settings Content (Renamed to Réglages) */}
            {activeSidebarTab === 'tools' && (
                <div className="p-4 space-y-6">
                    {/* Brush Preview Header */}
                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-800">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                             <Paintbrush size={20} className="text-gray-400" />
                        </div>
                        <div>
                             <h4 className="text-sm font-bold text-white">{activeBrush.name}</h4>
                             <p className="text-xs text-gray-500 uppercase">{activeBrush.mode === 'stamp' ? 'Texture' : 'Standard'}</p>
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1 items-center">
                                <label className="text-xs text-gray-400 uppercase font-bold w-12">Taille</label>
                                <span className="text-xs text-blue-400 font-mono">{brushSettings.size}px</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="200"
                                value={brushSettings.size}
                                onChange={(e) => setBrushSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                                className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-1 items-center">
                                <label className="text-xs text-gray-400 uppercase font-bold w-12 leading-none">Opacité</label>
                                <span className="text-xs text-blue-400 font-mono">{brushSettings.opacity}%</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={brushSettings.opacity}
                                onChange={(e) => setBrushSettings(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                                className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-1 items-center">
                                <label className="text-xs text-gray-400 uppercase font-bold w-12 leading-none">Flux</label>
                                <span className="text-xs text-blue-400 font-mono">{brushSettings.flow}%</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={brushSettings.flow}
                                onChange={(e) => setBrushSettings(prev => ({ ...prev, flow: parseInt(e.target.value) }))}
                                className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                         {activeBrush.mode === 'path' && (
                             <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Dureté</label>
                                    <span className="text-xs text-blue-400 font-mono">{(brushSettings.hardness * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={brushSettings.hardness}
                                    onChange={(e) => setBrushSettings(prev => ({ ...prev, hardness: parseFloat(e.target.value) }))}
                                    className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                             </div>
                         )}
                    </div>

                    <div className="pt-4 border-t border-gray-800 space-y-6">
                         {/* Stabilizer */}
                         <div>
                             <div className="flex items-center justify-between mb-3">
                                <label className="text-xs text-gray-400 uppercase font-bold flex items-center">
                                    Stabilisateur
                                </label>
                                <button 
                                    onClick={() => setBrushSettings(prev => ({ ...prev, isStabilizerEnabled: !prev.isStabilizerEnabled }))}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${brushSettings.isStabilizerEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${brushSettings.isStabilizerEnabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: brushSettings.isStabilizerEnabled ? '18px' : '2px' }} />
                                </button>
                             </div>
                             
                             <div className={`transition-opacity ${brushSettings.isStabilizerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={brushSettings.stabilizerLevel}
                                    onChange={(e) => setBrushSettings(prev => ({ ...prev, stabilizerLevel: parseInt(e.target.value) }))}
                                    className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                                    <span>Faible</span>
                                    <span>Fort</span>
                                </div>
                             </div>
                         </div>

                         {/* Pen Mode (Palm Rejection) */}
                         <div>
                             <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                                <div className="flex items-center space-x-2">
                                    <PenTool size={14} className="text-gray-400" />
                                    <label className="text-xs text-gray-300 uppercase font-bold">Mode Stylet Uniquement</label>
                                </div>
                                <button 
                                    onClick={() => setOnlyPenMode(!onlyPenMode)}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${onlyPenMode ? 'bg-green-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${onlyPenMode ? 'left-4.5' : 'left-0.5'}`} style={{ left: onlyPenMode ? '18px' : '2px' }} />
                                </button>
                             </div>
                             <p className="text-[10px] text-gray-500">
                                 {onlyPenMode ? "Le dessin au doigt est désactivé. Utilisez le stylet pour dessiner." : "Le dessin au doigt est activé."}
                             </p>
                         </div>

                         {/* Finesse du Trait (New) */}
                         <div className="pt-4 border-t border-gray-800">
                             <div className="flex items-center space-x-2 mb-3">
                                 <TrendingUp size={16} className="text-orange-400" />
                                 <label className="text-sm font-bold text-gray-200">Finesse du Trait</label>
                             </div>

                             <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs text-gray-500 font-medium">Début (Fade In)</label>
                                        <span className="text-xs text-orange-400 font-mono">{brushSettings.taperStart}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={brushSettings.taperStart}
                                        onChange={(e) => setBrushSettings(prev => ({ ...prev, taperStart: parseInt(e.target.value) }))}
                                        className="w-full accent-orange-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs text-gray-500 font-medium">Fin (Pression)</label>
                                        <span className="text-xs text-orange-400 font-mono">{brushSettings.taperEnd}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={brushSettings.taperEnd}
                                        onChange={(e) => setBrushSettings(prev => ({ ...prev, taperEnd: parseInt(e.target.value) }))}
                                        className="w-full accent-orange-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* FX Content (Updated: Stroke Blur instead of Glow) */}
            {activeSidebarTab === 'fx' && (
                <div className="p-4 space-y-6">
                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-800">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 text-purple-400">
                             <Zap size={20} />
                        </div>
                        <div>
                             <h4 className="text-sm font-bold text-white">Effets de Trait</h4>
                             <p className="text-xs text-gray-500">Modificateurs de pinceau en temps réel</p>
                        </div>
                    </div>

                    {/* Stroke Blur Effect */}
                    <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-2">
                                <CloudFog size={16} className="text-purple-400" />
                                <label className="text-sm font-bold text-gray-200">Flou du Trait</label>
                            </div>
                            
                             <button 
                                onClick={() => setBrushSettings(prev => ({ ...prev, strokeBlur: prev.strokeBlur === 0 ? 5 : 0 }))}
                                className={`w-8 h-4 rounded-full transition-colors relative ${brushSettings.strokeBlur > 0 ? 'bg-purple-600' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${brushSettings.strokeBlur > 0 ? 'left-4.5' : 'left-0.5'}`} style={{ left: brushSettings.strokeBlur > 0 ? '18px' : '2px' }} />
                            </button>
                        </div>

                        <div className={`transition-opacity duration-200 ${brushSettings.strokeBlur > 0 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-gray-500">Rayon du Flou</label>
                                <span className="text-xs text-purple-400 font-mono">{brushSettings.strokeBlur}px</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="50"
                                value={brushSettings.strokeBlur}
                                onChange={(e) => setBrushSettings(prev => ({ ...prev, strokeBlur: parseInt(e.target.value) }))}
                                className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        
                        <p className="text-[10px] text-gray-500 mt-2">
                            Applique un flou dynamique à chaque coup de pinceau. Idéal pour les ombres douces ou les effets vaporeux.
                        </p>
                    </div>
                </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-800 bg-gray-950 text-[10px] text-gray-600 text-center font-mono">
             {canvasSize.width} x {canvasSize.height} px • {layers.length} Calques • Zoom {(transform.scale * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIGeneration} isGenerating={isGeneratingAI} />
      <NewProjectModal isOpen={isNewProjectModalOpen} onClose={() => setIsNewProjectModalOpen(false)} onCreate={createNewProject} />
      <BrushCreatorModal isOpen={isBrushCreatorOpen} onClose={() => setIsBrushCreatorOpen(false)} onSave={handleCreateBrush} />
      <TextToolModal 
          isOpen={isTextModalOpen} 
          onClose={() => setIsTextModalOpen(false)} 
          onInsert={handleInsertText} 
          initialColor={brushSettings.color}
      />
    </div>
  );
}

export default App;
