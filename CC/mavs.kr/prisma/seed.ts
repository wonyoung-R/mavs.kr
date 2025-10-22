import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { name: '루카 돈치치' },
      update: {},
      create: { name: '루카 돈치치' },
    }),
    prisma.tag.upsert({
      where: { name: '키리 어빙' },
      update: {},
      create: { name: '키리 어빙' },
    }),
    prisma.tag.upsert({
      where: { name: '트레이드' },
      update: {},
      create: { name: '트레이드' },
    }),
    prisma.tag.upsert({
      where: { name: '경기 분석' },
      update: {},
      create: { name: '경기 분석' },
    }),
  ]);

  // Create sample badges
  const badges = await Promise.all([
    prisma.badge.upsert({
      where: { name: '신규 회원' },
      update: {},
      create: {
        name: '신규 회원',
        description: '새로 가입한 회원',
        icon: '🆕',
      },
    }),
    prisma.badge.upsert({
      where: { name: '활발한 참여자' },
      update: {},
      create: {
        name: '활발한 참여자',
        description: '포럼에 활발히 참여하는 회원',
        icon: '💬',
      },
    }),
    prisma.badge.upsert({
      where: { name: '뉴스 기자' },
      update: {},
      create: {
        name: '뉴스 기자',
        description: '뉴스를 자주 공유하는 회원',
        icon: '📰',
      },
    }),
  ]);

  console.log('Seed data created successfully!');
  console.log('Tags:', tags);
  console.log('Badges:', badges);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
