import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get("prefix")?.toUpperCase();

  if (!prefix || !/^[A-F0-9]{5}$/.test(prefix)) {
    return NextResponse.json({ error: "A valid 5-character SHA-1 prefix is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true"
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to query breach service." }, { status: 502 });
    }

    const body = await response.text();
    return NextResponse.json({ matches: body });
  } catch {
    return NextResponse.json({ error: "Breach service unavailable." }, { status: 502 });
  }
}
