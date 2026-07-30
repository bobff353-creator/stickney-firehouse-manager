import { unstable_cache } from "next/cache";

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
  available: boolean;
};

const dailyFeedTag = "stickney-daily-external-feeds";
export const externalFeedCacheTag = dailyFeedTag;

const closeCallFeed =
  "https://www.firefighterclosecalls.com/category/news/feed/";

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

async function loadCloseCallNews() {
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
  const providers = await Promise.all(
    trainingSources.map(async (provider): Promise<TrainingProvider> => {
      try {
        const html = await fetchText(provider.sourceUrl);
        const resources = resourcesFor(provider, html);
        return {
          ...provider,
          checkedAt,
          resources,
          available: resources.length > 0,
        };
      } catch {
        return {
          ...provider,
          checkedAt,
          resources: [],
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
  ["stickney-training-sites-v1"],
  { revalidate: 86_400, tags: [dailyFeedTag] },
);
