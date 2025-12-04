import PageClient from "./PageClient";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { serverCaller } from "~/trpc/server";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const bases = await serverCaller.base.list();

  return (
    <PageClient user={session.user} bases={bases} />
  );
}
