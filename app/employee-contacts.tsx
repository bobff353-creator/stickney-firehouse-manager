"use client";

import { useState } from "react";
import { compareEmployeeNames, formatEmployeeName } from "./employee-names";

type ContactEmployee = {
  id: string;
  name: string;
  rank: string;
  phone?: string | null;
  employmentType?: string | null;
  driverStatus?: string | null;
  isDpw?: number | boolean;
};

function phoneHref(value: string) {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

export default function EmployeeContacts({ employees, initialSearch = "", directoryOnly = false }: { employees: ContactEmployee[]; initialSearch?: string; directoryOnly?: boolean }) {
  const [search, setSearch] = useState(initialSearch);
  const alphabetical = employees.filter(employee => `${employee.name} ${employee.rank} ${employee.phone ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => compareEmployeeNames(a.name, b.name));

  return <section className="employee-contact-page">
    <div className="contact-page-heading standard-page-header">
      <div><span className="page-icon" aria-hidden="true">☎</span><div><p className="eyebrow">Stickney Fire Department</p><h1>{directoryOnly ? "Employee Directory" : "Employee Contact List"}</h1><p>{directoryOnly ? "Current employee names and ranks. Contact details require separate access." : "Automatically updated from Employee Information. Select a phone number to call."}</p></div></div>
      <span className="read-only-badge">Read only</span>
    </div>
    <section className="content-card contact-list-card">
      <label className="portal-roster-search"><span>Find a member</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, rank, or phone number…" /></label>
      {search && <p className="portal-inline-status" role="status">{alphabetical.length} matching contacts <button type="button" className="quiet-button" onClick={() => setSearch("")}>Clear search</button></p>}
      <div className="contact-list-band">Firefighters &amp; Officers</div>
      {!search && alphabetical.length === 0 && <div className="action-empty-state"><span aria-hidden="true">☎</span><div><strong>No employee contacts yet</strong><p>Contacts appear automatically after an administrator adds employees and their phone numbers.</p></div></div>}
      <div className="table-wrap contact-table-wrap"><table className="contact-table">
        <thead><tr><th>Rank</th><th>Name</th>{!directoryOnly && <th>Cell Number</th>}</tr></thead>
        <tbody>{alphabetical.map((employee) => <tr key={employee.id}>
          <td data-label="Rank"><strong>{employee.rank}</strong></td>
          <td data-label="Name">{formatEmployeeName(employee.name)}</td>
          {!directoryOnly && <td data-label="Cell Number">{employee.phone ? <a className="employee-call-link" href={phoneHref(employee.phone)}>{employee.phone}</a> : "Not provided"}</td>}
        </tr>)}</tbody>
      </table></div>
    </section>
    <p className="contact-source-note">An authorized employee manager can update these details on Employee Information.</p>
  </section>;
}
