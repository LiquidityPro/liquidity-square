"use client";

import { useParams } from "next/navigation";
import { ConversationView } from "@/components/square/message-thread";

export default function MessageThreadPage() {
  const { id } = useParams() as { id: string };
  return <ConversationView conversationId={id} />;
}
