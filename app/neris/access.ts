export const NERIS_PILOT_EMAIL='bobff353@gmail.com';
// This is deliberately excluded from assignable employee/rank permissions.
export function nerisPilotAccess(email:string|null|undefined){return String(email??'').trim().toLowerCase()===NERIS_PILOT_EMAIL;}
