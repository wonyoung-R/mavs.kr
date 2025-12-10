// src/lib/translation/simple-translator.ts
interface TranslationCache {
  [key: string]: string;
}

// 간단한 번역 매핑 테이블
const TRANSLATION_MAP: TranslationCache = {
  // 기본 농구 용어
  'Mavericks': '매버릭스',
  'Dallas': '달라스',
  'Luka Doncic': '루카 돈치치',
  'Kyrie Irving': '키리 어빙',
  'NBA': 'NBA',
  'playoff': '플레이오프',
  'championship': '챔피언십',
  'MVP': 'MVP',
  'All-Star': '올스타',
  'rookie': '신인',
  'veteran': '베테랑',
  'coach': '코치',
  'team': '팀',
  'game': '경기',
  'season': '시즌',
  'win': '승리',
  'loss': '패배',
  'victory': '승리',
  'defeat': '패배',
  'score': '득점',
  'points': '포인트',
  'rebound': '리바운드',
  'assist': '어시스트',
  'steal': '스틸',
  'block': '블록',
  'injury': '부상',
  'trade': '트레이드',
  'contract': '계약',
  'draft': '드래프트',
  'free agent': '자유계약선수',

  // 일반 뉴스 용어
  'breaking': '속보',
  'news': '뉴스',
  'report': '보고서',
  'source': '소식통',
  'according to': '에 따르면',
  'confirmed': '확인됨',
  'official': '공식',
  'announced': '발표됨',
  'signed': '계약됨',
  'agreed': '합의됨',
  'deal': '계약',
  'agreement': '합의',
  'extension': '연장',
  'return': '복귀',
  'comeback': '컴백',
  'retirement': '은퇴',
  'suspension': '출장정지',
  'fine': '벌금',
  'penalty': '처벌',

  // 시간 관련
  'today': '오늘',
  'yesterday': '어제',
  'tomorrow': '내일',
  'this week': '이번 주',
  'next week': '다음 주',
  'this month': '이번 달',
  'next month': '다음 달',
  'this year': '올해',
  'next year': '내년',


  // 형용사/부사
  'amazing': '놀라운',
  'incredible': '믿을 수 없는',
  'fantastic': '환상적인',
  'excellent': '훌륭한',
  'great': '훌륭한',
  'good': '좋은',
  'bad': '나쁜',
  'terrible': '끔찍한',
  'awful': '끔찍한',
  'horrible': '끔찍한',
  'unbelievable': '믿을 수 없는',
  'shocking': '충격적인',
  'surprising': '놀라운',
  'expected': '예상된',
  'unexpected': '예상치 못한',
  'possible': '가능한',
  'impossible': '불가능한',
  'likely': '가능성이 높은',
  'unlikely': '가능성이 낮은',

  // 동사
  'will': '할 것이다',
  'would': '할 것이다',
  'could': '할 수 있다',
  'should': '해야 한다',
  'might': '할 수도 있다',
  'may': '할 수도 있다',
  'can': '할 수 있다',
  'cannot': '할 수 없다',
  'can\'t': '할 수 없다',
  'won\'t': '하지 않을 것이다',
  'wouldn\'t': '하지 않을 것이다',
  'couldn\'t': '할 수 없었다',
  'shouldn\'t': '하지 않아야 한다',
  'mightn\'t': '하지 않을 수도 있다',
  'mayn\'t': '하지 않을 수도 있다',

  // 전치사/접속사
  'and': '그리고',
  'or': '또는',
  'but': '하지만',
  'however': '하지만',
  'although': '비록',
  'because': '왜냐하면',
  'since': '이후로',
  'if': '만약',
  'when': '언제',
  'where': '어디서',
  'why': '왜',
  'how': '어떻게',
  'what': '무엇',
  'who': '누구',
  'which': '어떤',
  'that': '그',
  'this': '이',
  'these': '이것들',
  'those': '그것들',

  // 일반적인 표현
  'according to sources': '소식통에 따르면',
  'it has been reported': '보고된 바에 따르면',
  'sources say': '소식통들이 말하길',
  'breaking news': '속보',
  'exclusive': '독점',
  'confirmed by': '확인됨',
  'official announcement': '공식 발표',
  'team statement': '팀 성명',
  'league sources': '리그 소식통',
  'insider reports': '내부자 보고서',
};

// 캐시 저장소
let translationCache: TranslationCache = {};

// 로컬 스토리지에서 캐시 로드
export function loadTranslationCache(): void {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('simple-translation-cache');
      if (stored) {
        translationCache = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load translation cache:', error);
    }
  }
}

// 로컬 스토리지에 캐시 저장
export function saveTranslationCache(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('simple-translation-cache', JSON.stringify(translationCache));
    } catch (error) {
      console.error('Failed to save translation cache:', error);
    }
  }
}

// 간단한 번역 함수
export function simpleTranslate(text: string): string {
  // 캐시에서 먼저 확인
  if (translationCache[text]) {
    return translationCache[text];
  }

  let translated = text;

  // 긴 구문부터 매칭 (더 정확한 번역을 위해)
  const sortedKeys = Object.keys(TRANSLATION_MAP).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translated = translated.replace(regex, TRANSLATION_MAP[key]);
  }

  // 기본적인 문장 패턴 번역
  translated = translated
    // "X says" -> "X가 말하길"
    .replace(/\b(\w+)\s+says\b/gi, '$1가 말하길')
    // "X reports" -> "X가 보고하길"
    .replace(/\b(\w+)\s+reports\b/gi, '$1가 보고하길')
    // "X confirms" -> "X가 확인하길"
    .replace(/\b(\w+)\s+confirms\b/gi, '$1가 확인하길')
    // "X announces" -> "X가 발표하길"
    .replace(/\b(\w+)\s+announces\b/gi, '$1가 발표하길')
    // "X agrees to" -> "X가 동의하길"
    .replace(/\b(\w+)\s+agrees\s+to\b/gi, '$1가 동의하길')
    // "X signs" -> "X가 계약하길"
    .replace(/\b(\w+)\s+signs\b/gi, '$1가 계약하길')
    // "X returns" -> "X가 복귀하길"
    .replace(/\b(\w+)\s+returns\b/gi, '$1가 복귀하길')
    // "X will" -> "X가 할 것이다"
    .replace(/\b(\w+)\s+will\b/gi, '$1가 할 것이다')
    // "X could" -> "X가 할 수 있다"
    .replace(/\b(\w+)\s+could\b/gi, '$1가 할 수 있다')
    // "X should" -> "X가 해야 한다"
    .replace(/\b(\w+)\s+should\b/gi, '$1가 해야 한다');

  // 캐시에 저장
  translationCache[text] = translated;
  saveTranslationCache();

  return translated;
}

// 배치 번역 함수
export function batchSimpleTranslate(texts: string[]): string[] {
  return texts.map(text => simpleTranslate(text));
}

// 번역 품질 확인 (한국어 문자가 포함되어 있는지)
export function hasKoreanText(text: string): boolean {
  return /[가-힣]/.test(text);
}

// 영어 텍스트인지 확인
export function isEnglishText(text: string): boolean {
  const hasEnglishChars = /[a-zA-Z]/.test(text);
  const hasKoreanChars = /[가-힣]/.test(text);
  return hasEnglishChars && !hasKoreanChars;
}


