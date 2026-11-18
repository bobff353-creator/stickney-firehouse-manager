import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

// One-time, server-authenticated provisioning of the verified existing maker.
// This function never accepts an arbitrary email, role, project, or department.
const project = 'qizfnynrspsydiuwkkex';
const email = 'bwyant@stickneyfire.com';
const userId = 'ed192761-2ecd-4ecc-a1e8-39ceb39f0145';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (url !== `https://${project}.supabase.co` || !key) return json({ error: 'Independent review project required.' }, 503);
  const proof = request.headers.get('x-review-server-proof') ?? '';
  if (!/^[a-f0-9]{96}$/.test(proof)) return json({ error: 'Server authentication required.' }, 401);
  const publishable = request.headers.get('apikey') ?? '';
  if (!publishable.startsWith('sb_publishable_')) return json({ error: 'The review publishable key is required.' }, 401);
  const proofClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const check = await proofClient.rpc('firehouse_server_sql', { p_sql: "SELECT 'review-owner-bootstrap' AS operation", p_mode: 'first', p_secret: proof });
  if (check.error || check.data?.operation !== 'review-owner-bootstrap') return json({ error: 'Server authentication failed.' }, 401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const department = await admin.from('departments').select('id').eq('slug', 'stickney-fire-department').single();
  if (department.error || !department.data?.id) return json({ error: 'Department configuration is unavailable.' }, 503);
  // Retain the verified source account's ID for historical foreign keys, while
  // creating an entirely new credential and no copied PIN or Auth session.
  let existing = await admin.auth.admin.getUserById(userId);
  if (!existing.data.user) {
    const created = await admin.auth.admin.createUser({ id: userId, email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID() });
    if (created.error || !created.data.user) return json({ error: 'The independent review identity could not be provisioned.' }, 503);
    existing = created;
  }
  if (existing.data.user?.email?.toLowerCase() !== email) return json({ error: 'The verified source identity does not match.' }, 409);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: 'https://stickney-power-apps-review.vercel.app/auth/confirm' } });
  if (link.error || !link.data?.user?.id || !link.data.properties?.hashed_token) return json({ error: 'The review invitation could not be generated.', code: link.error?.code ?? 'unavailable' }, 503);
  const membership = await admin.from('department_memberships').upsert({ department_id: department.data.id, user_id: link.data.user.id, role: 'admin', status: 'active' }, { onConflict: 'department_id,user_id' });
  if (membership.error) return json({ error: 'The review membership could not be provisioned.' }, 503);
  const activation = new URL('/auth/confirm', 'https://stickney-power-apps-review.vercel.app');
  activation.searchParams.set('token_hash', link.data.properties.hashed_token);
  activation.searchParams.set('type', 'magiclink');
  return json({ activationUrl: activation.href, userId: link.data.user.id });
});
