import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const CHANNEL_HANDLE = 'PandaHank41';

// 채널 외 수동 핀 영상 — 리스트 맨 앞에 prepend (썸네일·제목·duration은 YouTube에서 그대로 가져옴).
const PINNED_VIDEO_IDS = ['N-XvUHyOOhY'];

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

    // 핀 영상 메타데이터 (채널 업로드와 중복되면 스킵).
    let pinned: typeof videos = [];
    if (PINNED_VIDEO_IDS.length) {
      const channelIds = new Set(videos.map((v) => v.id));
      const idsToFetch = PINNED_VIDEO_IDS.filter((id) => !channelIds.has(id));
      if (idsToFetch.length) {
        try {
          const pinRes = await youtube.videos.list({
            part: ['snippet', 'contentDetails'],
            id: idsToFetch,
          });
          pinned = (pinRes.data.items ?? []).map((it) => ({
            id: it.id ?? '',
            title: it.snippet?.title ?? '',
            channelTitle: it.snippet?.channelTitle ?? '',
            thumbnail:
              it.snippet?.thumbnails?.medium?.url ??
              it.snippet?.thumbnails?.default?.url ??
              '',
            duration: it.contentDetails?.duration ? parseDuration(it.contentDetails.duration) : '0:00',
            publishedAt: it.snippet?.publishedAt ?? '',
          }));
        } catch (e) {
          console.warn('[YouTube API] pinned fetch failed:', e);
        }
      }
    }

    return NextResponse.json(
      { success: true, videos: [...pinned, ...videos] },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('[YouTube API]', err);
    return NextResponse.json({ success: false, videos: [], error: 'API error' }, { status: 500 });
  }
}
