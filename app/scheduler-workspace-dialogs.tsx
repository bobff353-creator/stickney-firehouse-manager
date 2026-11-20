"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { shiftHasNotStarted } from "./scheduler-member-view";
import {
  reminderAudience,
  reminderExplanation,
  reminderTimings,
} from "./scheduler-reminders";
import {
  clearedForPosition,
  incomingTradeOffers,
  scheduleClock,
  scheduleDates,
  scheduleDayLabel,
  scheduleEligibility,
  scheduleSpan,
  tradeSubmission,
  upcomingAssignments,
} from "./scheduler-workspace-model";
import type {
  LiveSchedule,
  ScheduleReminder,
  ScheduleShift,
  ScheduleSlot,
  ScheduleTrade,
  WorkspaceRequest,
} from "./scheduler-workspace-model";

export type ScheduleDialogState =
  | { kind: "trade" | "claim" | "staff" | "details"; slot: ScheduleSlot }
  | { kind: "accept"; slot: ScheduleSlot; trade: ScheduleTrade }
  | { kind: "request" }
  | { kind: "review"; request: WorkspaceRequest }
  | { kind: "pattern"; shift?: ScheduleShift }
  | { kind: "detail"; date: string }
  | { kind: "reminder"; rule: ScheduleReminder };
type Props = {
  state: ScheduleDialogState;
  data: LiveSchedule;
  employeeId: string;
  busy: boolean;
  disabled: boolean;
  error: string;
  act: (body: Record<string, unknown>) => Promise<boolean>;
  close: () => void;
};
type FormProps = Omit<Props, "state" | "busy" | "error">;
const titles = {
  trade: "Offer a trade",
  claim: "Request this shift",
  staff: "Manage position",
  details: "Shift details",
  accept: "Review trade",
  request: "New schedule request",
  review: "Request details",
  pattern: "Recurring schedule",
  detail: "Add special detail",
  reminder: "Scheduling alert",
};
export function ScheduleDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { state, close, busy, error, ...form } = props;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sf-schedule sf-dialog"
      aria-labelledby="sf-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="sf-dialog-heading">
        <div>
          <p className="sf-eyebrow">STICKNEY SCHEDULE</p>
          <h2 id="sf-dialog-title">{titles[state.kind]}</h2>
        </div>
        <button
          type="button"
          className="sf-icon-button sf-secondary"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="sf-dialog-body">
        {error && (
          <div className="sf-message sf-error" role="alert">
            {error}
          </div>
        )}
        {state.kind === "trade" ? (
          <TradeForm {...form} close={close} slot={state.slot} />
        ) : state.kind === "claim" ? (
          <ClaimForm {...form} close={close} slot={state.slot} />
        ) : state.kind === "accept" ? (
          <AcceptForm
            {...form}
            close={close}
            slot={state.slot}
            trade={state.trade}
          />
        ) : state.kind === "request" ? (
          <RequestForm {...form} close={close} />
        ) : state.kind === "review" ? (
          <ReviewForm {...form} close={close} request={state.request} />
        ) : state.kind === "staff" ? (
          <StaffForm {...form} close={close} slot={state.slot} />
        ) : state.kind === "pattern" ? (
          <PatternForm {...form} close={close} shift={state.shift} />
        ) : state.kind === "detail" ? (
          <DetailForm {...form} close={close} date={state.date} />
        ) : state.kind === "reminder" ? (
          <ReminderForm {...form} close={close} rule={state.rule} />
        ) : (
          <>
            <ShiftSummary slot={state.slot} />
            <p>{state.slot.employeeName || "Open position"}</p>
            <Footer close={close} />
          </>
        )}
      </div>
    </dialog>
  );
}
function Footer({
  close,
  disabled = false,
  label,
  children,
}: {
  close: () => void;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="sf-dialog-footer">
      <button type="button" className="sf-secondary" onClick={close}>
        Back
      </button>
      {children}
      {label && (
        <button type="submit" disabled={disabled}>
          {label}
        </button>
      )}
    </div>
  );
}
function ShiftSummary({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="sf-shift-summary">
      <p>{scheduleDayLabel(slot.entryDate, true)}</p>
      <h3>{slot.role}</h3>
      <strong>{scheduleSpan(slot)}</strong>
      {slot.staffingReason && <p>{slot.staffingReason}</p>}
    </div>
  );
}
function Note({
  value,
  set,
  max = 300,
}: {
  value: string;
  set: (text: string) => void;
  max?: number;
}) {
  return (
    <label>
      Note (optional)
      <textarea
        maxLength={max}
        rows={3}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="Add anything the reviewer should know"
      />
    </label>
  );
}
function TradeForm({
  data,
  employeeId,
  slot,
  disabled,
  act,
  close,
}: FormProps & { slot: ScheduleSlot }) {
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState("giveaway");
  const [back, setBack] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const now = new Date();
  const targets = data.employees.filter(
    (e) => e.id !== employeeId && clearedForPosition(e, slot.role),
  );
  const returns = upcomingAssignments(data, target, now).filter(
    (s) =>
      shiftHasNotStarted(s.entryDate, s.startTime, now) &&
      !scheduleEligibility(data, employeeId, s, [slot.id]) &&
      !scheduleEligibility(data, target, slot, [s.id]),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (kind === "swap" && !back)
        throw new Error("Choose a return shift for this swap.");
      const body = tradeSubmission(
        data,
        employeeId,
        slot.id,
        target,
        kind === "swap" ? back : "",
        note,
      );
      if (await act(body)) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your trade selections.");
    }
  }
  return (
    <form onSubmit={submit}>
      <ShiftSummary slot={slot} />
      <p>
        Send this assignment to one qualified member, or offer it to everyone
        cleared for the position.
      </p>
      <label>
        Who can accept?
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setBack("");
            if (!e.target.value) setKind("giveaway");
          }}
        >
          <option value="">Anyone cleared for {slot.role}</option>
          {targets.map((e) => (
            <option value={e.id} key={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <label>
          Trade type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="giveaway">Give away this shift</option>
            <option value="swap">Swap for their shift</option>
          </select>
        </label>
      )}
      {target && kind === "swap" && (
        <label>
          Their return shift
          <select
            value={back}
            onChange={(e) => setBack(e.target.value)}
            required
          >
            <option value="">Choose an eligible saved shift</option>
            {returns.map((s) => (
              <option value={s.id} key={s.id}>
                {scheduleDayLabel(s.entryDate)} · {s.role} · {scheduleSpan(s)}
              </option>
            ))}
          </select>
          {!returns.length && (
            <span className="sf-help">
              No eligible return shifts are saved for this member.
            </span>
          )}
        </label>
      )}
      <Note value={note} set={setNote} />
      <p className="sf-help">
        Your assignment stays yours until the other member accepts and an
        administrator approves.
      </p>
      {error && (
        <p className="sf-message sf-error" role="alert">
          {error}
        </p>
      )}
      <Footer close={close} disabled={disabled} label="Post trade offer" />
    </form>
  );
}
function ClaimForm({
  data,
  employeeId,
  slot,
  disabled,
  act,
  close,
}: FormProps & { slot: ScheduleSlot }) {
  const [note, setNote] = useState("");
  const pending = data.claims.some(
    (c) =>
      c.slotId === slot.id &&
      c.employeeId === employeeId &&
      c.status === "pending",
  );
  const reason = scheduleEligibility(data, employeeId, slot);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act({ action: "submitClaim", slotId: slot.id, note }))
          close();
      }}
    >
      <ShiftSummary slot={slot} />
      <p>Request this open position. It will be assigned after approval.</p>
      <Note value={note} set={setNote} />
      {(reason || pending) && (
        <p className="sf-message">
          {reason || "You already have a pending request for this position."}
        </p>
      )}
      <Footer
        close={close}
        disabled={disabled || !!reason || pending}
        label="Send shift request"
      />
    </form>
  );
}
function AcceptForm({
  data,
  employeeId,
  slot,
  trade,
  disabled,
  act,
  close,
}: FormProps & { slot: ScheduleSlot; trade: ScheduleTrade }) {
  const back = data.slots.find((s) => s.id === trade.returnSlotId);
  const eligible = incomingTradeOffers(data, employeeId, new Date()).some(
    (t) => t.id === trade.id,
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await act({
            action: "respondTrade",
            id: trade.id,
            decision: "accept",
          })
        )
          close();
      }}
    >
      <p>
        Offered by <strong>{trade.fromEmployeeName}</strong>
      </p>
      <ShiftSummary slot={slot} />
      {back && (
        <>
          <p>You give this shift in return:</p>
          <ShiftSummary slot={back} />
        </>
      )}
      {trade.note && <p className="sf-note">{trade.note}</p>}
      <p className="sf-help">
        Accepting sends this trade for administrator approval. The saved
        assignments change after approval.
      </p>
      {!eligible && (
        <p className="sf-message">
          This offer is no longer eligible for your account. Refresh the
          coverage board.
        </p>
      )}
      <Footer
        close={close}
        disabled={disabled || !eligible}
        label="Accept trade"
      >
        {trade.targetEmployeeId === employeeId && (
          <button
            type="button"
            className="sf-secondary"
            disabled={disabled}
            onClick={async () => {
              if (
                await act({
                  action: "respondTrade",
                  id: trade.id,
                  decision: "decline",
                })
              )
                close();
            }}
          >
            Decline
          </button>
        )}
      </Footer>
    </form>
  );
}
function RequestForm({ data, employeeId, disabled, act, close }: FormProps) {
  const [kind, setKind] = useState("availability"),
    [from, setFrom] = useState(data.today),
    [through, setThrough] = useState(data.today),
    [status, setStatus] = useState("available"),
    [allDay, setAllDay] = useState(true),
    [start, setStart] = useState("06:00"),
    [end, setEnd] = useState("18:00"),
    [note, setNote] = useState(""),
    [type, setType] = useState("vacation"),
    [approver, setApprover] = useState(""),
    [dates, setDates] = useState<string[]>([]),
    [error, setError] = useState("");
  const days = [
    ...new Set(
      upcomingAssignments(data, employeeId, new Date()).map((s) => s.entryDate),
    ),
  ];
  const approvers = data.employees.filter(
    (e) => clearedForPosition(e, "Officer/AO") && e.id !== employeeId,
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body =
        kind === "availability"
          ? {
              action: "saveAvailability",
              dates: scheduleDates(from, through),
              status,
              allDay,
              startTime: start,
              endTime: end,
              note,
            }
          : {
              action: "submitTimeOff",
              type,
              approverEmployeeId: approver,
              dates,
              note,
            };
      if (kind === "timeoff" && !dates.length)
        throw new Error("Select at least one of your scheduled dates.");
      if (await act(body)) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your dates.");
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="sf-segment sf-full">
        <button
          type="button"
          aria-pressed={kind === "availability"}
          onClick={() => setKind("availability")}
        >
          Availability
        </button>
        <button
          type="button"
          aria-pressed={kind === "timeoff"}
          onClick={() => setKind("timeoff")}
        >
          Time off
        </button>
      </div>
      {kind === "availability" ? (
        <>
          <p>
            Save when you can or cannot work. Availability is saved immediately;
            it does not assign you to a shift.
          </p>
          <label>
            I am
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="available">Available to work</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <div className="sf-form-grid">
            <label>
              First date
              <input
                type="date"
                required
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (e.target.value > through) setThrough(e.target.value);
                }}
              />
            </label>
            <label>
              Last date
              <input
                type="date"
                min={from}
                required
                value={through}
                onChange={(e) => setThrough(e.target.value)}
              />
            </label>
          </div>
          <label className="sf-check">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />{" "}
            All day
          </label>
          {!allDay && (
            <TimeFields
              start={start}
              end={end}
              setStart={setStart}
              setEnd={setEnd}
            />
          )}
          <p className="sf-help">
            This replaces your availability on the selected dates (up to 93
            days).
          </p>
        </>
      ) : (
        <>
          <p>
            Choose your scheduled dates. An approved request records your time
            off; the administrator manages any resulting coverage.
          </p>
          <label>
            Time-off type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                ["vacation", "Vacation"],
                ["recovery", "Recovery"],
                ["floating", "Floating holiday"],
                ["sick", "Sick"],
                ["official_business", "Official business"],
              ].map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Approving officer
            <select
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              required
            >
              <option value="">Choose an officer</option>
              {approvers.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sf-date-picker">
            <legend>Scheduled dates</legend>
            {days.map((day) => (
              <label className="sf-check" key={day}>
                <input
                  type="checkbox"
                  checked={dates.includes(day)}
                  onChange={(e) =>
                    setDates((current) =>
                      e.target.checked
                        ? [...current, day]
                        : current.filter((d) => d !== day),
                    )
                  }
                />
                {scheduleDayLabel(day, true)}
              </label>
            ))}
            {!days.length && <p>No upcoming scheduled dates.</p>}
          </fieldset>
        </>
      )}
      <Note value={note} set={setNote} max={240} />
      {error && (
        <p role="alert" className="sf-message sf-error">
          {error}
        </p>
      )}
      <Footer
        close={close}
        disabled={disabled}
        label={
          kind === "availability"
            ? "Save availability"
            : "Send time-off request"
        }
      />
    </form>
  );
}
function ReviewForm({
  data,
  employeeId,
  request,
  disabled,
  act,
  close,
}: FormProps & { request: WorkspaceRequest }) {
  const slot = data.slots.find((s) => s.id === request.slotId);
  const back = data.slots.find((s) => s.id === request.trade?.returnSlotId);
  const canReview =
    request.status === "pending" &&
    (data.viewer.isAdmin ||
      (request.kind === "timeoff" &&
        request.timeOff?.approverEmployeeId === employeeId));
  const canDeny =
    canReview ||
    (data.viewer.isAdmin &&
      request.kind === "trade" &&
      request.status === "offered");
  const canAccept =
    request.trade &&
    slot &&
    incomingTradeOffers(data, employeeId, new Date()).some(
      (t) => t.id === request.trade!.id,
    );
  async function review(decision: string) {
    if (
      await act({
        action:
          request.kind === "trade"
            ? "reviewTrade"
            : request.kind === "claim"
              ? "reviewClaim"
              : "reviewTimeOff",
        id: request.id,
        decision,
      })
    )
      close();
  }
  return (
    <>
      <p>
        <strong>{request.name}</strong> ·{" "}
        {request.kind === "trade"
          ? "Trade"
          : request.kind === "claim"
            ? "Shift request"
            : "Time off"}
      </p>
      <p className="sf-badge sf-gold">
        {request.status === "offered"
          ? "Awaiting a member’s acceptance"
          : request.status === "pending"
            ? "Awaiting approval"
            : request.status}
      </p>
      {slot && <ShiftSummary slot={slot} />}{" "}
      {back && (
        <>
          <p>Return assignment</p>
          <ShiftSummary slot={back} />
        </>
      )}
      {request.trade && (
        <dl className="sf-definition">
          <dt>Offered to</dt>
          <dd>
            {request.trade.targetEmployeeName ||
              data.employees.find(
                (e) => e.id === request.trade?.targetEmployeeId,
              )?.name ||
              "Anyone cleared for the position"}
          </dd>
          <dt>Accepted by</dt>
          <dd>
            {data.employees.find(
              (e) => e.id === request.trade?.acceptedByEmployeeId,
            )?.name || "Not accepted yet"}
          </dd>
        </dl>
      )}
      {request.timeOff && (
        <>
          <p>Type: {request.timeOff.type.replaceAll("_", " ")}</p>
          <p>
            {data.timeOffDates
              .filter((d) => d.requestId === request.id)
              .map((d) => scheduleDayLabel(d.offDate))
              .join(" · ")}
          </p>
          <p>
            Approver:{" "}
            {request.timeOff.approverName ||
              data.employees.find(
                (e) => e.id === request.timeOff?.approverEmployeeId,
              )?.name ||
              "Saved officer"}
          </p>
        </>
      )}
      {request.note && <p className="sf-note">{request.note}</p>}
      {canReview && (
        <p className="sf-help">
          {request.kind === "trade"
            ? "Approval transfers the saved assignment(s) to the accepting member."
            : request.kind === "claim"
              ? "Approval fills this open position with the requesting member."
              : "Approval records the time-off dates. Existing assignments still need coverage review."}
        </p>
      )}
      <div className="sf-dialog-footer">
        <button className="sf-secondary" onClick={close} disabled={disabled}>
          Back
        </button>
        {canDeny && (
          <>
            <button
              className="sf-danger"
              disabled={disabled}
              onClick={() => void review("denied")}
            >
              Deny
            </button>
            {canReview && (
              <button
                disabled={disabled}
                onClick={() => void review("approved")}
              >
                Approve request
              </button>
            )}
          </>
        )}
        {canAccept && (
          <button
            disabled={disabled}
            onClick={async () => {
              if (
                await act({
                  action: "respondTrade",
                  id: request.id,
                  decision: "accept",
                })
              )
                close();
            }}
          >
            Accept trade
          </button>
        )}
      </div>
    </>
  );
}
function StaffForm({
  data,
  slot,
  disabled,
  act,
  close,
}: FormProps & { slot: ScheduleSlot }) {
  const [employee, setEmployee] = useState(slot.employeeId || "");
  const candidates = data.employees.filter((e) =>
    clearedForPosition(e, slot.role),
  );
  const eligible = candidates.map((e) => ({
    employee: e,
    reason: scheduleEligibility(data, e.id, slot),
  }));
  const [deadline, setDeadline] = useState(
    data.requestDeadlines?.find((d) => d.id === slot.id)?.deadline || "",
  );
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              employee
                ? {
                    action: "assignSlot",
                    slotId: slot.id,
                    employeeId: employee,
                  }
                : { action: "clearSlot", slotId: slot.id },
            )
          )
            close();
        }}
      >
        <ShiftSummary slot={slot} />
        <label>
          Assigned member
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
          >
            <option value="">Leave open</option>
            {slot.employeeId &&
              !candidates.some((e) => e.id === slot.employeeId) && (
                <option value={slot.employeeId}>
                  {slot.employeeName || "Saved employee"} (outside active
                  roster)
                </option>
              )}
            {eligible.map(({ employee: e, reason }) => (
              <option
                value={e.id}
                key={e.id}
                disabled={!!reason && e.id !== slot.employeeId}
              >
                {e.name}
                {reason ? " · " + reason : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="sf-help">
          Only members cleared for this position can be assigned. Saving an
          assignment rechecks conflicts and closes related pending requests for
          this position.
        </p>
        <Footer
          close={close}
          disabled={disabled || employee === (slot.employeeId || "")}
          label={employee ? "Save assignment" : "Set position open"}
        />
      </form>
      {slot.status === "open" && (
        <form
          className="sf-subform"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act({
                action: "saveRequestDeadline",
                slotId: slot.id,
                deadline,
              })
            )
              close();
          }}
        >
          <h3>Request deadline</h3>
          <label>
            Central time
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <p className="sf-help">
            An empty date removes the deadline. Deadline alerts follow the saved
            alert rule.
          </p>
          <button disabled={disabled} type="submit" className="sf-secondary">
            Save deadline
          </button>
        </form>
      )}
    </>
  );
}
function TimeFields({
  start,
  end,
  setStart,
  setEnd,
}: {
  start: string;
  end: string;
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
}) {
  return (
    <>
      <div className="sf-form-grid">
        <label>
          Starts (Central)
          <input
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Ends (Central)
          <input
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {end <= start && <p className="sf-help">Ends the following day.</p>}
    </>
  );
}
function DetailForm({
  data,
  date,
  disabled,
  act,
  close,
}: FormProps & { date: string }) {
  const [day, setDay] = useState(date),
    [shiftId, setShiftId] = useState(
      data.entries.find((e) => e.entryDate === date)?.shiftTypeId ||
        data.shiftTypes[0]?.id ||
        "",
    ),
    [role, setRole] = useState("Extra member"),
    [start, setStart] = useState("06:00"),
    [end, setEnd] = useState("18:00"),
    [reason, setReason] = useState("");
  const roles = data.dayPositionRoles || data.roles;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const entry = data.entries.find(
          (e) => e.entryDate === day && e.shiftTypeId === shiftId,
        );
        if (
          await act({
            action: "addDaySlot",
            date: day,
            shiftTypeId: shiftId,
            entryId: entry?.id || "",
            role,
            startTime: start,
            endTime: end,
            staffingReason: reason,
          })
        )
          close();
      }}
    >
      <p>
        Add one extra position for this date. It starts open, ready for a
        qualified member to request or for you to assign.
      </p>
      <label>
        Date
        <input
          type="date"
          required
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <label>
        Shift group
        <select
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          required
        >
          {data.shiftTypes.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name} · {scheduleClock(s.startTime)}–{scheduleClock(s.endTime)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Position
        <select
          value={roles.includes(role) ? role : roles[0]}
          onChange={(e) => setRole(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <TimeFields start={start} end={end} setStart={setStart} setEnd={setEnd} />
      <label>
        Special detail or reason
        <input
          required
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Name of the event or staffing need"
        />
      </label>
      <p className="sf-help">
        Add another position after saving if the detail needs additional
        members.
      </p>
      <Footer
        close={close}
        disabled={disabled || !shiftId}
        label="Add open position"
      />
    </form>
  );
}
function PatternForm({
  data,
  shift,
  disabled,
  act,
  close,
}: FormProps & { shift?: ScheduleShift }) {
  const [name, setName] = useState(shift?.name || ""),
    [start, setStart] = useState(shift?.startTime || "06:00"),
    [end, setEnd] = useState(shift?.endTime || "18:00"),
    [anchor, setAnchor] = useState(shift?.anchorDate || data.today),
    [repeat, setRepeat] = useState(shift?.repeatEveryDays || 1),
    [color, setColor] = useState(shift?.color || "gold");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      data.roles.map((role) => [
        role,
        data.shiftTypeRoles.find(
          (r) => r.shiftTypeId === shift?.id && r.role === role,
        )?.count || 0,
      ]),
    ),
  );
  const positions = Object.entries(counts).filter(([, count]) => count > 0);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await act({
            action: "saveShiftType",
            id: shift?.id,
            name,
            startTime: start,
            endTime: end,
            anchorDate: anchor,
            repeatEveryDays: repeat,
            color,
            roleRequirements: positions.map(([role, count]) => ({
              role,
              count,
            })),
          })
        )
          close();
      }}
    >
      <label>
        Schedule name
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this recurring schedule"
        />
      </label>
      <TimeFields start={start} end={end} setStart={setStart} setEnd={setEnd} />
      <div className="sf-form-grid">
        <label>
          First shift date
          <input
            type="date"
            required
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </label>
        <label>
          Repeat every (days)
          <input
            type="number"
            min={1}
            max={365}
            required
            value={repeat}
            onChange={(e) => setRepeat(Number(e.target.value))}
          />
        </label>
      </div>
      <label>
        Calendar color
        <select value={color} onChange={(e) => setColor(e.target.value)}>
          {["red", "black", "gold", "blue", "green", "purple", "orange"].map(
            (c) => (
              <option value={c} key={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ),
          )}
        </select>
      </label>
      <fieldset>
        <legend>Positions per shift</legend>
        {data.roles.map((role) => (
          <label className="sf-count-field" key={role}>
            <span>{role}</span>
            <input
              aria-label={`${role} positions`}
              type="number"
              min={0}
              max={20}
              value={counts[role]}
              onChange={(e) =>
                setCounts((c) => ({ ...c, [role]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </fieldset>
      <p className="sf-message">
        Saving creates missing recurring dates for the next year. Time changes
        also affect existing positions that use this group’s times. Saved
        members and dates are kept; position counts apply to newly created
        dates.
      </p>
      <Footer
        close={close}
        disabled={disabled || !positions.length}
        label="Save recurring schedule"
      />
    </form>
  );
}
function ReminderForm({
  rule,
  disabled,
  act,
  close,
}: FormProps & { rule: ScheduleReminder }) {
  const saved: string[] = (() => {
    try {
      const value = JSON.parse(rule.offsets);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  })();
  const [enabled, setEnabled] = useState(!!rule.enabled),
    [push, setPush] = useState(!!rule.pushEnabled),
    [offsets, setOffsets] = useState(saved);
  const timings = [...new Set([...reminderTimings, ...saved])];
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await act({
            action: "saveReminderRule",
            id: rule.id,
            enabled,
            pushEnabled: push,
            offsets,
          })
        )
          close();
      }}
    >
      <h3>{rule.label}</h3>
      <p>{reminderExplanation(rule.type)}</p>
      <p className="sf-help">To: {reminderAudience(rule.type)}</p>
      <label className="sf-check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Enable this rule
      </label>
      <label className="sf-check">
        <input
          type="checkbox"
          checked={push}
          onChange={(e) => setPush(e.target.checked)}
        />{" "}
        Send push notifications
      </label>
      <fieldset>
        <legend>When to send</legend>
        {timings.map((t) => (
          <label className="sf-check" key={t}>
            <input
              type="checkbox"
              checked={offsets.includes(t)}
              onChange={(e) =>
                setOffsets((current) =>
                  e.target.checked
                    ? [...current, t]
                    : current.filter((x) => x !== t),
                )
              }
            />
            {t[0].toUpperCase() + t.slice(1)}
          </label>
        ))}
      </fieldset>
      <p className="sf-help">
        Members need notifications enabled on their devices. Existing email and
        text settings are managed by the delivery configuration.
      </p>
      <Footer close={close} disabled={disabled} label="Save alert rule" />
    </form>
  );
}
