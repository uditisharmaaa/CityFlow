import { Edge, Node, Vehicle, VehicleType } from '../types';

/**
 * TrafficAgent: Responsible for Route Optimization and Signal Preemption (Green Wave)
 */
export class TrafficAgent {
  
  /**
   * Calculates the shortest path using Breadth-First Search
   */
  calculateEmergencyRoute(startEdgeId: string, targetNodeId: string, edges: Edge[]): string[] {
    const startEdge = edges.find(e => e.id === startEdgeId);
    if (!startEdge) return [];

    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startEdge.to, path: [] }];
    const visited = new Set<string>();
    visited.add(startEdge.to);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      if (nodeId === targetNodeId) {
        return path;
      }

      const outgoing = edges.filter(e => e.from === nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({ nodeId: edge.to, path: [...path, edge.id] });
        }
      }
    }
    return [];
  }

  /**
   * Helper to identify which nodes need to change for a given set of active route edges.
   */
  getNodesForRoute(nodes: Node[], edges: Edge[], routeEdgeIds: string[]): string[] {
    const affectedNodeIds = new Set<string>();
    routeEdgeIds.forEach(edgeId => {
      const edge = edges.find(e => e.id === edgeId);
      if (edge) {
        affectedNodeIds.add(edge.to); // The light at the end of the edge
      }
    });
    return Array.from(affectedNodeIds);
  }
}

/**
 * LogisticsAgent: Responsible for Fleet Management and Collision Avoidance
 */
export class LogisticsAgent {
  
  /**
   * Enforce Clearance: Continuously checks vehicles. 
   * Stops those on the route, Resumes those not on the route.
   */
  enforceClearance(vehicles: Vehicle[], routeEdgeIds: string[]) {
    const routeSet = new Set(routeEdgeIds);
    vehicles.forEach(v => {
      // Ambulance is exempt from logistics agent control
      if (v.type === VehicleType.AMBULANCE) return;

      if (routeSet.has(v.edgeId)) {
        // If on the path, STOP
        v.stopped = true;
      } else {
        // If not on the path, ENSURE MOVING (Release if previously stopped)
        v.stopped = false;
      }
    });
  }

  /**
   * Resumes fleet operations for all
   */
  resumeFleet(vehicles: Vehicle[]) {
    vehicles.forEach(v => {
      if (v.type === VehicleType.DELIVERY_BOT || v.type === VehicleType.CIVILIAN) {
        v.stopped = false;
      }
    });
  }
}