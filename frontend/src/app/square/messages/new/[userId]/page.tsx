"use client";

import { useParams } from "next/navigation";
import { NewConversation } from "@/components/square/message-thread";

export default function NewMessagePage() {
  const { userId } = useParams() as { userId: string };
  return <NewConversation userId={userId} />;
}
