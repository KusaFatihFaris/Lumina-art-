import React, { useState } from 'react';
import { Sparkles, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-[90%] max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-lg font-semibold flex items-center text-white">
            <Sparkles className="mr-2 text-purple-400" size={20} />
            Assistant IA
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300 text-sm mb-4">
            Décrivez ce que vous souhaitez dessiner ou générer. L'IA créera un nouveau calque avec votre idée.
          </p>
          
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none h-32"
            placeholder="Ex: Un paysage cyberpunk avec des néons bleus et roses..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onGenerate(prompt)}
              disabled={isGenerating || !prompt.trim()}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                isGenerating || !prompt.trim()
                  ? 'bg-purple-900/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Génération...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2" size={16} />
                  Générer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
