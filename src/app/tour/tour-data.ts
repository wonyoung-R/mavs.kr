const directory = '/images/tour';

export const tourImages = {
  hero: `${directory}/01_hero_aac.webp`,
  arena: `${directory}/02_experience_arena_exterior.webp`,
  stockyards: `${directory}/03_experience_stockyards.webp`,
  fans: `${directory}/04_experience_fans.webp`,
  detroit: `${directory}/05_game_detroit.webp`,
  houston: `${directory}/06_game_houston.webp`,
  toronto: `${directory}/07_game_toronto.webp`,
  dallas: `${directory}/08_day01_dallas.webp`,
  kimbell: `${directory}/09_day02_kimbell.webp`,
  freeTime: `${directory}/10_day03_freetime.webp`,
  stadium: `${directory}/11_day04_att_stadium.webp`,
  tower: `${directory}/12_day04_reunion_tower.webp`,
  hotel: `${directory}/13_hotel_exterior.webp`,
  room: `${directory}/14_hotel_room.webp`,
  skyline: `${directory}/15_final_dallas_skyline.webp`,
};

export const tour = {
  title: '2027 댈러스 매버릭스 프리미엄 팬투어',
  date: '2027.01.29 — 02.04',
  highlights: '5박 7일 · 홈경기 3회',
  price: '₩6,990,000',
  hotel: 'SpringHill Suites Dallas Downtown/West End 또는 동급',
};

export const experiences = [
  { image: tourImages.arena, title: '홈코트에서.', alt: '아메리칸 에어라인스 센터 외관' },
  { image: tourImages.stockyards, title: '텍사스 한가운데서.', alt: '포트워스 스톡야드의 롱혼 행렬' },
  { image: tourImages.fans, title: '같은 팬들과 함께.', alt: '경기장으로 들어서는 매버릭스 팬들' },
];

export const games = [
  { image: tourImages.detroit, date: '01.29 FRI', opponent: 'DETROIT', isoDate: '2027-01-29' },
  { image: tourImages.houston, date: '01.31 SUN', opponent: 'HOUSTON', isoDate: '2027-01-31' },
  { image: tourImages.toronto, date: '02.02 TUE', opponent: 'TORONTO', isoDate: '2027-02-02' },
];

type ItineraryDay = {
  date: string;
  place: string;
  summary: string;
  details: string[];
  photos?: { src: string; alt: string }[];
};

export const itinerary: ItineraryDay[] = [
  {
    date: '01.29',
    place: '댈러스',
    summary: '댈러스 도착 · 디트로이트전',
    photos: [{ src: tourImages.dallas, alt: '댈러스 도심 거리' }],
    details: [
      '인천에서 KE031편으로 출발해 댈러스에 도착합니다.',
      '딜리 플라자, The Eye, 노비츠키 벽화를 둘러본 뒤 디트로이트전을 관람합니다.',
      '전용차량을 이용하며 점심과 저녁이 제공됩니다.',
    ],
  },
  {
    date: '01.30',
    place: '포트워스',
    summary: '킴벨 미술관 · 스톡야드 · 스테이크 특식',
    photos: [{ src: tourImages.kimbell, alt: '킴벨 미술관 외관' }],
    details: [
      '킴벨 미술관 상설전과 포트워스 스톡야드의 롱혼 소몰이를 관람합니다.',
      '전용차량을 이용하며 점심으로 스테이크 특식이 제공됩니다. 저녁은 자유식입니다.',
    ],
  },
  {
    date: '01.31',
    place: '댈러스 자유일정',
    summary: '자유일정 · 휴스턴전',
    photos: [{ src: tourImages.freeTime, alt: '댈러스 딥엘럼 거리' }],
    details: [
      '자유일정 후 아메리칸 에어라인스 센터로 개별 이동해 18:30까지 지정 장소에 모입니다. 팬 이벤트와 팀스토어 방문이 예정되어 있으며 휴스턴전을 관람합니다.',
      '전용차량과 식사는 제공되지 않습니다.',
      '넷플릭스 하우스, 댈러스 미술관, 파머스 마켓, 페어 파크, 딥엘럼, Globe Life Field, Texas Live는 개별 방문 추천 코스입니다.',
    ],
  },
  {
    date: '02.01',
    place: '알링턴 · 댈러스',
    summary: 'AT&T 스타디움 · 리유니언 타워 · 아울렛',
    photos: [
      { src: tourImages.stadium, alt: 'AT&T 스타디움 외관' },
      { src: tourImages.tower, alt: '댈러스 리유니언 타워' },
    ],
    details: [
      'AT&T 스타디움 단체 투어 후 파이오니어 플라자, 론 커크 보행교, 클라이드 워런 파크와 아트 디스트릭트 외관을 둘러봅니다.',
      '리유니언 타워 전망대와 앨런 프리미엄 아울렛을 방문합니다.',
      '전용차량을 이용하며 현지식 점심과 한식 저녁이 제공됩니다.',
    ],
  },
  {
    date: '02.02',
    place: '댈러스 자유일정',
    summary: '자유일정 · 토론토전',
    photos: [{ src: tourImages.toronto, alt: '댈러스와 토론토의 매치업' }],
    details: [
      '자유일정 후 경기장으로 개별 이동해 18:30까지 지정 장소에 모여 토론토전을 관람합니다.',
      '전용차량과 식사는 제공되지 않습니다.',
    ],
  },
  {
    date: '02.03',
    place: '댈러스 출발',
    summary: '호텔 체크아웃 · 인천행 출발',
    details: [
      '조식 후 호텔에서 체크아웃하고 07:30에 공항으로 이동합니다.',
      '일정표 기준 KE032편은 현지 시각 11:25에 출발합니다.',
    ],
  },
  {
    date: '02.04',
    place: '인천 도착',
    summary: '인천 도착 · 여행 종료',
    details: ['일정표 기준 17:35에 인천에 도착합니다.'],
  },
];

export const faqs = [
  {
    question: '사전 관심 등록을 하면 예약이 확정되나요?',
    answer: '관심 등록은 예약이나 결제 확정이 아닙니다. 등록한 연락처로 상세 일정과 예약 절차를 안내드립니다.',
  },
  {
    question: '자유일에는 경기장에 어떻게 가나요?',
    answer: '1월 31일과 2월 2일에는 경기장으로 개별 이동해 현지 시각 18:30까지 지정 장소에 모입니다. 두 날 모두 전용차량과 식사는 제공되지 않습니다.',
  },
  {
    question: '항공편과 수하물 조건은 언제 알 수 있나요?',
    answer: '일정표는 대한항공 KE031·KE032편을 기준으로 합니다. 확정 발권 조건, 항공편 시간과 수하물은 예약 안내에서 확인할 수 있습니다.',
  },
  {
    question: '경기 시작 시각과 좌석은 어떻게 안내되나요?',
    answer: '경기 시작 시각과 좌석 조건은 상세 일정과 예약 안내에서 확인할 수 있습니다.',
  },
  {
    question: '여행 경비의 포함·불포함 항목은 어디에서 확인하나요?',
    answer: '일자별 차량과 식사 조건은 위 일정에서 확인할 수 있습니다. 전체 여행 경비의 포함·불포함 항목은 예약 안내에서 확인할 수 있습니다.',
  },
];
