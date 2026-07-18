"use client";

type ContactEmployee = {
  id: string;
  name: string;
  rank: string;
  phone?: string | null;
  employmentType?: string | null;
  driverStatus?: string | null;
  isDpw?: number | boolean;
};

function displayName(value: string) {
  const [last, first] = value.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : value;
}

function phoneHref(value: string) {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

export default function EmployeeContacts({ employees }: { employees: ContactEmployee[] }) {
  const alphabetical = [...employees].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  return <section className="employee-contact-page">
    <div className="contact-page-heading standard-page-header">
      <div><span className="page-icon" aria-hidden="true">☎</span><div><p className="eyebrow">Stickney Fire Department</p><h1>Employee Contact List</h1><p>Automatically updated from Employee Information. Select a phone number to call.</p></div></div>
      <span className="read-only-badge">Read only</span>
    </div>
    <section className="content-card contact-list-card">
      <div className="contact-list-band">Firefighters &amp; Officers</div>
      <div className="table-wrap contact-table-wrap"><table className="contact-table">
        <thead><tr><th>Rank</th><th>Name</th><th>Employment</th><th>Driver Status</th><th>Cell Number</th></tr></thead>
        <tbody>{alphabetical.map((employee) => <tr key={employee.id}>
          <td data-label="Rank"><strong>{employee.rank}</strong></td>
          <td data-label="Name">{displayName(employee.name)}</td>
          <td data-label="Employment">{employee.isDpw ? "DPW" : employee.employmentType || ""}</td>
          <td data-label="Driver Status">{employee.driverStatus || ""}</td>
          <td data-label="Cell Number">{employee.phone ? <a className="employee-call-link" href={phoneHref(employee.phone)}>{employee.phone}</a> : ""}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="driver-key"><strong>Driver Status Key</strong><span><b>C</b> Cleared</span><span><b>A</b> Ambulance Only</span><span><b>NC</b> Not Cleared</span></div>
    </section>
    <p className="contact-source-note">Names, phone numbers, employment details, and driver status can only be changed from the Employee Information page.</p>
  </section>;
}
