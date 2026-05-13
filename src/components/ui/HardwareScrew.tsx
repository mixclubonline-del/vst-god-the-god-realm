import React from 'react';
import './HardwareScrew.css';

interface HardwareScrewProps {
  className?: string;
  size?: number;
  rotation?: number;
}

export const HardwareScrew: React.FC<HardwareScrewProps> = ({ 
  className = '', 
  size = 16, 
  rotation = 45 
}) => {
  return (
    <div 
      className={`hardware-screw ${className}`}
      style={{ 
        width: size, 
        height: size,
        transform: `rotate(${rotation}deg)` 
      }}
    >
      <div className="screw-head">
        <div className="screw-slot" />
        <div className="screw-shine" />
      </div>
    </div>
  );
};
