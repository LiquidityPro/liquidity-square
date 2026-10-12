"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { ME, type Author } from "./data";

export function useCurrentAuthor(): Author {
  const { data: session } = useSession();
  const sessionName = session?.user?.name;
  const sessionEmail = session?.user?.email;

  return useMemo(() => {
    const name = sessionName || ME.name;
    const handle = sessionEmail ? sessionEmail.split("@")[0] : ME.handle;
    const initials =
      name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "LQ";

    return { ...ME, name, handle, initials };
  }, [sessionName, sessionEmail]);
}
