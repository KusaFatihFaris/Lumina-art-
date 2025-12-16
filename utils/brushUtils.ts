
import { BrushPreset } from '../types';

// Helper to create noise texture
const createNoiseTexture = (density: number = 0.5, type: 'noise' | 'sponge' | 'canvas' = 'noise'): HTMLCanvasElement => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      let alpha = 0;
      
      const x = (i / 4) % size;
      const y = Math.floor((i / 4) / size);
      
      if (type === 'noise') {
          // Standard random noise
          alpha = Math.random() < density ? 255 : 0;
          // Soften circle edges
          const dist = Math.sqrt(Math.pow(x - 32, 2) + Math.pow(y - 32, 2));
          if (dist > 30) alpha = 0;
          else if (dist > 20) alpha *= (30 - dist) / 10;

      } else if (type === 'sponge') {
          // Clustered noise for sponge effect
          const noise = Math.random();
          alpha = noise > (1 - density) ? 255 : 0;
          if (x % 4 === 0 || y % 4 === 0) alpha *= 0.5; // Grid break

          const dist = Math.sqrt(Math.pow(x - 32, 2) + Math.pow(y - 32, 2));
          if (dist > 28) alpha *= (32 - dist) / 4;
          if (dist > 32) alpha = 0;

      } else if (type === 'canvas') {
          // Canvas texture pattern
          const n = (Math.sin(x * 0.5) + Math.cos(y * 0.5)) * 0.5 + 0.5;
          alpha = n * 255 * density;
          const dist = Math.sqrt(Math.pow(x - 32, 2) + Math.pow(y - 32, 2));
          if (dist > 30) alpha = 0;
      }

      imgData.data[i] = 0;     
      imgData.data[i + 1] = 0; 
      imgData.data[i + 2] = 0; 
      imgData.data[i + 3] = alpha; 
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
};

// Convert uploaded image to texture
export const imageToBrushTexture = (source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement => {
    const size = 64; 
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(source, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const alpha = 255 - avg;
            data[i] = 0;     
            data[i+1] = 0;   
            data[i+2] = 0;   
            data[i+3] = data[i+3] > 0 ? alpha : 0;
        }
        ctx.putImageData(imgData, 0, 0);
    }
    return canvas;
};

// Textures générées
const noiseTexture = createNoiseTexture(0.3, 'noise');
const heavyNoiseTexture = createNoiseTexture(0.7, 'noise');
const spongeTexture = createNoiseTexture(0.5, 'sponge');
const canvasTexture = createNoiseTexture(0.8, 'canvas');
const chalkTexture = createNoiseTexture(0.9, 'noise'); // Dense noise

export const BRUSH_PRESETS: BrushPreset[] = [
  // --- BASIQUE ---
  {
    id: 'tech-pen',
    name: 'Stylo Technique',
    mode: 'path',
    lineCap: 'round',
    hardness: 1,
    spacing: 0.1
  },
  {
    id: 'basic-round',
    name: 'Rond Dur',
    mode: 'path',
    lineCap: 'round',
    hardness: 0.9,
    spacing: 0.1
  },
  {
    id: 'airbrush',
    name: 'Aérographe Doux',
    mode: 'path',
    lineCap: 'round',
    hardness: 0,
    spacing: 0.1
  },
  
  // --- ENCRAGE ---
  {
    id: 'ink-pen',
    name: 'Plume G-Pen',
    mode: 'path',
    lineCap: 'round',
    hardness: 1,
    spacing: 0.05
  },
  {
    id: 'marker-chisel',
    name: 'Marqueur Biseauté',
    mode: 'path',
    lineCap: 'square',
    hardness: 1,
    spacing: 0.05
  },
  {
    id: 'ballpoint',
    name: 'Stylo Bille',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.9,
    spacing: 0.15,
    texture: noiseTexture
  },

  // --- CRAYONS & ESQUISSES ---
  {
    id: 'pencil-2b',
    name: 'Crayon 2B',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.7,
    spacing: 0.25,
    texture: noiseTexture
  },
  {
    id: 'pencil-4b',
    name: 'Crayon 4B (Gras)',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.6,
    spacing: 0.2,
    texture: heavyNoiseTexture
  },
  {
    id: 'pencil-mech',
    name: 'Porte-mine 0.5',
    mode: 'path',
    lineCap: 'round',
    hardness: 0.9,
    spacing: 0.1
  },
  {
    id: 'charcoal-stick',
    name: 'Bâton Fusain',
    mode: 'stamp',
    lineCap: 'square',
    hardness: 0.5,
    spacing: 0.1,
    texture: heavyNoiseTexture
  },
  {
    id: 'charcoal-soft',
    name: 'Fusain Doux',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.3,
    spacing: 0.15,
    texture: spongeTexture
  },

  // --- PEINTURE ---
  {
    id: 'oil-paint',
    name: 'Peinture à l\'Huile',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.8,
    spacing: 0.08,
    texture: canvasTexture
  },
  {
    id: 'acrylic',
    name: 'Acrylique Sec',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.9,
    spacing: 0.12,
    texture: heavyNoiseTexture
  },
  {
    id: 'gouache',
    name: 'Gouache',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 1,
    spacing: 0.05,
    texture: noiseTexture
  },
  {
    id: 'watercolor',
    name: 'Aquarelle',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.2,
    spacing: 0.1,
    blendMode: 'multiply'
  },
  {
    id: 'watercolor-wet',
    name: 'Aquarelle Humide',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0,
    spacing: 0.05,
    blendMode: 'multiply',
    texture: spongeTexture
  },

  // --- TEXTURES & EFFETS ---
  {
    id: 'pastel-chalk',
    name: 'Craie Pastel',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.6,
    spacing: 0.15,
    texture: chalkTexture
  },
  {
    id: 'sponge',
    name: 'Éponge',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.4,
    spacing: 0.3,
    texture: spongeTexture
  },
  {
    id: 'noise-spray',
    name: 'Spray Bruit',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0,
    spacing: 0.4,
    texture: heavyNoiseTexture
  },
  {
    id: 'texture-canvas',
    name: 'Texture Toile',
    mode: 'stamp',
    lineCap: 'round',
    hardness: 0.5,
    spacing: 0.2,
    texture: canvasTexture
  },
  
  // --- DIGITAL ---
  {
    id: 'pixel-art',
    name: 'Pixel Art (1px)',
    mode: 'path',
    lineCap: 'square',
    hardness: 1,
    spacing: 0.1 // Intended to be used at size 1
  },
  {
    id: 'glow-pen',
    name: 'Néon / Glow',
    mode: 'path',
    lineCap: 'round',
    hardness: 0.5,
    spacing: 0.1,
    blendMode: 'screen'
  }
];

export const getPointsOnCurve = (p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}, numPoints: number) => {
    const points = [];
    for(let t=0; t<=1; t+=1/numPoints) {
        const x = (1-t)*(1-t)*p1.x + 2*(1-t)*t*p2.x + t*t*p3.x;
        const y = (1-t)*(1-t)*p1.y + 2*(1-t)*t*p2.y + t*t*p3.y;
        points.push({x, y});
    }
    return points;
}
