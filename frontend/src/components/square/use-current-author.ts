"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { ME, type Author } from "./data";

export function useCurrentAuthor(): Author {
  const { data: session } = useSession();
  const sessionId = session?.user?.id;
  const sessionName = session?.user?.name;
  const sessionEmail = session?.user?.email;
  const sessionImage = session?.user?.image;
  const sessionUsername = session?.user?.username;

  return useMemo(() => {
    const name = sessionName || ME.name;
    const handle = sessionUsername || (sessionEmail ? sessionEmail.split("@")[0] : ME.handle);
    const initials =
      name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "LQ";

    return { ...ME, id: sessionId, name, handle, initials, image: sessionImage ?? null };
  }, [sessionId, sessionName, sessionEmail, sessionUsername, sessionImage]);
}
