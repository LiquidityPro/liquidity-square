"use client";

import { PageHeader } from "@/components/square/page-chrome";
import { DraftList } from "@/components/square/drafts";

export default function DraftsPage() {
  return (
    <>
      <PageHeader title="Drafts" back />
      <DraftList />
    </>
  );
}
