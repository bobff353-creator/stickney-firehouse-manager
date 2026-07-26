const feedUrl = "https://www.firefighterclosecalls.com/category/news/feed/";
const fallbackItems = [
  {
    title: "4th FIREFIGHTER DIES FOLLOWING KNOWLES FIRE BURNOVER (The Secret List)",
    url: "https://www.firefighterclosecalls.com/4th-firefighter-dies-following-knowles-fire-burnover-the-secret-list/",
    publishedAt: "2026-07-25T12:00:00-05:00",
    excerpt: "",
  },
  {
    title: "WASHINGTON, DC FIREFIGHTER STRUCK BY LADDER TRUCK – MEDAVAC’D TO TRAUMA CENTER",
    url: "https://www.firefighterclosecalls.com/washington-dc-firefighter-struck-by-ladder-truck-medavacd-to-trauma-center/",
    publishedAt: "2026-07-23T12:00:00-05:00",
    excerpt: "",
  },
  {
    title: "TROOPERS CITE STATE FIRE EMPLOYEE AFTER CRASH – COLORADO",
    url: "https://www.firefighterclosecalls.com/troopers-cite-state-fire-employee-after-crash-colorado/",
    publishedAt: "2026-07-23T12:00:00-05:00",
    excerpt: "",
  },
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&apos;/g, "’")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function field(item: string, tag: string) {
  return item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
}

export async function GET() {
  try {
    const response = await fetch(feedUrl, {
      headers: { "user-agent": "Stickney Fire Department Operations Portal/1.0" },
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error("News source unavailable");
    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 3).map((match) => {
      const item = match[1];
      const link = decodeXml(field(item, "link"));
      const url = new URL(link);
      if (url.hostname !== "www.firefighterclosecalls.com" && url.hostname !== "firefighterclosecalls.com") throw new Error("Unexpected news link");
      const description = decodeXml(field(item, "description"));
      return {
        title: decodeXml(field(item, "title")),
        url: url.toString(),
        publishedAt: field(item, "pubDate"),
        excerpt: description.length > 155 ? `${description.slice(0, 152).trimEnd()}…` : description,
      };
    }).filter((item) => item.title && item.url);
    if (!items.length) throw new Error("No news reports found");
    return Response.json({ items, source: "Firefighter Close Calls" }, { headers: { "cache-control": "public, max-age=300, s-maxage=900" } });
  } catch {
    return Response.json({ items: fallbackItems, source: "Firefighter Close Calls", stale: true }, { headers: { "cache-control": "public, max-age=60" } });
  }
}
