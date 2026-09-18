type Props = {
  apparatus?: Array<{ unit: string; status: string }>;
  confirmedAt: string | null;
  delayed: boolean;
};

// Presentation only: reuse the confirmed board packet; never fetch for a slide.
export function BoardEquipmentSummary({ apparatus, confirmedAt, delayed }: Props) {
  if (!apparatus || !confirmedAt) return <div className="board-equipment-summary unconfirmed"><strong>Equipment status not confirmed</strong><p>Waiting for the equipment report. No all-clear is assumed.</p></div>;
  return <div className={`board-equipment-summary${delayed ? ' unconfirmed' : ''}`}>
    <div className="equipment-clear-heading"><span aria-hidden="true">{delayed ? '!' : '✓'}</span><div><strong>{delayed ? 'Last report: no equipment issues' : 'No equipment issues reported'}</strong><p>{delayed ? 'Feed delayed — showing the last confirmed report.' : 'Latest saved equipment report'}</p></div></div>
    <p>Fleet availability is shown in Apparatus status below.</p>
    <p className="equipment-confirmed">Confirmed {new Date(confirmedAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}</p>
  </div>;
}
