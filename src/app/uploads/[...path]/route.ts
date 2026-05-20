import { NextResponse } from "next/server";
import { mimeForExt, readUpload } from "@/lib/settings/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const bytes = await readUpload(relative);
  if (!bytes) {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = relative.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeForExt(ext),
      "Cache-Control": "public, max-age=300",
    },
  });
}
