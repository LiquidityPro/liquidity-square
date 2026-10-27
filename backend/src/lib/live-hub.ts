export type LiveFrame = {
  now: string;
  unreadCount?: number;
  unreadMessages?: number;
  posts: unknown[];
  notifications: unknown[];
  messages: unknown[];
  reads: { conversationId: string; readAt: string }[];
  removedPostIds?: string[];
  removedAuthorIds?: string[];
};

type Subscriber = {
  userId: string;
  send: (frame: LiveFrame) => void;
  close?: () => void;
};

const subscribers = new Set<Subscriber>();

/** In-process fan-out for the machines that are running right now. A Redis bus can publish into `liveFanout` later. */
export function liveFanout(build: (userId: string) => LiveFrame | null) {
  for (const subscriber of [...subscribers]) {
    let frame: LiveFrame | null;
    try {
      frame = build(subscriber.userId);
    } catch (error) {
      console.error("Live frame failed", error);
      continue;
    }
    if (!frame) continue;
    try {
      subscriber.send(frame);
    } catch (error) {
      console.error("Live send failed", error);
      subscribers.delete(subscriber);
    }
  }
}

export function liveUserIds() {
  return [...new Set([...subscribers].map((subscriber) => subscriber.userId))];
}

export function subscribeLive(userId: string, send: (frame: LiveFrame) => void, close?: () => void) {
  const subscriber = { userId, send, close };
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/** Ends open streams for an account that was just taken down. The client reconnects and is signed out. */
export function disconnectLive(userId: string) {
  for (const subscriber of [...subscribers]) {
    if (subscriber.userId !== userId) continue;
    subscribers.delete(subscriber);
    try {
      subscriber.close?.();
    } catch (error) {
      console.error("Live close failed", error);
    }
  }
}
