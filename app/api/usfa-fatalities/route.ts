const usfaBase = "https://apps.usfa.fema.gov/firefighter-fatalities";

type UsfaFatality = {
  id: number;
  firstName: string;
  lastName: string;
  fdName: string;
  fdCity: string;
  stateAbbr: string;
  deathDt: string;
};

const lastKnown = {
  year: 2026,
  total: 45,
  items: [
    { id: 8710, firstName: "Dan", lastName: "Hernandez Jr.", fdName: "Slocum Volunteer Fire Department", fdCity: "Elkhart", stateAbbr: "TX", deathDt: "2026-07-11T00:00:00" },
    { id: 8706, firstName: "Robert", lastName: "Reider III", fdName: "Malaga Volunteer Fire Company #1", fdCity: "Malaga", stateAbbr: "NJ", deathDt: "2026-07-10T00:00:00" },
    { id: 8711, firstName: "Eugene", lastName: "Cervi", fdName: "Deep Creek Volunteer Fire Company", fdCity: "McHenry", stateAbbr: "MD", deathDt: "2026-07-06T00:00:00" },
    { id: 8699, firstName: "Kyle", lastName: "Yoder", fdName: "Holmes Fire District #1", fdCity: "Millersburg", stateAbbr: "OH", deathDt: "2026-07-04T00:00:00" },
    { id: 8712, firstName: "David", lastName: "Gagnon", fdName: "Cottekill Volunteer Fire Company", fdCity: "Cottekill", stateAbbr: "NY", deathDt: "2026-07-03T00:00:00" },
  ],
};

function yearInChicago() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric" }).format(new Date()));
}

function publicItem(item: UsfaFatality) {
  return {
    id: item.id,
    name: `${item.firstName} ${item.lastName}`.trim(),
    department: item.fdName,
    location: `${item.fdCity}, ${item.stateAbbr}`,
    deathDate: item.deathDt,
    url: `${usfaBase}/details?id=${item.id}`,
  };
}

export async function GET() {
  const year = yearInChicago();
  try {
    const options = {
      headers: { "user-agent": "Stickney Fire Department Operations Portal/1.0" },
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } };
    const [latestResponse, countResponse] = await Promise.all([
      fetch(`${usfaBase}/api/fatalityDatums/latest`, options),
      fetch(`${usfaBase}/api/fatalityDatums/page/1/search?deathDtRange=${year}`, options),
    ]);
    if (!latestResponse.ok || !countResponse.ok) throw new Error("USFA source unavailable");
    const latest = await latestResponse.json() as UsfaFatality[];
    const count = await countResponse.json() as { total?: number };
    const items = latest
      .filter((item) => item.deathDt.startsWith(String(year)))
      .sort((a, b) => b.deathDt.localeCompare(a.deathDt))
      .slice(0, 5)
      .map(publicItem);
    if (!items.length || typeof count.total !== "number") throw new Error("USFA data incomplete");
    return Response.json({ year, total: count.total, items, source: "U.S. Fire Administration" }, {
      headers: { "cache-control": "public, max-age=900, s-maxage=3600" },
    });
  } catch {
    return Response.json({
      ...lastKnown,
      items: lastKnown.items.map(publicItem),
      source: "U.S. Fire Administration",
      stale: true,
    }, { headers: { "cache-control": "public, max-age=60" } });
  }
}
