import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { prisma } from '@/lib/db/prisma';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'voice-corpus', 'posts');
const RYU_EMAIL = 'mavsdotkr@gmail.com';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

async function main() {
  const dryRun = process.argv.includes('--dry');

  const ryu = await prisma.user.findUnique({
    where: { email: RYU_EMAIL },
    select: { id: true, email: true, name: true, username: true },
  });

  if (!ryu) {
    console.error(`User ${RYU_EMAIL} not found`);
    process.exit(1);
  }

  console.log(`Ryu: ${ryu.id} (${ryu.name ?? ryu.username})`);

  const posts = await prisma.post.findMany({
    where: { authorId: ryu.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      createdAt: true,
      images: true,
    },
  });

  console.log(`Found ${posts.length} posts authored by Ryu`);

  if (dryRun) {
    posts.slice(0, 3).forEach(p => {
      console.log(`- [${p.category}] ${p.createdAt.toISOString().slice(0, 10)} | ${p.title}`);
    });
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const p of posts) {
    const date = p.createdAt.toISOString().slice(0, 10);
    const filename = `${date}_${p.category}_${slugify(p.title)}_${p.id.slice(0, 8)}.md`;
    const md = `---
post_id: ${p.id}
category: ${p.category}
created_at: ${p.createdAt.toISOString()}
title: ${p.title.replace(/\n/g, ' ')}
images: ${p.images.length}
---

# ${p.title}

${p.content}
`;
    writeFileSync(join(OUTPUT_DIR, filename), md, 'utf-8');
  }

  console.log(`Wrote ${posts.length} files to ${OUTPUT_DIR}`);

  const breakdown: Record<string, number> = {};
  posts.forEach(p => {
    breakdown[p.category] = (breakdown[p.category] || 0) + 1;
  });
  console.log('Category breakdown:', breakdown);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
