import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const CHANNEL_HANDLE = 'PandaHank41';

interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  publishedAt: string;
}

// 수동 핀 영상 — 리스트 맨 앞에 prepend. 런타임 YouTube API 호출 없이 하드코드.
// 썸네일은 YouTube 표준 URL(i.ytimg.com/vi/{id}/mqdefault.jpg)을 그대로 사용.
// 채널 업로드와 중복되면 자동 스킵.
const PINNED_VIDEOS: Omit<VideoItem, 'thumbnail'>[] = [
  {
    id: 'N-XvUHyOOhY',
    title: '누워보는 Mavs : 프리시즌 0화. 26 드래프트와 팰러스',
    channelTitle: '누워보는Mavs와 NBA',
    duration: '',
    publishedAt: '2026-05-29T00:00:00Z',
  },
  {
    id: 't5L_DhRgPec',
    title: "Watch This Video if You Can't Stop Thinking About Cooper Flagg & Kyrie Irving Playing Together",
    channelTitle: 'PandaHank41',
    duration: '',
    publishedAt: '2026-05-29T00:00:00Z',
  },
];

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1] ?? '0');
  const min = parseInt(m[2] ?? '0');
  const sec = parseInt(m[3] ?? '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

async function fetchChannelVideos(apiKey: string): Promise<VideoItem[]> {
  const youtube = google.youtube({ version: 'v3', auth: apiKey });

  const channelRes = await youtube.channels.list({
    part: ['id', 'contentDetails'],
    forHandle: CHANNEL_HANDLE,
  });
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const playlistRes = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults: 20,
  });
  const items = playlistRes.data.items ?? [];
  const videoIds = items.map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];
  if (!videoIds.length) return [];

  const videoRes = await youtube.videos.list({ part: ['contentDetails'], id: videoIds });
  const durationMap: Record<string, string> = {};
  for (const v of videoRes.data.items ?? []) {
    if (v.id && v.contentDetails?.duration) durationMap[v.id] = parseDuration(v.contentDetails.duration);
  }

  return items.map((item) => {
    const videoId = item.contentDetails?.videoId ?? '';
    const snippet = item.snippet;
    return {
      id: videoId,
      title: snippet?.title ?? '',
      channelTitle: snippet?.channelTitle ?? 'PandaHank',
      thumbnail: snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? '',
      duration: durationMap[videoId] ?? '0:00',
      publishedAt: snippet?.publishedAt ?? '',
    };
  });
}

export async function GET() {
  // 채널 영상은 YOUTUBE_API_KEY가 있을 때만 시도. 실패해도 핀 영상은 항상 노출.
  const apiKey = process.env.YOUTUBE_API_KEY;
  let channelVideos: VideoItem[] = [];
  if (apiKey) {
    try {
      channelVideos = await fetchChannelVideos(apiKey);
    } catch (err) {
      console.error('[YouTube API]', err);
    }
  }

  // 핀 영상 prepend (채널 업로드와 중복되면 스킵). 표준 썸네일 URL 사용.
  const channelIds = new Set(channelVideos.map((v) => v.id));
  const pinned: VideoItem[] = PINNED_VIDEOS
    .filter((p) => !channelIds.has(p.id))
    .map((p) => ({ ...p, thumbnail: `https://i.ytimg.com/vi/${p.id}/mqdefault.jpg` }));

  return NextResponse.json(
    { success: true, videos: [...pinned, ...channelVideos] },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300' } }
  );
}
