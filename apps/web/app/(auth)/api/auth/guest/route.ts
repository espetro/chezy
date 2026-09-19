import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "~/app/(auth)/auth";
import { env } from "~/lib/env";
import { isDevelopmentEnvironment } from "~/lib/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (token) {
    const base = env.NEXT_PUBLIC_BASE_PATH ?? "";
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return signIn("guest", { redirect: true, redirectTo: redirectUrl });
}
