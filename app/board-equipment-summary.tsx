type Props = {
  apparatus?: Array<{ unit: string; status: string }>;
  confirmedAt: string | null;
  delayed: boolean;
};

// Presentation only: reuse the confirmed board packet; never fetch for a slide.
export function BoardEquipmentSummary({ apparatus, confirmedAt, delayed }: Props) {
  if (!apparatus || !confirmedAt) return <div className="board-equipment-summary unconfirmed"><strong>Equipment status not confirmed</strong><p>Waiting for the equipment report. No all-clear is assumed.</p></div>;
  const available = apparatus.filter(unit => unit.status === 'Available');
  const committed = apparatus.filter(unit => unit.status === 'Committed to call');
  const other = apparatus.filter(unit => unit.status !== 'Available' && unit.status !== 'Committed to call');
  const groups = [{ label: 'Available', units: available }, { label: 'Committed to call', units: committed }, { label: 'Other status', units: other }];
  return <div className={`board-equipment-summary${delayed ? ' unconfirmed' : ''}`}>
    <div className="equipment-clear-heading"><span aria-hidden="true">{delayed ? '!' : '✓'}</span><div><strong>{delayed ? 'Last report: no equipment issues' : 'No equipment issues reported'}</strong><p>{delayed ? 'Feed delayed — showing the last confirmed report.' : 'Latest saved equipment report'}</p></div></div>
    {apparatus.length ? <dl aria-label="Fleet status summary">{groups.map(group => <div key={group.label}><dt>{group.label}</dt><dd>{group.units.length}</dd>{group.units.length ? <dd className="equipment-fleet-units">{group.units.map(unit => <span key={unit.unit}>Unit {unit.unit}{group.label === 'Other status' ? ` · ${unit.status}` : ''}</span>)}</dd> : null}</div>)}</dl> : <p>No apparatus status is available.</p>}
    <p className="equipment-confirmed">Confirmed {new Date(confirmedAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} · Equipment reports and fleet availability are separate.</p>
  </div>;
}
