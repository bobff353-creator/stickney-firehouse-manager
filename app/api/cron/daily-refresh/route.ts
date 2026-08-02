import { revalidateTag } from "next/cache";
import {
  externalFeedCacheTag,
  getCloseCallNews,
  getTrainingSites,
} from "../../../lib/external-feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  revalidateTag(externalFeedCacheTag, { expire: 0 });
  const [news, training] = await Promise.allSettled([
    getCloseCallNews(),
    getTrainingSites(),
  ]);

  const result = {
    ok: news.status === "fulfilled" && training.status === "fulfilled",
    refreshedAt: new Date().toISOString(),
    closeCallItems:
      news.status === "fulfilled" ? news.value.items.length : 0,
    trainingProviders:
      training.status === "fulfilled"
        ? training.value.providers.filter((provider) => provider.available)
            .length
        : 0,
    upcomingTrainingItems:
      training.status === "fulfilled"
        ? training.value.providers.reduce(
            (total, provider) => total + provider.upcoming.length,
            0,
          )
        : 0,
    closeCallsUpdated: news.status === "fulfilled",
    trainingUpdated: training.status === "fulfilled",
  };

  return Response.json(result, { status: result.ok ? 200 : 207 });
}
