import React, { useEffect, useRef, useState } from 'react';
import { Scan, Eye, Radio, Aperture } from 'lucide-react';
import { SimulationState, VehicleType } from '../types';
import { MAP_WIDTH, MAP_HEIGHT } from '../constants';

interface VisionFeedProps {
  simulationState: SimulationState;
  onEmergencyDetected: () => void;
}

const VisionFeed: React.FC<VisionFeedProps> = ({ simulationState, onEmergencyDetected }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanLineY, setScanLineY] = useState(0);

  useEffect(() => {
    // Animation loop for the scan line
    const interval = setInterval(() => {
      setScanLineY(prev => (prev + 1) % 100); // Slower scan
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with "Night Vision" background
    ctx.fillStyle = '#022c22'; // Dark green
    ctx.fillRect(0, 0, width, height);
    
    // Draw Grid (simulating digital overlay)
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1;
    for(let i=0; i<width; i+=40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
    }
    for(let i=0; i<height; i+=40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
    }

    // Scale simulation coordinates to fit vision feed
    const scaleX = width / MAP_WIDTH;
    const scaleY = height / MAP_HEIGHT;

    // Draw Vehicles as Blobs with Bounding Boxes
    simulationState.vehicles.forEach(v => {
      const edge = simulationState.edges.find(e => e.id === v.edgeId);
      const fromNode = simulationState.nodes.find(n => n.id === edge?.from);
      const toNode = simulationState.nodes.find(n => n.id === edge?.to);

      if (fromNode && toNode) {
        const x = (fromNode.pos.x + (toNode.pos.x - fromNode.pos.x) * v.progress) * scaleX;
        const y = (fromNode.pos.y + (toNode.pos.y - fromNode.pos.y) * v.progress) * scaleY;

        // Draw vehicle heat signature
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI*2); // Slightly larger
        ctx.fillStyle = v.type === VehicleType.AMBULANCE ? '#fff' : '#4ade80';
        ctx.fill();

        // Draw Bounding Box
        ctx.strokeStyle = v.type === VehicleType.AMBULANCE ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 1.5;
        const size = v.type === VehicleType.AMBULANCE ? 24 : 16;
        ctx.strokeRect(x - size/2, y - size/2, size, size);

        // Draw Label for Ambulance
        if (v.type === VehicleType.AMBULANCE) {
           ctx.fillStyle = '#ef4444';
           ctx.font = 'bold 14px Courier New';
           ctx.fillText("TARGET: ID-31", x + 15, y);
           
           // Target Lock Lines
           ctx.beginPath();
           ctx.moveTo(x, y-30); ctx.lineTo(x, y+30);
           ctx.moveTo(x-30, y); ctx.lineTo(x+30, y);
           ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
           ctx.lineWidth = 1;
           ctx.stroke();
        } else if (v.type === VehicleType.DELIVERY_BOT) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
            ctx.font = '10px monospace';
            ctx.fillText(`BOT`, x + 10, y + 10);
        }
      }
    });

    // Draw Scan Line overlay
    const scanY = (scanLineY / 100) * height;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(width, scanY);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [simulationState, scanLineY]);

  return (
    <div className="relative h-96 bg-black rounded-lg border-2 border-gray-800 overflow-hidden shadow-inner group">
      <canvas 
        ref={canvasRef} 
        width={800} // Increased resolution
        height={600} 
        className="w-full h-full object-cover opacity-90"
      />
      
      {/* Overlay UI */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="text-[10px] text-green-500 font-mono bg-black/50 px-1 border border-green-900">CAM_01: TRAFFIC_NET</span>
          <span className="text-[10px] text-green-500 font-mono bg-black/50 px-1 border border-green-900 flex items-center gap-1">
             <Radio className="w-3 h-3 animate-pulse" /> LIVE FEED
          </span>
      </div>

      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="text-[10px] text-green-400 font-mono">ISO 800</span>
          <span className="text-[10px] text-green-400 font-mono">1/60 shutter</span>
          {simulationState.emergencyActive && (
              <span className="text-xs text-red-500 font-bold bg-black px-2 border border-red-500 animate-pulse mt-2">
                  ALERT: EMERGENCY VEHICLE
              </span>
          )}
      </div>

      {/* Static noise simulation overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
    </div>
  );
};

export default VisionFeed;