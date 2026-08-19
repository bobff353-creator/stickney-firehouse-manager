import { ensureDatabase } from "../../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com", "bwyant@stickneyfire.com"];
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 3 * 1024 * 1024;

type PhotoBucket = {
  get(key: string): Promise<{ body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

async function bucket() {
  const { env } = await import("@/app/cf-env");
  const value = (env as unknown as { BUCKET?: PhotoBucket }).BUCKET;
  if (!value) throw new Error("Employee photo storage is unavailable");
  return value;
}

async function isAdmin(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const db = await ensureDatabase();
  const profile = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
  return Boolean(profile?.isAdmin);
}

function employeePhotoKey(employeeId: string) {
  return `employees/${employeeId}/profile`;
}

export async function GET(_request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const { employeeId } = await context.params;
    if (!employeeId) return Response.json({ error: "Employee is required" }, { status: 400 });
    const object = await (await bucket()).get(employeePhotoKey(employeeId));
    if (!object) return Response.json({ error: "No employee photo" }, { status: 404 });
    const headers = new Headers({
      "content-type": object.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "private, max-age=86400",
    });
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch {
    return Response.json({ error: "Employee photo is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    if (!(await isAdmin(request))) return Response.json({ error: "Administrator privileges are required to change employee photos." }, { status: 403 });
    const { employeeId } = await context.params;
    const db = await ensureDatabase();
    const employee = await db.prepare("SELECT id FROM employees WHERE id = ? AND active = 1").bind(employeeId).first();
    if (!employee) return Response.json({ error: "Save the employee before uploading a photo." }, { status: 404 });
    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return Response.json({ error: "Choose a photo to upload." }, { status: 400 });
    if (!allowedTypes.has(photo.type)) return Response.json({ error: "Use a JPG, PNG, or WebP photo." }, { status: 400 });
    if (photo.size <= 0 || photo.size > maxPhotoBytes) return Response.json({ error: "Employee photos must be smaller than 3 MB." }, { status: 400 });
    await (await bucket()).put(employeePhotoKey(employeeId), photo.stream(), { httpMetadata: { contentType: photo.type } });
    const updatedAt = new Date().toISOString();
    await db.prepare("UPDATE employee_profiles SET photo_updated_at = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?").bind(updatedAt, employeeId).run();
    return Response.json({ ok: true, photoUpdatedAt: updatedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save employee photo" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    if (!(await isAdmin(request))) return Response.json({ error: "Administrator privileges are required to remove employee photos." }, { status: 403 });
    const { employeeId } = await context.params;
    await (await bucket()).delete(employeePhotoKey(employeeId));
    const db = await ensureDatabase();
    await db.prepare("UPDATE employee_profiles SET photo_updated_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?").bind(employeeId).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to remove employee photo" }, { status: 500 });
  }
}
