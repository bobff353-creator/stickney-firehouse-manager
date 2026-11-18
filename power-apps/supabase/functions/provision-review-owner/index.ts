import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// First-time review setup is complete. This endpoint can no longer create
// identities, change membership, or issue activation credentials.
Deno.serve(() => new Response(JSON.stringify({ error: 'Review account setup is complete. Use the normal portal sign-in or recovery flow.' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
}));
