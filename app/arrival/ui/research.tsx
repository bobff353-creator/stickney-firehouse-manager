"use client";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Layers,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { competitors, sourceNotes } from "../lib/research";
import { Pill } from "./ui";
export default function Research() {
  return (
    <div className="research-page">
      <header className="page-heading">
        <div className="eyebrow">THE THINKING BEHIND ARRIVAL</div>
        <h1>Research into a clearer workflow.</h1>
        <p>
          14 products and adjacent tools. One question: what helps a firefighter
          collect and find the right information?
        </p>
      </header>
      <div className="research-intro">
        <div>
          <BookOpen size={24} />
          <h2>Evidence, with limits.</h2>
          <p>
            Research checked November 16–17, 2026. This combines a structured
            public-source comparison with your authorized live FlowMSP review. Other competitor accounts and
            independent field timing tests were not accessed. It covers major relevant products found,
            not every regional vendor.
          </p>
        </div>
        <div>
          <Layers size={24} />
          <h2>Compare product families fairly.</h2>
          <p>
            FlowMSP identifies itself as part of ImageTrend. FIREHOUSE belongs
            to ESO. Tablet Command and FireMapper are adjacent response /
            mapping tools. They should not all be counted as independent,
            like-for-like RMS vendors.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>What we learned from Stickney</h2>
          <Pill>Source + live interface reviewed</Pill>
        </div>
        <p>
          Read-only review of your existing source and signed-in preplan screen
          found strong equipment, side-photo, hazard and published-response
          foundations. The new-plan screen required a building outline before
          advancing. This new app keeps the useful concepts and makes the field
          visit three short steps, with optional building details and separate observations.
        </p>
        <div className="design-decisions">
          {[
            [
              "Start with the address",
              "No mandatory polygon tracing. Name, address and confirmation come first.",
            ],
            [
              "Ask one clear question",
              "Large Yes / No / Unknown choices, FDC and key-box explanations, and visible next actions.",
            ],
            [
              "Preserve approved information",
              "Working edits do not change the published arrival snapshot.",
            ],
            [
              "Make unknowns explicit",
              "Missing photos, unknown systems and unverified water supply stay visible.",
            ],
            [
              "Recover interrupted visits",
              "A device draft, cloud saves, explicit errors and version conflict protection.",
            ],
            [
              "Separate collection from arrival",
              "Three quick steps lead to a concise arrival brief. Detailed surveys and quick observations have their own paths.",
            ],
          ].map(([title, text]) => (
            <div key={title}>
              <Check size={17} />
              <div>
                <b>{title}</b>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel"><h2>What your open FlowMSP account added</h2><p>The November 17 live review informed separate first-in and detailed views, source-linked hydrants, searchable service status, annotated overview photos and explicit source review dates. Import reconciliation keeps Stickney-owned records separate from shared regional map data. Quick capture stays three steps; historical flow reports remain separate from verified flow tests.</p></section>
      <div className="competitor-grid">
        {competitors.map((c, i) => (
          <article className="panel competitor" key={c.name}>
            <div className="competitor-number">
              {String(i + 1).padStart(2, "0")}
              <Pill>{c.category}</Pill>
            </div>
            <h2>{c.name}</h2>
            <p>{c.strength}</p>
            <h3>Offline evidence</h3>
            <p>{c.offline}</p>
            <div className="lesson">
              <b>Design implication</b>
              <p>{c.lesson}</p>
            </div>
            <a href={c.url} target="_blank" rel="noreferrer">
              Read primary source <ArrowUpRight size={16} />
            </a>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Standards & supporting sources</h2>
        {sourceNotes.map((s) => (
          <div className="source-note" key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
              <ArrowUpRight size={15} />
            </a>
            <p>{s.text}</p>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>How this version is engineered</h2>
          <ShieldCheck size={19} />
        </div>
        <p>
          Authenticated owner-scoped records in Cloudflare D1, private files in
          R2, server validation, same-origin write checks, optimistic revision
          checks, and a separate immutable-at-publication JSON snapshot. Field
          answers are never filled in by AI. A fictional example is rendered
          separately and is never inserted into operational tables.
        </p>
        <h3>Private pilot boundaries</h3>
        <p>
          This is a working owner-private pilot. Department memberships and
          officer roles, live CAD connections, recurring cross-system sync,
          nationwide imagery coverage, fully offline field collection, enterprise backup
          recovery drills, and physical-device camera / glove testing remain
          future work. It does not replace the live Stickney app or claim to
          outperform established products in the field.
        </p>
      </section>
    </div>
  );
}
