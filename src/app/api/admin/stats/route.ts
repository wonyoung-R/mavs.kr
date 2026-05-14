import { NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase-helpers';
import { computeTodayStats, computeLastNDays } from '@/lib/auto-content/stats';

const ADMIN_EMAIL = 'mavsdotkr@gmail.com';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    const supabase = await createServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [today, last7, last30] = await Promise.all([
    computeTodayStats(),
    computeLastNDays(7),
    computeLastNDays(30),
  ]);

  return NextResponse.json({ ok: true, today, last7, last30 });
}
