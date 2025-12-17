import { type Metadata } from "next";
import { auth } from "~/server/auth";
import { redirect, notFound } from "next/navigation";
import { serverCaller } from "~/trpc/server";
import BaseClient from "./BaseClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const base = await serverCaller.base.byId({ id });

  if (!base) {
    notFound();
  }

  return { title: base.name };
}

export default async function BasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const base = await serverCaller.base.byId({ id });

  if (!base) {
    notFound()
  };

  return (
    <BaseClient
      baseId={base.id}
      baseName={base.name}
      tables={base.tables.map((t) => ({ id: t.id, name: t.name }))}
      user={session.user}
    />
  );
}
