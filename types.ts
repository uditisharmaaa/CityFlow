export enum VehicleType {
  CIVILIAN = 'CIVILIAN',
  DELIVERY_BOT = 'DELIVERY_BOT',
  AMBULANCE = 'AMBULANCE'
}

export interface Coordinates {
  x: number;
  y: number;
}

export type TrafficLightState = 'NORMAL' | 'PREEMPTION_HIGHLIGHT' | 'GREEN_WAVE';

export interface Node {
  id: string;
  pos: Coordinates;
  lightState: TrafficLightState;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  edgeId: string;
  progress: number; // 0 to 1 along the edge
  speed: number;
  stopped: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYSTEM' | 'VISION' | 'TRAFFIC_AGENT' | 'LOGISTICS_AGENT';
  message: string;
  level: 'info' | 'warning' | 'alert' | 'success';
}

export interface SimulationState {
  nodes: Node[];
  edges: Edge[];
  vehicles: Vehicle[];
  emergencyActive: boolean;
  tickCount: number;
  activeRoute: Coordinates[]; // Path for Green Wave visualization
  hospitalNodeId: string; // ID of the destination node
}