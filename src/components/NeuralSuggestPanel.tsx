import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Stub: Neural suggestions will be powered by io.net GPU cluster in production
const sendMessage = async (prompt: string): Promise<{ text: string }> => ({
  text: `🧠 Neural analysis of your request: "${prompt.slice(0, 50)}..."

The Divine Engine detects harmonic opportunities in your current stack. Consider layering a complementary texture in the next available slot.

Note: Full neural inference will be enabled when connected to the io.net processing cluster.`
});

interface NeuralSuggestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeSlots: any[];
  onApplySuggestion: (suggestion: any) => void;
}

/**
 * NeuralSuggestPanel — The "Third Eye" of the God Forge.
 * Harnesses Gemini 1.5 Pro to analyze the current sound stack and suggest
 * complementary layers or atmospheric shifts.
 */
export const NeuralSuggestPanel: React.FC<NeuralSuggestPanelProps> = ({
  isOpen,
  onClose,
  activeSlots,
  onApplySuggestion
}) => {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new response
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response, isAnalyzing]);

  const handleSuggest = async () => {
    if (!prompt.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setResponse(null);

    try {
      // Build context of current active slots
      const context = activeSlots.map((s, i) => ({
        index: i,
        name: s.name,
        enabled: s.enabled,
        vol: s.vol
      })).filter(s => s.enabled);

      const fullPrompt = `
        As a Neural Sound Designer for 'The God Realm' plugin, analyze this current 6-slot stack:
        ${JSON.stringify(context, null, 2)}
        
        User Request: "${prompt}"
        
        Provide a creative suggestion to enhance this stack. 
        If asking for a new layer, specify which empty slot (0-5) to use.
        Return your response in a supportive, slightly mystical "God Forge" tone.
        Include a hidden JSON block at the end with the proposed parameter changes if applicable.
      `;

      const { text } = await sendMessage(fullPrompt);
      setResponse(text);
    } catch (err) {
      setResponse("The Divine Connection was interrupted. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div 
            className="fixed right-0 top-0 bottom-0 w-80 bg-[#0a0a0a] border-l border-red-500/20 z-[101] flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.8)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-red-500/10 to-transparent">
              <div className="flex flex-col">
                <span className="text-xs font-black text-red-500 tracking-[0.2em] uppercase">The Third Eye</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Neural Logic Active</span>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Content / Chat Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
            >
              {/* Active Stack Summary */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block mb-2">Active Forge Stack</span>
                <div className="flex gap-1">
                  {activeSlots.map((s, i) => (
                    <div 
                      key={i} 
                      className={`h-1 flex-1 rounded-full ${s.enabled ? 'bg-red-500 shadow-[0_0_5px_#ff6600]' : 'bg-white/5'}`} 
                    />
                  ))}
                </div>
              </div>

              {/* Response Message */}
              {response && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm leading-relaxed text-white/80 font-light italic bg-red-500/5 p-4 rounded-xl border border-red-500/10"
                >
                  {response.split('{')[0]}
                  
                  {/* Action Button if suggestion found */}
                  {response.includes('{') && (
                    <button 
                      onClick={() => onApplySuggestion(JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}'))}
                      className="mt-4 w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-[10px] font-black text-red-500 tracking-widest uppercase transition-all"
                    >
                      Manifest Suggestion
                    </button>
                  )}
                </motion.div>
              )}

              {/* Loading State */}
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-red-500/10 border-t-red-500 animate-spin" />
                  <span className="text-[10px] font-black text-red-500/60 animate-pulse tracking-widest">ANALYZING SONIC AURA...</span>
                </div>
              )}

              {!response && !isAnalyzing && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-red-500/5 border border-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl opacity-20">👁️</span>
                  </div>
                  <p className="text-xs text-white/30 px-4 leading-loose uppercase tracking-tighter">
                    Type a command to awaken the engine.<br/>
                    "Suggest a lead layer"<br/>
                    "Make the atmosphere darker"<br/>
                    "Complement my 808"
                  </p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-black/40 border-t border-white/5">
              <div className="relative">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSuggest();
                    }
                  }}
                  placeholder="Speak to the Forge..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/40 transition-all resize-none h-24"
                />
                <button 
                  onClick={handleSuggest}
                  disabled={isAnalyzing || !prompt.trim()}
                  className="absolute right-3 bottom-3 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,102,0,0.4)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all"
                >
                  <span className="text-white text-xs">▲</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
