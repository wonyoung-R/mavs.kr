// src/lib/utils/team-logos.ts
// NBA 팀 로고 경로를 반환하는 공통 유틸리티 함수

// Supabase Storage URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nycoldtrqbkevvgoajlq.supabase.co';
const LOGO_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/MAVS.KR/NBA_Logos`;

export const getTeamLogo = (teamName: string): string => {
  // 팀 이름 매핑 (API 응답/전체이름/도시명 -> Supabase 파일명 약어)
  const teamMapping: { [key: string]: string } = {
    // === 서부 컨퍼런스 ===

    // Southwest
    'Mavericks': 'dal', 'Dallas Mavericks': 'dal', 'Dallas': 'dal', 'DAL': 'dal',
    'Spurs': 'sas', 'San Antonio Spurs': 'sas', 'San Antonio': 'sas', 'SAS': 'sas',
    'Rockets': 'hou', 'Houston Rockets': 'hou', 'Houston': 'hou', 'HOU': 'hou',
    'Grizzlies': 'mem', 'Memphis Grizzlies': 'mem', 'Memphis': 'mem', 'MEM': 'mem',
    'Pelicans': 'no', 'New Orleans Pelicans': 'no', 'New Orleans': 'no', 'NOP': 'no',

    // Pacific
    'Suns': 'phx', 'Phoenix Suns': 'phx', 'Phoenix': 'phx', 'PHX': 'phx',
    'Warriors': 'gs', 'Golden State Warriors': 'gs', 'Golden State': 'gs', 'GSW': 'gs',
    'Lakers': 'lal', 'Los Angeles Lakers': 'lal', 'LA Lakers': 'lal', 'LAL': 'lal',
    'Clippers': 'lac', 'Los Angeles Clippers': 'lac', 'LA Clippers': 'lac', 'LAC': 'lac',
    'Kings': 'sac', 'Sacramento Kings': 'sac', 'Sacramento': 'sac', 'SAC': 'sac',

    // Northwest
    'Nuggets': 'den', 'Denver Nuggets': 'den', 'Denver': 'den', 'DEN': 'den',
    'Thunder': 'okc', 'Oklahoma City Thunder': 'okc', 'Oklahoma City': 'okc', 'OKC': 'okc',
    'Timberwolves': 'min', 'Minnesota Timberwolves': 'min', 'Minnesota': 'min', 'MIN': 'min',
    'Trail Blazers': 'por', 'Portland Trail Blazers': 'por', 'Portland': 'por', 'POR': 'por', 'Blazers': 'por',
    'Jazz': 'utah', 'Utah Jazz': 'utah', 'Utah': 'utah', 'UTA': 'utah',

    // === 동부 컨퍼런스 ===

    // Atlantic
    'Celtics': 'bos', 'Boston Celtics': 'bos', 'Boston': 'bos', 'BOS': 'bos',
    'Nets': 'bkn', 'Brooklyn Nets': 'bkn', 'Brooklyn': 'bkn', 'BKN': 'bkn',
    'Knicks': 'ny', 'New York Knicks': 'ny', 'New York': 'ny', 'NYK': 'ny',
    '76ers': 'phi', 'Philadelphia 76ers': 'phi', 'Philadelphia': 'phi', 'Sixers': 'phi', 'PHI': 'phi',
    'Raptors': 'tor', 'Toronto Raptors': 'tor', 'Toronto': 'tor', 'TOR': 'tor',

    // Central
    'Bulls': 'chi', 'Chicago Bulls': 'chi', 'Chicago': 'chi', 'CHI': 'chi',
    'Cavaliers': 'cle', 'Cleveland Cavaliers': 'cle', 'Cleveland': 'cle', 'Cavs': 'cle', 'CLE': 'cle',
    'Pistons': 'det', 'Detroit Pistons': 'det', 'Detroit': 'det', 'DET': 'det',
    'Pacers': 'ind', 'Indiana Pacers': 'ind', 'Indiana': 'ind', 'IND': 'ind',
    'Bucks': 'mil', 'Milwaukee Bucks': 'mil', 'Milwaukee': 'mil', 'MIL': 'mil',

    // Southeast
    'Hawks': 'atl', 'Atlanta Hawks': 'atl', 'Atlanta': 'atl', 'ATL': 'atl',
    'Hornets': 'cha', 'Charlotte Hornets': 'cha', 'Charlotte': 'cha', 'CHA': 'cha',
    'Heat': 'mia', 'Miami Heat': 'mia', 'Miami': 'mia', 'MIA': 'mia',
    'Magic': 'orl', 'Orlando Magic': 'orl', 'Orlando': 'orl', 'ORL': 'orl',
    'Wizards': 'was', 'Washington Wizards': 'was', 'Washington': 'was', 'WAS': 'was',
  };

  const normalizedName = teamMapping[teamName];

  if (normalizedName) {
    return `${LOGO_BASE_URL}/${normalizedName}.png`;
  }

  // 매핑되지 않은 경우 콘솔에 경고 출력 후 기본값 반환
  console.warn(`[team-logos] Unknown team name: "${teamName}"`);
  return `${LOGO_BASE_URL}/dal.png`;
};

// 팀 이름 정규화 함수
export const normalizeTeamName = (teamName: string): string => {
  return teamName.trim();
};
