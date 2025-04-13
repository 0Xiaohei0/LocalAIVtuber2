type GlobalStateListener<K extends keyof GlobalState> = (value: GlobalState[K]) => void;

interface GlobalState {
    ttsLiveVolume: number;
    systemPrompt: string;
}

class GlobalStateManager {
  private state: GlobalState = {
    ttsLiveVolume: 0,
    systemPrompt: ""
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<keyof GlobalState, Set<GlobalStateListener<any>>> = new Map();

  subscribe<K extends keyof GlobalState>(key: K, listener: GlobalStateListener<K>) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    listener(this.state[key]);
    return () => {
      this.listeners.get(key)!.delete(listener);
    };
  }

  private notify<K extends keyof GlobalState>(key: K) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        listener(this.state[key]);
      }
    }
  }

  getState<K extends keyof GlobalState>(key: K): GlobalState[K] {
    return this.state[key];
  }

  updateState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.notify(key);
    }
  }
}

export const globalStateManager = new GlobalStateManager();