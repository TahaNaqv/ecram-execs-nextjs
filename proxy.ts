import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: sends visitors without a session cookie straight to the login page.
// Every admin page, query and Server Action still verifies the session against the database.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ee_admin_session")) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
