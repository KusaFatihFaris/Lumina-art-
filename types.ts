
export enum ToolType {
  BRUSH = 'brush',
  ERASER = 'eraser',
  FILL = 'fill',
  PICKER = 'picker',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  TRIANGLE = 'triangle',
  LINE = 'line',
  MOVE = 'move',
  SELECT = 'select',
  BLUR = 'blur',
  TEXT = 'text' // Nouvel outil Texte
}

export interface Point {
  x: number;
  y: number;
  pressure: number; // 0.0 to 1.0
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0 to 1
  locked: boolean;
}

export interface BrushSettings {
  size: number;
  opacity: number; // 0 to 100 (Stroke Opacity)
  flow: number;    // 0 to 100 (Stamp Density/Ink Flow)
  color: string;
  hardness: number; // 0 to 100
  stabilizerLevel: number; // 0 to 10
  isStabilizerEnabled: boolean;
  isDynamicsEnabled: boolean; // Toggle for shape dynamics
  taperStart: number; // 0 to 100 (Distance of fade in)
  taperEnd: number;   // 0 to 100 (Pressure sensitivity falloff)
  strokeBlur: number; // 0 to 50 (Real-time blur radius)
}

export type BrushMode = 'path' | 'stamp';

export interface BrushPreset {
  id: string;
  name: string;
  mode: BrushMode;
  lineCap: 'round' | 'square' | 'butt';
  hardness: number; // 0 (soft) to 1 (hard)
  spacing?: number; // 0.1 to 1 (percentage of size)
  texture?: HTMLCanvasElement | null; // For stamp brushes
  blendMode?: GlobalCompositeOperation;
}

export interface HistoryStep {
  layerId: string;
  imageData: ImageData;
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // in degrees
}

export interface SelectionState {
  isActive: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  // We store the cut image data as an offscreen canvas for performance during drag
  content: HTMLCanvasElement | null; 
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
}
