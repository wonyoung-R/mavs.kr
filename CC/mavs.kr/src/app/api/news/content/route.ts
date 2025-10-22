import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // 웹 페이지 내용 가져오기
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 다양한 뉴스 사이트의 콘텐츠 선택자
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '.story-body',
      '.article-body',
      '.post-body',
      'main',
      '.main-content',
      '#content',
      '.news-content',
      '.article-text',
      '.story-content',
      '.entry',
      '.post',
    ];

    let content = '';
    let contentElement = null;

    // 콘텐츠 요소 찾기
    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) {
        break;
      }
    }

    if (contentElement) {
      // 불필요한 요소 제거
      const elementsToRemove = [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.ad',
        '.ads',
        '.social-share',
        '.comments',
        '.related-articles',
        '.sidebar',
        '.menu',
        '.navigation',
      ];

      elementsToRemove.forEach(selector => {
        const elements = contentElement.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // 텍스트 추출
      content = contentElement.textContent || contentElement.innerText || '';

      // 정리
      content = content
        .replace(/\s+/g, ' ') // 여러 공백을 하나로
        .replace(/\n\s*\n/g, '\n') // 빈 줄 정리
        .trim();

      // 너무 짧은 내용은 무시
      if (content.length < 100) {
        content = '';
      }
    }

    // 콘텐츠를 찾지 못한 경우 메타 설명 사용
    if (!content) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        content = metaDescription.getAttribute('content') || '';
      }
    }

    return NextResponse.json({
      content,
      url,
      success: true,
    });

  } catch (error) {
    console.error('Content extraction error:', error);

    return NextResponse.json(
      {
        error: 'Failed to extract content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
