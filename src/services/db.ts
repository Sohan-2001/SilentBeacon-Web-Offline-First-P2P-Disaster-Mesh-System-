// SilentBeacon Local-First IndexedDB Storage Layer
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DistressTicket, MeshEventLog, PeerNode } from '../types';

interface SilentBeaconDB extends DBSchema {
  tickets: {
    key: string;
    value: DistressTicket;
    indexes: {
      'by-urgency': string;
      'by-status': string;
      'by-lamport': number;
      'by-created': number;
    };
  };
  peers: {
    key: string;
    value: PeerNode;
    indexes: {
      'by-status': string;
      'by-lastSeen': number;
    };
  };
  logs: {
    key: string;
    value: MeshEventLog;
    indexes: {
      'by-timestamp': number;
    };
  };
  meta: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'silentbeacon_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SilentBeaconDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<SilentBeaconDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SilentBeaconDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Tickets table
        if (!db.objectStoreNames.contains('tickets')) {
          const ticketStore = db.createObjectStore('tickets', { keyPath: 'id' });
          ticketStore.createIndex('by-urgency', 'urgency');
          ticketStore.createIndex('by-status', 'status');
          ticketStore.createIndex('by-lamport', 'lamportTimestamp');
          ticketStore.createIndex('by-created', 'createdAt');
        }

        // Peers table
        if (!db.objectStoreNames.contains('peers')) {
          const peerStore = db.createObjectStore('peers', { keyPath: 'id' });
          peerStore.createIndex('by-status', 'status');
          peerStore.createIndex('by-lastSeen', 'lastSeen');
        }

        // Mesh Audit logs table
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-timestamp', 'timestamp');
        }

        // Node metadata & clocks
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// Node Identity & Clocks
export async function getNodeIdentity(): Promise<{
  nodeId: string;
  nodeName: string;
  lamport: number;
  vectorClock: Record<string, number>;
}> {
  const db = await getDB();
  let nodeId = await db.get('meta', 'nodeId');
  let nodeName = await db.get('meta', 'nodeName');
  let lamport = (await db.get('meta', 'lamport')) || 0;
  let vectorClock = (await db.get('meta', 'vectorClock')) || {};

  if (!nodeId) {
    nodeId = 'SB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    nodeName = 'Beacon-' + nodeId.slice(-4);
    await db.put('meta', nodeId, 'nodeId');
    await db.put('meta', nodeName, 'nodeName');
  }

  return { nodeId, nodeName, lamport, vectorClock };
}

export async function saveNodeIdentity(name: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', name, 'nodeName');
}

export async function saveClocks(lamport: number, vectorClock: Record<string, number>): Promise<void> {
  const db = await getDB();
  await db.put('meta', lamport, 'lamport');
  await db.put('meta', vectorClock, 'vectorClock');
}

// Tickets Operations
export async function getAllTickets(): Promise<DistressTicket[]> {
  const db = await getDB();
  const tickets = await db.getAll('tickets');
  // Sort by urgency priority then newest
  const urgencyPriority: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };
  return tickets.sort((a, b) => {
    const pA = urgencyPriority[a.urgency] || 0;
    const pB = urgencyPriority[b.urgency] || 0;
    if (pB !== pA) return pB - pA;
    return b.updatedAt - a.updatedAt;
  });
}

export async function getTicketById(id: string): Promise<DistressTicket | undefined> {
  const db = await getDB();
  return db.get('tickets', id);
}

export async function saveTicket(ticket: DistressTicket): Promise<void> {
  const db = await getDB();
  await db.put('tickets', ticket);
}

export async function saveTicketsBatch(tickets: DistressTicket[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tickets', 'readwrite');
  for (const t of tickets) {
    await tx.store.put(t);
  }
  await tx.done;
}

export async function deleteTicket(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tickets', id);
}

// Logs Operations
export async function addLog(log: Omit<MeshEventLog, 'id'>): Promise<MeshEventLog> {
  const db = await getDB();
  const fullLog: MeshEventLog = {
    ...log,
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
  };
  await db.put('logs', fullLog);

  // Prune logs if exceeding 200 items
  const count = await db.count('logs');
  if (count > 250) {
    const keys = await db.getAllKeysFromIndex('logs', 'by-timestamp');
    const toDelete = keys.slice(0, 50);
    const tx = db.transaction('logs', 'readwrite');
    for (const k of toDelete) {
      await tx.store.delete(k);
    }
    await tx.done;
  }

  return fullLog;
}

export async function getAllLogs(): Promise<MeshEventLog[]> {
  const db = await getDB();
  const logs = await db.getAll('logs');
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

// Peers Operations
export async function savePeer(peer: PeerNode): Promise<void> {
  const db = await getDB();
  await db.put('peers', peer);
}

export async function getAllPeers(): Promise<PeerNode[]> {
  const db = await getDB();
  return db.getAll('peers');
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('tickets');
  await db.clear('peers');
  await db.clear('logs');
}
