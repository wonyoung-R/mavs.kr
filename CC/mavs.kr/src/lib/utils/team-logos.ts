// src/lib/utils/team-logos.ts
// NBA 팀 로고 경로를 반환하는 공통 유틸리티 함수

export const getTeamLogo = (teamName: string): string => {
  const teamLogos: { [key: string]: string } = {
    // 서부 컨퍼런스
    'Mavericks': '/images/teams/mavericks.svg',
    'Lakers': '/images/teams/lakers.svg',
    'Warriors': '/images/teams/warriors.svg',
    'Thunder': '/images/teams/thunder.svg',
    'Rockets': '/images/teams/rockets.svg',
    'Spurs': '/images/teams/spurs.svg',
    'Nuggets': '/images/teams/nuggets.svg',
    'Jazz': '/images/teams/jazz.svg',
    'Trail Blazers': '/images/teams/trailblazers.svg',
    'Suns': '/images/teams/suns.svg',
    'Kings': '/images/teams/kings.svg',
    'Clippers': '/images/teams/clippers.svg',
    'Timberwolves': '/images/teams/timberwolves.svg',
    'Pelicans': '/images/teams/pelicans.svg',
    'Grizzlies': '/images/teams/grizzlies.svg',
    
    // 동부 컨퍼런스
    'Celtics': '/images/teams/celtics.svg',
    'Heat': '/images/teams/heat.svg',
    'Bucks': '/images/teams/bucks.svg',
    '76ers': '/images/teams/76ers.svg',
    'Nets': '/images/teams/nets.svg',
    'Knicks': '/images/teams/knicks.svg',
    'Raptors': '/images/teams/raptors.svg',
    'Bulls': '/images/teams/bulls.svg',
    'Cavaliers': '/images/teams/cavaliers.svg',
    'Pistons': '/images/teams/pistons.svg',
    'Pacers': '/images/teams/pacers.svg',
    'Hawks': '/images/teams/hawks.svg',
    'Hornets': '/images/teams/hornets.svg',
    'Magic': '/images/teams/magic.svg',
    'Wizards': '/images/teams/wizards.svg',
    
    // 전체 이름 매핑 (API에서 이렇게 올 수도 있으니)
    'Dallas Mavericks': '/images/teams/mavericks.svg',
    'Los Angeles Lakers': '/images/teams/lakers.svg',
    'Golden State Warriors': '/images/teams/warriors.svg',
    'Oklahoma City Thunder': '/images/teams/thunder.svg',
    'Houston Rockets': '/images/teams/rockets.svg',
    'San Antonio Spurs': '/images/teams/spurs.svg',
    'Denver Nuggets': '/images/teams/nuggets.svg',
    'Utah Jazz': '/images/teams/jazz.svg',
    'Portland Trail Blazers': '/images/teams/trailblazers.svg',
    'Phoenix Suns': '/images/teams/suns.svg',
    'Sacramento Kings': '/images/teams/kings.svg',
    'LA Clippers': '/images/teams/clippers.svg',
    'Los Angeles Clippers': '/images/teams/clippers.svg',
    'Minnesota Timberwolves': '/images/teams/timberwolves.svg',
    'New Orleans Pelicans': '/images/teams/pelicans.svg',
    'Memphis Grizzlies': '/images/teams/grizzlies.svg',
    'Boston Celtics': '/images/teams/celtics.svg',
    'Miami Heat': '/images/teams/heat.svg',
    'Milwaukee Bucks': '/images/teams/bucks.svg',
    'Philadelphia 76ers': '/images/teams/76ers.svg',
    'Brooklyn Nets': '/images/teams/nets.svg',
    'New York Knicks': '/images/teams/knicks.svg',
    'Toronto Raptors': '/images/teams/raptors.svg',
    'Chicago Bulls': '/images/teams/bulls.svg',
    'Cleveland Cavaliers': '/images/teams/cavaliers.svg',
    'Detroit Pistons': '/images/teams/pistons.svg',
    'Indiana Pacers': '/images/teams/pacers.svg',
    'Atlanta Hawks': '/images/teams/hawks.svg',
    'Charlotte Hornets': '/images/teams/hornets.svg',
    'Orlando Magic': '/images/teams/magic.svg',
    'Washington Wizards': '/images/teams/wizards.svg',
  };
  
  // 기본 fallback - 매버릭스 로고
  return teamLogos[teamName] || '/images/teams/mavericks.svg';
};

// 팀 이름 정규화 함수 (선택사항)
export const normalizeTeamName = (teamName: string): string => {
  // 불필요한 공백 제거
  return teamName.trim();
};
