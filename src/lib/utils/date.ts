export function getKoreanTime(date: Date): Date {
  const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime;
}

export function getGameTimeStatus(scheduledAt: Date, status: string): string {
  const now = new Date();
  const gameTime = new Date(scheduledAt);

  if (status === 'LIVE') {
    return '진행중';
  }

  if (status === 'FINAL') {
    return '종료';
  }

  if (status === 'POSTPONED') {
    return '연기';
  }

  const diffInHours = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 0) {
    return '시작됨';
  }

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes}분 후`;
  }

  if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}시간 후`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}일 후`;
}

export function getSeasonYear(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // NBA 시즌은 10월에 시작하므로, 10월 이후는 다음 해 시즌
  if (month >= 10) {
    return year + 1;
  }

  return year;
}

export function isGameToday(scheduledAt: Date): boolean {
  const today = new Date();
  const gameDate = new Date(scheduledAt);

  return (
    today.getFullYear() === gameDate.getFullYear() &&
    today.getMonth() === gameDate.getMonth() &&
    today.getDate() === gameDate.getDate()
  );
}

export function getNextGameDate(): Date {
  const now = new Date();
  const nextGame = new Date(now);

  // 다음 경기는 보통 1-3일 후
  nextGame.setDate(now.getDate() + 2);
  nextGame.setHours(20, 0, 0, 0); // 오후 8시로 설정

  return nextGame;
}
