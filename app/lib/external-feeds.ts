import { unstable_cache } from "next/cache";
import {
  parseIfsiSchedule,
  parseNipstaCourseNames,
  parseNipstaEvents,
  parseRomeovilleActivity,
  type UpcomingTrainingCourse,
} from "./training-parsers";

export type CloseCallItem = {
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
};

export type TrainingResource = {
  title: string;
  url: string;
  detail: string;
};

export type TrainingProvider = {
  id: "romeoville" | "ifsi" | "nipsta";
  name: string;
  shortName: string;
  sourceUrl: string;
  checkedAt: string;
  resources: TrainingResource[];
  upcoming: UpcomingTrainingCourse[];
  available: boolean;
};

const dailyFeedTag = "stickney-daily-external-feeds";
export const externalFeedCacheTag = dailyFeedTag;

const closeCallFeed =
  "https://www.firefighterclosecalls.com/category/news/feed/";
const closeCallPosts =
  "https://www.firefighterclosecalls.com/wp-json/wp/v2/posts?categories=1&per_page=6&_fields=link,date_gmt,title,excerpt";

const trainingSources = [
  {
    id: "romeoville",
    name: "Romeoville Fire Academy",
    shortName: "Romeoville",
    sourceUrl: "https://www.romeoville.org/562/Fire-Rescue-Courses",
  },
  {
    id: "ifsi",
    name: "Illinois Fire Service Institute",
    shortName: "IFSI",
    sourceUrl: "https://www.fsi.illinois.edu/content/courses/schedule/",
  },
  {
    id: "nipsta",
    name: "NIPSTA Fire & Technical Rescue",
    shortName: "NIPSTA",
    sourceUrl: "https://nipsta.org/175/Fire-Technical-Rescue-Training",
  },
] as const;

const nipstaCalendarUrl =
  "https://secure.rec1.com/IL/nipsta-il/Public-Calendar-Main-Calendar/76202fcal";
const nipstaCalendarEndpoint =
  "https://secure.rec1.com/IL/nipsta-il/cal_ajax.php?request=publicCalendar";

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&apos;|&#39;|&#8217;/gi, "'")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&quot;|&#34;|&#8220;|&#8221;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function xmlField(item: string, tag: string) {
  return (
    item.match(
      new RegExp(
        `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
        "i",
      ),
    )?.[1] ?? ""
  );
}

function safeOfficialUrl(value: string, sourceUrl: string) {
  const url = new URL(decodeHtml(value), sourceUrl);
  if (url.protocol !== "https:") throw new Error("Unexpected resource URL");
  return url;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Stickney Fire Department Operations Portal/2.0 (+https://stickney-firehouse-manager.vercel.app)",
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Source returned ${response.status}`);
  }
  return response.text();
}

function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function mapLimited<T, R>(
  values: T[],
  limit: number,
  task: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (index < values.length) {
      const current = index++;
      results[current] = await task(values[current]);
    }
  }));
  return results;
}

async function romeovilleUpcoming(html: string, sourceUrl: string, today: string) {
  const activities = anchors(html, sourceUrl).filter(({ url }) =>
    url.hostname === "www.romeoville.org"
    && url.pathname.includes("/Activities/Activity/Detail/"),
  );
  const courses = await mapLimited(activities, 6, async ({ title, url }) => {
    try {
      return parseRomeovilleActivity(
        await fetchText(url.toString()),
        url.toString(),
        title,
        today,
      );
    } catch {
      return [];
    }
  });
  return courses.flat().sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title),
  );
}

function cookieHeader(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() || [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function nipstaUpcoming(today: string) {
  const page = await fetch(nipstaCalendarUrl, {
    headers: {
      "user-agent":
        "Stickney Fire Department Operations Portal/2.0 (+https://stickney-firehouse-manager.vercel.app)",
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!page.ok) throw new Error(`NIPSTA calendar returned ${page.status}`);
  const html = await page.text();
  const csrfToken = html.match(/<meta name="csrf-token" content="([^"]+)"/i)?.[1] || "";
  const csrfKey = html.match(/<meta name="csrf-key" content="([^"]+)"/i)?.[1] || "";
  const cookies = cookieHeader(page);
  if (!csrfToken || !csrfKey || !cookies) throw new Error("NIPSTA calendar session is unavailable");

  const start = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / 1000);
  const end = start + 370 * 86_400;
  const body = new URLSearchParams({
    start: String(start),
    end: String(end),
    "facilities[]": "76202",
    eventsBubbled: "true",
    eventLabelStyle: "1",
  });
  const response = await fetch(nipstaCalendarEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      cookie: cookies,
      referer: nipstaCalendarUrl,
      "user-agent":
        "Stickney Fire Department Operations Portal/2.0 (+https://stickney-firehouse-manager.vercel.app)",
      "x-csrf-key": csrfKey,
      "x-csrf-token": csrfToken,
      "x-requested-with": "XMLHttpRequest",
    },
    body,
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`NIPSTA event feed returned ${response.status}`);
  const payload = await response.json() as { events?: Array<{ title?: unknown; start?: unknown; end?: unknown }> };
  return parseNipstaEvents(
    Array.isArray(payload.events) ? payload.events : [],
    parseNipstaCourseNames(html),
    nipstaCalendarUrl,
    today,
  );
}

async function loadCloseCallNews() {
  try {
    const posts = JSON.parse(await fetchText(closeCallPosts)) as Array<{
      link?: unknown;
      date_gmt?: unknown;
      title?: { rendered?: unknown };
      excerpt?: { rendered?: unknown };
    }>;
    const items = Array.isArray(posts)
      ? posts.flatMap((post): CloseCallItem[] => {
          const title = decodeHtml(
            typeof post.title?.rendered === "string"
              ? post.title.rendered
              : "",
          );
          const description = decodeHtml(
            typeof post.excerpt?.rendered === "string"
              ? post.excerpt.rendered
              : "",
          );
          const publishedAt =
            typeof post.date_gmt === "string" ? `${post.date_gmt}Z` : "";
          try {
            const url = safeOfficialUrl(
              typeof post.link === "string" ? post.link : "",
              closeCallPosts,
            );
            if (
              url.hostname !== "www.firefighterclosecalls.com" &&
              url.hostname !== "firefighterclosecalls.com"
            ) {
              return [];
            }
            if (!title || !publishedAt) return [];
            return [
              {
                title,
                url: url.toString(),
                publishedAt,
                excerpt:
                  description.length > 360
                    ? `${description.slice(0, 357).trimEnd()}…`
                    : description,
              },
            ];
          } catch {
            return [];
          }
        })
      : [];
    if (items.length) {
      return {
        items,
        source: "Firefighter Close Calls",
        sourceUrl: "https://www.firefighterclosecalls.com/",
        checkedAt: new Date().toISOString(),
      };
    }
  } catch {
    // The RSS parser below remains an official-source fallback.
  }

  const xml = await fetchText(closeCallFeed);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, 6)
    .flatMap((match): CloseCallItem[] => {
      const item = match[1];
      const title = decodeHtml(xmlField(item, "title"));
      const publishedAt = decodeHtml(xmlField(item, "pubDate"));
      const description = decodeHtml(
        xmlField(item, "content:encoded") || xmlField(item, "description"),
      );
      try {
        const url = safeOfficialUrl(xmlField(item, "link"), closeCallFeed);
        if (
          url.hostname !== "www.firefighterclosecalls.com" &&
          url.hostname !== "firefighterclosecalls.com"
        ) {
          return [];
        }
        if (!title || !publishedAt) return [];
        return [
          {
            title,
            url: url.toString(),
            publishedAt,
            excerpt:
              description.length > 360
                ? `${description.slice(0, 357).trimEnd()}…`
                : description,
          },
        ];
      } catch {
        return [];
      }
    });
  if (!items.length) throw new Error("No close-call reports were found");
  return {
    items,
    source: "Firefighter Close Calls",
    sourceUrl: "https://www.firefighterclosecalls.com/",
    checkedAt: new Date().toISOString(),
  };
}

function anchors(html: string, sourceUrl: string) {
  const seen = new Set<string>();
  return [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap((match) => {
      const title = decodeHtml(match[2]);
      if (!title || title.length > 140) return [];
      try {
        const url = safeOfficialUrl(match[1], sourceUrl);
        const key = `${title.toLowerCase()}|${url.toString()}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ title, url }];
      } catch {
        return [];
      }
    });
}

function resourcesFor(
  provider: (typeof trainingSources)[number],
  html: string,
): TrainingResource[] {
  const links = anchors(html, provider.sourceUrl);
  if (provider.id === "romeoville") {
    return links
      .filter(({ url }) =>
        url.pathname.includes("/Activities/Activity/Detail/"),
      )
      .slice(0, 8)
      .map(({ title, url }) => ({
        title,
        url: url.toString(),
        detail: "Current official course page",
      }));
  }
  if (provider.id === "ifsi") {
    const printable = links.find(({ title, url }) =>
      /printable calendar/i.test(title) ||
      url.pathname.includes("/documents/calendar/current.pdf"),
    );
    return [
      {
        title: "Search current IFSI classes",
        url: provider.sourceUrl,
        detail: "Live schedule and registration search",
      },
      ...(printable
        ? [
            {
              title: "Printable current course calendar",
              url: printable.url.toString(),
              detail: "Official IFSI calendar",
            },
          ]
        : []),
      {
        title: "Browse IFSI courses",
        url: "https://www.fsi.illinois.edu/content/courses/",
        detail: "Official course catalog",
      },
    ];
  }
  const allowed = new Set([
    "/177/Basic-Firefighter-Academy",
    "/355/Advanced-Firefighter-Training",
    "/394/Fire-Officer-Training",
    "/339/Technical-Rescue-Training",
    "/338/Hazardous-Materials-Training",
  ]);
  return links
    .filter(({ url }) => allowed.has(url.pathname))
    .slice(0, 8)
    .map(({ title, url }) => ({
      title,
      url: url.toString(),
      detail: "Current official program page",
    }));
}

async function loadTrainingSites() {
  const checkedAt = new Date().toISOString();
  const today = chicagoDate();
  const providers = await Promise.all(
    trainingSources.map(async (provider): Promise<TrainingProvider> => {
      try {
        const html = await fetchText(provider.sourceUrl);
        const resources = resourcesFor(provider, html);
        const upcoming = provider.id === "romeoville"
          ? await romeovilleUpcoming(html, provider.sourceUrl, today)
          : provider.id === "ifsi"
            ? parseIfsiSchedule(html, provider.sourceUrl, today)
            : await nipstaUpcoming(today);
        return {
          ...provider,
          checkedAt,
          resources,
          upcoming,
          available: resources.length > 0 || upcoming.length > 0,
        };
      } catch {
        return {
          ...provider,
          checkedAt,
          resources: [],
          upcoming: [],
          available: false,
        };
      }
    }),
  );
  return { providers, checkedAt };
}

export const getCloseCallNews = unstable_cache(
  loadCloseCallNews,
  ["stickney-close-call-news-v2"],
  { revalidate: 86_400, tags: [dailyFeedTag] },
);

export const getTrainingSites = unstable_cache(
  loadTrainingSites,
  ["stickney-training-sites-v2"],
  { revalidate: 86_400, tags: [dailyFeedTag] },
);
