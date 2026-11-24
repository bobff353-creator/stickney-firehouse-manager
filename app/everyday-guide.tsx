import type { PortalPage } from "./portal-navigation";
import type { InventoryWorkspaceView } from "./inventory-workspace-model";
import "./everyday-guide.css";
type Steps = { start: string; save: string; next: string };
export const everydaySteps: Partial<Record<PortalPage, Steps>> = {
  "Daily Log": { start: "Check the date and who is working. Open Staffing first.", save: "Use Confirm & Save Staffing when shown. Wait for the save message after edits.", next: "Check calls, vehicle checks, then Notes & Handoff. Officer sign-out is a separate step." },
  Scheduling: { start: "Use My schedule for your shifts. Use Coverage to find an open shift.", save: "Save changes or send your request, then check its status. A request is not a confirmed shift.", next: "Look for the shift on your schedule. Check Requests for a reply." },
  "Daily Duties": { start: "Read today's duties. Open a linked vehicle check to record results.", save: "Save results in the check. Reading a duty does not mark it done.", next: "Finish each required check. Your officer reviews the shift log." },
  "My Timesheet": { start: "Check the pay-period dates, then read your hours.", save: "You cannot change hours here. If they are wrong, use Request correction.", next: "Check the request's status here. A request does not change your hours by itself." },
  Timesheets: { start: "Pick the pay period, employee and day you want to review.", save: "If you can edit, hours save when you leave a field. Wait for Saved; retry any failed entry.", next: "Review the totals. Saving hours does not approve or close payroll." },
  Payroll: { start: "Check the pay period. Open a person's timesheet to review their hours.", save: "Wait for each save. Mark Reviewed and Finalize are separate actions.", next: "Resolve warnings and correction requests before closing the period." },
  "Work Details": { start: "Pick the people, date and times for the work detail.", save: "Use Submit for Approval. Check that the request appears in the queue.", next: "Wait for review. Entering a request does not approve pay." },
  Training: { start: "Choose Record completed training for a class or drill that already happened.", save: "Check the details and people. Save a draft if you are not ready to finish.", next: "Open History & reports to check the saved record. A draft does not earn training credit." },
  "Field Preplans": { start: "Search for a building or hydrant. Open its saved record.", save: "Use Edit if it is shown, then save the changed section. A device draft is not a department save.", next: "Open the saved brief to check it. Sending for review and publishing are separate steps." },
  "Safety Inspections": { start: "Choose the inspection form and check the date.", save: "Save draft to stop and return later. Submit inspection finishes the report.", next: "Open the saved report and check it. Saving or submitting does not send an email." },
  "Fire Inspections": { start: "Choose a property, then schedule or start the visit.", save: "If you can edit, use Save draft while you work. Check the saved result.", next: "Review findings before finishing. Sending a report is a separate action." },
  "NERIS Reporting": { start: "Start a report or choose a saved CAD call. Check the incident facts.", save: "Use Save draft while you work. Fix the items shown in Review.", next: "Check the saved report. Saving here does not submit it to NERIS." },
  EMS: { start: "Choose the document you need. Open PDF to read or fill it in.", save: "Save a completed PDF in your PDF app. Opening it does not save answers to this portal.", next: "Reopen your saved copy to check it. Use Add document only to add a reference or blank form." },
  Policies: { start: "Search for a policy, then open it to read.", save: "Reading does not change a policy. If you can edit, use Save & view after making changes.", next: "Check any acknowledgement step shown for the current version." },
  "Box Cards": { start: "Choose the department, then the box card you need.", save: "Reading does not change the card. Editors use Save & view to check a change.", next: "Check the card and its source. Opening a card does not dispatch units." },
  "Employee Contacts": { start: "Search for a member by name, rank or phone number.", save: "This list is read only. An administrator changes contact details in Employees.", next: "Tap a number or email to open your phone or mail app. Review before sending." },
  "Phone Numbers": { start: "Search for the person, department or service you need.", save: "Reading does not change a number. Editors use Save Contact after a change.", next: "Tap the number to open your phone app. Check it before calling." },
  Employees: { start: "Find the person in the roster, then choose Edit.", save: "Use Save Changes. Cancel returns to the roster without saving your edits.", next: "Check the saved profile. A login invitation is a separate action." },
};
export function inventoryEverydaySteps(view: InventoryWorkspaceView): Steps | undefined {
  if (["due", "fleet", "inventory"].includes(view)) return { start: "Pick your vehicle. Continue a saved check when one is shown.", save: "Check one item at a time. Wait for each result to save.", next: "Review and submit the whole check when ready. Officer approval is separate." };
  if (view === "check") return { start: "Check each item. If it is a bag or tool box, open it to check inside.", save: "Tap a result, or use Save for a reading. Wait for confirmation before moving on.", next: "Use the section controls, then Review & submit. Saving an item alone does not submit the check." };
  if (view === "equipment") return { start: "Search for an item or choose its vehicle. Open the item to see its details.", save: "Reading an item does not change it. Use its edit controls only if a change is needed.", next: "Clear the search to find another item. Open Checks to record a check." };
  if (view === "service") return { start: "Find a repair, or report a new problem.", save: "Save the report and check its status. Reporting a problem does not mark it repaired.", next: "Review the repair work before closing it. Keep the saved repair history." };
  if (view === "air") return { start: "Choose the vehicle, air pack or bottle you need.", save: "Use the item's save step after a change. Wait for confirmation.", next: "Start or resume its air check to record inspection results." };
  if (view === "reports") return { start: "Find the vehicle and check. Use View to open the full saved report.", save: "This is saved history. Approval or a request for changes is a separate action.", next: "A reviewer checks the results before approval. Print and email are separate controls." };
  return undefined;
}
export default function EverydayGuide({ page, inventoryView }: { page?: PortalPage; inventoryView?: InventoryWorkspaceView }) {
  const steps = inventoryView ? inventoryEverydaySteps(inventoryView) : page ? everydaySteps[page] : undefined;
  if (!steps) return null;
  return <section className="everyday-guide no-print" aria-label="Start, save and next step"><ol>{([["Start here", steps.start], ["How to save", steps.save], ["What's next", steps.next]] as const).map(([label, text], index) => <li key={label}><span className="everyday-step-number" aria-hidden="true">{index + 1}</span><div><strong>{label}</strong><p>{text}</p></div></li>)}</ol></section>;
}
