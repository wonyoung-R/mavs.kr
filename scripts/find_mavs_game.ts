import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { prisma } from '@/lib/db/prisma';

async function main() {
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeam: { contains: 'Mavericks' } },
        { awayTeam: { contains: 'Mavericks' } },
        { homeTeam: { contains: 'Dallas' } },
        { awayTeam: { contains: 'Dallas' } },
      ],
      status: 'FINAL',
    },
    orderBy: { scheduledAt: 'desc' },
    take: 5,
    select: { gameId: true, scheduledAt: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true },
  });
  games.forEach(g => {
    const date = g.scheduledAt.toISOString().slice(0, 10);
    console.log(`${date} | gameId=${g.gameId} | ${g.awayTeam} @ ${g.homeTeam} (${g.awayScore}-${g.homeScore})`);
  });
}
main().finally(() => prisma.$disconnect());
