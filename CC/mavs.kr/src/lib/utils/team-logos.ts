// src/lib/utils/team-logos.ts
// NBA 팀 로고 경로를 반환하는 공통 유틸리티 함수

export const getTeamLogo = (teamName: string): string => {
  const teamLogos: { [key: string]: string } = {
    // 서부 컨퍼런스 - 모든 팀을 PNG로 통일
    'Mavericks': '/images/logos/mavericks.png',
    'Lakers': '/images/logos/lakers.png',
    'Warriors': '/images/logos/warriors.png',
    'Nuggets': '/images/logos/nuggets.png',
    'Suns': '/images/logos/suns.png',
    'Thunder': '/images/logos/thunder.png',
    'Rockets': '/images/logos/rockets.png',
    'Spurs': '/images/logos/spurs.png',
    'Jazz': '/images/logos/jazz.png',
    'Trail Blazers': '/images/logos/trailblazers.png',
    'Kings': '/images/logos/kings.png',
    'Clippers': '/images/logos/clippers.png',
    'Timberwolves': '/images/logos/timberwolves.png',
    'Pelicans': '/images/logos/pelicans.png',
    'Grizzlies': '/images/logos/grizzlies.png',

    // 동부 컨퍼런스 - 모든 팀을 PNG로 통일
    'Celtics': '/images/logos/celtics.png',
    'Heat': '/images/logos/heat.png',
    'Bucks': '/images/logos/bucks.png',
    '76ers': '/images/logos/76ers.png',
    'Nets': '/images/logos/nets.png',
    'Knicks': '/images/logos/knicks.png',
    'Raptors': '/images/logos/raptors.png',
    'Bulls': '/images/logos/bulls.png',
    'Cavaliers': '/images/logos/cavaliers.png',
    'Pistons': '/images/logos/pistons.png',
    'Pacers': '/images/logos/pacers.png',
    'Hawks': '/images/logos/hawks.png',
    'Hornets': '/images/logos/hornets.png',
    'Magic': '/images/logos/magic.png',
    'Wizards': '/images/logos/wizards.png',

    // 전체 이름 매핑 (API에서 이렇게 올 수도 있으니) - 모든 팀 PNG로 통일
    'Dallas Mavericks': '/images/logos/mavericks.png',
    'Los Angeles Lakers': '/images/logos/lakers.png',
    'Golden State Warriors': '/images/logos/warriors.png',
    'Oklahoma City Thunder': '/images/logos/thunder.png',
    'Houston Rockets': '/images/logos/rockets.png',
    'San Antonio Spurs': '/images/logos/spurs.png',
    'Denver Nuggets': '/images/logos/nuggets.png',
    'Utah Jazz': '/images/logos/jazz.png',
    'Portland Trail Blazers': '/images/logos/trailblazers.png',
    'Phoenix Suns': '/images/logos/suns.png',
    'Sacramento Kings': '/images/logos/kings.png',
    'LA Clippers': '/images/logos/clippers.png',
    'Los Angeles Clippers': '/images/logos/clippers.png',
    'Minnesota Timberwolves': '/images/logos/timberwolves.png',
    'New Orleans Pelicans': '/images/logos/pelicans.png',
    'Memphis Grizzlies': '/images/logos/grizzlies.png',
    'Boston Celtics': '/images/logos/celtics.png',
    'Miami Heat': '/images/logos/heat.png',
    'Milwaukee Bucks': '/images/logos/bucks.png',
    'Philadelphia 76ers': '/images/logos/76ers.png',
    'Brooklyn Nets': '/images/logos/nets.png',
    'New York Knicks': '/images/logos/knicks.png',
    'Toronto Raptors': '/images/logos/raptors.png',
    'Chicago Bulls': '/images/logos/bulls.png',
    'Cleveland Cavaliers': '/images/logos/cavaliers.png',
    'Detroit Pistons': '/images/logos/pistons.png',
    'Indiana Pacers': '/images/logos/pacers.png',
    'Atlanta Hawks': '/images/logos/hawks.png',
    'Charlotte Hornets': '/images/logos/hornets.png',
    'Orlando Magic': '/images/logos/magic.png',
    'Washington Wizards': '/images/logos/wizards.png',
  };

  // 기본 fallback - 매버릭스 PNG 로고
  return teamLogos[teamName] || '/images/logos/mavericks.png';
};

// 팀 이름 정규화 함수 (선택사항)
export const normalizeTeamName = (teamName: string): string => {
  // 불필요한 공백 제거
  return teamName.trim();
};
