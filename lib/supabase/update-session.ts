import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/session";

/**
 * Refresh the Supabase auth cookies on the response.
 * This is the Next.js 16 proxy (the renamed middleware). Cookie writes here
 * are allowed; the same writes throw inside a Server Component.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return response;

  try {
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && request.cookies.get(DEMO_SESSION_COOKIE)) {
    response.cookies.set(DEMO_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return response;
  } catch {
    return NextResponse.next({ request });
  }
}
