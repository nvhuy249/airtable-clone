import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { serverCaller } from "~/trpc/server";
import BaseClient from "./BaseClient";

export default async function BasePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const base = await serverCaller.base.byId({ id: params.id });

  if (!base) redirect("/");

  return (
    <BaseClient
      baseId={base.id}
      baseName={base.name}
      user={session.user}
    />
  );
}
