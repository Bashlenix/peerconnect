import { randomUUID } from "node:crypto";

export interface SSEWritable {
  write(chunk: string): boolean | void;
  writableEnded: boolean;
  destroyed: boolean;
}

export class SSEManager {
  private readonly connections = new Map<string, Map<string, SSEWritable>>();

  register(userId: string, res: SSEWritable): string {
    const connId = randomUUID();
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map());
    }
    this.connections.get(userId)!.set(connId, res);
    return connId;
  }

  unregister(userId: string, connId: string): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;
    userConns.delete(connId);
    if (userConns.size === 0) this.connections.delete(userId);
  }

  push(userId: string, event: string, data: unknown): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const stale: string[] = [];

    for (const [connId, res] of userConns) {
      if (res.writableEnded || res.destroyed) {
        stale.push(connId);
        continue;
      }
      try {
        res.write(message);
      } catch {
        stale.push(connId);
      }
    }

    for (const connId of stale) userConns.delete(connId);
    if (userConns.size === 0) this.connections.delete(userId);
  }
}

export const sseManager = new SSEManager();
