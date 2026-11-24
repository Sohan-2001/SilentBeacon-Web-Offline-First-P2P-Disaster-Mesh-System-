// SilentBeacon CRDT & Lamport Timestamp Ordering Engine
import { DistressTicket, TicketComment, TicketSummary, GossipMessage } from '../types';

export class CRDTEngine {
  private nodeId: string;
  private nodeName: string;
  private lamportClock: number = 0;
  private vectorClock: Record<string, number> = {};

  constructor(nodeId: string, nodeName: string, initialLamport: number = 0, initialVector: Record<string, number> = {}) {
    this.nodeId = nodeId;
    this.nodeName = nodeName;
    this.lamportClock = initialLamport;
    this.vectorClock = { ...initialVector, [nodeId]: initialLamport };
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getNodeName(): string {
    return this.nodeName;
  }

  public getLamport(): number {
    return this.lamportClock;
  }

  public getVectorClock(): Record<string, number> {
    return { ...this.vectorClock };
  }

  /**
   * Ticks local Lamport clock forward monotonically for local mutation
   */
  public tick(): number {
    this.lamportClock += 1;
    this.vectorClock[this.nodeId] = this.lamportClock;
    return this.lamportClock;
  }

  /**
   * Advances Lamport clock and vector clock upon receiving remote message
   */
  public receive(remoteLamport: number, remoteVector: Record<string, number> = {}): number {
    this.lamportClock = Math.max(this.lamportClock, remoteLamport) + 1;
    this.vectorClock[this.nodeId] = this.lamportClock;

    // Merge vector clocks (pairwise maximum)
    for (const [peerId, clock] of Object.entries(remoteVector)) {
      this.vectorClock[peerId] = Math.max(this.vectorClock[peerId] || 0, clock);
    }

    return this.lamportClock;
  }

  /**
   * Merge two tickets deterministically using Last-Write-Wins CRDT with Lamport Timestamps
   */
  public mergeTicket(
    local: DistressTicket | undefined,
    incoming: DistressTicket
  ): {
    result: DistressTicket;
    isNew: boolean;
    isUpdated: boolean;
    alarmTriggerNeeded: boolean;
  } {
    // Advance internal clock
    this.receive(incoming.lamportTimestamp, incoming.vectorClock);

    if (!local) {
      // Completely new ticket received via gossip hop
      const newHopCount = (incoming.hopCount || 0) + 1;
      const newRelayHistory = [...(incoming.relayHistory || [])];
      if (!newRelayHistory.includes(this.nodeId)) {
        newRelayHistory.push(this.nodeId);
      }

      const merged: DistressTicket = {
        ...incoming,
        hopCount: newHopCount,
        relayHistory: newRelayHistory,
        vectorClock: {
          ...incoming.vectorClock,
          [this.nodeId]: this.lamportClock
        }
      };

      const alarmTriggerNeeded = merged.urgency === 'CRITICAL' && merged.status === 'OPEN';

      return {
        result: merged,
        isNew: true,
        isUpdated: true,
        alarmTriggerNeeded
      };
    }

    // Both local and incoming exist. Evaluate CRDT precedence
    // 1. Lamport Timestamp comparison
    // 2. Tie break with updatedAt and deterministic string comparison
    let incomingWins = false;

    if (incoming.lamportTimestamp > local.lamportTimestamp) {
      incomingWins = true;
    } else if (incoming.lamportTimestamp === local.lamportTimestamp) {
      if (incoming.updatedAt > local.updatedAt) {
        incomingWins = true;
      } else if (incoming.updatedAt === local.updatedAt) {
        // Deterministic fallback: string comparison of ticket hashes or status priority
        // RESOLVED has higher semantic priority than OPEN in disaster coordination
        if (incoming.status === 'RESOLVED' && local.status !== 'RESOLVED') {
          incomingWins = true;
        }
      }
    }

    // Merge comments (CRDT Union of unique comment IDs)
    const commentMap = new Map<string, TicketComment>();
    for (const c of local.comments || []) {
      commentMap.set(c.id, c);
    }
    for (const c of incoming.comments || []) {
      if (!commentMap.has(c.id)) {
        commentMap.set(c.id, c);
      }
    }
    const mergedComments = Array.from(commentMap.values()).sort(
      (a, b) => a.lamport - b.lamport || a.timestamp - b.timestamp
    );

    // Merge relay history
    const mergedRelay = Array.from(
      new Set([...(local.relayHistory || []), ...(incoming.relayHistory || []), this.nodeId])
    );

    // Merge vector clocks
    const mergedVector: Record<string, number> = {
      ...(local.vectorClock || {}),
      ...(incoming.vectorClock || {}),
      [this.nodeId]: this.lamportClock
    };

    const winner = incomingWins ? incoming : local;
    const isUpdated = incomingWins || mergedComments.length !== (local.comments || []).length;

    const merged: DistressTicket = {
      ...winner,
      comments: mergedComments,
      relayHistory: mergedRelay,
      hopCount: Math.min(local.hopCount, (incoming.hopCount || 0) + 1),
      vectorClock: mergedVector,
      lamportTimestamp: Math.max(local.lamportTimestamp, incoming.lamportTimestamp)
    };

    // Alarm needed if transitioned to CRITICAL or was updated with new critical alert
    const alarmTriggerNeeded =
      merged.urgency === 'CRITICAL' &&
      merged.status === 'OPEN' &&
      (incomingWins || local.status !== 'OPEN');

    return {
      result: merged,
      isNew: false,
      isUpdated,
      alarmTriggerNeeded
    };
  }

  /**
   * Generates a lightweight digest of tickets for Phase 1 Epidemic Gossip Handshake
   */
  public generateDigest(tickets: DistressTicket[]): TicketSummary[] {
    return tickets.map((t) => ({
      id: t.id,
      lamportTimestamp: t.lamportTimestamp,
      updatedAt: t.updatedAt,
      status: t.status
    }));
  }

  /**
   * Evaluates a remote digest to determine which tickets this node needs (missing or newer on remote)
   * and which tickets remote is missing
   */
  public computeGossipDiff(
    localTickets: DistressTicket[],
    remoteDigest: TicketSummary[]
  ): {
    ticketsToRequest: string[]; // We need these from remote
    ticketsToOffer: DistressTicket[]; // Remote needs these from us
  } {
    const localMap = new Map<string, DistressTicket>();
    for (const t of localTickets) {
      localMap.set(t.id, t);
    }

    const remoteMap = new Map<string, TicketSummary>();
    for (const s of remoteDigest) {
      remoteMap.set(s.id, s);
    }

    const ticketsToRequest: string[] = [];
    const ticketsToOffer: DistressTicket[] = [];

    // Check remote tickets against local
    for (const remoteSummary of remoteDigest) {
      const local = localMap.get(remoteSummary.id);
      if (!local) {
        // We don't have this ticket at all!
        ticketsToRequest.push(remoteSummary.id);
      } else if (remoteSummary.lamportTimestamp > local.lamportTimestamp) {
        // Remote has newer revision
        ticketsToRequest.push(remoteSummary.id);
      }
    }

    // Check local tickets against remote
    for (const local of localTickets) {
      const remote = remoteMap.get(local.id);
      if (!remote) {
        // Remote doesn't have our ticket
        ticketsToOffer.push(local);
      } else if (local.lamportTimestamp > remote.lamportTimestamp) {
        // We have newer revision
        ticketsToOffer.push(local);
      }
    }

    return { ticketsToRequest, ticketsToOffer };
  }
}
