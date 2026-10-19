export interface SessionIdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DraftRecoveryChannel {
  postMessage(message: unknown): void;
  addMessageListener(listener: (message: unknown) => void): void;
  removeMessageListener(listener: (message: unknown) => void): void;
}

export interface DraftRecoveryChannelFactory {
  create(name: string): DraftRecoveryChannel;
}

export interface DraftRecoveryCoordinatorOptions {
  sessionStorage?: SessionIdentityStorage;
  channelFactory?: DraftRecoveryChannelFactory;
  createWriterId?: () => string;
}

type ActiveWriterMessage = {
  type: 'active' | 'clear';
  uid: string;
  mapId: string;
  writerId: string;
};

const SESSION_KEY = 'markmap-aws:draft-recovery-writer-id';
const CHANNEL_NAME = 'markmap-aws:draft-recovery';

/**
 * BroadcastChannel only exposes advisory live-writer metadata. It never
 * broadcasts draft content or Firebase credentials; Firestore remains the
 * authority for cross-tab save conflicts.
 */
export class DraftRecoveryCoordinator {
  readonly writerId: string;
  private readonly channel: DraftRecoveryChannel | undefined;
  private readonly liveWriterIdsByMap = new Map<string, Set<string>>();
  private readonly subscribersByMap = new Map<string, Set<(writerIds: string[]) => void>>();

  constructor(options: DraftRecoveryCoordinatorOptions = {}) {
    const sessionStorage = options.sessionStorage ?? browserSessionStorage();
    this.writerId = readOrCreateWriterId(sessionStorage, options.createWriterId ?? createBrowserWriterId);
    this.channel = options.channelFactory?.create(CHANNEL_NAME) ?? browserChannelFactory()?.create(CHANNEL_NAME);
    this.channel?.addMessageListener(this.receiveMessage);
  }

  announceActive(uid: string, mapId: string): void {
    this.post({ type: 'active', uid, mapId, writerId: this.writerId });
  }

  clearActive(uid: string, mapId: string): void {
    this.post({ type: 'clear', uid, mapId, writerId: this.writerId });
  }

  subscribeToLiveWriters(uid: string, mapId: string, listener: (writerIds: string[]) => void): () => void {
    const key = mapKey(uid, mapId);
    const listeners = this.subscribersByMap.get(key) ?? new Set<(writerIds: string[]) => void>();
    listeners.add(listener);
    this.subscribersByMap.set(key, listeners);
    listener(this.liveWriterIds(key));

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.subscribersByMap.delete(key);
    };
  }

  private readonly receiveMessage = (message: unknown): void => {
    if (!isActiveWriterMessage(message) || message.writerId === this.writerId) return;

    const key = mapKey(message.uid, message.mapId);
    const writerIds = this.liveWriterIdsByMap.get(key) ?? new Set<string>();
    if (message.type === 'active') writerIds.add(message.writerId);
    else writerIds.delete(message.writerId);

    if (writerIds.size === 0) this.liveWriterIdsByMap.delete(key);
    else this.liveWriterIdsByMap.set(key, writerIds);
    this.notify(key);
  };

  private post(message: ActiveWriterMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // Advisory tab coordination must never block recovery or cloud saves.
    }
  }

  private notify(key: string): void {
    const listeners = this.subscribersByMap.get(key);
    if (!listeners) return;
    const writerIds = this.liveWriterIds(key);
    for (const listener of listeners) listener(writerIds);
  }

  private liveWriterIds(key: string): string[] {
    return [...(this.liveWriterIdsByMap.get(key) ?? [])].sort();
  }
}

function mapKey(uid: string, mapId: string): string {
  return `${uid}\u0000${mapId}`;
}

function isActiveWriterMessage(message: unknown): message is ActiveWriterMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Partial<ActiveWriterMessage>;
  return (candidate.type === 'active' || candidate.type === 'clear')
    && typeof candidate.uid === 'string'
    && typeof candidate.mapId === 'string'
    && typeof candidate.writerId === 'string';
}

function readOrCreateWriterId(storage: SessionIdentityStorage | undefined, createWriterId: () => string): string {
  try {
    const existing = storage?.getItem(SESSION_KEY);
    if (existing) return existing;
    const writerId = createWriterId();
    storage?.setItem(SESSION_KEY, writerId);
    return writerId;
  } catch {
    return createWriterId();
  }
}

function browserSessionStorage(): SessionIdentityStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

function browserChannelFactory(): DraftRecoveryChannelFactory | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  return {
    create(name) {
      const channel = new BroadcastChannel(name);
      const listeners = new Map<(message: unknown) => void, (event: MessageEvent<unknown>) => void>();
      return {
        postMessage: (message) => channel.postMessage(message),
        addMessageListener(listener) {
          const eventListener = (event: MessageEvent<unknown>) => listener(event.data);
          listeners.set(listener, eventListener);
          channel.addEventListener('message', eventListener);
        },
        removeMessageListener(listener) {
          const eventListener = listeners.get(listener);
          if (!eventListener) return;
          channel.removeEventListener('message', eventListener);
          listeners.delete(listener);
        }
      };
    }
  };
}

function createBrowserWriterId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `writer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
