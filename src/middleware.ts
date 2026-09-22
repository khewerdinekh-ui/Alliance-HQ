import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isOnboardingRoute = path.startsWith("/onboarding");
  const isPublicRoute =
    isOnboardingRoute || path === "/contact" || path === "/subscription" || path.startsWith("/owner");

  // No session yet (first visit): only public routes are reachable —
  // /onboarding creates the anonymous session itself once the user submits
  // Join/Create.
  if (!user) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { count } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasOrg = (count ?? 0) > 0;

  if (!hasOrg && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  if (hasOrg && isOnboardingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/members";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
