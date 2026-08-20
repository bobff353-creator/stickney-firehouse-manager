import { Webhook } from "standardwebhooks";
import { getPublicSupabaseConfig } from "../../../supabase-config";

type EmailHookPayload = {
  user?: { email?: string; new_email?: string };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function confirmationUrl(payload: EmailHookPayload) {
  const email = payload.email_data;
  const supabaseUrl = getPublicSupabaseConfig().url;
  if (!supabaseUrl || !email?.token_hash || !email.email_action_type) return "";
  const verify = new URL("/auth/v1/verify", supabaseUrl);
  verify.searchParams.set("token", email.token_hash);
  verify.searchParams.set("type", email.email_action_type);
  verify.searchParams.set("redirect_to", email.redirect_to || "https://stickney-firehouse-manager.vercel.app/auth/confirm");
  return verify.toString();
}

export async function POST(request: Request) {
  const rawSecret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim() ?? "";
  const resendKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_EMAIL_FROM?.trim() ?? "";
  if (!rawSecret || !resendKey || !from) {
    return Response.json({ error: { http_code: 503, message: "Authentication email delivery is not configured." } }, { status: 503 });
  }

  const body = await request.text();
  let payload: EmailHookPayload;
  try {
    const secret = rawSecret.replace(/^v1,whsec_/, "");
    payload = new Webhook(secret).verify(body, Object.fromEntries(request.headers)) as EmailHookPayload;
  } catch (error) {
    console.error("Authentication email hook signature rejected", error instanceof Error ? error.message : "Unknown signature error");
    return Response.json({ error: { http_code: 401, message: "Invalid authentication email signature." } }, { status: 401 });
  }

  const to = payload.user?.email?.trim().toLowerCase() ?? "";
  const link = confirmationUrl(payload);
  if (!to || !link) {
    console.error("Authentication email hook payload incomplete", {
      hasRecipient: Boolean(to),
      hasTokenHash: Boolean(payload.email_data?.token_hash),
      actionType: payload.email_data?.email_action_type || "missing",
    });
    return Response.json({ error: { http_code: 400, message: "Authentication email data is incomplete." } }, { status: 400 });
  }

  const action = payload.email_data?.email_action_type === "recovery" ? "Reset your portal password" : "Confirm your Stickney Firehouse Manager email";
  const safeLink = escapeHtml(link);
  const delivery = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: action,
      text: `${action}: ${link}\n\nIf you did not request this, you can ignore this message.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#12344d"><h1 style="font-size:24px">${escapeHtml(action)}</h1><p>Use this secure link to continue to Stickney Firehouse Manager.</p><p><a href="${safeLink}" style="display:inline-block;background:#174f73;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700">Open secure portal</a></p><p style="font-size:13px;color:#526b7a">If you did not request this, you can ignore this message.</p></div>`,
    }),
  });
  if (!delivery.ok) {
    const providerMessage = (await delivery.text()).slice(0, 500);
    console.error("Resend rejected an authentication email", delivery.status, providerMessage);
    if (delivery.status === 403) {
      const domains = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${resendKey}` },
      }).then((response) => response.ok ? response.json() : null).catch(() => null) as { data?: Array<{ name?: string; status?: string }> } | null;
      console.error("Resend sending domains", (domains?.data ?? []).map((domain) => ({ name: domain.name, status: domain.status })));
    }
    return Response.json({ error: { http_code: 502, message: "The authentication email provider rejected the message." } }, { status: 502 });
  }
  return Response.json({});
}
