
import React, { useState } from 'react';
import { Type, X, Check, Bold, Italic } from 'lucide-react';

interface TextToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string, font: string, size: number, color: string, bold: boolean, italic: boolean) => void;
  initialColor: string;
}

const FONTS = [
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Roboto', family: "'Roboto', sans-serif" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Merriweather', family: "'Merriweather', serif" },
  { name: 'Courier Prime', family: "'Courier Prime', monospace" },
  { name: 'Pacifico', family: "'Pacifico', cursive" },
  { name: 'Lobster', family: "'Lobster', display" },
  { name: 'Bangers', family: "'Bangers', display" },
];

export const TextToolModal: React.FC<TextToolModalProps> = ({ isOpen, onClose, onInsert, initialColor }) => {
  const [text, setText] = useState('');
  const [fontFamily, setFontFamily] = useState(FONTS[0].family);
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState(initialColor);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (text.trim()) {
      onInsert(text, fontFamily, fontSize, color, isBold, isItalic);
      setText(''); // Reset
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-lg font-semibold flex items-center text-white">
            <Type className="mr-2 text-blue-400" size={20} />
            Ajouter du Texte
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tapez votre texte ici..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:border-blue-500 outline-none resize-none h-24"
            autoFocus
          />

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Police</label>
                <select 
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white text-sm outline-none"
                    style={{ fontFamily: fontFamily }}
                >
                    {FONTS.map(font => (
                        <option key={font.name} value={font.family} style={{ fontFamily: font.family }}>
                            {font.name}
                        </option>
                    ))}
                </select>
             </div>
             
             <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Taille ({fontSize}px)</label>
                <input
                    type="range"
                    min="10"
                    max="200"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-blue-500 mt-2"
                />
             </div>
          </div>

          <div className="flex items-center space-x-4">
              <div className="flex-1">
                 <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Couleur</label>
                 <div className="flex items-center space-x-2">
                     <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                     />
                     <span className="text-sm text-gray-400 font-mono">{color}</span>
                 </div>
              </div>

              <div className="flex space-x-2">
                  <button
                    onClick={() => setIsBold(!isBold)}
                    className={`p-2 rounded-lg border transition-all ${isBold ? 'bg-blue-600/30 border-blue-500 text-blue-200' : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'}`}
                  >
                      <Bold size={20} />
                  </button>
                  <button
                    onClick={() => setIsItalic(!isItalic)}
                    className={`p-2 rounded-lg border transition-all ${isItalic ? 'bg-blue-600/30 border-blue-500 text-blue-200' : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'}`}
                  >
                      <Italic size={20} />
                  </button>
              </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3 border-t border-gray-700 mt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleInsert}
              disabled={!text.trim()}
              className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                !text.trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
              }`}
            >
              <Check size={16} className="mr-2" />
              Insérer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
