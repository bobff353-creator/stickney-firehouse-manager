export type EmployeeAccount = { id: string; email: string; activated: boolean; verified: boolean; employeeId: string | null };
export type AccountSetup = { accounts: EmployeeAccount[]; invites: { email: string; status: string; expiresAt: string }[] };
export function accountStatus(employee: { id: string; email?: string | null }, setup: AccountSetup | null, now = Date.now()) {
  if (!setup) return { label: 'Not checked', detail: 'Account status has not been verified.' };
  const email = employee.email?.trim().toLowerCase();
  const accounts = setup.accounts.filter(a => a.employeeId === employee.id || a.email.toLowerCase() === email);
  if (accounts.some(a => a.activated && a.employeeId === employee.id)) return { label: 'Linked', detail: 'Verified sign-in, private PIN and employee link are ready.' };
  if (accounts.some(a => a.activated)) return { label: 'Activated', detail: 'Sign-in is ready. An administrator must resolve the employee link.' };
  if (accounts.some(a => a.verified)) return { label: 'Finish activation', detail: 'Email verified. Finish signing in and setting a private PIN.' };
  const invite = setup.invites.find(i => i.email.toLowerCase() === email && i.status === 'pending');
  if (invite) return Date.parse(invite.expiresAt) > now
    ? { label: 'Invited', detail: 'Invitation recorded; delivery is not confirmed. Open the email link and set a private PIN.' }
    : { label: 'Invite expired', detail: 'Send a new invitation when the employee is ready.' };
  return { label: 'Not invited', detail: 'Save a login email and Employee #, then choose Invite.' };
}
