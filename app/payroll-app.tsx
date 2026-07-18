"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DailyLog from "./daily-log";
import HolidayPolicy from "./holiday-policy";
import PhoneNumbers from "./phone-numbers";
import EmployeeContacts from "./employee-contacts";
import { BoxCardsPage, PoliciesPage } from "./resource-pages";
import RoleDashboard from "./role-dashboard";

type Category = "shift" | "drill" | "workDetail" | "callback" | "actingOfficer" | "holiday" | "dpw";
type PayScale = { id: string; label: string; regularRate: number; overtimeRate: number; holidayRate: number };
type Employee = PayScale & {
  id: string; name: string; payScaleId: string; rank: string; active: number;
  employeeNumber?: string | null; startDate?: string | null; endDate?: string | null; dateOfBirth?: string | null;
  phone?: string | null; email?: string | null; addressLine1?: string | null; city?: string | null;
  state?: string | null; postalCode?: string | null; employmentType?: string | null; isDpw?: number | boolean; driverStatus?: string | null; isAdmin?: number | boolean;
  emergencyName?: string | null; emergencyRelationship?: string | null; emergencyPhone?: string | null; notes?: string | null;
};
type EmployeeForm = {
  id?: string; name: string; payScaleId: string; employeeNumber: string; startDate: string; endDate: string;
  dateOfBirth: string; phone: string; email: string; addressLine1: string; city: string; state: string;
  postalCode: string; employmentType: string; isDpw: boolean; driverStatus: string; isAdmin: boolean; emergencyName: string; emergencyRelationship: string;
  emergencyPhone: string; notes: string;
};
type Entry = { id?: string; employeeId: string; workDate: string; category: Category; hours: number };
type PayrollData = {
  period: { startDate: string; endDate: string; status: "draft" | "reviewed" | "finalized" };
  employees: Employee[];
  entries: Entry[];
  payScales: PayScale[];
  settings: { overtimeThreshold: number; actingOfficerPremium: number; dpwMultiplier: number };
  viewer: { email: string; isAdmin: boolean; employeeId: string | null; displayName: string };
};
type GlobalSearchItem = { id: string; type: "Employee" | "Contact" | "Policy" | "Box Card" | "Important Number"; title: string; detail: string; page: NavItem };

type NavItem = "Dashboard" | "Payroll" | "Daily Log" | "Timesheets" | "My Timesheet" | "Employees" | "Employee Contacts" | "Policies" | "Box Cards" | "Holiday Policy" | "Phone Numbers" | "Rates & Rules";
const adminNavItems: NavItem[] = ["Dashboard", "Payroll", "Daily Log", "Timesheets", "Employees", "Employee Contacts", "Policies", "Box Cards", "Holiday Policy", "Phone Numbers", "Rates & Rules"];
const employeeNavItems: NavItem[] = ["Dashboard", "My Timesheet", "Policies", "Box Cards"];
const navIcons: Record<NavItem, string> = { Dashboard: "⌂", Payroll: "$", "Daily Log": "▣", Timesheets: "◷", "My Timesheet": "◷", Employees: "♙", "Employee Contacts": "☎", Policies: "▤", "Box Cards": "⌑", "Holiday Policy": "★", "Phone Numbers": "☏", "Rates & Rules": "⚙" };
const adminNavGroups: Array<{ label: string; icon: string; items: Array<{ label: string; page: NavItem }> }> = [
  { label: "Operations", icon: "▣", items: [{ label: "Daily Log", page: "Daily Log" }, { label: "Box Cards", page: "Box Cards" }] },
  { label: "Personnel", icon: "♙", items: [{ label: "Employees", page: "Employees" }, { label: "Contacts", page: "Employee Contacts" }] },
  { label: "Payroll", icon: "$", items: [{ label: "Payroll", page: "Payroll" }, { label: "Timesheets", page: "Timesheets" }, { label: "Rates", page: "Rates & Rules" }] },
  { label: "Documents", icon: "▤", items: [{ label: "Policies", page: "Policies" }, { label: "Holiday Policy", page: "Holiday Policy" }] },
  { label: "Settings", icon: "⚙", items: [{ label: "Important Phone Numbers", page: "Phone Numbers" }] },
];
const emptyEmployee: EmployeeForm = {
  name: "", payScaleId: "firefighter", employeeNumber: "", startDate: "", endDate: "", dateOfBirth: "",
  phone: "", email: "", addressLine1: "", city: "", state: "IL", postalCode: "", employmentType: "Part-time", isDpw: false, driverStatus: "", isAdmin: false,
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

function displayName(value: string) {
  const [last, first] = value.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : value;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function safeNumber(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function Icon({ name }: { name: "people" | "clock" | "document" | "warning" | "search" | "filter" | "export" | "back" | "next" | "save" }) {
  const symbols = { people: "👥", clock: "◷", document: "▤", warning: "!", search: "⌕", filter: "▽", export: "⇧", back: "‹", next: "›", save: "✓" };
  return <span aria-hidden="true">{symbols[name]}</span>;
}

export default function PayrollApp() {
  const [activeNav, setActiveNav] = useState<NavItem>("Dashboard");
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
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeForm>(emptyEmployee);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [sharedSearchItems, setSharedSearchItems] = useState<GlobalSearchItem[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

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
      setSelectedEmployeeId((current) => current || payload.employees[0]?.id || "");
      setActiveNav((current) => (payload.viewer.isAdmin ? adminNavItems : employeeNavItems).includes(current) ? current : "Dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payroll");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const [policiesResponse, boxCardsResponse, numbersResponse] = await Promise.all([
        fetch("/api/resources?type=policy"), fetch("/api/resources?type=boxCard"), fetch("/api/phone-numbers"),
      ]);
      const [policies, boxCards, numbers] = await Promise.all([policiesResponse.json(), boxCardsResponse.json(), numbersResponse.json()]) as [
        { items?: Array<Record<string, string>> }, { items?: Array<Record<string, string>> }, { numbers?: Array<Record<string, string>> },
      ];
      setSharedSearchItems([
        ...(policies.items ?? []).map((item) => ({ id: `policy-${item.id}`, type: "Policy" as const, title: item.title, detail: [item.policyNumber, item.category, item.body].filter(Boolean).join(" · "), page: "Policies" as const })),
        ...(boxCards.items ?? []).map((item) => ({ id: `box-${item.id}`, type: "Box Card" as const, title: item.title, detail: [item.boxNumber, item.address, item.accessNotes, item.details].filter(Boolean).join(" · "), page: "Box Cards" as const })),
        ...(numbers.numbers ?? []).map((item) => ({ id: `phone-${item.id}`, type: "Important Number" as const, title: item.name, detail: [item.emergencyNumber, item.nonEmergencyNumber, item.notes].filter(Boolean).join(" · "), page: "Phone Numbers" as const })),
      ]);
    } catch { setSharedSearchItems([]); }
    finally { setGlobalSearchLoading(false); }
  }, [globalSearchLoading, sharedSearchItems.length]);

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
    const gross = regularHours * employee.regularRate + overtimeHours * employee.overtimeRate + holidayHours * employee.holidayRate + actingHours * data.settings.actingOfficerPremium + dpwHours * employee.regularRate * data.settings.dpwMultiplier;
    const issues: string[] = [];
    for (const date of listDates(data.period.startDate, data.period.endDate)) {
      const dayHours = employeeEntries.filter((entry) => entry.workDate === date && entry.category !== "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0);
      const dayActing = employeeEntries.filter((entry) => entry.workDate === date && entry.category === "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0);
      if (dayHours > 24) issues.push(`${dayLabel(date)} has ${dayHours} paid hours`);
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
    const result = await response.json() as { error?: string };
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
    const rows = [["Employee", "Rank", "Regular Hours", "OT Hours", "Holiday Hours", "Acting Officer Hours", "DPW Hours", "Gross Pay", "Status"]];
    employeeSummaries.forEach((row) => rows.push([displayName(row.employee.name), row.employee.rank, row.regularHours.toFixed(2), row.overtimeHours.toFixed(2), row.holidayHours.toFixed(2), row.actingHours.toFixed(2), row.dpwHours.toFixed(2), row.gross.toFixed(2), row.status]));
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
    setToast(status === "finalized" ? "Payroll finalized" : "Status updated");
  }

  async function saveRules() {
    if (!rulesDraft) return;
    try {
      await post({ action: "saveRules", ...rulesDraft, payScales: scaleDraft });
      await loadPayroll(periodStart);
      setToast("Rates and rules saved");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save rules"); }
  }

  function changeBaseRate(index: number, value: number) {
    const calculated = Math.round(value * 1.5 * 100) / 100;
    setScaleDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, regularRate: value, overtimeRate: calculated, holidayRate: calculated } : item));
  }

  function editEmployee(employee?: Employee) {
    if (!employee) {
      setEmployeeDraft(emptyEmployee);
    } else {
      setEmployeeDraft({
        id: employee.id, name: employee.name, payScaleId: employee.payScaleId, employeeNumber: employee.employeeNumber ?? "",
        startDate: employee.startDate ?? "", endDate: employee.endDate ?? "", dateOfBirth: employee.dateOfBirth ?? "",
        phone: employee.phone ?? "", email: employee.email ?? "", addressLine1: employee.addressLine1 ?? "",
        city: employee.city ?? "", state: employee.state ?? "IL", postalCode: employee.postalCode ?? "",
        employmentType: employee.employmentType ?? "Part-time", isDpw: Boolean(employee.isDpw), driverStatus: employee.driverStatus ?? "", isAdmin: Boolean(employee.isAdmin), emergencyName: employee.emergencyName ?? "",
        emergencyRelationship: employee.emergencyRelationship ?? "", emergencyPhone: employee.emergencyPhone ?? "", notes: employee.notes ?? "",
      });
    }
    setProfileOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEmployeeProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      await post({ action: "saveEmployee", ...employeeDraft });
      setEmployeeDraft(emptyEmployee);
      setProfileOpen(false);
      await loadPayroll(periodStart);
      setToast(employeeDraft.id ? "Employee information updated" : "Employee added");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save employee"); }
  }

  const statusLabel = data?.period.status ? data.period.status[0].toUpperCase() + data.period.status.slice(1) : "Draft";
  const visibleNav = data?.viewer.isAdmin ? adminNavItems : employeeNavItems;
  function navigate(page: NavItem) { setActiveNav(page); setMobileMenuOpen(false); setOpenNavGroup(null); setGlobalSearchOpen(false); setGlobalSearch(""); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("Dashboard")}><span className="brand-mark"><span>◆</span></span><span>Stickney FD Manager</span></button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <button className={activeNav === "Dashboard" ? "nav-active" : ""} onClick={() => navigate("Dashboard")}><span className="nav-icon" aria-hidden="true">⌂</span>Dashboard</button>
          {data?.viewer.isAdmin ? adminNavGroups.map((group) => <div className={`nav-group ${group.items.some((item) => item.page === activeNav) ? "group-active" : ""}`} key={group.label}><button aria-expanded={openNavGroup === group.label} onClick={() => setOpenNavGroup((current) => current === group.label ? null : group.label)}><span className="nav-icon" aria-hidden="true">{group.icon}</span>{group.label}<span className="nav-caret">⌄</span></button>{openNavGroup === group.label && <div className="nav-dropdown">{group.items.map((item) => <button key={item.page} className={activeNav === item.page ? "current" : ""} onClick={() => navigate(item.page)}><span aria-hidden="true">{navIcons[item.page]}</span><span>{item.label}</span></button>)}</div>}</div>) : visibleNav.filter((item) => item !== "Dashboard").map((item) => <button key={item} className={activeNav === item ? "nav-active" : ""} onClick={() => navigate(item)}><span className="nav-icon" aria-hidden="true">{navIcons[item]}</span>{item}</button>)}
        </nav>
        <button className="global-search-trigger" onClick={() => void openGlobalSearch()} aria-label="Search all records"><span aria-hidden="true">⌕</span><span>Search</span></button>
        <button className="mobile-menu-toggle" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((current) => !current)}><span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span><span>Menu</span></button>
        <div className="profile"><span className="avatar">{data?.viewer.displayName.split(/[ ,]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FD"}</span><span>{data ? displayName(data.viewer.displayName) : "Signed in"}</span><span aria-hidden="true">⌄</span></div>
        {mobileMenuOpen && <nav id="mobile-navigation" className="mobile-nav-panel" aria-label="Mobile navigation"><button className={activeNav === "Dashboard" ? "current" : ""} onClick={() => navigate("Dashboard")}><span aria-hidden="true">⌂</span>Dashboard</button>{data?.viewer.isAdmin ? adminNavGroups.map((group) => <section key={group.label}><h2><span aria-hidden="true">{group.icon}</span>{group.label}</h2>{group.items.map((item) => <button key={item.page} className={activeNav === item.page ? "current" : ""} onClick={() => navigate(item.page)}><span aria-hidden="true">{navIcons[item.page]}</span>{item.label}</button>)}</section>) : visibleNav.filter((item) => item !== "Dashboard").map((item) => <button key={item} className={activeNav === item ? "current" : ""} onClick={() => navigate(item)}><span aria-hidden="true">{navIcons[item]}</span>{item}</button>)}</nav>}
      </header>

      {globalSearchOpen && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setGlobalSearchOpen(false); }}><section className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title"><div className="global-search-head"><div><p className="eyebrow">Department-wide search</p><h2 id="global-search-title">Find anything</h2></div><button aria-label="Close search" onClick={() => setGlobalSearchOpen(false)}>×</button></div><label className="global-search-input"><span aria-hidden="true">⌕</span><input autoFocus value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search employees, contacts, policies, Box Cards, or important numbers…" /></label><div className="global-search-results">{globalSearchLoading ? <div className="global-search-empty">Loading shared information…</div> : !globalSearch.trim() ? <div className="global-search-empty">Start typing a name, address, policy, card number, or phone number.</div> : globalSearchResults.length ? globalSearchResults.map((item) => <button key={item.id} onClick={() => navigate(item.page)}><span className={`search-type ${item.type.toLowerCase().replace(" ", "-")}`}>{item.type}</span><strong>{item.title}</strong><small>{item.detail || `Open ${item.page}`}</small><b aria-hidden="true">›</b></button>) : <div className="global-search-empty">No results found for “{globalSearch}”.</div>}</div></section></div>}

      <section className="workspace">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => { setError(""); void loadPayroll(periodStart); }}>Retry</button></div>}
        {toast && <div className="toast" role="status"><Icon name="save" /> {toast}</div>}
        {loading && !data ? <div className="loading-card">Loading your payroll…</div> : data && <>
          {activeNav !== "Dashboard" && activeNav !== "Daily Log" && activeNav !== "Holiday Policy" && activeNav !== "Phone Numbers" && activeNav !== "Employee Contacts" && activeNav !== "Policies" && activeNav !== "Box Cards" && <div className="period-row">
            <div>
              <p className="eyebrow">{activeNav === "Payroll" ? "Current pay period" : activeNav}</p>
              <div className="title-line">
                <button className="period-arrow" aria-label="Previous pay period" onClick={() => setPeriodStart(shiftPeriod(periodStart, -1))}><Icon name="back" /></button>
                <h1>{periodLabel(data.period.startDate, data.period.endDate)}</h1>
                <button className="period-arrow" aria-label="Next pay period" onClick={() => setPeriodStart(shiftPeriod(periodStart, 1))}><Icon name="next" /></button>
                <span className={`period-badge ${data.period.status}`}>▣ {statusLabel}</span>
              </div>
            </div>
            {activeNav === "Payroll" && <button className="primary-action" onClick={() => openTimesheet()}><span>{data.period.status === "finalized" ? "▤" : "◷"}</span> {data.period.status === "finalized" ? "View Timesheets" : "Enter Hours"}</button>}
            {activeNav === "Timesheets" && data.viewer.isAdmin && <button className="primary-action secondary-red" onClick={() => setActiveNav("Payroll")}>Review Payroll</button>}
          </div>}

          {activeNav === "Payroll" && <div className={data.period.status === "finalized" ? "record-finalized" : "record-editable"}>
            {data.period.status === "finalized" && <div className="record-state-banner finalized"><span className="state-lock" aria-hidden="true">✓</span><div><strong>Finalized payroll · Read only</strong><span>This pay period is closed. Hours and payroll totals can no longer be changed.</span></div></div>}
            <section className="kpi-grid" aria-label="Payroll summary">
              <article className="kpi-card"><span className="kpi-icon blue"><Icon name="people" /></span><div><strong>{payrollEmployees.length}</strong><span>On This Payroll</span></div></article>
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
                    <td data-label="Employee"><span className="person-icon">♙</span><strong>{displayName(row.employee.name)}</strong></td><td data-label="Rank">{row.employee.rank}</td><td data-label="Hours" className="number tabular">{row.hours.toFixed(1)} hrs</td><td data-label="Gross Pay" className="number tabular">{formatMoney(row.gross)}</td><td data-label="Status"><span className={`status-pill ${row.status.toLowerCase().replace(" ", "-")}`}>{row.status === "Ready" ? "✓" : row.status === "Review" ? "◷" : "–"} {row.status}</span></td>
                  </tr>)}
                </tbody></table>
              </div>
              <div className="review-bar"><span><strong>{readyCount}</strong> ready · <strong>{reviewCount}</strong> need review · <strong>{payrollEmployees.length - readyCount - reviewCount}</strong> not started</span><div>{data.period.status !== "finalized" ? <><button className="quiet-button" onClick={() => void setPeriodStatus("reviewed")}>Mark Reviewed</button><button className="finalize-button" disabled={reviewCount > 0} onClick={() => void setPeriodStatus("finalized")}>Finalize Payroll</button></> : <span className="closed-confirmation">✓ Payroll closed</span>}</div></div>
            </section>
          </div>}

          {activeNav === "Dashboard" && <RoleDashboard data={{ viewer: data.viewer, employees: data.employees, entries: data.entries, period: data.period, grossPayroll, reviewCount, employeeGross: selectedSummary?.gross ?? 0 }} onNavigate={(page) => setActiveNav(page)} />}

          {(activeNav === "Timesheets" || activeNav === "My Timesheet") && selectedEmployee && selectedSummary && <div className={data.period.status === "finalized" ? "record-finalized" : "record-editable"}>{data.period.status === "finalized" && <div className="record-state-banner finalized"><span className="state-lock" aria-hidden="true">🔒</span><div><strong>Finalized timesheet · Read only</strong><span>This timesheet belongs to a closed payroll period.</span></div></div>}<section className="content-card timesheet-card">
            <div className="section-header"><div>{data.viewer.isAdmin ? <><label htmlFor="employee-select">Employee</label><select id="employee-select" value={selectedEmployee.id} onChange={(event) => setSelectedEmployeeId(event.target.value)}>{payrollEmployees.map((employee) => <option value={employee.id} key={employee.id}>{displayName(employee.name)} — {employee.rank}</option>)}</select></> : <><p className="eyebrow">My timesheet</p><h2>{displayName(selectedEmployee.name)}</h2><p>{selectedEmployee.rank} · Read only</p></>}</div><span className={`status-pill ${selectedSummary.status.toLowerCase().replace(" ", "-")}`}>{selectedSummary.status}</span></div>
            <div className="mini-summary"><div><span>Paid hours</span><strong>{selectedSummary.hours.toFixed(1)}</strong></div><div><span>Overtime</span><strong>{selectedSummary.overtimeHours.toFixed(1)}</strong></div><div><span>Holiday</span><strong>{selectedSummary.holidayHours.toFixed(1)}</strong></div><div><span>Gross pay</span><strong>{formatMoney(selectedSummary.gross)}</strong></div></div>
            {selectedSummary.issues.length > 0 && <div className="validation-box"><strong>Check these entries</strong>{selectedSummary.issues.map((issue) => <span key={issue}>• {issue}</span>)}</div>}
            <div className="entry-grid-wrap"><table className="entry-grid"><thead><tr><th>Date</th>{categoryColumns.map((column) => <th key={column.key} title={column.label}>{column.short}</th>)}<th>Total</th></tr></thead><tbody>
              {listDates(data.period.startDate, data.period.endDate).map((date) => {
                const rowTotal = categoryColumns.filter((column) => column.key !== "actingOfficer").reduce((sum, column) => sum + entryValue(selectedEmployee.id, date, column.key), 0);
                return <tr key={date}><td>{dayLabel(date)}</td>{categoryColumns.map((column) => {
                  const cell = `${selectedEmployee.id}-${date}-${column.key}`;
                  const value = entryValue(selectedEmployee.id, date, column.key);
                  const canEditEntry = data.viewer.isAdmin && data.period.status !== "finalized";
                  return <td key={column.key}><input aria-label={`${column.label} hours for ${dayLabel(date)}`} type="number" min="0" max="48" step="0.25" value={value || ""} readOnly={!canEditEntry} className={`${savingCells.has(cell) ? "saving" : ""}${canEditEntry ? "" : " timesheet-readonly"}`} onChange={(event) => { if (canEditEntry) changeEntry(selectedEmployee.id, date, column.key, safeNumber(event.target.value)); }} onBlur={(event) => { if (canEditEntry) void saveEntry(selectedEmployee.id, date, column.key, safeNumber(event.target.value)); }} /></td>;
                })}<td className={rowTotal > 24 ? "row-warning" : ""}>{rowTotal.toFixed(1)}</td></tr>;
              })}
            </tbody><tfoot><tr><td>Period totals</td>{categoryColumns.map((column) => <td key={column.key}>{data.entries.filter((entry) => entry.employeeId === selectedEmployee.id && entry.category === column.key).reduce((sum, entry) => sum + entry.hours, 0).toFixed(1)}</td>)}<td>{selectedSummary.hours.toFixed(1)}</td></tr></tfoot></table></div>
            <p className="helper-note">{data.period.status === "finalized" ? "This finalized timesheet is read only. Reopening a closed payroll period requires a separate administrator workflow." : data.viewer.isAdmin ? "Acting Officer hours add the configured premium only. DPW hours use the configured DPW multiplier. Entries save when you leave a field." : "This timesheet is read only. Contact an administrator if an entry needs to be corrected."}</p>
          </section></div>}

          {activeNav === "Daily Log" && <DailyLog employees={data.employees} onPayrollSynced={() => { void loadPayroll(periodStart); }} />}

          {activeNav === "Holiday Policy" && <HolidayPolicy />}

          {activeNav === "Phone Numbers" && <PhoneNumbers />}

          {activeNav === "Employee Contacts" && <EmployeeContacts employees={data.employees} />}

          {activeNav === "Policies" && <PoliciesPage />}

          {activeNav === "Box Cards" && <BoxCardsPage />}

          {activeNav === "Employees" && <section className="employee-page">
            <div className="standard-page-header"><div><span className="page-icon" aria-hidden="true">♙</span><div><p className="eyebrow">Personnel administration</p><h1>Employees</h1><p>Manage employment, contact, access, driver status, and emergency information.</p></div></div><button type="button" className="primary-action" onClick={() => editEmployee()}>Add Employee</button></div>
            {profileOpen && <form className="content-card employee-profile-form" onSubmit={(event) => void saveEmployeeProfile(event)}>
              <div className="section-header"><div><h2>{employeeDraft.id ? `Edit ${displayName(employeeDraft.name)}` : "Add employee"}</h2><p>Personnel, payroll eligibility, and emergency contact information.</p></div><div className="employee-form-actions">{employeeDraft.id && <button type="button" className="quiet-button" onClick={() => editEmployee()}>New Employee</button>}<button className="primary-action compact" type="submit">{employeeDraft.id ? "Save Changes" : "Add Employee"}</button></div></div>
              <fieldset><legend>Employment</legend><div className="employee-fields three-col">
                <label><span>Employee name *</span><input required placeholder="Last, First" value={employeeDraft.name} onChange={(event) => setEmployeeDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                <label><span>Employee number</span><input placeholder="Example: 1203-17" value={employeeDraft.employeeNumber} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employeeNumber: event.target.value }))} /></label>
                <label><span>Employment type</span><select value={employeeDraft.employmentType} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employmentType: event.target.value }))}><option>Part-time</option><option>Full-time</option><option>Paid-on-call</option><option>Temporary</option><option>Contract</option></select></label>
                <label><span>Driver status</span><select value={employeeDraft.driverStatus} onChange={(event) => setEmployeeDraft((current) => ({ ...current, driverStatus: event.target.value }))}><option value="">Not entered</option><option>Cleared</option><option>Ambulance Only</option><option>Not Cleared</option></select></label>
                <label className="dpw-employee-check"><input type="checkbox" checked={employeeDraft.isDpw} onChange={(event) => setEmployeeDraft((current) => ({ ...current, isDpw: event.target.checked }))} /><span><strong>DPW employee</strong><small>Daily Log hours go to the DPW column. No holiday or overtime increase; Acting Officer pay still applies when selected.</small></span></label>
                <label className="admin-employee-check"><input type="checkbox" checked={employeeDraft.isAdmin} onChange={(event) => setEmployeeDraft((current) => ({ ...current, isAdmin: event.target.checked }))} /><span><strong>Administrative privileges</strong><small>Can access payroll, every timesheet, employee records, and rates and rules.</small></span></label>
                <label><span>Pay scale *</span><select value={employeeDraft.payScaleId} onChange={(event) => setEmployeeDraft((current) => ({ ...current, payScaleId: event.target.value }))}>{data.payScales.map((scale) => <option value={scale.id} key={scale.id}>{scale.label}</option>)}</select></label>
                <label><span>Start date</span><input type="date" value={employeeDraft.startDate} onChange={(event) => setEmployeeDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
                <label><span>Last day of work</span><input type="date" value={employeeDraft.endDate} min={employeeDraft.startDate || undefined} onChange={(event) => setEmployeeDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
              </div><p className="field-help">The employee appears on payroll beginning with their start date. After their last day, they are automatically removed from future payrolls while all history stays saved.</p></fieldset>
              <fieldset><legend>Contact & personal information</legend><div className="employee-fields three-col">
                <label><span>Date of birth</span><input type="date" value={employeeDraft.dateOfBirth} onChange={(event) => setEmployeeDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
                <label><span>Phone number</span><input type="tel" placeholder="(708) 555-0123" value={employeeDraft.phone} onChange={(event) => setEmployeeDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label><span>Login email</span><input type="email" placeholder="name@example.com" value={employeeDraft.email} onChange={(event) => setEmployeeDraft((current) => ({ ...current, email: event.target.value }))} /><small className="input-help">Must match the employee’s ChatGPT login email to show their timesheet.</small></label>
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
              <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Employee #</th><th>Pay Scale</th><th>Driver</th><th>Phone</th><th>Start</th><th>Last Day</th><th>Status</th><th></th></tr></thead><tbody>{data.employees.map((employee) => {
                const payrollStatus = employee.startDate && employee.startDate > data.period.endDate ? "Scheduled" : employee.endDate && employee.endDate < data.period.startDate ? "Ended" : "Active";
                return <tr key={employee.id}><td data-label="Employee"><span className="person-icon">♙</span><strong>{displayName(employee.name)}</strong></td><td data-label="Employee #">{employee.employeeNumber || "—"}</td><td data-label="Pay Scale">{employee.rank}</td><td data-label="Driver">{employee.driverStatus || "—"}</td><td data-label="Phone">{employee.phone || "—"}</td><td data-label="Start">{employee.startDate || "—"}</td><td data-label="Last Day">{employee.endDate || "—"}</td><td data-label="Status"><span className={`employment-status ${payrollStatus.toLowerCase()}`}>{payrollStatus}</span></td><td data-label="Actions"><button className="edit-employee" onClick={() => editEmployee(employee)}>Edit</button></td></tr>;
              })}</tbody></table></div>
            </section>
          </section>}

          {activeNav === "Rates & Rules" && rulesDraft && <section className="settings-layout">
            <article className="content-card rules-card"><div className="section-header"><div><h2>Payroll rules</h2><p>These replace the formulas that caused broken references.</p></div></div><div className="settings-grid"><label><span>Overtime threshold</span><div className="input-unit"><input type="number" min="0" step="1" value={rulesDraft.overtimeThreshold} onChange={(event) => setRulesDraft({ ...rulesDraft, overtimeThreshold: safeNumber(event.target.value) })} /><b>hours</b></div></label><label><span>Acting Officer premium</span><div className="input-unit"><b>$</b><input type="number" min="0" step="0.01" value={rulesDraft.actingOfficerPremium} onChange={(event) => setRulesDraft({ ...rulesDraft, actingOfficerPremium: safeNumber(event.target.value) })} /><b>/ hr</b></div></label><label><span>DPW multiplier</span><div className="input-unit"><input type="number" min="1" step="0.05" value={rulesDraft.dpwMultiplier} onChange={(event) => setRulesDraft({ ...rulesDraft, dpwMultiplier: safeNumber(event.target.value) })} /><b>× rate</b></div></label></div></article>
            <article className="content-card"><div className="section-header"><div><h2>Pay rates</h2><p>Enter the Straight Time / Normal Rate. Overtime and Holiday automatically calculate at 1.5×.</p></div></div><div className="rate-list"><div className="rate-head"><span>Pay scale</span><span>Straight Time / Normal</span><span>Overtime · 1.5×</span><span>Holiday · 1.5×</span></div>{scaleDraft.map((scale, index) => <div className="rate-row" key={scale.id}><strong>{scale.label}</strong><label><span className="mobile-rate-label">Straight Time / Normal</span><b>$</b><input aria-label={`${scale.label} Straight Time / Normal Rate`} type="number" min="0" step="0.01" value={scale.regularRate} onChange={(event) => changeBaseRate(index, safeNumber(event.target.value))} /></label><label className="calculated-rate"><span className="mobile-rate-label">Overtime · 1.5×</span><b>$</b><input aria-label={`${scale.label} Overtime Rate`} readOnly value={scale.overtimeRate.toFixed(2)} /><em>Auto</em></label><label className="calculated-rate"><span className="mobile-rate-label">Holiday · 1.5×</span><b>$</b><input aria-label={`${scale.label} Holiday Rate`} readOnly value={scale.holidayRate.toFixed(2)} /><em>Auto</em></label></div>)}</div><button className="primary-action save-rules" onClick={() => void saveRules()}>Save Rates & Rules</button></article>
          </section>}
        </>}
      </section>
    </main>
  );
}
