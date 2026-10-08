import { createContext, useContext, useState, ReactNode } from "react";
import { AUTHORS, ME, POSTS, type Post, extractTickers, type Stance } from "./data";

type SquareContextType = {
  posts: Post[];
  following: Set<string>;
  toggleFollow: (handle: string) => void;
  handlePost: (body: string, stance: Stance) => void;
};

const SquareContext = createContext<SquareContextType | null>(null);

export function SquareProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(POSTS);
  const [following, setFollowing] = useState<Set<string>>(
    () => new Set([AUTHORS.analyst1.handle, AUTHORS.macro.handle, ME.handle])
  );

  const toggleFollow = (handle: string) => {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  };

  const handlePost = (body: string, stance: Stance) => {
    setPosts((prev) => [
      {
        id: `local-${prev.length + 1}`,
        author: ME,
        time: "now",
        body,
        stance,
        tickers: extractTickers(body),
        replies: 0,
        reposts: 0,
        likes: 0,
      },
      ...prev,
    ]);
  };

  return (
    <SquareContext.Provider value={{ posts, following, toggleFollow, handlePost }}>
      {children}
    </SquareContext.Provider>
  );
}

export function useSquare() {
  const ctx = useContext(SquareContext);
  if (!ctx) throw new Error("useSquare must be used within a SquareProvider");
  return ctx;
}
