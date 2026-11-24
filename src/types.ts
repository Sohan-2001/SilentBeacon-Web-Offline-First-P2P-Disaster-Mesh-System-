// SilentBeacon Types & Core Models

export type TicketUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TicketCategory = 
  | 'MEDICAL' 
  | 'TRAPPED' 
  | 'WATER_FOOD' 
  | 'SHELTER' 
  | 'FIRE_HAZARD' 
  | 'EVACUATION' 
  | 'GENERAL';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  landmark?: string;
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: number;
  lamport: number;
}

export interface DistressTicket {
  id: string;
  authorId: string;
  authorName: string;
  contactInfo?: string;
  urgency: TicketUrgency;
  category: TicketCategory;
  status: TicketStatus;
  title: string;
  description: string;
  casualties: number;
  location: GeoLocation;
  createdAt: number;
  updatedAt: number;
  
  // CRDT & Epidemic Gossip fields
  lamportTimestamp: number;
  vectorClock: Record<string, number>;
  hopCount: number;
  relayHistory: string[];
  
  // Coordination
  comments: TicketComment[];
  assignedRescuer?: {
    id: string;
    name: string;
    assignedAt: number;
  };
}

export interface PeerNode {
  id: string;
  name: string;
  transport: 'webrtc' | 'acoustic' | 'nfc' | 'broadcast' | 'ble';
  status: 'connected' | 'handshaking' | 'disconnected';
  lastSeen: number;
  vectorClock: Record<string, number>;
  syncedTicketsCount: number;
  rttMs?: number;
}

// Epidemic Gossip Protocol messages
export type GossipMessageType = 
  | 'DIGEST_REQ'      // Phase 1: Asking for known ticket IDs and lamport timestamps
  | 'DIGEST_RESP'     // Phase 1 reply: List of ticket summaries
  | 'DELTA_REQ'       // Phase 2: Requesting tickets with newer or missing IDs
  | 'DELTA_RESP'      // Phase 2 reply: Actual ticket payloads
  | 'CRITICAL_ALERT'  // Immediate high-priority broadcast hop
  | 'PING'
  | 'PONG';

export interface TicketSummary {
  id: string;
  lamportTimestamp: number;
  updatedAt: number;
  status: TicketStatus;
}

export interface GossipMessage {
  type: GossipMessageType;
  senderId: string;
  senderName: string;
  lamport: number;
  vectorClock: Record<string, number>;
  timestamp: number;
  payload?: any;
}

export interface MeshEventLog {
  id: string;
  timestamp: number;
  type: 'DISCOVERY' | 'HANDSHAKE' | 'SYNC' | 'CRDT_MERGE' | 'CRITICAL_ALARM' | 'ERROR';
  peerId?: string;
  peerName?: string;
  transport?: string;
  message: string;
  details?: any;
}

// Triage Guide Types
export interface TriageEvaluation {
  ableToWalk: boolean;
  spontaneousBreathing: boolean;
  respiratoryRate: number; // breaths per min
  radialPulsePresent: boolean;
  mentalStatusFollowsCommands: boolean;
}

export type TriageCategory = 'IMMEDIATE' | 'DELAYED' | 'MINOR' | 'DECEASED';
