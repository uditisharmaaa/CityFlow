import { Edge, Node, SimulationState, Vehicle, VehicleType } from '../types';
import { GRID_SIZE, MAP_HEIGHT, MAP_WIDTH, VEHICLE_COUNT, DELIVERY_BOT_COUNT } from '../constants';
import { TrafficAgent, LogisticsAgent } from './agents';

// Helper to create grid city
const createCity = (): { nodes: Node[], edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  const cellWidth = MAP_WIDTH / (GRID_SIZE + 1);
  const cellHeight = MAP_HEIGHT / (GRID_SIZE + 1);

  // Create Nodes
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      nodes.push({
        id: `n_${x}_${y}`,
        pos: {
          x: (x + 1) * cellWidth,
          y: (y + 1) * cellHeight
        },
        lightState: 'NORMAL'
      });
    }
  }

  // Create Edges (Grid structure)
  nodes.forEach((node, i) => {
    const x = i % GRID_SIZE;
    const y = Math.floor(i / GRID_SIZE);

    if (x < GRID_SIZE - 1) {
      const right = nodes[i + 1];
      edges.push({ id: `e_${node.id}_${right.id}`, from: node.id, to: right.id });
      edges.push({ id: `e_${right.id}_${node.id}`, from: right.id, to: node.id });
    }
    if (y < GRID_SIZE - 1) {
      const bottom = nodes[i + GRID_SIZE];
      edges.push({ id: `e_${node.id}_${bottom.id}`, from: node.id, to: bottom.id });
      edges.push({ id: `e_${bottom.id}_${node.id}`, from: bottom.id, to: node.id });
    }
  });

  return { nodes, edges };
};

const { nodes, edges } = createCity();
const getRandomEdge = () => edges[Math.floor(Math.random() * edges.length)];
const hospitalNodeId = `n_${GRID_SIZE - 1}_${GRID_SIZE - 1}`;

export class SimulationEngine {
  state: SimulationState;
  private trafficAgent: TrafficAgent;
  private logisticsAgent: LogisticsAgent;
  private ambulancePathQueue: string[] = [];
  
  // Route state
  private plannedRouteEdges: string[] = [];

  constructor() {
    this.trafficAgent = new TrafficAgent();
    this.logisticsAgent = new LogisticsAgent();
    
    this.state = {
      nodes,
      edges,
      vehicles: this.spawnInitialVehicles(),
      emergencyActive: false,
      tickCount: 0,
      activeRoute: [],
      hospitalNodeId
    };
  }

  private spawnInitialVehicles(): Vehicle[] {
    const vehicles: Vehicle[] = [];
    for (let i = 0; i < VEHICLE_COUNT; i++) {
      vehicles.push({
        id: `civ_${i}`,
        type: VehicleType.CIVILIAN,
        edgeId: getRandomEdge().id,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.005,
        stopped: false
      });
    }
    for (let i = 0; i < DELIVERY_BOT_COUNT; i++) {
      vehicles.push({
        id: `delivery_${i}`,
        type: VehicleType.DELIVERY_BOT,
        edgeId: getRandomEdge().id,
        progress: Math.random(),
        speed: 0.003,
        stopped: false
      });
    }
    return vehicles;
  }

  reset() {
     this.state.vehicles = this.spawnInitialVehicles();
     this.state.emergencyActive = false;
     this.state.nodes.forEach(n => n.lightState = 'NORMAL');
     this.state.activeRoute = [];
     this.ambulancePathQueue = [];
     this.plannedRouteEdges = [];
     this.logisticsAgent.resumeFleet(this.state.vehicles);
  }

  injectAmbulance() {
    // Find a random edge that isn't too close to the hospital to ensure a good visual path
    let edge: Edge = getRandomEdge();
    let distance = 0;
    let attempts = 0;
    
    // Attempt to find a start point reasonably far from the hospital
    do {
        edge = this.state.edges[Math.floor(Math.random() * this.state.edges.length)];
        const fromNode = this.state.nodes.find(n => n.id === edge.from);
        const toNode = this.state.nodes.find(n => n.id === this.state.hospitalNodeId);
        
        if (fromNode && toNode) {
            distance = Math.sqrt(Math.pow(fromNode.pos.x - toNode.pos.x, 2) + Math.pow(fromNode.pos.y - toNode.pos.y, 2));
        }
        attempts++;
        // 200px is roughly 1/4 of the map width, good enough buffer
    } while ((distance < 200 || edge.to === this.state.hospitalNodeId) && attempts < 20);

    const ambulance: Vehicle = {
      id: 'ambulance_1',
      type: VehicleType.AMBULANCE,
      edgeId: edge.id,
      progress: 0,
      speed: 0.015,
      stopped: false
    };
    this.state.vehicles.push(ambulance);
    this.state.emergencyActive = true;
    return ambulance;
  }

  highlightTrafficLights() {
    this.state.nodes.forEach(n => n.lightState = 'PREEMPTION_HIGHLIGHT');
  }

  activateAgents() {
    const ambulance = this.state.vehicles.find(v => v.type === VehicleType.AMBULANCE);
    if (!ambulance) return;

    // 1. Traffic Agent: Route Planning (BFS finds shortest path)
    const route = this.trafficAgent.calculateEmergencyRoute(ambulance.edgeId, this.state.hospitalNodeId, this.state.edges);
    
    // Store route for execution
    this.ambulancePathQueue = [...route];
    this.plannedRouteEdges = [ambulance.edgeId, ...route]; // Include current edge for initial clearing
    
    // Visualize Route
    this.state.activeRoute = [];
    this.plannedRouteEdges.forEach(eid => {
       const e = this.state.edges.find(edge => edge.id === eid);
       if (!e) return;
       const n1 = this.state.nodes.find(n => n.id === e.from);
       const n2 = this.state.nodes.find(n => n.id === e.to);
       if (n1 && !this.state.activeRoute.find(p => p.x === n1.pos.x && p.y === n1.pos.y)) this.state.activeRoute.push(n1.pos);
       if (n2) this.state.activeRoute.push(n2.pos);
    });

    // Initial clear
    this.logisticsAgent.enforceClearance(this.state.vehicles, this.plannedRouteEdges);
  }

  tick() {
    this.state.tickCount++;

    const ambulance = this.state.vehicles.find(v => v.type === VehicleType.AMBULANCE);

    // --- CONTINUOUS AGENT ENFORCEMENT ---
    if (this.state.emergencyActive && this.plannedRouteEdges.length > 0 && ambulance && !ambulance.stopped) {
        // Enforce stopping logic dynamically. 
        // Only consider the current edge and future edges as "Active Route".
        // Vehicles on edges BEHIND the ambulance (already passed) should be free to move.
        const activeRouteEdges = [ambulance.edgeId, ...this.ambulancePathQueue];
        this.logisticsAgent.enforceClearance(this.state.vehicles, activeRouteEdges);
    } else if (ambulance?.stopped) {
         // If ambulance arrived, we can technically resume fleet, or keep them stopped.
         // Let's release the fleet once the ambulance is safe at hospital.
         this.logisticsAgent.resumeFleet(this.state.vehicles);
    }

    // --- SEQUENTIAL GREEN WAVE LOGIC ---
    if (this.state.emergencyActive && this.plannedRouteEdges.length > 0 && ambulance) {
        // Find where the ambulance currently is in the overall plan
        const currentIndex = this.plannedRouteEdges.indexOf(ambulance.edgeId);
        
        if (currentIndex !== -1) {
            const LOOK_AHEAD = 2; // How many lights ahead turn green

            // Iterate over the entire route plan to update lights strictly
            this.plannedRouteEdges.forEach((edgeId, index) => {
                const edge = this.state.edges.find(e => e.id === edgeId);
                if (!edge) return;
                
                const node = this.state.nodes.find(n => n.id === edge.to); // The light at the end of this edge
                if (!node) return;

                if (index < currentIndex) {
                    // PASSED: Revert to normal
                    if (node.lightState !== 'NORMAL') node.lightState = 'NORMAL';
                } 
                else if (index >= currentIndex && index <= currentIndex + LOOK_AHEAD) {
                    // IMMEDIATE PATH: Green Wave
                    node.lightState = 'GREEN_WAVE';
                } 
                else {
                    // FUTURE PATH: Keep Yellow/Highlighted (Preemption Warning)
                    // This ensures they don't turn green too early
                    if (node.lightState !== 'PREEMPTION_HIGHLIGHT') node.lightState = 'PREEMPTION_HIGHLIGHT';
                }
            });
        }
    }

    // --- VEHICLE MOVEMENT ---
    this.state.vehicles.forEach(v => {
      // PHYSICS: Deceleration Logic
      if (v.stopped) {
        if (v.speed > 0) {
            v.speed = Math.max(0, v.speed - 0.0005); // Brake rate
        }
        return; // Don't move if stopped
      } else {
        // Acceleration logic (restore speed if unstopped)
        const targetSpeed = v.type === VehicleType.DELIVERY_BOT ? 0.003 : 0.008;
        if(v.type === VehicleType.AMBULANCE) {
           // Ambulance maintains high speed
        } else if (v.speed < targetSpeed) {
            v.speed += 0.0002;
        }
      }

      v.progress += v.speed;

      if (v.progress >= 1) {
        const currentEdge = this.state.edges.find(e => e.id === v.edgeId);
        if (currentEdge) {
            
          if (v.type === VehicleType.AMBULANCE && this.ambulancePathQueue.length > 0) {
              const nextEdgeId = this.ambulancePathQueue.shift();
              if (nextEdgeId) {
                  v.edgeId = nextEdgeId;
                  v.progress = 0;
              } else {
                  // End of Queue: Reached Hospital
                  v.progress = 1; 
                  v.stopped = true; 
                  // Reset lights when arrived
                  this.state.nodes.forEach(n => n.lightState = 'NORMAL');
              }
          } else if (v.type === VehicleType.AMBULANCE && this.ambulancePathQueue.length === 0) {
             // Redundant safety check for arrival
             v.progress = 1;
             v.stopped = true;
          } else {
              // Standard Vehicle Logic
              const nextEdges = this.state.edges.filter(e => e.from === currentEdge.to);
              if (nextEdges.length > 0) {
                const nextEdge = nextEdges[Math.floor(Math.random() * nextEdges.length)];
                v.edgeId = nextEdge.id;
                v.progress = 0;
              } else {
                 v.progress = 0; // Loop or stuck
              }
          }
        }
      }
    });

    return { ...this.state };
  }
}