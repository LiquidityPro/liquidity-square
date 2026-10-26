export type LiveFrame = {
  now: string;
  unreadCount?: number;
  unreadMessages?: number;
  posts: unknown[];
  notifications: unknown[];
  messages: unknown[];
  reads: { conversationId: string; readAt: string }[];
};

type Subscriber = {
  userId: string;
  send: (frame: LiveFrame) => void;
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

export function subscribeLive(userId: string, send: (frame: LiveFrame) => void) {
  const subscriber = { userId, send };
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}
