"use client";
import {getSupabaseBrowserClient} from "../../supabase-browser";
import { useUnsavedWork } from "../../use-unsaved-work";
import {useArrivalAccess} from "../access";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  FilePlus2,
  Flame,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  blankPlan,
  type PlanRecord,
  planSchema,
  answered,
  formatDate,
  chicagoDate,
  example,
} from "../lib/preplan";
import Editor, { type Draft } from "./editor";
import { request } from "../lib/client";
import QuickPreplan from "./quick-preplan";
import { preplanDetailDraft } from "../lib/edit-navigation";
import BuildingDetailEditor from "./building-details";
import { ObservationCapture, ObservationList } from "./observation";
import type { Observation, ObservationDraft } from "../lib/observations";
import {
  observationDrafts,
  removeObservationDraft,
} from "../lib/observation-device";
import RecordView from "./record";
import ImportTools,{HydrantLibrary} from "./import-tools";
import Overview from './overview';
import HydrantIcon from './hydrant-icon';
import {initialOverview,type OverviewState} from '../lib/overview';
import {recordEditingDraft,draftProgressLabel,preplanReturn} from '../lib/usability';
import type {PlanData} from "../lib/preplan";
import { Brand, Blueprint, Empty, Pill, ArrowLink } from "./ui";
import {
  packets,
  removePacket,
  type Packet,
  downloadJson,
} from "../lib/device";
type User = { id: string; name: string } | null;
const nav = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "preplans", label: "Preplans", icon: Building2 },
  { key: "hydrants", label: "Hydrants", icon: HydrantIcon },
  { key: "observations", label: "Observations", icon: MessageSquarePlus },
  { key: "review", label: "Review queue", icon: ClipboardCheck },
  { key: "offline", label: "Offline library", icon: ArrowDownToLine },
];
export default function Workspace({ user }: { user: User }) {
  const access=useArrivalAccess();
  const initialRoute=useRef(false);
  const [page, setPage] = useState("overview");
  const [overview,setOverview]=useState<OverviewState>(initialOverview);
  const [importBusy,setImportBusy]=useState(false);
  const [records, setRecords] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(!!user);
  const [loadError, setLoadError] = useState("");
  const [limited, setLimited] = useState(false);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationsLoadedAt, setObservationsLoadedAt] = useState<
    string | null
  >(null);
  const [observationQuery, setObservationQuery] = useState("");
  const [observationError, setObservationError] = useState("");
  const [observationLimited, setObservationLimited] = useState(false);
  const [capture, setCapture] = useState<ObservationDraft | null>(null);
  const [pendingObservations, setPendingObservations] = useState<
    ObservationDraft[]
  >([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [localDrafts, setLocalDrafts] = useState<Draft[]>([]);
  const [current, setCurrent] = useState<PlanRecord | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [offlinePackets, setOfflinePackets] = useState<Packet[]>([]);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [online, setOnline] = useState(true);
  const [dark, setDark] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  useUnsavedWork(Boolean(draft||capture),importBusy);
  const prefix = "stickney-arrival-draft-" + (user?.id || "guest") + "-";
  useEffect(()=>{if(initialRoute.current||!records.length)return;initialRoute.current=true;const id=new URLSearchParams(window.location.search).get('preplan');const record=records.find(row=>row.id===id);if(record)setCurrent(record);},[records]);
  const notify = useCallback((s: string) => {
    setToast(s);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 8000);
    return () => clearTimeout(t);
  }, [toast]);
  const refreshDrafts = useCallback(() => {
    try {
      const values: Draft[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) {
          try {
            const v = JSON.parse(localStorage.getItem(k) || "null");
            if (
              v?.id &&
              planSchema.safeParse(v.data).success &&
              (v.revision === null || Number.isSafeInteger(v.revision))
            )
              values.push(v);
          } catch {}
        }
      }
      setLocalDrafts(values);
    } catch {
      setDeviceError(
        "Device drafts are unavailable in this browser. Use cloud Save or Export draft.",
      );
    }
  }, [prefix]);
  const refreshObservationDrafts = useCallback(() => {
    if (user)
      observationDrafts(user.id)
        .then(setPendingObservations)
        .catch(() =>
          setDeviceError(
            "Observation drafts could not be read from this device.",
          ),
        );
  }, [user]);
  const loadObservations = useCallback(async () => {
    if (!user) return;
    try {
      const result = await request<{
        observations: Observation[];
        limited: boolean;
      }>("/api/arrival/observations");
      setObservations(result.observations);
      setObservationLimited(result.limited);
      setObservationError("");
      setObservationsLoadedAt(new Date().toISOString());
    } catch (e) {
      setObservationError((e as Error).message);
    }
  }, [user]);
  useEffect(() => {
    void loadObservations();
    refreshObservationDrafts();
  }, [loadObservations, refreshObservationDrafts]);
  function addObservation(plan?: PlanRecord) {
    if(!access.has("field_preplans.edit")){notify("Your account has read-only preplan access.");return;}
    if (!user) {
      window.location.assign("/?display=portal&page=field-preplans");
      return;
    }
    const id = crypto.randomUUID();
    setCapture({
      id,
      owner: user.id,
      data: {
        id,
        planId: plan && plan.id !== "example" ? plan.id : null,
        address: plan ? (plan.published||plan.working).address : "",
        text: "",
        priority: "note",
      },
      photo: null,
      modifiedAt: Date.now(),
    });
    setMobileNav(false);
  }
  function observationSaved(o: Observation) {
    setObservations((prev) =>
      [o, ...prev.filter((x) => x.id !== o.id)].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
    setCapture(null);
    refreshObservationDrafts();
    notify(
      o.priority === "crew-alert"
        ? "Crew alert saved as a field observation."
        : "Observation saved. The approved preplan is unchanged.",
    );
  }
  function closeEditor(savedRecord?:PlanRecord) {
    setDraft(null);
    setCurrent(savedRecord||null);
    if(savedRecord){setPage('preplans');setReviewMode(savedRecord.status!=='published');notify('Working copy saved to the department. Review and send it when ready; approval is separate.');}
    else {setPage('preplans');notify('Draft kept on this device. Choose Resume under Saved on this device to continue.');}
    refreshDrafts();
  }
  function submitted(r: PlanRecord) {
    merge(r);
    setDraft(null);
    setPage("review");
    setReviewMode(true);
    refreshDrafts();
    notify("Working copy sent for review. It is not published yet.");
  }
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError("");
    try {
      const result = await request<{ plans: PlanRecord[]; limited?: boolean }>(
        "/api/arrival/plans",
      );
      setRecords(result.plans);
      setLimited(!!result.limited);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void load();
    refreshDrafts();
    try {
      setDark(localStorage.getItem("stickney-arrival-theme") === "dark");
    } catch {}
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setDeviceError(
            "Offline page installation failed. Retry online before relying on offline access.",
          ),
        );
    const change = () => setOnline(navigator.onLine);
    change();
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, [load, refreshDrafts]);
  useEffect(() => {
    document.querySelector<HTMLElement>(".arrival-app")?.setAttribute("data-theme",dark ? "dark" : "light");
    try {
      localStorage.setItem("stickney-arrival-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    if (page === "offline" && user)
      packets(user.id)
        .then(setOfflinePackets)
        .catch(() => setDeviceError("Device storage could not be opened."));
  }, [page, user]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function navigate(key: string) {
    if(importBusy){notify("The data import is running. Wait for the result before leaving this screen.");return;}
    if (draft) { notify("Save or keep this draft and exit before opening another workspace section."); setMobileNav(false); return; }
    setPage(key);
    setCurrent(null);
    setMobileNav(false);
    setQuery("");
    setFilter("all");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function merge(r: PlanRecord) {
    setDraft((d) =>
      d?.id === r.id
        ? { ...d, id: r.id, revision: r.revision, data: r.working }
        : d,
    );
    setRecords((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
    setCurrent(r);
  }
  function start() {
    if(!access.has("field_preplans.edit")){notify("Your account has read-only preplan access.");return;}
    if (draft) { notify("Save or keep your current draft and exit before starting another preplan."); setMobileNav(false); return; }
    if (!user) {
      window.location.assign("/?display=portal&page=field-preplans");
      return;
    }
    setCurrent(null);
    setDraft({
      id: crypto.randomUUID(),
      revision: null,
      kind: "quick",
      data: { ...blankPlan(), scope: "quick" },
    });
    setMobileNav(false);
  }
  function edit(r: PlanRecord) {
    if(!access.has("field_preplans.edit")){notify("Your account has read-only preplan access.");return;}
    const local = localDrafts.find((x) => x.id === r.id);
    setDraft(recordEditingDraft(r,local));
    setCurrent(null);
  }
  function editDetail(r:PlanRecord,label:string){
    if(!access.has('field_preplans.edit')){notify('Your account has read-only preplan access.');return;}
    const local=localDrafts.find(d=>d.id===r.id);
    setDraft(recordEditingDraft(r,local,label));setCurrent(null);
    if(local)notify('Your saved device draft was restored. Save to department when you are ready.');
  }
  function open(r: PlanRecord, review = false) {
    void loadObservations();
    setCurrent(r);
    setReviewMode(review);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function buildingDetails(r: PlanRecord, section?: "outline") {
    if(!access.has("field_preplans.edit")){notify("Your account has read-only preplan access.");return;}
    const local = localDrafts.find((x) => x.id === r.id);
    setDraft({
      id: r.id,
      revision: local?.revision ?? r.revision,
      data: local?.data || structuredClone(r.working),
      kind: "details",
      section,
    });
    setCurrent(null);
  }
  function openPhotoTools(r: PlanRecord) {
    if(!access.has("field_preplans.edit")){notify("Your account has read-only preplan access.");return;}
    setDraft({
      id: r.id,
      revision: r.revision,
      data: { ...r.working, step: 4 },
      kind: "photos",
    });
    setCurrent(null);
  }
  const reviews = records.filter((r) => r.status === "review");
  const published = records.filter((r) => r.published);
  const due = published.filter(
    (r) => r.published?.reviewDue && r.published.reviewDue <= chicagoDate(),
  );
  const drafts = records.filter((r) => r.status === "draft");
  const visible = records.filter(
    (r) =>
      (page !== "review" || r.status === "review") &&
      (filter === "all" ||
        (filter === "published"
          ? !!r.published
          : filter === "due"
            ? !!r.published?.reviewDue && r.published.reviewDue <= chicagoDate()
            : r.status === filter)) &&
      (!query ||
        [r.name, r.address, r.working.city, r.working.occupancy]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  async function clearLocal() {
    localStorage.removeItem("stickney-arrival-owner");
    try {
      const saved = await packets(user?.id || "");
      for (const p of saved) await removePacket(p.id);
      for (const o of await observationDrafts(user?.id || ""))
        await removeObservationDraft(o.id);
      setPendingObservations([]);
      for (const d of localDrafts) localStorage.removeItem(prefix + d.id);
      const hydrantPrefix="arrival-hydrant-activity-"+(user?.id||"")+"-";for(const key of Object.keys(localStorage))if(key.startsWith(hydrantPrefix))localStorage.removeItem(key);
      setLocalDrafts([]);
      setOfflinePackets([]);
      notify(
        "Device drafts and offline packets cleared. Cloud records are unchanged.",
      );
      return true;
    } catch {
      notify("Device storage could not be cleared. Try again.");
      return false;
    }
  }
  async function signout() {
    if (!(await clearLocal())) return;
    const response=await fetch("/api/auth/pin",{method:"DELETE"});if(!response.ok){notify("Sign-out could not be confirmed. Use the portal sign-out control.");return;}
    await getSupabaseBrowserClient().auth.signOut({scope:"local"});
    window.location.assign("/?display=portal");
  }
  const DraftEditor =
    draft?.kind === "details"
      ? BuildingDetailEditor
      : draft?.kind === "photos" || draft?.kind === "full"
        ? Editor
        : QuickPreplan;
  return (
    <div className={"app-shell " + (draft ? "editing" : "")}>
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      {mobileNav && (
        <button
          aria-label="Close navigation"
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        inert={!!capture}
        className={"sidebar " + (mobileNav ? "open" : "")}
      >
        <button
          className="brand-button"
          disabled={!!draft}
          onClick={() => {
            if (!draft) navigate("overview");
          }}
          aria-label="Stickney preplan overview"
        >
          <span className="trim-brand"><img src="/stickney-fd-patch.png" alt="Stickney Fire Department"/>Stickney<span>PREPLANS</span></span>
        </button>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.key}
              disabled={!!draft}
              className={page === item.key && !current ? "active" : ""}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.key === "review" && reviews.length > 0 && (
                <b className="nav-count">{reviews.length}</b>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="app-content" inert={!!capture}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <b>
              {draft
                ? "Field visit"
                : current
                  ? "Preplan brief"
                  : page === "settings"
                      ? "Settings"
                      : page === "imports" ? "Data & imports" : nav.find((n) => n.key === page)?.label}
            </b>
          </div>
          <div className="topbar-right">
            {!draft && access.has('field_preplans.edit') && (
              <button
                className="btn small observation-trigger"
                onClick={() => addObservation(current || undefined)}
              >
                <MessageSquarePlus size={17} />
                <span>Add observation</span>
              </button>
            )}
            {!draft && (current || !['overview','preplans','review'].includes(page)) && (
              <label className="header-search">
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search preplans"
                  placeholder="Find a building or address"
                  disabled={importBusy}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage("preplans");
                    setCurrent(null);
                  }}
                />
                <kbd>/</kbd>
              </label>
            )}
            <span
              className={"connection " + (!online ? "disconnected" : "")}
              title={
                !online
                  ? "Browser reports offline. Use downloaded packets."
                  : loadError
                    ? "Cloud request failed. Browser network is available."
                    : "Browser connection available. Cloud save state is shown separately."
              }
            >
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{online ? "Online" : "Offline"}</span>
            </span>
            <button className="icon-button" aria-label="Settings" title="Settings" disabled={!!draft || importBusy} onClick={()=>navigate("settings")}><Settings size={20}/></button>
          </div>
        </header>
        <main id="main" className={draft ? "main editor-main" : "main"}>
          {draft ? (
            <DraftEditor
              key={draft.id}
              initial={draft}
              storageKey={prefix + draft.id}
              onSaved={merge}
              onClose={closeEditor}
              onSubmitted={submitted}
              onPhotos={openPhotoTools}
              onEditDetails={(currentDraft: Draft, label: string) => {
                if (!access.has("field_preplans.edit")) { notify("Your account has read-only preplan access."); return; }
                setDraft(preplanDetailDraft(currentDraft, label));
              }}
            />
          ) : current ? (
            <RecordView
              key={current.id}
              record={current}
              userId={user?.id || null}
              review={reviewMode}
              backLabel={preplanReturn(page).label}
              onBack={() => {
                setCurrent(null);
                setPage(preplanReturn(page).page);
              }}
              onEdit={edit}
              onEditDetails={editDetail}
              onDetails={buildingDetails}
              onFootprint={() => buildingDetails(current, "outline")}
              onObserve={() => addObservation(current)}
              onObservationUpdate={observationSaved}
              observationsLoadedAt={observationsLoadedAt}
              onUpdate={(r) => {
                merge(r);
                setReviewMode(r.status === "review");
              }}
              onToast={notify}
            />
          ) : (
            <>
              {!user && (
                <div className="signin-banner">
                  <ShieldCheck size={20} />
                  <span>
                    <b>Your workspace is private.</b> Sign in to create and save
                    preplans. You can explore the fictional example now.
                  </span>
                  <a
                    className="btn primary small"
                    href="/signin-with-chatgpt?return_to=%2F"
                    target="_top"
                  >
                    Sign in
                  </a>
                </div>
              )}
              {limited && (
                <div className="review-notice warning">
                  Showing the latest 1,000 cloud records. Counts, search and
                  export cover those loaded records; older records are retained
                  in the cloud. This pilot needs pagination before a larger
                  department rollout.
                </div>
              )}
              {loadError && (
                <div className="form-error" role="alert">
                  {loadError}
                  <button className="text-button" onClick={() => void load()}>
                    <RefreshCw size={15} />
                    Retry cloud connection
                  </button>
                </div>
              )}
              {deviceError && (
                <div className="review-notice warning">
                  <TriangleAlert size={18} />
                  {deviceError}
                </div>
              )}
              {page === "hydrants" && user && <HydrantLibrary ownerId={user?.id||""}/>}
              {page === "imports" && user && <ImportTools onImported={load} onBusyChange={setImportBusy} onOpen={async id=>{try {const r=await request<{plan:PlanRecord}>("/api/arrival/plans/"+id);merge(r.plan);open(r.plan);}catch(e){notify((e as Error).message);}}} onStart={(v,id)=>{const planId="plan-"+id;const found=records.find(r=>r.id===planId);if(found){edit(found);return;}setDraft({id:planId,revision:null,kind:"quick",data:{...blankPlan(),scope:"quick",...v,imported:{recordId:id,sources:["Imported address"],importedAt:new Date().toISOString(),linkedHydrantIds:[]}}});}}/>}
              {(page === "observations" || page === "review") && (
                <section className="panel observations-workspace">
                  <div className="panel-title">
                    <div>
                      <span className="eyebrow">
                        FIELD NOTES · SEPARATE FROM THE APPROVED PLAN
                      </span>
                      <h2>
                        {page === "review"
                          ? "Observations to review"
                          : "Observations"}
                      </h2>
                      <p>
                        Capture what you notice. Check it later without
                        repeating the quick preplan.
                      </p>
                    </div>
                    {access.has('field_preplans.edit')&&<button
                      className="btn primary"
                      onClick={() => addObservation()}
                    >
                      <MessageSquarePlus size={17} />
                      Add observation
                    </button>}
                  </div>
                  {pendingObservations.length > 0 && (
                    <div className="pending-observations">
                      <h3>Kept on this device · not yet saved online</h3>
                      {pendingObservations.map((d) => (
                        <div className="draft-row" key={d.id}>
                          <div>
                            <b>
                              {d.data.address ||
                                records.find((r) => r.id === d.data.planId)
                                  ?.name ||
                                "Selected building"}
                            </b>
                            <small>
                              {d.data.text.slice(0, 120) ||
                                "Photo observation draft"}
                              {d.photo ? " · photo kept" : ""}
                            </small>
                          </div>
                          <button
                            className="btn small"
                            onClick={() => setCapture(d)}
                          >
                            Resume note
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {observationError ? (
                    <div role="alert" className="form-error">
                      {observationError}
                      <button
                        className="text-button"
                        onClick={() => void loadObservations()}
                      >
                        Retry loading observations
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="observation-search">
                        <label className="search-field">
                          <Search size={17} />
                          <input
                            aria-label="Search field observations"
                            type="search"
                            placeholder="Find an address or observation"
                            value={observationQuery}
                            onChange={(e) =>
                              setObservationQuery(e.target.value)
                            }
                          />
                        </label>
                        <button
                          className="btn small"
                          onClick={() => void loadObservations()}
                        >
                          Refresh notes
                        </button>
                      </div>
                      <ObservationList
                        observations={observations.filter(
                          (o) =>
                            (page !== "review" || o.state === "unreviewed") &&
                            [o.address, o.text]
                              .join(" ")
                              .toLowerCase()
                              .includes(observationQuery.toLowerCase()),
                        )}
                        review
                        onUpdate={observationSaved}
                        onOpenBuilding={(id) => {
                          const r = records.find((r) => r.id === id);
                          if (r) open(r);
                          else
                            notify(
                              "This building is not in the loaded list. Refresh the preplans.",
                            );
                        }}
                      />
                      {!observations.some(
                        (o) => page !== "review" || o.state === "unreviewed",
                      ) && (
                        <p className="empty-note">
                          {page === "review"
                            ? "No unreviewed observations loaded."
                            : "Nothing recorded yet. A building or address and a short note are enough."}
                        </p>
                      )}
                    </>
                  )}
                  {observationLimited && (
                    <p className="field-help">
                      Latest 200 observations shown. Older observations remain
                      saved in the cloud.
                    </p>
                  )}
                </section>
              )}
              {page === "overview" && <>
                <header className="page-heading with-action"><div><h1>Maps & preplans</h1><p>Find a building, open its preplan, then read or update its details.</p></div><div className="action-group"><button className="btn" onClick={()=>navigate('preplans')}>{access.has('field_preplans.edit')?'Find or edit a preplan':'Find a preplan'}</button>{access.has('field_preplans.edit')&&<button className="btn primary" onClick={start}><Plus size={18}/>Add preplan</button>}</div></header>
                <Overview records={records} loading={loading} signedIn={!!user} ownerId={user?.id||""} state={overview} onChange={setOverview} onOpen={r=>open(r,r.status==='review')} onObserve={addObservation}/>
                {localDrafts.length>0&&<div className="resume-strip"><span>{localDrafts.length} saved device {localDrafts.length===1?"draft":"drafts"}</span><button className="btn small" onClick={()=>navigate("preplans")}>Resume draft</button></div>}
              </>}
              {(page === "preplans" || page === "review") && (
                <>
                  <header className="page-heading with-action"><div><h1>{page === "review" ? "Review queue" : "Preplans"}</h1>
                    </div>
                    {page==='review'?<button className="btn" onClick={()=>navigate('preplans')}>Back to preplans</button>:access.has('field_preplans.edit')&&<button className="btn primary" onClick={start}><Plus size={18}/>Add preplan</button>}
                  </header>
                  <section className="preplan-next-step" aria-label="What to do next"><strong>{page==='review'?'Review before publishing':'Find an existing building first'}</strong><p>{page==='review'?'Open a submitted working copy, review its details and unknowns, then approve it or return it for correction. Only authorized reviewers can approve.':access.has('field_preplans.edit')?'Search by name or address, open the building, then choose Edit preplan. Add preplan starts a separate building record.':'Search by name or address and open a building to read its saved preplan. Ask a preplan editor to make changes.'}</p></section>
                  {page === "preplans" && localDrafts.length > 0 && (
                    <section className="panel device-drafts">
                      <div className="panel-title">
                        <h2>Saved on this device</h2>
                        <Pill>{localDrafts.length} drafts</Pill>
                      </div>
                      {localDrafts.map((d) => (
                        <div className="draft-row" key={d.id}>
                          <span className="file-icon">
                            <FilePlus2 size={20} />
                          </span>
                          <div>
                            <b>{d.data.name || "Untitled field visit"}</b>
                            <small>
                              {d.data.address || "Address not entered"} ·{" "}
                              {draftProgressLabel(d)}{" "}
                              {d.revision === null
                                ? "· not saved to cloud"
                                : ""}
                            </small>
                          </div>
                          <button
                            className="btn small"
                            disabled={!access.has('field_preplans.edit')}
                            onClick={() => setDraft(d)}
                          >
                            Resume
                            <ArrowRight size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={
                              "Export draft " + (d.data.name || "Untitled")
                            }
                            onClick={() =>
                              downloadJson(d, "arrival-device-draft.json")
                            }
                          >
                            <ArrowDownToLine size={16} />
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                  <section className="panel">
                    <div className="list-toolbar">
                      <label className="search-field">
                        <Search size={18} />
                        <input
                          type="search"
                          value={query}
                          placeholder="Search name, street, city or occupancy"
                          aria-label="Filter buildings"
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      {page === "preplans" && (
                        <select
                          aria-label="Filter by status"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="all">All statuses</option>
                          <option value="draft">Working drafts</option>
                          <option value="review">In review</option>
                          <option value="published">
                            Published arrival versions
                          </option>
                          <option value="due">Reviews due</option>
                        </select>
                      )}
                      <button
                        className="icon-button"
                        aria-label="Refresh cloud preplans"
                        onClick={() => void load()}
                        disabled={loading}
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                    {!loading&&<p className="preplan-result-count" role="status">{visible.length} {visible.length===1?'building':'buildings'} shown{query?` for “${query}”`:''}{filter!=='all'?' · status filter applied':''}</p>}
                    {loading ? (
                      <Empty title="Loading preplans…">
                        Getting your saved workspace.
                      </Empty>
                    ) : visible.length ? (
                      <div className="plan-rows">
                        {visible.map((r) => (
                          <PlanRow
                            key={r.id}
                            record={r}
                            onClick={() => open(r, page === "review")}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title={
                          query || filter!=='all'
                            ? "No matching buildings"
                            : page === "review"
                              ? "Nothing waiting for review"
                              : "Your building library is ready"
                        }
                        action={
                          query || filter!=='all' ? <button className="btn" onClick={()=>{setQuery('');setFilter('all');}}>Clear search &amp; filters</button> : page === "review" ? (
                            <button
                              className="btn"
                              onClick={() => navigate("preplans")}
                            >
                              Open preplans
                              <ArrowRight size={16} />
                            </button>
                          ) : access.has('field_preplans.edit') ? (
                            <button className="btn primary" onClick={start}>
                              <Plus size={16} /> Start a preplan
                            </button>
                          ) : undefined
                        }
                      >
                        {query || filter!=='all'
                          ? "Try another name, street or city, or clear the search and status filter. Check for an existing record before adding a building."
                          : page === "review"
                            ? "Finish a guided visit and send it here. Approval is a separate action."
                            : "Start a quick preplan. Cloud records will appear here after you save."}
                      </Empty>
                    )}
                  </section>
                  {page === "preplans" && (
                    <button
                      className="example-strip"
                      onClick={() => open(example)}
                    >
                      <span>
                        <EyeIcon />
                        <b>Want to see a finished preplan?</b>
                        <small>Open a clearly labeled fictional example.</small>
                      </span>
                      <ArrowRight size={20} />
                    </button>
                  )}
                </>
              )}
              {page === "offline" && (
                <>
                  <header className="page-heading">
                    <div className="eyebrow">
                      READY WHEN THE CONNECTION ISN’T
                    </div>
                    <h1>Offline library</h1>
                    <p>
                      Deliberately downloaded, published arrival packets on this
                      device.
                    </p>
                  </header>
                  <div className="offline-intro">
                    <WifiOff size={26} />
                    <div>
                      <h2>Published text and exterior photos.</h2>
                      <p>
                        Download a published preplan from its arrival brief
                        while online. Packets keep their revision and download
                        timestamp. CAD, maps, PDFs and live service status are
                        not available offline. Device packets stay until you
                        clear them or sign out here.
                      </p>
                      <a className="btn" href="/arrival-offline/index.html">
                        Open offline reader
                        <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                  {offlinePackets.length ? (
                    <section className="panel">
                      {offlinePackets.map((packet) => (
                        <div className="draft-row" key={packet.id}>
                          <Building2 size={22} />
                          <div>
                            <b>{packet.record.name}</b>
                            <small>
                              Published revision{" "}
                              {packet.record.publishedRevision} · saved{" "}
                              {formatDate(packet.savedAt)}
                              {records.find((x) => x.id === packet.id)
                                ?.publishedRevision !==
                              packet.record.publishedRevision
                                ? " · check for newer publication"
                                : ""}
                            </small>
                          </div>
                          <a
                            className="btn small"
                            href={"/arrival-offline/index.html#" + packet.id}
                          >
                            Read packet
                          </a>
                          <button
                            className="icon-button"
                            aria-label={
                              "Remove device packet " + packet.record.name
                            }
                            onClick={async () => {
                              try {
                                await removePacket(packet.id);
                                setOfflinePackets((prev) =>
                                  prev.filter((x) => x.id !== packet.id),
                                );
                                notify(
                                  "Device packet removed. Cloud preplan kept.",
                                );
                              } catch {
                                notify("Could not remove the device packet.");
                              }
                            }}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      ))}
                    </section>
                  ) : (
                    <section className="panel">
                      <Empty
                        title="No packets downloaded yet"
                        action={
                          <button
                            className="btn primary"
                            onClick={() => navigate("preplans")}
                          >
                            Choose a published preplan
                            <ArrowRight size={17} />
                          </button>
                        }
                      >
                        Open a published arrival brief and choose Save published
                        plan offline. Drafts never become offline arrival
                        packets.
                      </Empty>
                    </section>
                  )}
                </>
              )}
              {page === "settings" && (
                <>
                  <header className="page-heading"><h1>Settings</h1></header>
                  <section className="panel"><div className="action-group"><button className="btn" onClick={()=>navigate("imports")}>Data & imports</button><button className="btn" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>} {dark?"Light appearance":"Dark appearance"}</button></div></section>
                  <div className="detail-grid">
                    <section className="panel">
                      <h2>Device storage</h2>
                      <p>
                        Clear device drafts and downloaded arrival packets from
                        this browser. Cloud records remain saved.
                      </p>
                      <button className="btn" onClick={() => void clearLocal()}>
                        Clear device drafts & packets
                      </button>
                      <h3 className="mt24">Export cloud records</h3>
                      <p>
                        JSON export includes working and published snapshots.
                        Uploaded file bodies are separate.
                      </p>
                      <button
                        className="btn"
                        onClick={() =>
                          downloadJson(
                            {
                              exportedAt: new Date().toISOString(),
                              plans: records,
                            },
                            "arrival-workspace-export.json",
                          )
                        }
                        disabled={!records.length}
                      >
                        <ArrowDownToLine size={16} />
                        Export loaded workspace
                      </button>
                    </section>
                    <section className="panel">
                      <h2>Sign-in</h2>
                      <p>
                        {user
                          ? "Sign out clears this browser’s draft and offline packet copies through this app."
                          : "Sign in with ChatGPT to save records and upload private photos."}
                      </p>
                      {user ? (
                        <button className="btn" onClick={() => void signout()}>
                          <LogOut size={16} /> Clear device copies & sign out
                        </button>
                      ) : (
                        <a
                          className="btn primary"
                          href="/signin-with-chatgpt?return_to=%2F"
                          target="_top"
                        >
                          Sign in with ChatGPT
                        </a>
                      )}
                    </section>
                  </div>
                </>
              )}
            </>
          )}
        </main>

      </div>
      {capture && (
        <ObservationCapture
          key={capture.id}
          initial={capture}
          records={records}
          onClose={() => {
            setCapture(null);
            refreshObservationDrafts();
          }}
          onSaved={observationSaved}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function EyeIcon() {
  return <FolderOpen size={20} />;
}
function PlanRow({
  record: r,
  onClick,
}: {
  record: PlanRecord;
  onClick: () => void;
}) {
  return (
    <button className="plan-row" onClick={onClick}>
      <span
        className={"plan-icon " + (r.status === "published" ? "green" : "")}
      >
        <Building2 size={23} />
      </span>
      <div className="plan-info">
        <b>{r.name}</b>
        <small>
          {r.address} · {r.working.city}
        </small>
      </div>
      <div className="plan-row-meta">
        <Pill
          tone={
            r.status === "published"
              ? "green"
              : r.status === "review"
                ? "blue"
                : "orange"
          }
        >
          {r.status === "published"
            ? "Published"
            : r.status === "review"
              ? "In review"
              : "Working draft"}
        </Pill>
        <small>
          {r.status === "draft"
            ? r.working.scope === "quick"
              ? "Quick preplan · working copy"
              : answered(r.working) + "/12 details answered"
            : "Saved " + formatDate(r.updatedAt)}
        </small>
        {r.published && r.status !== "published" && (
          <small>Previous arrival version kept</small>
        )}
      </div>
      <ArrowRight size={18} />
    </button>
  );
}
