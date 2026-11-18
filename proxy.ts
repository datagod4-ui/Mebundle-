import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") ||
      host === "mebundle.vercel.app" || host.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  // Custom domains serve only the reseller storefront at the root URL.
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.next();

  try {
    const endpoint = new URL(supabaseUrl + "/functions/v1/mebundle-reseller");
    endpoint.searchParams.set("action", "resolve-domain");
    endpoint.searchParams.set("host", host);
    const response = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.next();
    const result = await response.json() as { slug?: string };
    if (!result.slug || !/^[a-z0-9-]{3,48}$/.test(result.slug)) return NextResponse.next();

    const destination = request.nextUrl.clone();
    destination.pathname = "/store/" + result.slug;
    return NextResponse.rewrite(destination);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/"],
};
