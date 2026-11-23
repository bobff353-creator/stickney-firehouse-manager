"use client";
import {
  ArrowRight,
  Building2,
  Check,
  Droplets,
  Flame,
  KeyRound,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Flame size={24} strokeWidth={1.8} />
      </span>
      <span>
        arrival<span className="brand-dot">.</span>
        <small>PRE-INCIDENT INTELLIGENCE</small>
      </span>
    </div>
  );
}
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function Primary({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn primary"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Building2 size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
export function Choices({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  help?: string;
}) {
  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      {help && <p className="field-help">{help}</p>}
      <div className="choices">
        {options.map((v) => (
          <button
            type="button"
            key={v}
            className={value === v ? "selected" : ""}
            aria-pressed={value === v}
            onClick={() => onChange(v)}
          >
            {value === v && <Check size={16} />} {v}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function Blueprint({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={"blueprint " + (compact ? "compact" : "")}
      aria-label="Illustration of a preplanned building, not a real site"
    >
      <svg
        viewBox="0 0 550 340"
        role="img"
        aria-label="Building illustration with example equipment symbols"
      >
        <defs>
          <pattern
            id="bpgrid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M24 0H0V24"
              fill="none"
              stroke="currentColor"
              strokeWidth=".4"
              opacity=".18"
            />
          </pattern>
          <linearGradient id="roof" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f8f5ee" />
            <stop offset="1" stopColor="#d7dbd8" />
          </linearGradient>
        </defs>
        <rect width="550" height="340" fill="url(#bpgrid)" />
        <g transform="translate(44 15)">
          <path
            d="M57 203 272 84 472 194 258 318Z"
            fill="#8d9d93"
            opacity=".13"
          />
          <path
            d="M90 135 267 36 431 128 253 230Z"
            fill="url(#roof)"
            stroke="#9ba79f"
          />
          <path d="M90 135v75l163 94v-74Z" fill="#d6ded5" stroke="#9ba79f" />
          <path d="M253 230v74l178-101v-75Z" fill="#b5c6bc" stroke="#879d8d" />
          <path
            d="m105 135 162-89 150 83-164 93Z"
            fill="none"
            stroke="#b1b9b2"
          />
          <path
            d="M132 132 264 60M172 154 306 82M212 177 346 104M253 198 386 127M159 102 309 186M203 77 354 161"
            stroke="#c0c8bf"
            strokeWidth="1"
          />
          <path
            d="m160 132 47-26 68 38-46 27Z"
            fill="#c7cfca"
            stroke="#99a89d"
          />
          <path
            d="m160 132v14l69 39v-14Zm69 39 46-27v14l-46 27"
            fill="#a4b3a8"
            stroke="#99a89d"
          />
          <g fill="#61796d">
            {[0, 1, 2].map((x) => (
              <path
                key={x}
                d={`m${112 + x * 39} ${163 + x * 22} 24 14v25l-24-14Z`}
              />
            ))}
            {[0, 1, 2, 3].map((x) => (
              <path
                key={x}
                d={`m${275 + x * 37} ${233 - x * 21} 23-13v24l-23 13Z`}
              />
            ))}
          </g>
          <path d="m202 212 30 17v49l-30-17Z" fill="#3b5447" />
          <path d="m188 203 46 26 15-8-46-26Z" fill="#ed703e" />
          <path
            d="M57 143v99m0-23 177 103m27-8 201-114m-11-99 21 12v104"
            fill="none"
            stroke="#6e8d78"
            strokeDasharray="4 5"
            opacity=".6"
          />
          <circle
            cx="294"
            cy="269"
            r="11"
            fill="#e87541"
            stroke="white"
            strokeWidth="3"
          />
          <circle
            cx="199"
            cy="265"
            r="10"
            fill="#577f6b"
            stroke="white"
            strokeWidth="3"
          />
          <circle
            cx="416"
            cy="192"
            r="10"
            fill="#567a9b"
            stroke="white"
            strokeWidth="3"
          />
        </g>
      </svg>
      <span className="blueprint-label label-fdc">
        <Droplets size={14} /> FDC
      </span>
      <span className="blueprint-label label-access">
        <KeyRound size={14} /> Building access
      </span>
      <span className="blueprint-label label-electric">
        <Zap size={14} /> Electrical
      </span>
      <span className="drawing-note">
        CONCEPT ILLUSTRATION · NOT A REAL SITE
      </span>
    </div>
  );
}
export function StepHint({ children }: { children: ReactNode }) {
  return (
    <aside className="hint">
      <ShieldCheck size={20} />
      <p>{children}</p>
    </aside>
  );
}
export function ArrowLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" type="button" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
