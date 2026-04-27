import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const CHANNEL_HANDLE = 'PandaHank41';

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1] ?? '0');
  const min = parseInt(m[2] ?? '0');
  const sec = parseInt(m[3] ?? '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, videos: [], error: 'YOUTUBE_API_KEY not set' });
  }

  try {
    const youtube = google.youtube({ version: 'v3', auth: apiKey });

    const channelRes = await youtube.channels.list({
      part: ['id', 'contentDetails'],
      forHandle: CHANNEL_HANDLE,
    });
    const channel = channelRes.data.items?.[0];
    if (!channel) {
      return NextResponse.json({ success: false, videos: [], error: 'Channel not found' });
    }

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return NextResponse.json({ success: false, videos: [], error: 'No uploads playlist' });
    }

    const playlistRes = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 20,
    });

    const items = playlistRes.data.items ?? [];
    const videoIds = items
      .map((i) => i.contentDetails?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds.length) {
      return NextResponse.json({ success: true, videos: [] });
    }

    const videoRes = await youtube.videos.list({
      part: ['contentDetails'],
      id: videoIds,
    });

    const durationMap: Record<string, string> = {};
    for (const v of videoRes.data.items ?? []) {
      if (v.id && v.contentDetails?.duration) {
        durationMap[v.id] = parseDuration(v.contentDetails.duration);
      }
    }

    const videos = items.map((item) => {
      const videoId = item.contentDetails?.videoId ?? '';
      const snippet = item.snippet;
      return {
        id: videoId,
        title: snippet?.title ?? '',
        channelTitle: snippet?.channelTitle ?? 'PandaHank',
        thumbnail:
          snippet?.thumbnails?.medium?.url ??
          snippet?.thumbnails?.default?.url ??
          '',
        duration: durationMap[videoId] ?? '0:00',
        publishedAt: snippet?.publishedAt ?? '',
      };
    });

    return NextResponse.json(
      { success: true, videos },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('[YouTube API]', err);
    return NextResponse.json({ success: false, videos: [], error: 'API error' }, { status: 500 });
  }
}
