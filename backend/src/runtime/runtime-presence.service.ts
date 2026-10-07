import { Injectable } from '@nestjs/common';

/** Una pestaña envía latidos cada 10 s; los navegadores frenan los temporizadores de pestañas ocultas hasta ~1 por minuto */
const CLIENT_TTL_MS = 90_000;

@Injectable()
export class RuntimePresenceService {
  private readonly clients = new Map<string, { active: boolean; seenAt: number }>();

  heartbeat(clientId: string, active: boolean) {
    if (!clientId) return;
    const now = Date.now();
    this.prune(now);
    this.clients.set(clientId, { active, seenAt: now });
    if (!active) {
      setTimeout(() => {
        const current = this.clients.get(clientId);
        if (current && !current.active && current.seenAt === now) {
          this.clients.delete(clientId);
        }
      }, 75_000).unref();
    }
  }

  /** Pestañas activas que dieron señal recientemente (una pestaña que se cerró a la fuerza ya no cuenta) */
  activeCount() {
    const now = Date.now();
    this.prune(now);
    return [...this.clients.values()].filter((entry) => entry.active).length;
  }

  snapshot() {
    this.prune(Date.now());
    return {
      total: this.clients.size,
      active: this.activeCount(),
      clients: [...this.clients.entries()].map(([id, entry]) => ({ id, active: entry.active, seenAt: entry.seenAt })),
    };
  }

  private prune(now: number) {
    for (const [id, entry] of this.clients) {
      if (now - entry.seenAt > CLIENT_TTL_MS) this.clients.delete(id);
    }
  }
}
