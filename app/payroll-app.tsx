"use client";
/* eslint-disable @next/next/no-img-element -- direct static assets avoid runtime image-proxy failures for the department patch. */

import { useCallback, useEffect, useMemo, useState } from "react";
import DailyLog from "./daily-log";
import HolidayPolicy from "./holiday-policy";
import PhoneNumbers from "./phone-numbers";
import EmployeeContacts from "./employee-contacts";
import { BoxCardsPage, PoliciesPage } from "./resource-pages";
import RoleDashboard from "./role-dashboard";
import ConfirmDialog from "./confirm-dialog";
import { RecordCredibility, type Revision } from "./record-credibility";
import OperationsBoard from "./operations-board";
import ActivityTimeline from "./activity-timeline";
import SmartAlerts from "./smart-alerts";
import PwaInstall from "./pwa-install";
import CommandCenter from "./command-center";
import DailyDuties from "./daily-duties";
import { compareEmployeeNames, employeeNameFromParts, formatEmployeeName, splitEmployeeName } from "./employee-names";
import { roundPayrollUpToCent } from "./payroll-rounding";
import { ACTING_OFFICER_STIPEND_PER_HOUR, calculateGrossPay } from "./payroll-calculation";
import { payrollExportRows } from "./payroll-export";
import WorkDetails from "./work-details";
import Scheduling from "./scheduling";
import PermissionSettings from "./permission-settings";
import FieldPreplans from "./field-preplans";
import CadIntegrationSettings from "./cad-integration-settings";
import Respond from "./respond";
import IncidentCommandBoard from "./incident-command-board";
import RespondDeviceSettingsPage from "./respond-device-settings";
import DepartmentSettings from "./department-settings";
import { defaultRespondDeviceSettings, readRespondDeviceSettings, RESPOND_ALERT_DURATION_SECONDS, type RespondDeviceSettings } from "./respond-device";

type Category = "shift" | "drill" | "workDetail" | "callback" | "actingOfficer" | "holiday" | "dpw";
type PayScale = { id: string; label: string; regularRate: number; overtimeRate: number; holidayRate: number };
type PayRateHistory = PayScale & { payScaleId: string; effectiveDate: string; createdBy?: string; createdAt?: string };
type Employee = PayScale & {
  id: string; name: string; payScaleId: string; rank: string; active: number;
  employeeNumber?: string | null; startDate?: string | null; endDate?: string | null; dateOfBirth?: string | null;
  phone?: string | null; email?: string | null; addressLine1?: string | null; city?: string | null;
  state?: string | null; postalCode?: string | null; employmentType?: string | null; isDpw?: number | boolean; driverStatus?: string | null; actingOfficerEligible?: number | boolean; scheduleSmsOptIn?: number | boolean; isAdmin?: number | boolean;
  emergencyName?: string | null; emergencyRelationship?: string | null; emergencyPhone?: string | null; photoUpdatedAt?: string | null; notes?: string | null;
};
type EmployeeForm = {
  id?: string; lastName: string; firstName: string; payScaleId: string; employeeNumber: string; startDate: string; endDate: string;
  dateOfBirth: string; phone: string; email: string; addressLine1: string; city: string; state: string;
  postalCode: string; employmentType: string; isDpw: boolean; driverStatus: string; actingOfficerEligible: boolean; scheduleSmsOptIn: boolean; isAdmin: boolean; emergencyName: string; emergencyRelationship: string;
  emergencyPhone: string; notes: string;
};
type Entry = { id?: string; employeeId: string; workDate: string; category: Category; hours: number };
type PayrollData = {
  period: { startDate: string; endDate: string; status: "draft" | "reviewed" | "finalized"; createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string; finalizedBy?: string; finalizedAt?: string; revisions?: Revision[] };
  employees: Employee[];
  entries: Entry[];
  payScales: PayScale[];
  rateHistory: PayRateHistory[];
  settings: { overtimeThreshold: number; actingOfficerPremium: number; dpwMultiplier: number };
  viewer: { email: string; isAdmin: boolean; employeeId: string | null; displayName: string };
};
type GlobalSearchItem = { id: string; type: "Employee" | "Contact" | "Policy" | "Box Card" | "Important Number" | "Preplan" | "Screen"; title: string; detail: string; page: NavItem };
type IconName = "home" | "log" | "box" | "users" | "phone" | "payroll" | "clock" | "rates" | "document" | "holiday" | "settings" | "search" | "bell" | "menu" | "close" | "filter" | "export" | "back" | "next" | "save" | "warning" | "chevron";

type NavItem = "Dashboard" | "Command Center" | "Operations Board" | "Activity Timeline" | "Respond" | "Command Board" | "Field Preplans" | "Scheduling" | "Payroll" | "Work Details" | "Daily Log" | "Timesheets" | "My Timesheet" | "Employees" | "Employee Contacts" | "Policies" | "Box Cards" | "Holiday Policy" | "Daily Duties" | "Inventory" | "Phone Numbers" | "Rates & Rules" | "Departments" | "Permissions" | "CAD Integration" | "Respond Device Modes" | "Test View";
const adminNavItems: NavItem[] = ["Dashboard", "Command Center", "Operations Board", "Activity Timeline", "Respond", "Command Board", "Field Preplans", "Scheduling", "Payroll", "Work Details", "Daily Log", "Timesheets", "My Timesheet", "Employees", "Employee Contacts", "Policies", "Box Cards", "Holiday Policy", "Daily Duties", "Inventory", "Phone Numbers", "Rates & Rules", "Departments", "Permissions", "CAD Integration", "Respond Device Modes", "Test View"];
const employeeNavItems: NavItem[] = ["Dashboard", "Operations Board", "Respond", "Command Board", "Field Preplans", "Scheduling", "My Timesheet", "Policies", "Box Cards", "Daily Duties", "Inventory"];
const navIcons: Record<NavItem, IconName> = { Dashboard: "home", "Command Center": "rates", "Operations Board": "log", "Activity Timeline": "clock", Respond: "log", "Command Board": "warning", "Field Preplans": "search", Scheduling: "clock", Payroll: "payroll", "Work Details": "document", "Daily Log": "log", Timesheets: "clock", "My Timesheet": "clock", Employees: "users", "Employee Contacts": "phone", Policies: "document", "Box Cards": "box", "Holiday Policy": "holiday", "Daily Duties": "clock", Inventory: "box", "Phone Numbers": "phone", "Rates & Rules": "rates", Departments: "settings", Permissions: "settings", "CAD Integration": "settings", "Respond Device Modes": "settings", "Test View": "users" };
const adminNavGroups: Array<{ label: string; icon: IconName; items: Array<{ label: string; page: NavItem }> }> = [
  { label: "Operations", icon: "log", items: [{ label: "Command Center", page: "Command Center" }, { label: "Live Operations Board", page: "Operations Board" }, { label: "Activity Timeline", page: "Activity Timeline" }, { label: "Daily Log", page: "Daily Log" }, { label: "Box Cards", page: "Box Cards" }] },
  { label: "Field", icon: "search", items: [{ label: "Respond", page: "Respond" }, { label: "Command Board", page: "Command Board" }, { label: "Preplans", page: "Field Preplans" }] },
  { label: "Scheduling", icon: "clock", items: [{ label: "Schedule Command", page: "Scheduling" }] },
  { label: "Personnel", icon: "users", items: [{ label: "Employees", page: "Employees" }, { label: "Contacts", page: "Employee Contacts" }] },
  { label: "Payroll", icon: "payroll", items: [{ label: "Payroll", page: "Payroll" }, { label: "Work Detail", page: "Work Details" }, { label: "Timesheets", page: "Timesheets" }, { label: "Rates", page: "Rates & Rules" }] },
  { label: "Documents", icon: "document", items: [{ label: "Policies", page: "Policies" }, { label: "Holiday Policy", page: "Holiday Policy" }] },
  { label: "Station Duties", icon: "clock", items: [{ label: "Daily Duties", page: "Daily Duties" }, { label: "Inventory", page: "Inventory" }] },
  { label: "Settings", icon: "settings", items: [{ label: "Departments", page: "Departments" }, { label: "Important Phone Numbers", page: "Phone Numbers" }, { label: "Permissions", page: "Permissions" }, { label: "CIS CAD Integration", page: "CAD Integration" }, { label: "Respond Device Modes", page: "Respond Device Modes" }, { label: "Test as Member", page: "Test View" }] },
];
const navPermission: Partial<Record<NavItem, string>> = { Dashboard: "dashboard.view", "Command Center": "command_center.view", "Operations Board": "operations_board.view", "Activity Timeline": "command_center.view", Respond: "field_preplans.view", "Command Board": "incident_command.view", "Field Preplans": "field_preplans.view", Scheduling: "scheduling.view", Payroll: "payroll.manage", "Work Details": "scheduling.manage", "Daily Log": "daily_log.view", Timesheets: "payroll.manage", "My Timesheet": "payroll.view_own", Employees: "employees.manage", "Employee Contacts": "contacts.view", Policies: "documents.view", "Box Cards": "documents.view", "Holiday Policy": "documents.view", "Daily Duties": "documents.view", Inventory: "documents.view", "Phone Numbers": "settings.manage", "Rates & Rules": "payroll.manage", Departments: "settings.manage", Permissions: "permissions.manage", "CAD Integration": "permissions.manage", "Respond Device Modes": "settings.manage", "Test View": "permissions.manage" };
const memberStationDutyItems = new Set<NavItem>(["Daily Duties", "Inventory"]);
const emptyEmployee: EmployeeForm = {
  lastName: "", firstName: "", payScaleId: "firefighter", employeeNumber: "", startDate: "", endDate: "", dateOfBirth: "",
  phone: "", email: "", addressLine1: "", city: "", state: "IL", postalCode: "", employmentType: "Part-time", isDpw: false, driverStatus: "", actingOfficerEligible: false, scheduleSmsOptIn: false, isAdmin: false,
  emergencyName: "", emergencyRelationship: "", emergencyPhone: "", notes: "",
};
const categoryColumns: Array<{ key: Category; short: string; label: string }> = [
  { key: "shift", short: "Shift", label: "Shift" },
  { key: "drill", short: "Drill", label: "Drill" },
  { key: "workDetail", short: "Detail", label: "Work Detail" },
  { key: "callback", short: "Callback", label: "Call Back" },
  { key: "actingOfficer", short: "AO", label: "Acting Officer" },
  { key: "holiday", short: "Holiday", label: "Holiday" },
  { key: "dpw", short: "DPW", label: "DPW Assignment" },
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function currentPeriodStart() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  if (day >= 26) return isoDate(year, month, 26);
  if (day >= 11) return isoDate(year, month, 11);
  const previous = new Date(year, month - 1, 26);
  return isoDate(previous.getFullYear(), previous.getMonth(), 26);
}

function shiftPeriod(start: string, direction: -1 | 1) {
  const date = new Date(`${start}T12:00:00`);
  const day = date.getDate();
  if (direction === 1) {
    if (day === 11) return isoDate(date.getFullYear(), date.getMonth(), 26);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 11);
    return isoDate(next.getFullYear(), next.getMonth(), 11);
  }
  if (day === 26) return isoDate(date.getFullYear(), date.getMonth(), 11);
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 26);
  return isoDate(previous.getFullYear(), previous.getMonth(), 26);
}

function listDates(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const finish = new Date(`${end}T12:00:00`);
  while (cursor <= finish) {
    dates.push(isoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function periodLabel(start: string, end: string) {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const monthA = a.toLocaleDateString("en-US", { month: "long" });
  const monthB = b.toLocaleDateString("en-US", { month: "long" });
  return a.getMonth() === b.getMonth()
    ? `${monthA} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`
    : `${monthA} ${a.getDate()}–${monthB} ${b.getDate()}, ${b.getFullYear()}`;
}

function dayLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const displayName = formatEmployeeName;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function safeNumber(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="line-icon" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>
    {name === "home" && <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>}
    {name === "log" && <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM9 11h6M9 15h6"/></>}
    {name === "box" && <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 0 10 8 4 8-4V7M12 11v10"/></>}
    {name === "users" && <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.8M17 13a4 4 0 0 1 3.5 4v3"/></>}
    {name === "phone" && <path d="M5 3h4l2 5-2.5 1.8a15 15 0 0 0 5.7 5.7L16 13l5 2v4c0 1.1-.9 2-2 2C10.2 21 3 13.8 3 5c0-1.1.9-2 2-2Z"/>}
    {name === "payroll" && <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4M7 13h2M15 9v6M13 11h4M13 15h4"/></>}
    {name === "clock" && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    {name === "rates" && <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>}
    {name === "document" && <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>}
    {name === "holiday" && <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><circle cx="12" cy="12" r="3"/></>}
    {name === "settings" && <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6.2L14.7 3h-4L10 6.2a7 7 0 0 0-1.5.9l-2.4-1-2 3.4L6.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.5.9l.7 3.2h4l.3-3.2a7 7 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></>}
    {name === "search" && <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>}
    {name === "bell" && <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 8H3c0-1 3-1 3-8M10 21h4"/></>}
    {name === "menu" && <path d="M4 7h16M4 12h16M4 17h16"/>}
    {name === "close" && <path d="m6 6 12 12M18 6 6 18"/>}
    {name === "filter" && <path d="M4 5h16l-6 7v6l-4 2v-8z"/>}
    {name === "export" && <><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/></>}
    {name === "back" && <path d="m15 5-7 7 7 7"/>}{name === "next" && <path d="m9 5 7 7-7 7"/>}
    {name === "save" && <path d="m5 12 4 4L19 6"/>}
    {name === "warning" && <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/></>}
    {name === "chevron" && <path d="m9 7 5 5-5 5"/>}
  </svg>;
}

function PortalSkeleton({ page }: { page: NavItem }) {
  const tableLike = ["Payroll", "Timesheets", "My Timesheet", "Employees", "Employee Contacts"].includes(page);
  return <div className="portal-skeleton" aria-label={`Loading ${page}`} aria-busy="true"><div className="skeleton-heading"><span/><strong/></div>{tableLike ? <><div className="skeleton-metrics">{[1,2,3,4].map((item) => <span key={item}/>)}</div><div className="skeleton-table"><i/><i/><i/><i/><i/></div></> : <><div className="skeleton-hero"/><div className="skeleton-cards">{[1,2,3].map((item) => <span key={item}/>)}</div></>}</div>;
}

export default function PayrollApp({
  accountEmail,
  onSignOut,
  initialPage = "Dashboard",
}: {
  accountEmail: string;
  onSignOut: () => void;
  initialPage?: "Dashboard" | "Inventory";
}) {
  const [activeNav, setActiveNav] = useState<NavItem>(initialPage);
  const [schedulingSection, setSchedulingSection] = useState("calendar");
  const [scheduleEmployeePreview, setScheduleEmployeePreview] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [periodStart, setPeriodStart] = useState(currentPeriodStart);
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [rulesDraft, setRulesDraft] = useState<PayrollData["settings"] | null>(null);
  const [scaleDraft, setScaleDraft] = useState<PayScale[]>([]);
  const [rateEffectiveDate, setRateEffectiveDate] = useState(currentPeriodStart);
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeForm>(emptyEmployee);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [openNavGroups, setOpenNavGroups] = useState<Set<string>>(() => new Set(["Operations"]));
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [sharedSearchItems, setSharedSearchItems] = useState<GlobalSearchItem[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [employeePhotoFile, setEmployeePhotoFile] = useState<File | null>(null);
  const [employeePhotoPreview, setEmployeePhotoPreview] = useState("");
  const [removeEmployeePhoto, setRemoveEmployeePhoto] = useState(false);
  const [testMember, setTestMember] = useState<{ id: string; name: string; rank: string; effectivePermissions: string[] } | null>(null);
  const [viewerPermissions, setViewerPermissions] = useState<string[] | null>(null);
  const [respondDeviceSettings, setRespondDeviceSettings] = useState<RespondDeviceSettings>(defaultRespondDeviceSettings);
  const [respondAlertCallId, setRespondAlertCallId] = useState("");
  const [respondAlertSeconds, setRespondAlertSeconds] = useState(RESPOND_ALERT_DURATION_SECONDS);

  const loadPayroll = useCallback(async (start: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payroll?period=${start}`);
      const payload = await response.json() as PayrollData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load payroll");
      setData(payload);
      setRulesDraft(payload.settings);
      setScaleDraft(payload.payScales);
      setRateEffectiveDate(start);
      setLastSynced(new Date());
      setSelectedEmployeeId((current) => current || payload.employees[0]?.id || "");
      setActiveNav((current) => (payload.viewer.isAdmin ? adminNavItems : employeeNavItems).includes(current) ? current : "Dashboard");
      const permissionsResponse = await fetch("/api/permissions");
      if (permissionsResponse.ok) {
        const permissionsPayload = await permissionsResponse.json() as { viewerPermissions?: string[] };
        setViewerPermissions(permissionsPayload.viewerPermissions ?? null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payroll");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setIsOnline(window.navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const settings = readRespondDeviceSettings(window.localStorage);
      setRespondDeviceSettings(settings);
      const params = new URLSearchParams(window.location.search);
      if (params.get("display") === "tv") {
        setActiveNav("Operations Board");
        setTvMode(true);
        return;
      }
      if (settings.mode === "apparatus") setActiveNav("Respond");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!respondAlertCallId) return;
    const deadline = Date.now() + RESPOND_ALERT_DURATION_SECONDS * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRespondAlertSeconds(remaining);
      if (!remaining) setRespondAlertCallId("");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [respondAlertCallId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPayroll(periodStart); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPayroll, periodStart]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openGlobalSearch = useCallback(async () => {
    setGlobalSearchOpen(true);
    if (sharedSearchItems.length || globalSearchLoading) return;
    setGlobalSearchLoading(true);
    try {
      const [policiesResponse, boxCardsResponse, numbersResponse, preplansResponse] = await Promise.all([
        fetch("/api/resources?type=policy"), fetch("/api/resources?type=boxCard"), fetch("/api/phone-numbers"), fetch("/api/field-preplans"),
      ]);
      const [policies, boxCards, numbers, preplans] = await Promise.all([policiesResponse.json(), boxCardsResponse.json(), numbersResponse.json(), preplansResponse.json()]) as [
        { items?: Array<Record<string, string>> }, { items?: Array<Record<string, string>> }, { numbers?: Array<Record<string, string>> }, { preplans?: Array<Record<string, string>> },
      ];
      const searchableScreens = testMember
        ? adminNavItems.filter((item) => !navPermission[item] || testMember.effectivePermissions.includes(navPermission[item]!))
        : data?.viewer.isAdmin
          ? adminNavItems
          : viewerPermissions
            ? adminNavItems.filter((item) => !navPermission[item] || viewerPermissions.includes(navPermission[item]!))
            : employeeNavItems;
      setSharedSearchItems([
        ...searchableScreens.map((page) => ({ id: `screen-${page}`, type: "Screen" as const, title: page, detail: `Open ${page}`, page })),
        ...(policies.items ?? []).map((item) => ({ id: `policy-${item.id}`, type: "Policy" as const, title: item.title, detail: [item.policyNumber, item.category, item.body].filter(Boolean).join(" · "), page: "Policies" as const })),
        ...(boxCards.items ?? []).map((item) => ({ id: `box-${item.id}`, type: "Box Card" as const, title: item.title, detail: [item.boxNumber, item.address, item.accessNotes, item.details].filter(Boolean).join(" · "), page: "Box Cards" as const })),
        ...(numbers.numbers ?? []).map((item) => ({ id: `phone-${item.id}`, type: "Important Number" as const, title: item.name, detail: [item.emergencyNumber, item.nonEmergencyNumber, item.notes].filter(Boolean).join(" · "), page: "Phone Numbers" as const })),
        ...(preplans.preplans ?? []).map((item) => ({ id: `preplan-${item.id}`, type: "Preplan" as const, title: item.businessName || item.address, detail: [item.address, item.status].filter(Boolean).join(" · "), page: "Field Preplans" as const })),
      ]);
    } catch { setSharedSearchItems([]); }
    finally { setGlobalSearchLoading(false); }
  }, [data, globalSearchLoading, sharedSearchItems.length, testMember, viewerPermissions]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        void openGlobalSearch();
      } else if (event.key === "Escape") {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openGlobalSearch]);

  const entryValue = useCallback((employeeId: string, workDate: string, category: Category) => {
    return data?.entries.find((entry) => entry.employeeId === employeeId && entry.workDate === workDate && entry.category === category)?.hours ?? 0;
  }, [data]);

  const summaryFor = useCallback((employee: Employee) => {
    if (!data) return { hours: 0, regularHours: 0, overtimeHours: 0, holidayHours: 0, actingHours: 0, dpwHours: 0, gross: 0, status: "Not started" as const, issues: [] as string[] };
    const employeeEntries = data.entries.filter((entry) => entry.employeeId === employee.id);
    const total = (category: Category) => employeeEntries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.hours, 0);
    const baseHours = total("shift") + total("drill") + total("workDetail") + total("callback");
    const overtimeHours = Math.max(baseHours - data.settings.overtimeThreshold, 0);
    const regularHours = Math.max(baseHours - overtimeHours, 0);
    const holidayHours = total("holiday");
    const actingHours = total("actingOfficer");
    const dpwHours = total("dpw");
    const gross = calculateGrossPay({
      regularHours,
      overtimeHours,
      holidayHours,
      actingOfficerHours: actingHours,
      dpwHours,
      regularRate: employee.regularRate,
      overtimeRate: employee.overtimeRate,
      holidayRate: employee.holidayRate,
      dpwMultiplier: data.settings.dpwMultiplier,
    });
    const issues: string[] = [];
    for (const date of listDates(data.period.startDate, data.period.endDate)) {
      const dayHours = employeeEntries.filter((entry) => entry.workDate === date && entry.category !== "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0);
      const dayActing = employeeEntries.filter((entry) => entry.workDate === date && entry.category === "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0);
      if (dayActing > dayHours && dayActing > 0) issues.push(`${dayLabel(date)} acting-officer hours exceed worked hours`);
    }
    const hours = baseHours + holidayHours + dpwHours;
    const status = employeeEntries.length === 0 ? "Not started" as const : issues.length ? "Review" as const : "Ready" as const;
    return { hours, regularHours, overtimeHours, holidayHours, actingHours, dpwHours, gross, status, issues };
  }, [data]);

  const payrollEmployees = useMemo(() => (data?.employees ?? []).filter((employee) => {
    if (!data) return false;
    const started = !employee.startDate || employee.startDate <= data.period.endDate;
    const notEnded = !employee.endDate || employee.endDate >= data.period.startDate;
    return started && notEnded;
  }), [data]);
  const employeeSummaries = useMemo(() => payrollEmployees.map((employee) => ({ employee, ...summaryFor(employee) })), [payrollEmployees, summaryFor]);
  const reviewCount = employeeSummaries.filter((row) => row.status === "Review").length;
  const readyCount = employeeSummaries.filter((row) => row.status === "Ready").length;
  const grossPayroll = employeeSummaries.reduce((sum, row) => sum + row.gross, 0);
  const selectedEmployee = payrollEmployees.find((employee) => employee.id === selectedEmployeeId) ?? payrollEmployees[0];
  const selectedSummary = selectedEmployee ? summaryFor(selectedEmployee) : null;

  const filteredRows = useMemo(() => employeeSummaries.filter((row) => {
    const matchesSearch = row.employee.name.toLowerCase().includes(search.toLowerCase()) || row.employee.rank.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || row.status.toLowerCase().replace(" ", "-") === statusFilter;
    return matchesSearch && matchesStatus;
  }), [employeeSummaries, search, statusFilter]);

  const globalSearchResults = useMemo(() => {
    const employeeItems: GlobalSearchItem[] = (data?.employees ?? []).flatMap((employee) => [
      ...(data?.viewer.isAdmin ? [{ id: `employee-${employee.id}`, type: "Employee" as const, title: displayName(employee.name), detail: [employee.rank, employee.employeeNumber, employee.driverStatus].filter(Boolean).join(" · "), page: "Employees" as const }] : []),
      { id: `contact-${employee.id}`, type: "Contact" as const, title: displayName(employee.name), detail: [employee.phone, employee.rank, employee.driverStatus].filter(Boolean).join(" · "), page: "Employee Contacts" as const },
    ]);
    const term = globalSearch.trim().toLowerCase();
    if (!term) return [];
    return [...employeeItems, ...sharedSearchItems].filter((item) => `${item.type} ${item.title} ${item.detail}`.toLowerCase().includes(term)).slice(0, 30);
  }, [data?.employees, data?.viewer, globalSearch, sharedSearchItems]);

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/payroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string; id?: string };
    if (!response.ok) throw new Error(result.error || "Unable to save");
    return result;
  }

  function changeEntry(employeeId: string, workDate: string, category: Category, hours: number) {
    setData((current) => {
      if (!current) return current;
      const remaining = current.entries.filter((entry) => !(entry.employeeId === employeeId && entry.workDate === workDate && entry.category === category));
      return { ...current, entries: hours > 0 ? [...remaining, { employeeId, workDate, category, hours }] : remaining };
    });
  }

  async function saveEntry(employeeId: string, workDate: string, category: Category, hours: number) {
    const cell = `${employeeId}-${workDate}-${category}`;
    setSavingCells((current) => new Set(current).add(cell));
    try {
      await post({ action: "saveEntry", periodStart, employeeId, workDate, category, hours });
      setLastSynced(new Date());
      setToast("Hours saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save hours");
    } finally {
      setSavingCells((current) => { const next = new Set(current); next.delete(cell); return next; });
    }
  }

  function openTimesheet(employeeId?: string) {
    if (employeeId) setSelectedEmployeeId(employeeId);
    setActiveNav("Timesheets");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportCsv() {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      [`${periodLabel(data.period.startDate, data.period.endDate)} Payroll`],
      ["Name", "Rank", "Shift", "Drill", "Work Detail", "Call Back", "Acting Officer", "Holiday", "Total", "Rate", "Pay"],
    ];
    employeeSummaries.forEach((summary) => {
      const employeeEntries = data.entries.filter((entry) => entry.employeeId === summary.employee.id);
      rows.push(...payrollExportRows({
        name: displayName(summary.employee.name),
        rank: summary.employee.rank,
        regularRate: summary.employee.regularRate,
        overtimeRate: summary.employee.overtimeRate,
        holidayRate: summary.employee.holidayRate,
        isDpw: summary.employee.isDpw,
      }, employeeEntries, data.settings.overtimeThreshold, data.settings.dpwMultiplier));
    });
    const categoryTotal = (category: Category) => data.entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.hours, 0);
    rows.push([
      "Totals",
      "",
      categoryTotal("shift").toFixed(2),
      categoryTotal("drill").toFixed(2),
      categoryTotal("workDetail").toFixed(2),
      categoryTotal("callback").toFixed(2),
      categoryTotal("actingOfficer").toFixed(2),
      categoryTotal("holiday").toFixed(2),
      "",
      "",
      grossPayroll.toFixed(2),
    ]);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Stickney-Payroll-${data.period.startDate}-to-${data.period.endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Payroll exported");
  }

  async function setPeriodStatus(status: PayrollData["period"]["status"]) {
    await post({ action: "setPeriodStatus", periodStart, status });
    setData((current) => current ? { ...current, period: { ...current.period, status } } : current);
    setLastSynced(new Date());
    setToast(status === "finalized" ? "Payroll finalized" : "Status updated");
  }

  async function finalizePayroll() {
    setFinalizing(true);
    try { await setPeriodStatus("finalized"); setFinalizeConfirmOpen(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to finalize payroll"); }
    finally { setFinalizing(false); }
  }

  async function saveRules() {
    if (!rulesDraft) return;
    try {
      await post({ action: "saveRules", ...rulesDraft, effectiveDate: rateEffectiveDate, payScales: scaleDraft });
      await loadPayroll(periodStart);
      setToast(`Rates saved effective ${rateEffectiveDate}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save rules"); }
  }

  function changeRateEffectiveDate(value: string) {
    setRateEffectiveDate(value);
    if (!data) return;
    setScaleDraft(data.payScales.map((scale) => {
      const rate = data.rateHistory.find((item) => item.payScaleId === scale.id && item.effectiveDate <= value);
      return rate ? { id: scale.id, label: scale.label, regularRate: rate.regularRate, overtimeRate: rate.overtimeRate, holidayRate: rate.holidayRate } : scale;
    }));
  }

  function changeBaseRate(index: number, value: number) {
    const calculated = roundPayrollUpToCent(value * 1.5);
    setScaleDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, regularRate: value, overtimeRate: calculated, holidayRate: calculated } : item));
  }

  function editEmployee(employee?: Employee) {
    setEmployeePhotoFile(null);
    setRemoveEmployeePhoto(false);
    if (!employee) {
      setEmployeeDraft(emptyEmployee);
      setEmployeePhotoPreview("");
    } else {
      setEmployeeDraft({
        id: employee.id, ...splitEmployeeName(employee.name), payScaleId: employee.payScaleId, employeeNumber: employee.employeeNumber ?? "",
        startDate: employee.startDate ?? "", endDate: employee.endDate ?? "", dateOfBirth: employee.dateOfBirth ?? "",
        phone: employee.phone ?? "", email: employee.email ?? "", addressLine1: employee.addressLine1 ?? "",
        city: employee.city ?? "", state: employee.state ?? "IL", postalCode: employee.postalCode ?? "",
        employmentType: employee.employmentType ?? "Part-time", isDpw: Boolean(employee.isDpw), driverStatus: employee.driverStatus ?? "", actingOfficerEligible: Boolean(employee.actingOfficerEligible), scheduleSmsOptIn: Boolean(employee.scheduleSmsOptIn), isAdmin: Boolean(employee.isAdmin), emergencyName: employee.emergencyName ?? "",
        emergencyRelationship: employee.emergencyRelationship ?? "", emergencyPhone: employee.emergencyPhone ?? "", notes: employee.notes ?? "",
      });
      setEmployeePhotoPreview(employee.photoUpdatedAt ? `/api/employee-photo/${employee.id}?v=${encodeURIComponent(employee.photoUpdatedAt)}` : "");
    }
    setProfileOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEmployeeProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await post({ action: "saveEmployee", ...employeeDraft, name: employeeNameFromParts(employeeDraft.lastName, employeeDraft.firstName) });
      const employeeId = result.id || employeeDraft.id;
      if (!employeeId) throw new Error("The employee record was saved without an ID.");
      if (removeEmployeePhoto && employeeDraft.id) {
        const response = await fetch(`/api/employee-photo/${employeeDraft.id}`, { method: "DELETE" });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to remove employee photo");
      }
      if (employeePhotoFile) {
        const form = new FormData();
        form.set("photo", employeePhotoFile);
        const response = await fetch(`/api/employee-photo/${employeeId}`, { method: "POST", body: form });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to upload employee photo");
      }
      setEmployeeDraft(emptyEmployee);
      setEmployeePhotoFile(null);
      setEmployeePhotoPreview("");
      setRemoveEmployeePhoto(false);
      setProfileOpen(false);
      await loadPayroll(periodStart);
      setToast(employeeDraft.id ? "Employee information updated" : "Employee added");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save employee"); }
  }

  async function sendEmployeeInvite(employee: Employee) {
    const email = employee.email?.trim().toLowerCase() ?? "";
    if (!email) {
      setInviteMessage(`Add a login email to ${displayName(employee.name)} before sending an invite.`);
      return;
    }
    setInvitingEmail(email);
    setInviteMessage(`Sending a secure app invitation to ${email}...`);
    try {
      const response = await fetch("/api/auth/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The invitation could not be sent.");
      setInviteMessage(`Invitation sent to ${email}. They must confirm the email and create a 4 to 6 digit PIN.`);
    } catch (caught) {
      setInviteMessage(caught instanceof Error ? caught.message : "The invitation could not be sent.");
    } finally {
      setInvitingEmail("");
    }
  }

  function chooseEmployeePhoto(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP employee photo.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Employee photos must be smaller than 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => setEmployeePhotoPreview(String(reader.result || "")), { once: true });
    reader.readAsDataURL(file);
    setEmployeePhotoFile(file);
    setRemoveEmployeePhoto(false);
    setError("");
  }

  async function deleteEmployee() {
    if (!employeeToDelete) return;
    setDeletingEmployee(true);
    try {
      await post({ action: "deleteEmployee", employeeId: employeeToDelete.id });
      const deletedId = employeeToDelete.id;
      setEmployeeToDelete(null);
      setProfileOpen(false);
      setEmployeeDraft(emptyEmployee);
      if (selectedEmployeeId === deletedId) setSelectedEmployeeId("");
      await loadPayroll(periodStart);
      setToast("Employee deleted");
    } catch (caught) {
      setEmployeeToDelete(null);
      setError(caught instanceof Error ? caught.message : "Unable to delete employee");
    } finally {
      setDeletingEmployee(false);
    }
  }

  const statusLabel = data?.period.status ? data.period.status[0].toUpperCase() + data.period.status.slice(1) : "Draft";
  const syncLabel = !isOnline ? "Offline" : loading || savingCells.size > 0 ? "Saving" : "Saved";
  const syncTime = lastSynced?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) ?? "Not synced";
  const isAdminView = Boolean(data?.viewer.isAdmin && !testMember);
  const visibleNav = useMemo(() => testMember ? adminNavItems.filter((item) => !navPermission[item] || testMember.effectivePermissions.includes(navPermission[item]!)) : data?.viewer.isAdmin ? adminNavItems : viewerPermissions ? adminNavItems.filter((item) => !navPermission[item] || viewerPermissions.includes(navPermission[item]!)) : employeeNavItems, [data?.viewer.isAdmin, testMember, viewerPermissions]);
  const visibleAdminGroups = useMemo(() => adminNavGroups.map((group) => ({ ...group, items: group.items.filter((item) => visibleNav.includes(item.page)) })).filter((group) => group.items.length), [visibleNav]);
  const homePage = visibleNav[0] ?? "My Timesheet";
  useEffect(() => {
    if ((testMember || (data && !data.viewer.isAdmin && viewerPermissions)) && !visibleNav.includes(activeNav)) setActiveNav(homePage);
  }, [activeNav, data, homePage, testMember, viewerPermissions, visibleNav]);
  function navigate(page: NavItem) {
    if (page === "Inventory") {
      window.location.assign("/inventory");
      return;
    }
    setActiveNav(page);
    setMobileMenuOpen(false);
    setGlobalSearchOpen(false);
    setGlobalSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openSchedulingSection(section:string) {
    setSchedulingSection(section);
    setActiveNav("Scheduling");
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleNavGroup(group: string) {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setOpenNavGroups(new Set([group]));
      return;
    }
    setOpenNavGroups((current) => current.has(group) ? new Set() : new Set([group]));
  }
  function changeTestMember(member: { id: string; name: string; rank: string; effectivePermissions: string[] } | null) {
    setTestMember(member);
    if (member) {
      setSelectedEmployeeId(member.id);
      const firstPermitted = adminNavItems.find((item) => !navPermission[item] || member.effectivePermissions.includes(navPermission[item]!));
      setActiveNav(firstPermitted ?? "My Timesheet");
    } else setActiveNav("Test View");
  }
  function permissionsSaved(payload: { viewerPermissions?: string[]; employees: Array<{ id: string; name: string; rank: string; effectivePermissions: string[] }> }) {
    if (payload.viewerPermissions) setViewerPermissions(payload.viewerPermissions);
    if (testMember) {
      const refreshed = payload.employees.find((employee) => employee.id === testMember.id);
      if (refreshed) setTestMember(refreshed);
    }
  }

  return (
    <main className={`app-shell${tvMode ? " tv-shell" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      {!tvMode && <PwaInstall />}
      <aside id="desktop-navigation" className="desktop-sidebar" aria-hidden={sidebarCollapsed} inert={sidebarCollapsed}>
        <button className="sidebar-brand" onClick={() => { navigate(homePage); setSidebarCollapsed(true); }} aria-label="Stickney Fire Department Operations Portal home" title="Dashboard"><img className="brand-patch" src="/stickney-fd-patch.png?v=3" alt="Stickney Fire Department patch" width="64" height="64" /><span><strong>Stickney Fire Department</strong><small>Operations Portal</small></span></button>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {visibleNav.includes("Dashboard") && <button title="Dashboard" className={activeNav === "Dashboard" ? "current" : ""} onClick={() => { navigate("Dashboard"); setSidebarCollapsed(true); }}><Icon name="home"/><span>Dashboard</span></button>}
          {isAdminView ? visibleAdminGroups.map((group) => (
            <section key={group.label}>
              <button className="sidebar-group-toggle" title={group.label} aria-expanded={openNavGroups.has(group.label)} onClick={() => toggleNavGroup(group.label)}><Icon name={group.icon}/><span>{group.label}</span><Icon name="chevron" size={14}/></button>
              {openNavGroups.has(group.label) ? <div className="sidebar-group-items">{group.items.map((item) => <button key={item.page} className={activeNav === item.page ? "current" : ""} onClick={() => { navigate(item.page); setSidebarCollapsed(true); }}><Icon name={navIcons[item.page]}/><span>{item.label}</span></button>)}</div> : null}
            </section>
          )) : (
            <>
              <section>
                <h2>{testMember ? `Testing · ${testMember.rank}` : "My Portal"}</h2>
                {visibleNav.filter((item) => item !== "Dashboard" && !memberStationDutyItems.has(item)).map((item) => <button key={item} className={activeNav === item ? "current" : ""} onClick={() => { navigate(item); setSidebarCollapsed(true); }}><Icon name={navIcons[item]}/><span>{item === "Scheduling" ? "Employee Schedule Portal" : item}</span></button>)}
              </section>
              {visibleNav.some((item) => memberStationDutyItems.has(item)) && <section>
                <h2>Station Duties</h2>
                {visibleNav.filter((item) => memberStationDutyItems.has(item)).map((item) => <button key={item} className={activeNav === item ? "current" : ""} onClick={() => { navigate(item); setSidebarCollapsed(true); }}><Icon name={navIcons[item]}/><span>{item}</span></button>)}
              </section>}
            </>
          )}
          <div className="account-session-bar">
            <span><b>Verified account</b>{accountEmail}</span>
            <button type="button" onClick={onSignOut}>Sign out</button>
          </div>
        </nav>
        <div className="sidebar-footer"><span className="system-dot"/>System ready<small>Portal v1.0</small></div>
      </aside>
      <header className="topbar">
        <button className="desktop-sidebar-toggle" type="button" aria-expanded={!sidebarCollapsed} aria-controls="desktop-navigation" aria-label={sidebarCollapsed ? "Open navigation menu" : "Close navigation menu"} title={sidebarCollapsed ? "Open menu" : "Close menu"} onClick={() => setSidebarCollapsed((current) => !current)}><Icon name={sidebarCollapsed ? "menu" : "close"} size={19}/><span>{sidebarCollapsed ? "Menu" : "Close"}</span></button>
        <button className="mobile-brand" onClick={() => navigate(homePage)} aria-label="Stickney Fire Department Operations Portal home"><img src="/stickney-fd-patch.png?v=3" alt="Stickney Fire Department patch" width="44" height="44" /><strong>Stickney FD Operations Portal</strong></button>
        <div className="topbar-context"><span>Stickney Fire Department</span><strong>{activeNav}</strong></div>
        <div className="topbar-utilities"><div className={`sync-indicator ${syncLabel.toLowerCase()}`}><Icon name={syncLabel === "Offline" ? "warning" : "save"} size={16}/><span><strong>{syncLabel}</strong><small>Last synced {syncTime}</small></span></div><button className="global-search-trigger" onClick={() => void openGlobalSearch()}><Icon name="search"/><span>Search</span><kbd>⌘ K</kbd></button><SmartAlerts icon={<Icon name="bell"/>} onNavigate={(page) => navigate(page as NavItem)} /><div className="profile"><span className="avatar">{(testMember?.name ?? data?.viewer.displayName ?? "").split(/[ ,]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FD"}</span><span className="profile-copy"><strong>{testMember ? displayName(testMember.name) : data ? displayName(data.viewer.displayName) : "Signed in"}</strong><small>{testMember ? `Test view · ${testMember.rank}` : data?.viewer.isAdmin ? "Administrator" : "Employee"}</small></span><Icon name="chevron" size={15}/></div><button className="mobile-menu-toggle" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((current) => !current)} aria-label="Open navigation"><Icon name={mobileMenuOpen ? "close" : "menu"}/></button></div>
      </header>
      {mobileMenuOpen && <nav id="mobile-navigation" className="mobile-nav-panel" aria-label="Mobile navigation">
          {visibleNav.includes("Dashboard") && <button className={activeNav === "Dashboard" ? "current" : ""} onClick={() => navigate("Dashboard")}><Icon name="home"/>Dashboard</button>}
          {isAdminView ? visibleAdminGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.items.map((item) => <button key={item.page} className={activeNav === item.page ? "current" : ""} onClick={() => navigate(item.page)}><Icon name={navIcons[item.page]}/>{item.label}</button>)}</section>) : <>
            <section><h2>My Portal</h2>{visibleNav.filter((item) => item !== "Dashboard" && !memberStationDutyItems.has(item)).map((item) => <button key={item} className={activeNav === item ? "current" : ""} onClick={() => navigate(item)}><Icon name={navIcons[item]}/>{item === "Scheduling" ? "Employee Schedule Portal" : item}</button>)}</section>
            {visibleNav.some((item) => memberStationDutyItems.has(item)) && <section><h2>Station Duties</h2>{visibleNav.filter((item) => memberStationDutyItems.has(item)).map((item) => <button key={item} onClick={() => navigate(item)}><Icon name={navIcons[item]}/>{item}</button>)}</section>}
          </>}
          <div className="account-session-bar mobile-account-session">
            <span><b>Verified account</b>{accountEmail}</span>
            <button type="button" onClick={onSignOut}>Sign out</button>
          </div>
      </nav>}

      <nav className="mobile-bottom-tabs" aria-label="Primary mobile navigation">
        {([
          ["Dashboard", "Dashboard", "home"],
          ["Scheduling", "Schedule", "clock"],
          ["Daily Log", "Daily Log", "log"],
          ["Respond", "Respond", "warning"],
        ] as Array<[NavItem, string, IconName]>).filter(([page]) => visibleNav.includes(page)).map(([page,label,icon]) => <button key={page} className={activeNav===page?"current":""} onClick={() => navigate(page)}><Icon name={icon}/><span>{label}</span></button>)}
        <button className={mobileMenuOpen?"current":""} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((current) => !current)}><Icon name="menu"/><span>More</span></button>
      </nav>

      {globalSearchOpen && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setGlobalSearchOpen(false); }}><section className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title"><div className="global-search-head"><div><p className="eyebrow">Department-wide search</p><h2 id="global-search-title">Find anything</h2></div><button aria-label="Close search" onClick={() => setGlobalSearchOpen(false)}><Icon name="close"/></button></div><label className="global-search-input"><Icon name="search"/><input autoFocus value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search employees, contacts, policies, Box Cards, or important numbers…" /></label><div className="global-search-results">{globalSearchLoading ? <div className="global-search-empty">Loading shared information…</div> : !globalSearch.trim() ? <div className="global-search-empty">Start typing a name, address, policy, card number, or phone number.</div> : globalSearchResults.length ? globalSearchResults.map((item) => <button key={item.id} onClick={() => navigate(item.page)}><span className={`search-type ${item.type.toLowerCase().replace(" ", "-")}`}>{item.type}</span><strong>{item.title}</strong><small>{item.detail || `Open ${item.page}`}</small><b aria-hidden="true"><Icon name="chevron" size={18}/></b></button>) : <div className="global-search-empty">No results found for “{globalSearch}”.</div>}</div></section></div>}
      <ConfirmDialog open={finalizeConfirmOpen} title="Finalize this payroll period?" description={`This will lock payroll for ${data ? periodLabel(data.period.startDate, data.period.endDate) : "the selected period"}. Timesheets will become read only and additional changes will require an administrator workflow.`} confirmLabel="Finalize Payroll" tone="warning" busy={finalizing} onCancel={() => setFinalizeConfirmOpen(false)} onConfirm={() => void finalizePayroll()} />
      <ConfirmDialog open={Boolean(employeeToDelete)} title={`Delete ${employeeToDelete ? displayName(employeeToDelete.name) : "employee"}?`} description="This permanently deletes the employee record. This cannot be undone. Employees with payroll or Daily Log history cannot be deleted." confirmLabel="Confirm Delete" tone="danger" busy={deletingEmployee} onCancel={() => setEmployeeToDelete(null)} onConfirm={() => void deleteEmployee()} />

      <section className={`workspace${testMember ? " testing-member-view" : ""}`} onClickCapture={(event) => { if (testMember && (event.target as HTMLElement).closest("button,input,select,textarea") && !(event.target as HTMLElement).closest(".test-view-banner,[data-test-safe],[data-test-interactive]")) { event.preventDefault(); event.stopPropagation(); } }} onSubmitCapture={(event) => { if (testMember && !(event.target as HTMLElement).closest("[data-test-interactive]")) { event.preventDefault(); event.stopPropagation(); } }} onChangeCapture={(event) => { if (testMember && !(event.target as HTMLElement).closest(".test-view-banner,[data-test-safe],[data-test-interactive]")) { event.preventDefault(); event.stopPropagation(); } }}>
        {testMember && <div className="test-view-banner"><div><b>TEST VIEW</b><span>Previewing as {displayName(testMember.name)} · {testMember.rank}</span><small>No identity or approval authority has changed.</small></div><button onClick={() => changeTestMember(null)}>Exit test view</button></div>}
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => { setError(""); void loadPayroll(periodStart); }}>Retry</button></div>}
        {toast && <div className="toast" role="status"><Icon name="save" /> {toast}</div>}
        {loading && !data ? <PortalSkeleton page={activeNav} /> : data && <>
          {activeNav !== "Dashboard" && activeNav !== "Command Center" && activeNav !== "Operations Board" && activeNav !== "Activity Timeline" && activeNav !== "Respond" && activeNav !== "Command Board" && activeNav !== "Field Preplans" && activeNav !== "Scheduling" && activeNav !== "Work Details" && activeNav !== "Daily Log" && activeNav !== "Holiday Policy" && activeNav !== "Daily Duties" && activeNav !== "Phone Numbers" && activeNav !== "Employee Contacts" && activeNav !== "Policies" && activeNav !== "Box Cards" && activeNav !== "Departments" && activeNav !== "Permissions" && activeNav !== "CAD Integration" && activeNav !== "Respond Device Modes" && activeNav !== "Test View" && <div className="period-row">
            <div>
              <p className="eyebrow">{activeNav === "Payroll" ? "Current pay period" : activeNav}</p>
              <div className="title-line">
                <button className="period-arrow" aria-label="Previous pay period" onClick={() => setPeriodStart(shiftPeriod(periodStart, -1))}><Icon name="back" /></button>
                <h1>{periodLabel(data.period.startDate, data.period.endDate)}</h1>
                <button className="period-arrow" aria-label="Next pay period" onClick={() => setPeriodStart(shiftPeriod(periodStart, 1))}><Icon name="next" /></button>
                <span className={`period-badge ${data.period.status}`}><Icon name="document" size={16}/> {statusLabel}</span>
              </div>
            </div>
            {activeNav === "Payroll" && <button className="primary-action" onClick={() => openTimesheet()}><Icon name={data.period.status === "finalized" ? "document" : "clock"}/> {data.period.status === "finalized" ? "View Timesheets" : "Enter Hours"}</button>}
            {activeNav === "Timesheets" && data.viewer.isAdmin && <button className="primary-action secondary-red" onClick={() => setActiveNav("Payroll")}>Review Payroll</button>}
          </div>}

          {(activeNav === "Payroll" || activeNav === "Timesheets" || activeNav === "My Timesheet") && <RecordCredibility audit={{ recordNumber: `PAY-${data.period.startDate.replaceAll("-", "")}`, status: statusLabel, createdBy: data.period.createdBy, createdAt: data.period.createdAt, updatedBy: data.period.updatedBy, updatedAt: data.period.updatedAt, closedBy: data.period.finalizedBy, closedAt: data.period.finalizedAt, revisions: data.period.revisions }} />}

          {activeNav === "Payroll" && <div className={data.period.status === "finalized" ? "record-finalized" : "record-editable"}>
            {data.period.status === "finalized" && <div className="record-state-banner finalized"><span className="state-lock" aria-hidden="true">✓</span><div><strong>Finalized payroll · Read only</strong><span>This pay period is closed. Hours and payroll totals can no longer be changed.</span></div></div>}
            <section className="kpi-grid" aria-label="Payroll summary">
              <article className="kpi-card"><span className="kpi-icon blue"><Icon name="users" size={28}/></span><div><strong>{payrollEmployees.length}</strong><span>On This Payroll</span></div></article>
              <article className="kpi-card"><span className="kpi-icon blue"><Icon name="clock" /></span><div><strong>{data.settings.overtimeThreshold} <small>hr</small></strong><span>OT Threshold</span></div></article>
              <article className="kpi-card"><span className="kpi-icon blue"><Icon name="document" /></span><div><strong>{formatMoney(grossPayroll)}</strong><span>Calculated Gross</span></div></article>
              <article className="kpi-card alert"><span className="kpi-icon red"><Icon name="warning" /></span><div><strong>{reviewCount}</strong><span>Need Review</span></div></article>
            </section>
            <section className="payroll-panel">
              <div className="toolbar">
                <label className="search-box"><Icon name="search" /><span className="sr-only">Search employees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees…" /></label>
                <div className="toolbar-actions">
                  <label className="select-button"><Icon name="filter" /><span className="sr-only">Filter status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="ready">Ready</option><option value="review">Needs review</option><option value="not-started">Not started</option></select></label>
                  <button onClick={exportCsv}><Icon name="export" /> Export CSV</button>
                </div>
              </div>
              <div className="table-wrap payroll-table">
                <table><thead><tr><th>Employee</th><th>Rank</th><th className="number">Hours</th><th className="number">Gross Pay</th><th>Status</th></tr></thead><tbody>
                  {filteredRows.map((row) => <tr key={row.employee.id} onClick={() => openTimesheet(row.employee.id)}>
                    <td data-label="Employee"><span className="person-icon"><Icon name="users"/></span><strong>{displayName(row.employee.name)}</strong></td><td data-label="Rank">{row.employee.rank}</td><td data-label="Hours" className="number tabular">{row.hours.toFixed(1)} hrs</td><td data-label="Gross Pay" className="number tabular">{formatMoney(row.gross)}</td><td data-label="Status"><span className={`status-pill ${row.status.toLowerCase().replace(" ", "-")}`}>{row.status === "Ready" ? "✓" : row.status === "Review" ? "◷" : "–"} {row.status}</span></td>
                  </tr>)}
                </tbody></table>
              </div>
              {filteredRows.length === 0 && <div className="action-empty-state"><Icon name="search" size={28}/><div><strong>No payroll records match</strong><p>Clear the search or status filter to see employees on this payroll.</p></div><button className="quiet-button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear Filters</button></div>}
              <div className="review-bar"><span><strong>{readyCount}</strong> ready · <strong>{reviewCount}</strong> need review · <strong>{payrollEmployees.length - readyCount - reviewCount}</strong> not started</span><div>{data.period.status !== "finalized" ? <><button className="quiet-button" onClick={() => void setPeriodStatus("reviewed")}>Mark Reviewed</button><button className="finalize-button" disabled={reviewCount > 0} onClick={() => setFinalizeConfirmOpen(true)}>Finalize Payroll</button></> : <span className="closed-confirmation">✓ Payroll closed</span>}</div></div>
            </section>
          </div>}

          {activeNav === "Dashboard" && <RoleDashboard data={{ viewer: testMember ? { email: "", isAdmin: false, employeeId: testMember.id, displayName: testMember.name } : data.viewer, employees: testMember ? data.employees.filter((employee) => employee.id === testMember.id) : data.employees, entries: testMember ? data.entries.filter((entry) => entry.employeeId === testMember.id) : data.entries, period: data.period, grossPayroll, reviewCount, employeeGross: selectedSummary?.gross ?? 0 }} onNavigate={(page) => setActiveNav(page)} />}

          {activeNav === "Command Center" && <CommandCenter />}
          {activeNav === "Work Details" && <WorkDetails onPayrollChanged={(approvedPeriodStart) => { if (approvedPeriodStart === periodStart) void loadPayroll(periodStart); else setPeriodStart(approvedPeriodStart); }} />}
          {activeNav === "Scheduling" && <div className="schedule-workspace-shell">
            <nav className="schedule-page-tabs" aria-label="Scheduling workspace">
              {(isAdminView && !scheduleEmployeePreview ? [["calendar","Schedule"],["requests","Requests & trades"],["people","Personnel"],["patterns","Rules & reminders"],["generate","Generate schedule"]] : [["calendar","My schedule"],["open","Open shifts & trades"],["alerts","Reminders"]]).map(([key,label], index) => <button key={`${key}-${label}-${index}`} className={schedulingSection === key ? "active" : ""} aria-pressed={schedulingSection === key} onClick={() => openSchedulingSection(key)}>{label}</button>)}
              {isAdminView && <button className="schedule-view-switch" onClick={() => { setScheduleEmployeePreview((current) => !current); openSchedulingSection("calendar"); }}>{scheduleEmployeePreview ? "Admin console" : "Employee view"}</button>}
            </nav>
            <Scheduling testMember={testMember} requestedTab={schedulingSection} forceEmployeeView={scheduleEmployeePreview} onTabChange={setSchedulingSection} />
          </div>}

          {activeNav === "Operations Board" && <OperationsBoard tvMode={tvMode} onTvModeChange={(enabled) => {
            setTvMode(enabled);
            const url = new URL(window.location.href);
            if (enabled) url.searchParams.set("display", "tv");
            else url.searchParams.delete("display");
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          }} onNewActiveCall={(call) => {
            if (respondDeviceSettings.mode === "operations-alert" && activeNav === "Operations Board") {
              setRespondAlertSeconds(RESPOND_ALERT_DURATION_SECONDS);
              setRespondAlertCallId(call.reportNumber);
            }
          }} />}

          {activeNav === "Activity Timeline" && <ActivityTimeline />}
          {activeNav === "Respond" && <Respond apparatus={respondDeviceSettings.mode === "apparatus" ? respondDeviceSettings.apparatus : ""} onNavigate={(page) => navigate(page)} />}
          {activeNav === "Command Board" && <IncidentCommandBoard />}
          {activeNav === "Field Preplans" && <FieldPreplans />}
          {activeNav === "Respond Device Modes" && data.viewer.isAdmin && <RespondDeviceSettingsPage onSaved={(settings) => {
            setRespondDeviceSettings(settings);
            if (settings.mode === "apparatus") navigate("Respond");
          }} />}
          {respondAlertCallId && activeNav === "Operations Board" && <div className="respond-auto-alert" role="dialog" aria-modal="true" aria-label="New active call Respond view">
            <header><div><strong>NEW ACTIVE CALL · RESPOND</strong><span>Returning to Live Operations in {respondAlertSeconds} seconds</span></div><button type="button" onClick={() => setRespondAlertCallId("")}>Return now</button></header>
            <Respond onNavigate={(page) => navigate(page)} />
          </div>}

          {(activeNav === "Timesheets" || activeNav === "My Timesheet") && selectedEmployee && selectedSummary && <div className={data.period.status === "finalized" ? "record-finalized" : "record-editable"}>{data.period.status === "finalized" && <div className="record-state-banner finalized"><span className="state-lock" aria-hidden="true">🔒</span><div><strong>Finalized timesheet · Read only</strong><span>This timesheet belongs to a closed payroll period.</span></div></div>}<section className="content-card timesheet-card">
            <div className="section-header"><div>{isAdminView ? <><label htmlFor="employee-select">Employee</label><select id="employee-select" value={selectedEmployee.id} onChange={(event) => setSelectedEmployeeId(event.target.value)}>{payrollEmployees.map((employee) => <option value={employee.id} key={employee.id}>{displayName(employee.name)} — {employee.rank}</option>)}</select></> : <><p className="eyebrow">My timesheet</p><h2>{displayName(selectedEmployee.name)}</h2><p>{selectedEmployee.rank} · Read only</p></>}</div><span className={`status-pill ${selectedSummary.status.toLowerCase().replace(" ", "-")}`}>{selectedSummary.status}</span></div>
            <div className="mini-summary"><div><span>Paid hours</span><strong>{selectedSummary.hours.toFixed(1)}</strong></div><div><span>Overtime</span><strong>{selectedSummary.overtimeHours.toFixed(1)}</strong></div><div><span>Holiday</span><strong>{selectedSummary.holidayHours.toFixed(1)}</strong></div><div><span>Gross pay</span><strong>{formatMoney(selectedSummary.gross)}</strong></div></div>
            {selectedSummary.issues.length > 0 && <div className="validation-box"><strong>Check these entries</strong>{selectedSummary.issues.map((issue) => <span key={issue}>• {issue}</span>)}</div>}
            <div className="entry-grid-wrap"><table className="entry-grid"><thead><tr><th>Date</th>{categoryColumns.map((column) => <th key={column.key} title={column.label}>{column.short}</th>)}<th>Total</th></tr></thead><tbody>
              {listDates(data.period.startDate, data.period.endDate).map((date) => {
                const rowTotal = categoryColumns.filter((column) => column.key !== "actingOfficer").reduce((sum, column) => sum + entryValue(selectedEmployee.id, date, column.key), 0);
                return <tr key={date}><td>{dayLabel(date)}</td>{categoryColumns.map((column) => {
                  const cell = `${selectedEmployee.id}-${date}-${column.key}`;
                  const value = entryValue(selectedEmployee.id, date, column.key);
                  const canEditEntry = isAdminView && data.period.status !== "finalized";
                  return <td key={column.key}><input aria-label={`${column.label} hours for ${dayLabel(date)}`} type="number" min="0" max="48" step="0.25" value={value || ""} readOnly={!canEditEntry} className={`${savingCells.has(cell) ? "saving" : ""}${canEditEntry ? "" : " timesheet-readonly"}`} onChange={(event) => { if (canEditEntry) changeEntry(selectedEmployee.id, date, column.key, safeNumber(event.target.value)); }} onBlur={(event) => { if (canEditEntry) void saveEntry(selectedEmployee.id, date, column.key, safeNumber(event.target.value)); }} /></td>;
                })}<td>{rowTotal.toFixed(1)}</td></tr>;
              })}
            </tbody><tfoot><tr><td>Period totals</td>{categoryColumns.map((column) => <td key={column.key}>{data.entries.filter((entry) => entry.employeeId === selectedEmployee.id && entry.category === column.key).reduce((sum, entry) => sum + entry.hours, 0).toFixed(1)}</td>)}<td>{selectedSummary.hours.toFixed(1)}</td></tr></tfoot></table></div>
            <p className="helper-note">{data.period.status === "finalized" ? "This finalized timesheet is read only. Reopening a closed payroll period requires a separate administrator workflow." : isAdminView ? `Acting Officer pay is a straight $${ACTING_OFFICER_STIPEND_PER_HOUR.toFixed(2)} per AO hour and never receives overtime or holiday multipliers. DPW hours use the configured DPW multiplier. Daily totals over 24 hours are allowed for callbacks and overlapping pay categories. Entries save when you leave a field.` : "This timesheet is read only. Contact an administrator if an entry needs to be corrected."}</p>
          </section></div>}

          {activeNav === "Daily Log" && <DailyLog employees={data.employees} onPayrollSynced={() => { void loadPayroll(periodStart); }} />}

          {activeNav === "Holiday Policy" && <HolidayPolicy />}
          {activeNav === "Daily Duties" && <DailyDuties />}
          {activeNav === "Phone Numbers" && <PhoneNumbers />}
          {activeNav === "CAD Integration" && data.viewer.isAdmin && <CadIntegrationSettings />}
          {activeNav === "Departments" && data.viewer.isAdmin && <DepartmentSettings />}

          {activeNav === "Employee Contacts" && <EmployeeContacts employees={data.employees} />}

          {activeNav === "Policies" && <PoliciesPage />}

          {activeNav === "Box Cards" && <BoxCardsPage />}

          {(activeNav === "Permissions" || activeNav === "Test View") && data.viewer.isAdmin && <PermissionSettings initialTab={activeNav === "Test View" ? "test" : "permissions"} testEmployeeId={testMember?.id ?? ""} onTestEmployee={changeTestMember} onPermissionsSaved={permissionsSaved} />}

          {activeNav === "Employees" && <section className="employee-page">
            <div className="standard-page-header"><div><span className="page-icon"><Icon name="users" size={25}/></span><div><p className="eyebrow">Personnel administration</p><h1>Employees</h1><p>Manage employment, contact, access, driver status, and emergency information.</p></div></div><button type="button" className="primary-action" onClick={() => editEmployee()}>Add Employee</button></div>
            {inviteMessage && <div className="employee-invite-message" role="status">{inviteMessage}<button type="button" aria-label="Dismiss invitation message" onClick={() => setInviteMessage("")}>×</button></div>}
            {profileOpen && <form className="content-card employee-profile-form" onSubmit={(event) => void saveEmployeeProfile(event)}>
              <div className="section-header"><div><h2>{employeeDraft.id ? `Edit ${employeeNameFromParts(employeeDraft.lastName, employeeDraft.firstName)}` : "Add employee"}</h2><p>Personnel, payroll eligibility, and emergency contact information.</p></div><div className="employee-form-actions">{employeeDraft.id && <button type="button" className="quiet-button" onClick={() => editEmployee()}>New Employee</button>}<button className="primary-action compact" type="submit">{employeeDraft.id ? "Save Changes" : "Add Employee"}</button></div></div>
              <fieldset><legend>Employment</legend><div className="employee-photo-editor"><div className="employee-photo-preview">{employeePhotoPreview ? <img src={employeePhotoPreview} alt="Employee photo preview" /> : <span>{employeeNameFromParts(employeeDraft.lastName, employeeDraft.firstName).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FD"}</span>}</div><div><strong>Employee photo</strong><p>Used for new-member announcements and personnel displays.</p><div><label className="employee-photo-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseEmployeePhoto(event.target.files?.[0] ?? null)} /><span>{employeePhotoPreview ? "Choose a different photo" : "Choose photo"}</span></label>{employeePhotoPreview && <button type="button" className="quiet-button" onClick={() => { setEmployeePhotoFile(null); setEmployeePhotoPreview(""); setRemoveEmployeePhoto(Boolean(employeeDraft.id)); }}>Remove photo</button>}</div><small>JPG, PNG, or WebP · maximum 3 MB</small></div></div><div className="employee-fields three-col">
                <label><span>Last name *</span><input required autoComplete="family-name" value={employeeDraft.lastName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, lastName: event.target.value }))} /></label>
                <label><span>First name *</span><input required autoComplete="given-name" value={employeeDraft.firstName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, firstName: event.target.value }))} /></label>
                <label><span>Employee number</span><input placeholder="Example: 1203-17" value={employeeDraft.employeeNumber} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employeeNumber: event.target.value }))} /></label>
                <label><span>Employment type</span><select value={employeeDraft.employmentType} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employmentType: event.target.value }))}><option>Part-time</option><option>Full-time</option><option>Paid-on-call</option><option>Temporary</option><option>Contract</option></select></label>
                <label><span>Driver status</span><select value={employeeDraft.driverStatus} onChange={(event) => setEmployeeDraft((current) => ({ ...current, driverStatus: event.target.value }))}><option value="">Not entered</option><option>Cleared</option><option>Ambulance Only</option><option>Not Cleared</option></select></label>
                <label className="dpw-employee-check"><input type="checkbox" checked={employeeDraft.isDpw} onChange={(event) => setEmployeeDraft((current) => ({ ...current, isDpw: event.target.checked }))} /><span><strong>DPW employee</strong><small>Daily Log hours go to the DPW column. No holiday or overtime increase; Acting Officer pay still applies when selected.</small></span></label>
                <label className="admin-employee-check"><input type="checkbox" checked={employeeDraft.isAdmin} onChange={(event) => setEmployeeDraft((current) => ({ ...current, isAdmin: event.target.checked }))} /><span><strong>Administrative privileges</strong><small>Can access payroll, every timesheet, employee records, and rates and rules.</small></span></label>
                <label><span>Pay scale *</span><select value={employeeDraft.payScaleId} onChange={(event) => setEmployeeDraft((current) => ({ ...current, payScaleId: event.target.value }))}>{data.payScales.map((scale) => <option value={scale.id} key={scale.id}>{scale.label}</option>)}</select></label>
                <label><span>Start date</span><input type="date" value={employeeDraft.startDate} onChange={(event) => setEmployeeDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
                <label><span>Last day of work</span><input type="date" value={employeeDraft.endDate} min={employeeDraft.startDate || undefined} onChange={(event) => setEmployeeDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
              </div><p className="field-help">The employee appears on payroll beginning with their start date. After their last day, they are automatically removed from future payrolls while all history stays saved.</p></fieldset>
              <fieldset className="acting-officer-profile"><legend>Acting Officer</legend><label className="acting-officer-eligible-check"><input type="checkbox" checked={employeeDraft.actingOfficerEligible} onChange={(event) => setEmployeeDraft((current) => ({ ...current, actingOfficerEligible: event.target.checked }))} /><span><strong>Eligible to work Acting Officer shifts</strong><small>Scheduling will allow this employee to be assigned to, notified about, trade into, or request an Officer/AO shift. Commissioned officer ranks remain eligible by rank.</small></span></label><p className="field-help">This controls scheduling eligibility only. Acting Officer payroll remains a separate manual selection in the Daily Log for the employee and hours actually worked.</p></fieldset>
              <fieldset><legend>Contact & personal information</legend><div className="employee-fields three-col">
                <label><span>Date of birth</span><input type="date" value={employeeDraft.dateOfBirth} onChange={(event) => setEmployeeDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
                <label><span>Phone number</span><input type="tel" placeholder="(708) 555-0123" value={employeeDraft.phone} onChange={(event) => setEmployeeDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label><span>Login email</span><input type="email" placeholder="name@example.com" value={employeeDraft.email} onChange={(event) => setEmployeeDraft((current) => ({ ...current, email: event.target.value }))} /><small className="input-help">Must match the employee’s ChatGPT login email to show their timesheet.</small></label>
                <label className="admin-employee-check"><input type="checkbox" checked={employeeDraft.scheduleSmsOptIn} onChange={(event) => setEmployeeDraft((current) => ({ ...current, scheduleSmsOptIn: event.target.checked }))} /><span><strong>Employee elected to receive scheduling texts</strong><small>Text alerts are queued only when this is checked and a phone number is saved.</small></span></label>
                <label className="span-two"><span>Home address</span><input placeholder="Street address" value={employeeDraft.addressLine1} onChange={(event) => setEmployeeDraft((current) => ({ ...current, addressLine1: event.target.value }))} /></label>
                <label><span>City</span><input value={employeeDraft.city} onChange={(event) => setEmployeeDraft((current) => ({ ...current, city: event.target.value }))} /></label>
                <label><span>State</span><input maxLength={2} value={employeeDraft.state} onChange={(event) => setEmployeeDraft((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label>
                <label><span>ZIP code</span><input inputMode="numeric" value={employeeDraft.postalCode} onChange={(event) => setEmployeeDraft((current) => ({ ...current, postalCode: event.target.value }))} /></label>
              </div></fieldset>
              <fieldset><legend>Emergency contact</legend><div className="employee-fields three-col">
                <label><span>Contact name</span><input value={employeeDraft.emergencyName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, emergencyName: event.target.value }))} /></label>
                <label><span>Relationship</span><input placeholder="Spouse, parent, friend…" value={employeeDraft.emergencyRelationship} onChange={(event) => setEmployeeDraft((current) => ({ ...current, emergencyRelationship: event.target.value }))} /></label>
                <label><span>Emergency phone</span><input type="tel" value={employeeDraft.emergencyPhone} onChange={(event) => setEmployeeDraft((current) => ({ ...current, emergencyPhone: event.target.value }))} /></label>
              </div></fieldset>
              <fieldset><legend>Administrative notes</legend><label className="notes-field"><span>Internal notes</span><textarea rows={3} placeholder="Restrictions, payroll notes, rehire eligibility, or other important information" value={employeeDraft.notes} onChange={(event) => setEmployeeDraft((current) => ({ ...current, notes: event.target.value }))} /></label></fieldset>
            </form>}
            <section className="content-card employee-roster-card"><div className="section-header"><div><h2>Employee roster</h2><p>Ended employees remain here for payroll history and can be updated or rehired.</p></div><div className="employee-form-actions"><span className="count-badge">{data.employees.length} records</span><button type="button" className="primary-action compact" onClick={() => editEmployee()}>Add Employee</button></div></div>
              {data.employees.length === 0 && <div className="action-empty-state"><Icon name="users" size={28}/><div><strong>No employees yet</strong><p>Add the first employee to begin staffing, timesheets, and payroll.</p></div><button className="quiet-button" onClick={() => editEmployee()}>Add Employee</button></div>}
              <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Employee #</th><th>Pay Scale</th><th>Driver</th><th>Acting Officer</th><th>Phone</th><th>Start</th><th>Last Day</th><th>Status</th><th></th></tr></thead><tbody>{[...data.employees].sort((a, b) => compareEmployeeNames(a.name, b.name)).map((employee) => {
                const payrollStatus = employee.startDate && employee.startDate > data.period.endDate ? "Scheduled" : employee.endDate && employee.endDate < data.period.startDate ? "Ended" : "Active";
                return <tr key={employee.id}><td data-label="Employee"><span className="person-icon employee-list-photo">{employee.photoUpdatedAt ? <img src={`/api/employee-photo/${employee.id}?v=${encodeURIComponent(employee.photoUpdatedAt)}`} alt="" /> : <Icon name="users"/>}</span><strong>{displayName(employee.name)}</strong></td><td data-label="Employee #">{employee.employeeNumber || "—"}</td><td data-label="Pay Scale">{employee.rank}</td><td data-label="Driver">{employee.driverStatus || "—"}</td><td data-label="Acting Officer"><span className={`ao-eligibility ${employee.actingOfficerEligible ? "eligible" : ""}`}>{employee.actingOfficerEligible ? "Eligible" : "Not eligible"}</span></td><td data-label="Phone">{employee.phone || "—"}</td><td data-label="Start">{employee.startDate || "—"}</td><td data-label="Last Day">{employee.endDate || "—"}</td><td data-label="Status"><span className={`employment-status ${payrollStatus.toLowerCase()}`}>{payrollStatus}</span></td><td data-label="Actions"><div className="employee-row-actions"><button className="invite-employee" disabled={!employee.email || Boolean(invitingEmail)} onClick={() => void sendEmployeeInvite(employee)}>{invitingEmail === employee.email?.trim().toLowerCase() ? "Sending..." : "Invite"}</button><button className="edit-employee" onClick={() => editEmployee(employee)}>Edit</button><button className="delete-employee" onClick={() => setEmployeeToDelete(employee)}>Delete</button></div></td></tr>;
              })}</tbody></table></div>
            </section>
          </section>}

          {activeNav === "Rates & Rules" && rulesDraft && <section className="settings-layout">
              <article className="content-card rules-card"><div className="section-header"><div><h2>Payroll rules</h2><p>These replace the formulas that caused broken references.</p></div></div><div className="settings-grid"><label><span>Overtime threshold</span><div className="input-unit"><input type="number" min="0" step="1" value={rulesDraft.overtimeThreshold} onChange={(event) => setRulesDraft({ ...rulesDraft, overtimeThreshold: safeNumber(event.target.value) })} /><b>hours</b></div></label><label><span>Acting Officer stipend</span><div className="input-unit"><b>$</b><input type="number" value={ACTING_OFFICER_STIPEND_PER_HOUR.toFixed(2)} readOnly aria-readonly="true" /><b>/ AO hr</b></div><small>Straight stipend only—never multiplied for overtime or holidays.</small></label><label><span>DPW multiplier</span><div className="input-unit"><input type="number" min="1" step="0.05" value={rulesDraft.dpwMultiplier} onChange={(event) => setRulesDraft({ ...rulesDraft, dpwMultiplier: safeNumber(event.target.value) })} /><b>× rate</b></div></label></div></article>
            <article className="content-card"><div className="section-header"><div><h2>Pay rates</h2><p>Rates are saved by effective date, so closed and earlier payroll periods never change.</p></div></div><div className="rate-effective-control"><label><span>Effective pay-period date *</span><input type="date" required value={rateEffectiveDate} onChange={(event) => changeRateEffectiveDate(event.target.value)} /></label><small>Select the first day of a payroll period: the 11th or 26th. Existing history before this date remains unchanged.</small></div><div className="rate-list"><div className="rate-head"><span>Pay scale</span><span>Straight Time / Normal</span><span>Overtime · 1.5×</span><span>Holiday · 1.5×</span></div>{scaleDraft.map((scale, index) => <div className="rate-row" key={scale.id}><strong>{scale.label}</strong><label><span className="mobile-rate-label">Straight Time / Normal</span><b>$</b><input aria-label={`${scale.label} Straight Time / Normal Rate`} type="number" min="0" step="0.01" value={scale.regularRate} onChange={(event) => changeBaseRate(index, safeNumber(event.target.value))} /></label><label className="calculated-rate"><span className="mobile-rate-label">Overtime · 1.5×</span><b>$</b><input aria-label={`${scale.label} Overtime Rate`} readOnly value={scale.overtimeRate.toFixed(2)} /><em>Auto</em></label><label className="calculated-rate"><span className="mobile-rate-label">Holiday · 1.5×</span><b>$</b><input aria-label={`${scale.label} Holiday Rate`} readOnly value={scale.holidayRate.toFixed(2)} /><em>Auto</em></label></div>)}</div><button className="primary-action save-rules" onClick={() => void saveRules()}>Save Rates Effective {rateEffectiveDate}</button><div className="rate-history"><h3>Rate history</h3>{data.rateHistory.filter((rate, index, rows) => rows.findIndex((item) => item.effectiveDate === rate.effectiveDate) === index).slice(0, 8).map((rate) => <div key={rate.effectiveDate}><strong>{rate.effectiveDate}</strong><span>{data.rateHistory.filter((item) => item.effectiveDate === rate.effectiveDate).length} pay scales</span></div>)}</div></article>
          </section>}
        </>}
      </section>
      {activeNav !== "Scheduling" && <footer className="portal-footer"><div className="footer-identity"><img src="/stickney-fd-patch.png?v=3" alt="Official Stickney Fire Department patch" width="56" height="56" /><div><strong>Stickney Fire Department Operations Portal</strong><span>Stickney, Illinois</span><a href="tel:+17089747721">Cicero Consolidated Dispatch · (708) 974-7721</a></div></div><div className="footer-links"><button onClick={() => navigate("Phone Numbers")}>Department Directory</button><button onClick={() => navigate("Phone Numbers")}>Portal Support</button><button className="portal-version" title="Open support and department contact information" onClick={() => navigate("Phone Numbers")}>Version 1.1 · Support</button></div><p>© {new Date().getFullYear()} Stickney Fire Department · Official department system · Authorized use only</p></footer>}
    </main>
  );
}
