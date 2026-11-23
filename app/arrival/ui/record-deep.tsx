import type { PlanData } from "../lib/preplan";
export function BuildingDetailReadout({ data: p }: { data: PlanData }) {
  const d = p.details;
  if (!d) return null;
  return (
    <section className="panel extra-building-view">
      <h2>Additional building details</h2>
      <div className="detail-grid">
        <div>
          <h3>Standpipe</h3>
          <p>
            {d.standpipe.answer || "Unknown"} ·{" "}
            {d.standpipe.location || "Location not entered"}
          </p>
          <p>
            {d.standpipe.type || "Type unknown"} · {d.standpipe.status}
          </p>
          <h3>Fire pump</h3>
          <p>
            {d.firePump.answer || "Unknown"} ·{" "}
            {d.firePump.location || "Location not entered"}
          </p>
          <p>
            {d.firePump.status} · {d.firePump.notes || "No further information"}
          </p>
          <h3>FDC specifications</h3>
          <p>{d.fdcSpec || "Not entered"}</p>
          <h3>Sprinkler coverage</h3>
          <p>{d.sprinklerCoverage || "Not entered"}</p>
        </div>
        <div>
          <h3>Floors / levels</h3>
          {d.levels.length ? (
            d.levels.map((x) => (
              <div key={x.id}>
                <b>{x.name}</b>
                <p>{x.notes || "No notes"}</p>
              </div>
            ))
          ) : (
            <p>No level details entered.</p>
          )}
          <h3>Occupants / suites</h3>
          {d.occupants.length ? (
            d.occupants.map((x) => (
              <div key={x.id}>
                <b>{x.name}</b>
                <p>
                  {x.location} · {x.notes}
                </p>
              </div>
            ))
          ) : (
            <p>No occupant details entered.</p>
          )}
        </div>
      </div>
      <h3>Hazardous materials</h3>
      {d.materials.length ? (
        d.materials.map((x) => (
          <div className="system-fact" key={x.id}>
            <h3>{x.name}</h3>
            <p>
              {x.location || "Location unknown"} ·{" "}
              {x.quantity || "Quantity unknown"} ·{" "}
              {x.unNumber || "UN / NA unknown"}
            </p>
            <p>{x.notes}</p>
          </div>
        ))
      ) : (
        <p>
          No materials entered. This does not establish that none are present.
        </p>
      )}
    </section>
  );
}
