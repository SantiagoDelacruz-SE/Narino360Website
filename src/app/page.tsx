import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, sessionIdentity } from "@/lib/auth";
import { listActivities } from "@/lib/db";
import { readAssets } from "@/lib/media";
import Observatory from "@/components/observatory";
export const runtime = "nodejs";
export default async function Home() {
  const user = sessionIdentity((await cookies()).get(COOKIE)?.value);
  if (!user) redirect("/acceso");
  return (
    <Observatory
      user={user}
      initialActivities={listActivities()}
      initialAssets={readAssets()}
    />
  );
}
