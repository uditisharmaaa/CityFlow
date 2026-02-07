import React, { useRef, useEffect } from 'react';
import { SimulationState, VehicleType } from '../types';
import { MAP_WIDTH, MAP_HEIGHT, COLOR_BG, COLOR_ROAD_ASPHALT, COLOR_ROAD_MARKING, COLOR_VEHICLE_CIV, COLOR_VEHICLE_BOT, COLOR_VEHICLE_EMERGENCY, COLOR_NODE_OFF, COLOR_NODE_GREEN, COLOR_NODE_YELLOW, ROAD_WIDTH, LANE_OFFSET, COLOR_HOSPITAL, COLOR_HOSPITAL_BG } from '../constants';
import { Plus } from 'lucide-react';

interface CityMapProps {
  state: SimulationState;
}

const CityMap: React.FC<CityMapProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to get lane position
  const getLanePosition = (x1: number, y1: number, x2: number, y2: number, progress: number, offset: number) => {
      // Direction vector
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ndx = dx / len;
      const ndy = dy / len;

      // Normal vector (Right hand side relative to forward)
      // If forward is (1,0) [Right], Right is (0,1) [Down]. Formula: (-y, x) -> (-0, 1) -> (0, 1). Correct.
      // If forward is (0,1) [Down], Right is (-1,0) [Left]. Formula: (-1, 0). Correct.
      const perpX = -ndy;
      const perpY = ndx;

      const px = x1 + dx * progress + perpX * offset;
      const py = y1 + dy * progress + perpY * offset;
      
      return { x: px, y: py };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // 0. Draw Roads (Base Layer)
    // Draw all edges as thick lines to form the network
    ctx.lineCap = 'round';
    state.edges.forEach(edge => {
      const fromNode = state.nodes.find(n => n.id === edge.from);
      const toNode = state.nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        // Draw Asphalt
        ctx.beginPath();
        ctx.moveTo(fromNode.pos.x, fromNode.pos.y);
        ctx.lineTo(toNode.pos.x, toNode.pos.y);
        ctx.lineWidth = ROAD_WIDTH;
        ctx.strokeStyle = COLOR_ROAD_ASPHALT;
        ctx.stroke();

        // Draw Center Line (Dashed)
        ctx.beginPath();
        ctx.setLineDash([10, 10]);
        ctx.moveTo(fromNode.pos.x, fromNode.pos.y);
        ctx.lineTo(toNode.pos.x, toNode.pos.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_ROAD_MARKING;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // 1. Draw Green Corridor Highlight (Underlay on Lanes)
    if (state.activeRoute.length > 1) {
       // We can just highlight the nodes involved roughly
       // Simpler: Draw a polyline connecting the nodes
        ctx.beginPath();
        ctx.moveTo(state.activeRoute[0].x, state.activeRoute[0].y);
        for(let i=1; i<state.activeRoute.length; i++) {
            ctx.lineTo(state.activeRoute[i].x, state.activeRoute[i].y);
        }
        ctx.lineWidth = ROAD_WIDTH * 0.8; 
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.1)';
        ctx.stroke();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.stroke();
    }

    // 2. Draw Nodes (Intersections)
    state.nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.pos.x, node.pos.y, 8, 0, Math.PI * 2);
      
      let color = COLOR_NODE_OFF;
      if (node.lightState === 'GREEN_WAVE') color = COLOR_NODE_GREEN;
      if (node.lightState === 'PREEMPTION_HIGHLIGHT') color = COLOR_NODE_YELLOW;
      
      ctx.fillStyle = color;
      ctx.fill();
      
      // Intersection center dot
      ctx.beginPath();
      ctx.arc(node.pos.x, node.pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Glow effect for lights
      if (node.lightState !== 'NORMAL') {
         ctx.shadowBlur = 15;
         ctx.shadowColor = color;
         ctx.fill();
         ctx.shadowBlur = 0;
      }
    });

    // 3. Draw Hospital
    const hospitalNode = state.nodes.find(n => n.id === state.hospitalNodeId);
    if (hospitalNode) {
        const hx = hospitalNode.pos.x + 40; // Offset slightly from intersection
        const hy = hospitalNode.pos.y + 40;
        
        // Draw Path Connection
        ctx.beginPath();
        ctx.moveTo(hospitalNode.pos.x, hospitalNode.pos.y);
        ctx.lineTo(hx, hy);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#334155';
        ctx.stroke();

        // Building Box
        ctx.fillStyle = COLOR_HOSPITAL_BG;
        ctx.fillRect(hx - 20, hy - 20, 40, 40);
        ctx.strokeStyle = COLOR_HOSPITAL;
        ctx.lineWidth = 2;
        ctx.strokeRect(hx - 20, hy - 20, 40, 40);

        // H Symbol
        ctx.fillStyle = COLOR_HOSPITAL;
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H", hx, hy);
        
        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.fillText("CITY HOSPITAL", hx, hy + 30);
    }

    // 4. Draw Vehicles (With Lane Logic)
    state.vehicles.forEach(v => {
      const edge = state.edges.find(e => e.id === v.edgeId);
      const fromNode = state.nodes.find(n => n.id === edge?.from);
      const toNode = state.nodes.find(n => n.id === edge?.to);

      if (fromNode && toNode) {
        // Calculate position with Lane Offset
        const { x, y } = getLanePosition(
            fromNode.pos.x, 
            fromNode.pos.y, 
            toNode.pos.x, 
            toNode.pos.y, 
            v.progress, 
            LANE_OFFSET
        );

        ctx.beginPath();
        
        if (v.type === VehicleType.AMBULANCE) {
          // Ambulance Halo
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = COLOR_VEHICLE_EMERGENCY;
          ctx.shadowBlur = 15;
          ctx.shadowColor = COLOR_VEHICLE_EMERGENCY;
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // White Cross
          ctx.fillStyle = 'white';
          ctx.fillRect(x - 4, y - 1.5, 8, 3);
          ctx.fillRect(x - 1.5, y - 4, 3, 8);

        } else if (v.type === VehicleType.DELIVERY_BOT) {
          ctx.rect(x-5, y-5, 10, 10);
          ctx.fillStyle = v.stopped ? '#475569' : COLOR_VEHICLE_BOT; // Grey if stopped
          ctx.fill();
          
          if (v.stopped) {
              ctx.fillStyle = '#f87171';
              ctx.font = 'bold 10px Arial';
              ctx.fillText("!", x-1, y+3);
          }
        } else {
          // Civilian Car - Rectangular
          ctx.save();
          // Rotate to face direction
          const angle = Math.atan2(toNode.pos.y - fromNode.pos.y, toNode.pos.x - fromNode.pos.x);
          ctx.translate(x, y);
          ctx.rotate(angle);
          
          ctx.fillStyle = COLOR_VEHICLE_CIV;
          ctx.fillRect(-6, -3, 12, 6); // Car body
          ctx.fillStyle = '#1e293b'; // Windshield
          ctx.fillRect(0, -2.5, 3, 5);
          
          ctx.restore();
        }
      }
    });

  }, [state]);

  return (
    <div className="relative border border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-gray-900/50 backdrop-blur-sm">
        <div className="absolute bottom-4 right-4 flex gap-4 text-xs font-mono text-gray-500 bg-black/40 p-2 rounded border border-gray-800 pointer-events-none z-10">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span>AMBULANCE</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400"></div>
                <span>BOT</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                <span>GREEN WAVE</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-3 h-3 bg-red-100 rounded-sm">
                    <span className="text-[8px] text-red-500 font-bold">H</span>
                </div>
                <span>HOSPITAL</span>
            </div>
        </div>
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="w-full h-auto block"
      />
    </div>
  );
};

export default CityMap;