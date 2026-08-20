export type UpcomingTrainingCourse = {
  title: string;
  url: string;
  startDate: string;
  endDate: string;
  location: string;
  detail: string;
};

type NipstaCalendarEvent = {
  title?: unknown;
  start?: unknown;
  end?: unknown;
};

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&apos;|&#39;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&quot;|&#34;|&#8220;|&#8221;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return "";
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function dateRange(value: string) {
  const dates = [...value.matchAll(/\d{1,2}\/\d{1,2}\/\d{2,4}/g)].map((match) =>
    isoDate(match[0]),
  ).filter(Boolean);
  return { startDate: dates[0] || "", endDate: dates[1] || dates[0] || "" };
}

function classText(block: string, className: string) {
  for (const match of block.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)) {
    const classValue = match[1].match(/\bclass=["']([^"']*)["']/i)?.[1] || "";
    if (classValue.split(/\s+/).includes(className)) return decode(match[2]);
  }
  return "";
}

function uniqueCourses(courses: UpcomingTrainingCourse[]) {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = `${course.title}|${course.startDate}|${course.endDate}|${course.location}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title),
  );
}

export function parseRomeovilleActivity(
  html: string,
  sourceUrl: string,
  fallbackTitle: string,
  today: string,
) {
  const courses = [...html.matchAll(
    /<li\b[^>]*class=["'][^"']*\bsession\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
  )].flatMap((match): UpcomingTrainingCourse[] => {
    const block = match[0];
    const range = dateRange(classText(block, "dates"));
    if (!range.startDate || range.endDate < today) return [];
    const title = classText(block, "title") || fallbackTitle;
    const location = classText(block, "location");
    const time = classText(block, "time");
    return [{
      title,
      url: sourceUrl,
      ...range,
      location,
      detail: [time, location].filter(Boolean).join(" · "),
    }];
  });
  return uniqueCourses(courses);
}

export function parseIfsiSchedule(html: string, sourceUrl: string, today: string) {
  const courses = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .flatMap((match): UpcomingTrainingCourse[] => {
      const activityId = match[1].match(/showClass\(['"](\d+)['"]\)/i)?.[1];
      if (!activityId) return [];
      const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((cell) => decode(cell[1]));
      const startDate = isoDate(cells[1] || "");
      if (!cells[0] || !startDate || startDate < today) return [];
      const location = [cells[2], cells[3]].filter(Boolean).join(", ");
      return [{
        title: cells[0],
        url: `${sourceUrl}#activity-${activityId}`,
        startDate,
        endDate: startDate,
        location,
        detail: [location, cells[4]].filter(Boolean).join(" · "),
      }];
    });
  return uniqueCourses(courses);
}

export function parseNipstaCourseNames(html: string) {
  const raw = html.match(/var\s+leagues_data\s*=\s*(\{[\s\S]*?\});/i)?.[1];
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Record<string, { name?: unknown }>;
    return Object.values(data)
      .map((item) => typeof item.name === "string" ? decode(item.name) : "")
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
  } catch {
    return [];
  }
}

const nipstaExcluded = /CPAT|Candidate Physical|POWER Test|Law Enforcement|Public Works|CPR|Crisis Communication|Jewish Community|Ludwig Speaks|Snowplow|Flagger|Fall Protection|Lock.?out|Respiratory Protection|Ground Person/i;
const nipstaFireTraining = /fire|hazard|rescue|confined space|incident safety|instructor|ICS-|structural collapse|trench/i;

export function parseNipstaEvents(
  events: NipstaCalendarEvent[],
  courseNames: string[],
  sourceUrl: string,
  today: string,
) {
  const grouped = new Map<string, UpcomingTrainingCourse>();
  for (const event of events) {
    const rawTitle = typeof event.title === "string" ? decode(event.title) : "";
    const title = courseNames.find((name) => rawTitle.startsWith(name)) ||
      rawTitle.split(/Rental/i)[0].trim();
    if (!title || nipstaExcluded.test(title) || !nipstaFireTraining.test(title)) continue;
    const startDate = typeof event.start === "string" ? event.start.slice(0, 10) : "";
    const endDate = typeof event.end === "string" ? event.end.slice(0, 10) : startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate || startDate) < today) continue;
    const afterTitle = rawTitle.slice(title.length);
    const session = afterTitle.split(/Rental/i)[0].trim();
    const location = rawTitle.match(/Rental\s+([^\n]+?)(?:\s+\d{1,2}:\d{2}|$)/i)?.[1]?.trim() || "NIPSTA";
    const key = `${title}|${session}`.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.startDate = existing.startDate < startDate ? existing.startDate : startDate;
      existing.endDate = existing.endDate > endDate ? existing.endDate : endDate;
      continue;
    }
    grouped.set(key, {
      title,
      url: sourceUrl,
      startDate,
      endDate: endDate || startDate,
      location,
      detail: [session, location].filter(Boolean).join(" · "),
    });
  }
  return uniqueCourses([...grouped.values()]);
}
