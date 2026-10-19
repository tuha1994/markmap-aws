import { describe, expect, it, vi } from 'vitest';

import {
  DraftRecoveryCoordinator,
  type DraftRecoveryChannel,
  type DraftRecoveryChannelFactory,
  type SessionIdentityStorage
} from './draftRecoveryCoordinator';

class MemorySessionStorage implements SessionIdentityStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class MemoryChannelHub implements DraftRecoveryChannelFactory {
  readonly postedMessages: unknown[] = [];
  private readonly channels = new Set<MemoryChannel>();

  create(name: string): DraftRecoveryChannel {
    void name;
    const channel = new MemoryChannel(this);
    this.channels.add(channel);
    return channel;
  }

  broadcast(sender: MemoryChannel, message: unknown): void {
    this.postedMessages.push(message);
    for (const channel of this.channels) {
      if (channel !== sender) channel.deliver(message);
    }
  }
}

class MemoryChannel implements DraftRecoveryChannel {
  private readonly listeners = new Set<(message: unknown) => void>();

  constructor(private readonly hub: MemoryChannelHub) {}

  postMessage(message: unknown): void {
    this.hub.broadcast(this, message);
  }

  addMessageListener(listener: (message: unknown) => void): void {
    this.listeners.add(listener);
  }

  removeMessageListener(listener: (message: unknown) => void): void {
    this.listeners.delete(listener);
  }

  deliver(message: unknown): void {
    for (const listener of this.listeners) listener(message);
  }
}

describe('DraftRecoveryCoordinator', () => {
  it('persists one writer identity for the same tab session', () => {
    const sessionStorage = new MemorySessionStorage();
    const first = new DraftRecoveryCoordinator({ sessionStorage, createWriterId: () => 'writer-first' });
    const refreshed = new DraftRecoveryCoordinator({ sessionStorage, createWriterId: () => 'writer-second' });

    expect(first.writerId).toBe('writer-first');
    expect(refreshed.writerId).toBe('writer-first');
  });

  it('announces and clears active writers only for the subscribed UID and map', () => {
    const channels = new MemoryChannelHub();
    const current = new DraftRecoveryCoordinator({
      sessionStorage: new MemorySessionStorage(),
      channelFactory: channels,
      createWriterId: () => 'writer-current'
    });
    const other = new DraftRecoveryCoordinator({
      sessionStorage: new MemorySessionStorage(),
      channelFactory: channels,
      createWriterId: () => 'writer-other'
    });
    const snapshots: string[][] = [];
    const unsubscribe = current.subscribeToLiveWriters('user-a', 'map-1', (writerIds) => snapshots.push(writerIds));

    other.announceActive('user-b', 'map-1');
    other.announceActive('user-a', 'map-2');
    other.announceActive('user-a', 'map-1');
    other.clearActive('user-a', 'map-1');

    expect(snapshots).toEqual([[], ['writer-other'], []]);
    unsubscribe();
  });

  it('discovers an already-active same-map writer when a tab subscribes late', () => {
    const channels = new MemoryChannelHub();
    const active = new DraftRecoveryCoordinator({
      sessionStorage: new MemorySessionStorage(),
      channelFactory: channels,
      createWriterId: () => 'writer-active'
    });
    active.announceActive('user-a', 'map-1');
    const late = new DraftRecoveryCoordinator({
      sessionStorage: new MemorySessionStorage(),
      channelFactory: channels,
      createWriterId: () => 'writer-late'
    });
    const snapshots: string[][] = [];

    const unsubscribe = late.subscribeToLiveWriters('user-a', 'map-1', (writerIds) => snapshots.push(writerIds));

    expect(snapshots).toEqual([[], ['writer-active']]);
    expect(channels.postedMessages).toEqual([
      { type: 'active', uid: 'user-a', mapId: 'map-1', writerId: 'writer-active' },
      { type: 'hello', uid: 'user-a', mapId: 'map-1', writerId: 'writer-late' },
      { type: 'active', uid: 'user-a', mapId: 'map-1', writerId: 'writer-active' }
    ]);
    unsubscribe();
  });

  it('broadcasts only advisory UID, map, and writer metadata', () => {
    const channels = new MemoryChannelHub();
    const coordinator = new DraftRecoveryCoordinator({
      sessionStorage: new MemorySessionStorage(),
      channelFactory: channels,
      createWriterId: () => 'writer-a'
    });

    coordinator.announceActive('user-a', 'map-1');

    expect(channels.postedMessages).toEqual([{
      type: 'active',
      uid: 'user-a',
      mapId: 'map-1',
      writerId: 'writer-a'
    }]);
  });

  it('remains usable when sessionStorage and BroadcastChannel are unavailable', () => {
    const coordinator = new DraftRecoveryCoordinator({ createWriterId: () => 'ephemeral-writer' });
    const updates: string[][] = [];

    const unsubscribe = coordinator.subscribeToLiveWriters('user-a', 'map-1', (writerIds) => updates.push(writerIds));
    coordinator.announceActive('user-a', 'map-1');
    coordinator.clearActive('user-a', 'map-1');
    unsubscribe();

    expect(coordinator.writerId).toBe('ephemeral-writer');
    expect(updates).toEqual([[]]);
  });

  it('remains usable when the browser BroadcastChannel constructor throws', () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel blocked');
      }
    });

    try {
      const coordinator = new DraftRecoveryCoordinator({
        sessionStorage: new MemorySessionStorage(),
        createWriterId: () => 'ephemeral-writer'
      });
      const updates: string[][] = [];

      const unsubscribe = coordinator.subscribeToLiveWriters('user-a', 'map-1', (writerIds) => updates.push(writerIds));
      coordinator.announceActive('user-a', 'map-1');
      coordinator.clearActive('user-a', 'map-1');
      unsubscribe();

      expect(updates).toEqual([[]]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
