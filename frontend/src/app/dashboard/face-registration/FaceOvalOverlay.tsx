import { motion } from 'framer-motion';

interface FaceOvalOverlayProps {
  progress: number; // 0 to 1
  isLocked: boolean; // True when stability is counting down
  isDetecting: boolean; // True when face is found at all
  color: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red';
}

export function FaceOvalOverlay({ progress, isLocked, isDetecting, color }: FaceOvalOverlayProps) {
  // Map our semantic colors to Tailwind border colors
  const colorMap = {
    slate: 'border-slate-400',
    indigo: 'border-indigo-400',
    emerald: 'border-emerald-400',
    amber: 'border-amber-400',
    red: 'border-red-400',
  };
  
  const activeColor = colorMap[color] || 'border-slate-400';

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Dark overlay with transparent oval hole */}
      <div 
        className="absolute inset-0 z-0" 
        style={{
          background: 'radial-gradient(ellipse 45% 80% at center, transparent 99%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      
      {/* Oval border */}
      <div 
        className={`relative z-10 w-[45%] h-[80%] rounded-[100%] border-4 transition-colors duration-300 ${activeColor} ${isDetecting && !isLocked ? 'border-dashed opacity-70 animate-[spin_10s_linear_infinite]' : 'opacity-100'}`}
        style={{
          boxShadow: isLocked ? '0 0 20px rgba(52, 211, 153, 0.4)' : 'none',
        }}
      />
      
      {/* Corner Brackets (Animate in when face is detected) */}
      <motion.div
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ 
          scale: isDetecting ? 1 : 1.2, 
          opacity: isDetecting ? 1 : 0 
        }}
        transition={{ duration: 0.3 }}
        className="absolute w-[50%] h-[85%] z-20"
      >
        <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-300 ${activeColor}`} />
        <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-300 ${activeColor}`} />
        <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-300 ${activeColor}`} />
        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors duration-300 ${activeColor}`} />
      </motion.div>

      {/* Progress ring around the oval */}
      {progress > 0 && (
        <svg className="absolute w-[45%] h-[80%] z-30" style={{ overflow: 'visible' }}>
          <rect
            x="0" y="0" width="100%" height="100%" rx="50%" ry="50%"
            fill="none"
            stroke="rgba(52, 211, 153, 1)" // emerald
            strokeWidth="8"
            strokeDasharray="1000"
            strokeDashoffset={1000 - (1000 * progress)}
            className="transition-all duration-300 ease-linear"
            style={{ 
              transformOrigin: 'center',
              transform: 'rotate(-90deg)'
            }}
          />
        </svg>
      )}
    </div>
  );
}
