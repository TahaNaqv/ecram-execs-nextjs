import { readFleetImage } from "@/lib/fleet/image-store";

/** A photograph uploaded for a fleet vehicle. The path is a slug and a numbered image, nothing else. */
export async function GET(_request: Request, ctx: RouteContext<"/api/fleet-images/[id]/[file]">) {
  const { id, file } = await ctx.params;
  const image = await readFleetImage(id, file);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
