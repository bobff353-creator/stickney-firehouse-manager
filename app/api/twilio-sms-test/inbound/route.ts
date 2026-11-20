// Deliberately silent: no body access, credentials, database writes or SMS calls.
// This replaces Twilio's trial auto-reply while all automatic texts are off.
export async function POST() {
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
