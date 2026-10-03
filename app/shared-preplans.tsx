"use client";
import { useEffect, useState } from 'react';

type RecordRow = Record<string, unknown> & { id: string };
type SharedDepartment = { id: string; name: string; hydrants: RecordRow[]; preplans: RecordRow[] };
const display = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const fields = ['address','service_status','manufacturer','model','port_count','port_sizes','notes','construction','access_info','alarm_system','knox_box','riser','fdc','sprinkler_system','contact_info','floor_count','suggested_fire_flow_gpm','last_verified_at','next_review_date','updated_at'];

export default function SharedPreplans() {
  const [departments, setDepartments] = useState<SharedDepartment[]>([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/shared-preplans', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDepartments(data.departments);
      setError('');
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  return <section className="content-card shared-preplans">
    <header className="section-header"><div><h2>Other departments’ hydrants &amp; preplans</h2><p>View only. Records stay with their owning department. Only published preplans are shared.</p></div></header>
    <div className="department-form-grid"><label><span>Department</span><select value={selected} onChange={event => setSelected(event.target.value)}><option value="">All other departments</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label><span>Search address or name</span><input value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {loading && <p role="status">Loading shared records…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Retry</button></p>}
    {!loading && !error && !departments.length && <p>No other department records are available.</p>}
    {!error && departments.filter(department => !selected || department.id === selected).map(department => <section key={department.id}>
      <h3>{department.name} <small>View only</small></h3>
      {(['preplans','hydrants'] as const).map(kind => {
        const rows = department[kind].filter(row => [row.business_name,row.hydrant_number,row.address].some(value => display(value).toLowerCase().includes(search.toLowerCase())));
        return <div key={kind}><h4>{kind === 'preplans' ? 'Published preplans' : 'Hydrants'} · {rows.length}</h4>{rows.length ? rows.map(row => <details key={row.id} className="shared-record"><summary><strong>{display(row.business_name || row.hydrant_number) || 'Hydrant'}</strong> · {display(row.address) || 'Address not entered'}</summary><dl>{fields.filter(field => display(row[field])).map(field => <div key={field}><dt>{field.replaceAll('_',' ')}</dt><dd>{display(row[field])}</dd></div>)}</dl>
          {(['features','levels','hazmat'] as const).map(section => Array.isArray(row[section]) && row[section].length ? <section key={section}><h5>{section === 'features' ? 'Building systems & hazards' : section === 'levels' ? 'Floors & levels' : 'Hazardous materials'}</h5>{(row[section] as RecordRow[]).map(item => <dl key={item.id}>{Object.entries(item).filter(([key,value]) => !key.endsWith('_id') && !['id','created_at','updated_at'].includes(key) && display(value)).map(([key,value]) => <div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{display(value)}</dd></div>)}</dl>)}</section> : null)}
          {(['photos','assets'] as const).map(section => Array.isArray(row[section]) && row[section].length ? <section key={section}><h5>{section === 'photos' ? 'Photos' : 'Plans & attachments'}</h5>{(row[section] as RecordRow[]).map(item => <p key={item.id}><a href={`/api/shared-preplans/${department.id}/files/${encodeURIComponent(item.id)}?kind=${section === 'photos' ? 'photo' : 'asset'}`} target="_blank" rel="noopener noreferrer">{display(item.caption || item.filename || item.original_filename) || 'Open preplan file'}</a></p>)}</section> : null)}
          {Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) && row.latitude != null && row.longitude != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${Number(row.latitude)},${Number(row.longitude)}`}>View location</a>}</details>) : <p>{search ? 'No matching records.' : 'No records shared yet.'}</p>}</div>;
      })}
    </section>)}
  </section>;
}
