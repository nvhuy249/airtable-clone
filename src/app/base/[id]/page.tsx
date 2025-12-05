import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { serverCaller } from "~/trpc/server";
import BaseClient from "./BaseClient";

export default async function BasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const base = await serverCaller.base.byId({ id });

  if (!base) redirect("/");

  return (
    <BaseClient
      baseId={base.id}
      baseName={base.name}
      user={session.user}
    />
  );
}
