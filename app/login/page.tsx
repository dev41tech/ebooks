import { redirect } from "next/navigation";
import { getUser, safeReturnPath } from "../auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { return_to } = await searchParams;
  const returnTo = safeReturnPath(return_to || "/");

  if (await getUser()) redirect(returnTo);

  return <LoginForm returnTo={returnTo} />;
}
