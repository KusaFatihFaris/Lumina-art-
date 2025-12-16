
import React from 'react';
import { Point, ViewportTransform } from '../types';

export const getCoordinates = (
  event: React.PointerEvent | PointerEvent | React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, 
  canvas: HTMLCanvasElement,
  transform?: ViewportTransform
): Point | null => {
  if (!canvas) return null;
  
  const rect = canvas.getBoundingClientRect();
  let clientX = 0;
  let clientY = 0;
  let pressure = 0.5; // Default pressure

  // Pointer Events (Preferred for Pen/Touch pressure)
  if ('pointerType' in event) {
      const ptr = event as PointerEvent;
      clientX = ptr.clientX;
      clientY = ptr.clientY;
      // Normalise pressure: 0.5 for mouse (unless clicked?), actual for pen
      if (ptr.pointerType === 'mouse') {
         pressure = ptr.buttons === 1 ? 0.5 : 0; 
      } else {
         pressure = ptr.pressure;
         // Some devices return 0 pressure on touch start, force min
         if (pressure === 0 && (ptr.pointerType === 'touch' || ptr.pointerType === 'pen')) pressure = 0.5;
      }
  } 
  // Fallback Touch
  else if ('touches' in event) {
     const touchEvent = event as unknown as TouchEvent;
     // Check touches first, then changedTouches (for touchend)
     if (touchEvent.touches && touchEvent.touches.length > 0) {
        clientX = touchEvent.touches[0].clientX;
        clientY = touchEvent.touches[0].clientY;
        pressure = 0.5; 
     } else if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
        clientX = touchEvent.changedTouches[0].clientX;
        clientY = touchEvent.changedTouches[0].clientY;
        pressure = 0.5;
     } else {
        return null;
     }
  } 
  // Fallback Mouse
  else {
    const mouseEvent = event as React.MouseEvent | MouseEvent;
    clientX = mouseEvent.clientX;
    clientY = mouseEvent.clientY;
    pressure = 0.5;
  }

  if (transform) {
    // Calculate center of the canvas on screen
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Vector from center to mouse
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Inverse Rotation
    const rad = -transform.rotation * (Math.PI / 180);
    const rotX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const rotY = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Inverse Scale
    const scaledX = rotX / transform.scale;
    const scaledY = rotY / transform.scale;

    return {
      x: scaledX + canvas.width / 2,
      y: scaledY + canvas.height / 2,
      pressure: pressure
    };
  }

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
    pressure: pressure
  };
};

export const hexToRgba = (hex: string, alpha: number = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Generate a soft radial gradient tip for brushes
export const createSoftBrushTip = (size: number, hardness: number, color: string): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        const center = size / 2;
        const radius = size / 2;
        const gradient = ctx.createRadialGradient(center, center, radius * hardness, center, center, radius);
        
        // Parse hex color to RGB to create a transparent end-stop of the SAME color
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`); // Inner color (solid)
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`); // Outer color (transparent but same RGB)
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }
    return canvas;
};

// Simple Stack-based Flood Fill algorithm
export const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string
) => {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  
  const sX = Math.floor(startX);
  const sY = Math.floor(startY);
  
  if (sX < 0 || sX >= w || sY < 0 || sY >= h) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const rFill = parseInt(fillColorHex.slice(1, 3), 16);
  const gFill = parseInt(fillColorHex.slice(3, 5), 16);
  const bFill = parseInt(fillColorHex.slice(5, 7), 16);
  const aFill = 255;

  const startPos = (sY * w + sX) * 4;
  const rTarget = data[startPos];
  const gTarget = data[startPos + 1];
  const bTarget = data[startPos + 2];
  const aTarget = data[startPos + 3];

  if (rTarget === rFill && gTarget === gFill && bTarget === bFill && aTarget === aFill) {
    return;
  }

  const stack = [[sX, sY]];

  while (stack.length) {
    const pos = stack.pop();
    if (!pos) continue;
    const [x, y] = pos;
    const pixelPos = (y * w + x) * 4;

    if (x < 0 || x >= w || y < 0 || y >= h) continue;

    if (
      data[pixelPos] === rTarget &&
      data[pixelPos + 1] === gTarget &&
      data[pixelPos + 2] === bTarget &&
      data[pixelPos + 3] === aTarget
    ) {
      data[pixelPos] = rFill;
      data[pixelPos + 1] = gFill;
      data[pixelPos + 2] = bFill;
      data[pixelPos + 3] = aFill;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

export type PaperType = 'plain' | 'canvas' | 'old_paper' | 'rough';

export const generatePaperTexture = (type: PaperType, width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (type === 'plain') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        return canvas;
    } else if (type === 'old_paper') {
        ctx.fillStyle = '#f4e4bc'; 
        ctx.fillRect(0, 0, width, height);
    } else if (type === 'canvas') {
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(0, 0, width, height);
    } else if (type === 'rough') {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, width, height);
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);

        let noise = 0;

        if (type === 'old_paper') {
            noise = (Math.random() - 0.5) * 20; 
            const dx = x - width / 2;
            const dy = y - height / 2;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const maxDist = Math.sqrt(width*width + height*height) / 2;
            noise -= (dist / maxDist) * 30; 

            if (Math.random() > 0.9995) {
                 noise -= 50;
            }

        } else if (type === 'canvas') {
            const grainX = Math.sin(x * 0.5);
            const grainY = Math.sin(y * 0.5);
            noise = (grainX + grainY) * 10;
        } else if (type === 'rough') {
            noise = (Math.random() - 0.5) * 40;
        }

        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
};
