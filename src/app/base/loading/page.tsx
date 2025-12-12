import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import BaseClient from "../[id]/BaseClient";

export default async function CreatingBasePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <BaseClient
      baseId="creating"
      baseName="Untitled Base"
      tables={[]}
      user={session.user}
      loading
    />
  );
}
