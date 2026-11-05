import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, sessionIdentity } from "@/lib/auth";
import Login from "@/components/login";
export const runtime = "nodejs";
export default async function AccessPage() {
  if (sessionIdentity((await cookies()).get(COOKIE)?.value)) redirect("/");
  return <Login />;
}
