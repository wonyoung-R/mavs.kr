'use client';

import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DynamicJSXRenderer from '@/components/analysis/DynamicJSXRenderer';

interface ColumnContentRendererProps {
  htmlContent: string;
}

interface JSXBlock {
  element: Element;
  code: string;
  id: string;
}

// Helper function to decode base64 to JSX code
function decodeBase64ToJsx(base64Code: string): string | null {
  try {
    // Try new UTF-8 safe method first
    const binaryString = atob(base64Code);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    try {
      // Fallback to old method for backward compatibility
      return decodeURIComponent(escape(atob(base64Code)));
    } catch (e2) {
      console.error('[ColumnContentRenderer] Failed to decode base64:', e2);
      return null;
    }
  }
}

// 빈 paragraph를 br로 변환하여 줄바꿈이 유지되도록 처리
function processLineBreaks(html: string): string {
  // 빈 <p></p> 또는 <p> </p> (공백만 있는)를 <br>로 변환
  let processed = html
    // 완전히 빈 paragraph
    .replace(/<p><\/p>/gi, '<p><br></p>')
    // 공백만 있는 paragraph
    .replace(/<p>\s*<\/p>/gi, '<p><br></p>')
    // &nbsp;만 있는 paragraph
    .replace(/<p>&nbsp;<\/p>/gi, '<p><br></p>')
    // 연속된 빈 paragraph들 사이의 공백 정리
    .replace(/<\/p>\s*<p>/gi, '</p><p>');

  return processed;
}

// Check if content is pure JSX (not HTML with embedded JSX blocks)
function isPureJsx(content: string): boolean {
  const trimmed = content.trim();
  // Pure JSX typically starts with: import, const, function, or ( for arrow function
  // And does NOT start with HTML tags like <p>, <div>, <h1>, etc.
  const jsxPatterns = [
    /^import\s+/,
    /^const\s+\w+\s*=\s*\(/,
    /^function\s+\w+/,
    /^export\s+(default\s+)?/,
  ];

  // If it looks like HTML (starts with common HTML tags), it's not pure JSX
  if (/^<(p|div|h[1-6]|span|article|section|header|footer|ul|ol|li|table|br|hr|a|img)\b/i.test(trimmed)) {
    return false;
  }

  return jsxPatterns.some(pattern => pattern.test(trimmed));
}

export default function ColumnContentRenderer({ htmlContent }: ColumnContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [jsxBlocks, setJsxBlocks] = useState<JSXBlock[]>([]);
  const [mounted, setMounted] = useState(false);

  // Determine if content is pure JSX
  const isPureJsxContent = useMemo(() => isPureJsx(htmlContent), [htmlContent]);

  // Mark as mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Find and process JSX blocks after HTML is rendered (only for HTML+JSX mixed content)
  useLayoutEffect(() => {
    if (!mounted || !containerRef.current || isPureJsxContent) return;

    const container = containerRef.current;
    const jsxElements = container.querySelectorAll('[data-type="jsx-block"]');

    console.log('[ColumnContentRenderer] Found JSX elements:', jsxElements.length);

    const blocks: JSXBlock[] = [];
    jsxElements.forEach((element, index) => {
      const dataJsxCode = element.getAttribute('data-jsx-code');
      const id = element.getAttribute('data-id') || element.id || `jsx-block-${index}`;

      if (dataJsxCode) {
        const decodedJsx = decodeBase64ToJsx(dataJsxCode);
        if (decodedJsx) {
          console.log('[ColumnContentRenderer] Decoded JSX block:', id, 'length:', decodedJsx.length);
          // Clear placeholder content
          element.innerHTML = '';
          element.className = 'jsx-block-container my-6';
          blocks.push({ element, code: decodedJsx, id });
        }
      }
    });

    setJsxBlocks(blocks);
  }, [htmlContent, mounted, isPureJsxContent]);

  // If content is pure JSX, render it directly with DynamicJSXRenderer
  if (isPureJsxContent) {
    return (
      <div className="not-prose">
        <DynamicJSXRenderer jsxCode={htmlContent} />
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-lg max-w-none">
      {/* Render HTML content first */}
      <div
        ref={containerRef}
        className="whitespace-pre-line [&_p]:min-h-[1.5em] [&_p:empty]:min-h-[1.5em] [&_p:empty]:before:content-['\00a0']"
        dangerouslySetInnerHTML={{ __html: processLineBreaks(htmlContent) }}
      />

      {/* Render JSX components into their placeholder elements using portals */}
      {mounted && jsxBlocks.map((block) =>
        createPortal(
          <div className="not-prose">
            <DynamicJSXRenderer jsxCode={block.code} />
          </div>,
          block.element
        )
      )}
    </div>
  );
}

