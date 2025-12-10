import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { simpleTranslate } from '@/lib/translation/simple-translator';

export async function POST(request: NextRequest) {
  try {
    const { url, title } = await request.json();

    if (!url || !title) {
      return NextResponse.json(
        { error: 'URL and title are required' },
        { status: 400 }
      );
    }

    // 1. 기사 본문 크롤링
    const articleContent = await crawlArticle(url);

    if (!articleContent) {
      // 크롤링 실패 시 제목만으로 간단 번역 및 요약
      const translatedTitle = simpleTranslate(title);
      const keyPoints = generateKeyPointsFromTitle(title);
      const summary = generateSummaryFromTitle(title);

      return NextResponse.json({
        success: false,
        fallback: true,
        translatedTitle,
        keyPoints,
        summary,
        originalTitle: title,
        originalContent: null,
        sentiment: 'neutral',
        relevanceScore: 5
      });
    }

    // 2. AI로 번역 및 요약
    const summary = await summarizeWithAI(title, articleContent);

    return NextResponse.json({
      success: true,
      originalContent: articleContent,
      ...summary
    });

  } catch (error) {
    console.error('Summarize Error:', error);
    return NextResponse.json(
      { error: 'Failed to summarize article' },
      { status: 500 }
    );
  }
}

// 제목만으로 키포인트 생성
function generateKeyPointsFromTitle(title: string): string[] {
  // const translatedTitle = simpleTranslate(title);

  // 제목에서 키워드 추출 및 분석
  const keywords = extractKeywords(title);
  const keyPoints: string[] = [];

  // 매버릭스 관련 키워드가 있으면 우선 처리
  if (keywords.includes('mavericks') || keywords.includes('dallas') || keywords.includes('mavs')) {
    keyPoints.push('달라스 매버릭스와 관련된 뉴스입니다.');
  }

  // 플레이어 관련 키워드
  const players = ['luka', 'doncic', 'kyrie', 'irving', 'hardaway', 'kleber', 'powell', 'finney-smith'];
  const foundPlayer = players.find(player => keywords.some(k => k.includes(player)));
  if (foundPlayer) {
    keyPoints.push(`${foundPlayer.charAt(0).toUpperCase() + foundPlayer.slice(1)} 선수와 관련된 내용입니다.`);
  }

  // 경기 관련 키워드
  if (keywords.some(k => ['game', 'win', 'loss', 'score', 'playoff', 'season'].includes(k))) {
    keyPoints.push('경기 결과나 시즌 관련 소식입니다.');
  }

  // 트레이드 관련 키워드
  if (keywords.some(k => ['trade', 'deal', 'sign', 'contract'].includes(k))) {
    keyPoints.push('선수 영입이나 계약 관련 소식입니다.');
  }

  // 기본 키포인트
  if (keyPoints.length === 0) {
    keyPoints.push('NBA 및 달라스 매버릭스 관련 뉴스입니다.');
    keyPoints.push('자세한 내용은 원문을 확인해주세요.');
  }

  return keyPoints;
}

// 제목만으로 요약 생성
function generateSummaryFromTitle(title: string): string {
  const translatedTitle = simpleTranslate(title);
  const keywords = extractKeywords(title);

  let summary = `"${translatedTitle}"\n\n`;

  // 매버릭스 관련 내용인지 확인
  if (keywords.includes('mavericks') || keywords.includes('dallas') || keywords.includes('mavs')) {
    summary += '이 기사는 달라스 매버릭스와 관련된 뉴스입니다. ';
  } else {
    summary += '이 기사는 NBA 관련 뉴스입니다. ';
  }

  // 추가 컨텍스트 제공
  if (keywords.some(k => ['game', 'win', 'loss'].includes(k))) {
    summary += '경기 결과나 성과에 대한 내용을 다루고 있습니다.';
  } else if (keywords.some(k => ['trade', 'deal'].includes(k))) {
    summary += '선수 영입이나 트레이드 관련 소식을 다루고 있습니다.';
  } else if (keywords.some(k => ['injury', 'hurt'].includes(k))) {
    summary += '선수 부상이나 건강 상태에 대한 내용입니다.';
  } else {
    summary += '팀의 최신 소식이나 상황을 다루고 있습니다.';
  }

  summary += '\n\n※ 기사 본문을 가져올 수 없어 제목을 바탕으로 요약했습니다. 자세한 내용은 원문을 확인해주세요.';

  return summary;
}

// 키워드 추출 함수
function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 10); // 상위 10개 키워드만
}

// 기사 크롤링 함수
async function crawlArticle(url: string): Promise<string | null> {
  try {
    // User-Agent 설정으로 봇 차단 회피
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      next: { revalidate: 3600 } // 1시간 캐시
    });

    if (!response.ok) {
      console.error('HTTP Error:', response.status);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 사이트별 선택자 매핑 (더 포괄적으로 개선)
    const selectors = {
      'espn.com': '.article-body, .story-body, [data-behavior="article_body"], .Article__Body, .Story__Body',
      'nba.com': '.Article_article__2Uc5f, .content-wrapper, .Article__Body, .Article__Content',

      'thesmokingcuban.com': '.entry-content, .post-content, article .content, .article-content, .entry-body',
      'mavsmoneyball.com': '.c-entry-content, .entry-content, .post-content, .entry-body',
      'theathletic.com': '.article-content-container, .article__body, .ArticleBody, .Article__Content',
      'bleacherreport.com': '.contentStream, .article-body, .ArticleBody, .Article__Content',
      'sbnation.com': '.c-entry-content, .entry-content, .entry-body',
      'yahoo.com': '.caas-body, .article-content, .story-body',
      'cnn.com': '.article__content, .l-container, .zn-body__paragraph',
      'foxsports.com': '.article-content, .story-body, .content',
      'cbssports.com': '.Article__Body, .article-content, .story-body',
      'default': 'article, main, .content, .post-content, .entry-content, .article-body, .story-body, .article-content, [role="main"]'
    };

    // URL에 따른 선택자 선택
    const domain = new URL(url).hostname.replace('www.', '');
    const selector = Object.entries(selectors).find(([key]) =>
      domain.includes(key)
    )?.[1] || selectors.default;

    // 본문 추출 (더 강력한 로직)
    let content = '';

    // 여러 선택자 시도
    const selArray = selector.split(', ');
    for (const sel of selArray) {
      const element = $(sel);
      if (element.length > 0) {
        // 스크립트와 스타일 태그 제거
        element.find('script, style, nav, header, footer, aside, .advertisement, .ad').remove();

        content = element.text()
          .replace(/\s+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (content.length > 200) break; // 충분한 컨텐츠 찾음
      }
    }

    // 본문이 여전히 짧으면 더 광범위하게 검색
    if (content.length < 200) {
      // 모든 p 태그들 수집
      const paragraphs = $('p').map((_, el) => {
        const $el = $(el);
        // 광고나 네비게이션 제외
        if ($el.closest('.ad, .advertisement, .nav, .navigation, .sidebar').length > 0) return '';
        return $el.text().trim();
      }).get().filter(text => text.length > 20);

      content = paragraphs.join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // 여전히 짧으면 div 태그들도 시도
    if (content.length < 200) {
      const divs = $('div').map((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        // 너무 짧거나 긴 텍스트 제외
        if (text.length < 50 || text.length > 2000) return '';
        // 광고나 네비게이션 제외
        if ($el.closest('.ad, .advertisement, .nav, .navigation, .sidebar').length > 0) return '';
        return text;
      }).get().filter(text => text.length > 50);

      if (divs.length > 0) {
        content = divs.slice(0, 3).join(' ') // 상위 3개만
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    // 최대 길이 제한 (토큰 제한 고려)
    const maxLength = 4000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    return content || null;

  } catch (error) {
    console.error('Crawl Error:', error);
    return null;
  }
}

// AI 요약 함수 (Gemini API 사용)
async function summarizeWithAI(title: string, content: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found, using fallback');
      return fallbackSummary(title, content);
    }

    const prompt = `당신은 전문 번역가이자 NBA 뉴스 분석가입니다. 다음 영어 NBA 뉴스를 자연스러운 한국어로 완전 번역해주세요.

번역 규칙:
1. 제목을 자연스러운 한국어로 번역
2. 본문 전체를 자연스러운 한국어로 완전 번역
3. 선수 이름은 한글 표기 후 괄호에 영문 병기 (예: "루카 돈치치(Luka Doncic)")
4. 농구 용어는 한국어로 자연스럽게 번역
5. 문장 구조를 한국어에 맞게 조정

응답 형식 (정확히 이 형식을 따라주세요):
===제목===
[번역된 제목]

===본문번역===
[완전 번역된 본문 내용]

===핵심요약===
• [핵심 포인트 1]
• [핵심 포인트 2]
• [핵심 포인트 3]

===감정===
[positive/negative/neutral]

원문 제목: ${title}

원문 본문:
${content.substring(0, 4000)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // 텍스트에서 정보 추출
    return extractFromText(resultText, title);

  } catch (error) {
    console.error('Gemini API Error:', error);
    // Fallback: 규칙 기반 요약
    return fallbackSummary(title, content);
  }
}

// 텍스트에서 정보 추출 (JSON 파싱 실패 시)
function extractFromText(text: string, originalTitle: string) {
  let translatedTitle = originalTitle;
  let translatedContent = '';
  let keyPoints: string[] = [];
  let summary = '';
  let sentiment = 'neutral';

  // 제목 추출
  const titleMatch = text.match(/===제목===\s*([\s\S]*?)(?=\n===|$)/i);
  if (titleMatch) {
    translatedTitle = titleMatch[1].trim();
  } else {
    // 기존 형식 fallback
    const oldTitleMatch = text.match(/제목[:\s]*([^\n]+)/i);
    if (oldTitleMatch) translatedTitle = oldTitleMatch[1].trim();
  }

  // 본문 번역 추출
  const contentMatch = text.match(/===본문번역===\s*([\s\S]*?)(?=\n===|$)/i);
  if (contentMatch) {
    translatedContent = contentMatch[1].trim();
  }

  // 핵심 요약 추출
  const summaryMatch = text.match(/===핵심요약===\s*([\s\S]*?)(?=\n===|$)/i);
  if (summaryMatch) {
    const bulletMatches = summaryMatch[1].match(/[•\-\*]\s*([^\n]+)/g);
    if (bulletMatches) {
      keyPoints = bulletMatches.map(match => match.replace(/^[•\-\*]\s*/, '').trim());
    }
    summary = keyPoints.join(' ');
  } else {
    // 기존 형식 fallback
    const bulletMatches = text.match(/[•\-\*]\s*([^\n]+)/g);
    if (bulletMatches) {
      keyPoints = bulletMatches.map(match => match.replace(/^[•\-\*]\s*/, '').trim());
    }
  }

  // 감정 추출
  const sentimentMatch = text.match(/===감정===\s*([^\n]+)/i) || text.match(/감정[:\s]*([^\n]+)/i);
  if (sentimentMatch) {
    const sentimentText = sentimentMatch[1].trim().toLowerCase();
    if (sentimentText.includes('positive') || sentimentText.includes('긍정')) sentiment = 'positive';
    else if (sentimentText.includes('negative') || sentimentText.includes('부정')) sentiment = 'negative';
    else sentiment = 'neutral';
  }

  return {
    translatedTitle,
    translatedContent,
    keyPoints,
    summary,
    originalTitle,
    sentiment,
    relevanceScore: 5
  };
}

// Fallback: 규칙 기반 요약
function fallbackSummary(title: string, content: string) {
  try {
    // 간단한 규칙 기반 요약 (기존 로직)
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

    // Mavericks 관련 문장들 우선 추출
    const mavsSentences = sentences.filter(s =>
      s.toLowerCase().includes('maverick') ||
      s.toLowerCase().includes('luka') ||
      s.toLowerCase().includes('dallas') ||
      s.toLowerCase().includes('doncic')
    );

    // 핵심 포인트 추출 (상위 3-5개)
    const keyPoints = mavsSentences.length > 0
      ? mavsSentences.slice(0, 3).map(s => simpleTranslate(s.trim()))
      : sentences.slice(0, 3).map(s => simpleTranslate(s.trim()));

    // 요약 생성
    const summaryText = sentences.slice(0, 2).join(' ');
    const summary = simpleTranslate(summaryText);

    // 감정 분석 (간단한 키워드 기반)
    const positiveWords = ['win', 'victory', 'success', 'great', 'excellent', 'amazing'];
    const negativeWords = ['loss', 'defeat', 'injury', 'problem', 'issue', 'bad'];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

    let sentiment = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';

    // 관련도 점수 (Mavericks 관련 내용 비율)
    const mavsRelatedWords = ['maverick', 'luka', 'dallas', 'doncic', 'cuban', 'mavs'];
    const relatedCount = mavsRelatedWords.filter(word =>
      lowerContent.includes(word)
    ).length;
    const relevanceScore = Math.min(10, Math.max(1, relatedCount * 2));

    return {
      translatedTitle: simpleTranslate(title),
      keyPoints: keyPoints,
      summary: summary,
      originalTitle: title,
      sentiment: sentiment,
      relevanceScore: relevanceScore,
      fallback: true
    };

  } catch (error) {
    console.error('Fallback Summary Error:', error);
    // 최종 폴백: 제목만 번역
    return {
      translatedTitle: simpleTranslate(title),
      keyPoints: ['기사 요약을 생성할 수 없습니다.'],
      summary: '기사 요약을 생성할 수 없습니다.',
      originalTitle: title,
      sentiment: 'neutral',
      relevanceScore: 5,
      fallback: true
    };
  }
}
