"use client";
import { useEffect, useState } from "react";
import EmployeeContacts from "./employee-contacts";

export default function EmployeeDirectory({ contacts = false, initialSearch = "" }: { contacts?: boolean; initialSearch?: string }) {
  const [employees, setEmployees] = useState<Array<{id:string;name:string;rank:string;phone?:string}>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/employee-directory?contacts=${contacts ? "1" : "0"}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to load directory"); setEmployees(payload.employees); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [contacts]);
  if (loading || error) return <section className="content-card"><p role={error ? "alert" : "status"}>{error || "Loading employee directory…"}</p></section>;
  return <EmployeeContacts employees={employees} initialSearch={initialSearch} directoryOnly={!contacts} />;
}
