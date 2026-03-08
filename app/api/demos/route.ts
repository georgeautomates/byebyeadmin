import { NextResponse } from 'next/server';

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export async function GET() {
  if (!API_KEY || !CHANNEL_ID) {
    return NextResponse.json({ error: 'Missing YouTube API config' }, { status: 500 });
  }

  // 1. Get the channel's uploads playlist ID
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`,
    { next: { revalidate: 3600 } }
  );
  const chData = await chRes.json();
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return NextResponse.json([]);

  // 2. Fetch recent uploads (up to 50)
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsId}&key=${API_KEY}`,
    { next: { revalidate: 3600 } }
  );
  const plData = await plRes.json();
  const ids: string[] = (plData.items ?? []).map(
    (item: { snippet: { resourceId: { videoId: string } } }) => item.snippet.resourceId.videoId
  );
  if (!ids.length) return NextResponse.json([]);

  // 3. Fetch video details to get duration (filter Shorts: ≤ 180s)
  const vRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(',')}&key=${API_KEY}`,
    { next: { revalidate: 3600 } }
  );
  const vData = await vRes.json();

  type YTVideo = {
    id: string;
    contentDetails: { duration: string };
    snippet: {
      title: string;
      thumbnails: {
        maxres?: { url: string };
        high?: { url: string };
        medium?: { url: string };
      };
    };
  };

  const shorts = (vData.items ?? [])
    .filter((v: YTVideo) => parseDuration(v.contentDetails.duration) <= 180)
    .map((v: YTVideo) => ({
      id: v.id,
      title: v.snippet.title.replace(/#\S+/g, '').trim(),
      thumbnail:
        v.snippet.thumbnails.maxres?.url ??
        v.snippet.thumbnails.high?.url ??
        v.snippet.thumbnails.medium?.url ??
        '',
    }));

  return NextResponse.json(shorts, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
