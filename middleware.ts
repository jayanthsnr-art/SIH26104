import { NextResponse, type NextRequest } from "next/server";

const allowedOrigins = new Set(
  (process.env.RESOGUARD_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isAllowed = origin !== null && allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Vary", "Origin");
    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.headers.set("Access-Control-Max-Age", "600");
    }
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("Vary", "Origin");
  if (isAllowed) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
