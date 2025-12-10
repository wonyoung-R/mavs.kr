// src/lib/utils/team-logos.ts
// NBA 팀 로고 경로를 반환하는 공통 유틸리티 함수

// Supabase Storage URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nycoldtrqbkevvgoajlq.supabase.co';
const LOGO_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/MAVS.KR/NBA_Logos`;

export const getTeamLogo = (teamName: string): string => {
  // 팀 이름 매핑 (API 응답/전체이름 -> Supabase 파일명 약어)
  // 규칙: 도시 이름 약어 2~3글자 (예: dal, atl, gs, no, ny)
  const teamMapping: { [key: string]: string } = {
    // === 서부 컨퍼런스 ===

    // Southwest
    'Mavericks': 'dal', 'Dallas Mavericks': 'dal', 'DAL': 'dal',
    'Spurs': 'sas', 'San Antonio Spurs': 'sas', 'SAS': 'sas',
    'Rockets': 'hou', 'Houston Rockets': 'hou', 'HOU': 'hou',
    'Grizzlies': 'mem', 'Memphis Grizzlies': 'mem', 'MEM': 'mem',
    'Pelicans': 'no', 'New Orleans Pelicans': 'no', 'NOP': 'no', // User specified 'no'

    // Pacific
    'Suns': 'phx', 'Phoenix Suns': 'phx', 'PHX': 'phx',
    'Warriors': 'gs', 'Golden State Warriors': 'gs', 'GSW': 'gs', // User specified 'gs'
    'Lakers': 'lal', 'Los Angeles Lakers': 'lal', 'LAL': 'lal',
    'Clippers': 'lac', 'Los Angeles Clippers': 'lac', 'LAC': 'lac',
    'Kings': 'sac', 'Sacramento Kings': 'sac', 'SAC': 'sac',

    // Northwest
    'Nuggets': 'den', 'Denver Nuggets': 'den', 'DEN': 'den',
    'Thunder': 'okc', 'Oklahoma City Thunder': 'okc', 'OKC': 'okc',
    'Timberwolves': 'min', 'Minnesota Timberwolves': 'min', 'MIN': 'min',
    'Trail Blazers': 'por', 'Portland Trail Blazers': 'por', 'POR': 'por',
    'Jazz': 'uta', 'Utah Jazz': 'uta', 'UTA': 'uta',

    // === 동부 컨퍼런스 ===

    // Atlantic
    'Celtics': 'bos', 'Boston Celtics': 'bos', 'BOS': 'bos',
    'Nets': 'bkn', 'Brooklyn Nets': 'bkn', 'BKN': 'bkn',
    'Knicks': 'ny', 'New York Knicks': 'ny', 'NYK': 'ny', // User specified 'ny'
    '76ers': 'phi', 'Philadelphia 76ers': 'phi', 'PHI': 'phi',
    'Raptors': 'tor', 'Toronto Raptors': 'tor', 'TOR': 'tor',

    // Central
    'Bulls': 'chi', 'Chicago Bulls': 'chi', 'CHI': 'chi',
    'Cavaliers': 'cle', 'Cleveland Cavaliers': 'cle', 'CLE': 'cle',
    'Pistons': 'det', 'Detroit Pistons': 'det', 'DET': 'det',
    'Pacers': 'ind', 'Indiana Pacers': 'ind', 'IND': 'ind',
    'Bucks': 'mil', 'Milwaukee Bucks': 'mil', 'MIL': 'mil',

    // Southeast
    'Hawks': 'atl', 'Atlanta Hawks': 'atl', 'ATL': 'atl',
    'Hornets': 'cha', 'Charlotte Hornets': 'cha', 'CHA': 'cha',
    'Heat': 'mia', 'Miami Heat': 'mia', 'MIA': 'mia',
    'Magic': 'orl', 'Orlando Magic': 'orl', 'ORL': 'orl',
    'Wizards': 'was', 'Washington Wizards': 'was', 'WAS': 'was',
  };

  const normalizedName = teamMapping[teamName];

  if (normalizedName) {
    // 파일 확장자는 .png로 가정 (필요시 .svg 등 수정 가능)
    return `${LOGO_BASE_URL}/${normalizedName}.png`;
  }

  // 매핑되지 않은 경우 기본값 (댈러스)
  return `${LOGO_BASE_URL}/dal.png`;
};

// 팀 이름 정규화 함수
export const normalizeTeamName = (teamName: string): string => {
  return teamName.trim();
};
