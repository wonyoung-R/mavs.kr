'use client';

import { useEffect, useState } from 'react';
import DynamicJSXRenderer from '@/components/analysis/DynamicJSXRenderer';

interface ColumnContentRendererProps {
  htmlContent: string;
}

interface ContentPart {
  type: 'html' | 'jsx';
  content: string;
}

export default function ColumnContentRenderer({ htmlContent }: ColumnContentRendererProps) {
  const [contentParts, setContentParts] = useState<ContentPart[]>([]);

  useEffect(() => {
    // Helper function to convert self-closing tags to JSX format
    const fixSelfClosingTags = (html: string): string => {
      // Fix common self-closing tags to JSX format
      // Handle all variations of these tags: <br>, <br/>, <br />, etc.
      return html
        .replace(/<br\s*\/?>/gi, '<br />')
        .replace(/<hr\s*\/?>/gi, '<hr />')
        .replace(/<img([^>]*?)\s*\/?>/gi, (match, attrs) => {
          // Ensure img tag is self-closing
          const trimmedAttrs = attrs.trim();
          return trimmedAttrs ? `<img ${trimmedAttrs} />` : '<img />';
        })
        .replace(/<input([^>]*?)\s*\/?>/gi, (match, attrs) => {
          const trimmedAttrs = attrs.trim();
          return trimmedAttrs ? `<input ${trimmedAttrs} />` : '<input />';
        })
        .replace(/<meta([^>]*?)\s*\/?>/gi, (match, attrs) => {
          const trimmedAttrs = attrs.trim();
          return trimmedAttrs ? `<meta ${trimmedAttrs} />` : '<meta />';
        })
        .replace(/<link([^>]*?)\s*\/?>/gi, (match, attrs) => {
          const trimmedAttrs = attrs.trim();
          return trimmedAttrs ? `<link ${trimmedAttrs} />` : '<link />';
        });
    };
    console.log('[ColumnContentRenderer] HTML Content:', htmlContent.substring(0, 500));
    console.log('[ColumnContentRenderer] Searching for JSX blocks...');

    // Fix self-closing tags before parsing
    const fixedHtmlContent = fixSelfClosingTags(htmlContent);

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = fixedHtmlContent;

    // Find all JSX block elements
    const jsxBlocks = tempDiv.querySelectorAll('[data-type="jsx-block"]');
    console.log('[ColumnContentRenderer] Found JSX blocks count:', jsxBlocks.length);

    if (jsxBlocks.length === 0) {
      console.log('[ColumnContentRenderer] No JSX blocks found, rendering as HTML');
      setContentParts([{ type: 'html', content: htmlContent }]);
      return;
    }

    const parts: ContentPart[] = [];
    let currentHTML = '';

    // Process all child nodes
    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        // Check if this is a JSX block
        if (element.getAttribute('data-type') === 'jsx-block') {
          // Save accumulated HTML
          if (currentHTML.trim()) {
            parts.push({ type: 'html', content: currentHTML });
            currentHTML = '';
          }

          // Get JSX code
          const base64Code = element.getAttribute('data-jsx-code');
          console.log('[ColumnContentRenderer] Found JSX block with base64:', base64Code?.substring(0, 50));

          if (base64Code) {
            try {
              let decodedJsxCode;

              try {
                // Try new UTF-8 safe method first
                const binaryString = atob(base64Code);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                decodedJsxCode = new TextDecoder().decode(bytes);
              } catch (e) {
                // Fallback to old method for backward compatibility
                console.log('[ColumnContentRenderer] Trying fallback decoding method');
                decodedJsxCode = decodeURIComponent(escape(atob(base64Code)));
              }

              console.log('[ColumnContentRenderer] Decoded JSX Code:', decodedJsxCode.substring(0, 100));
              parts.push({ type: 'jsx', content: decodedJsxCode });
            } catch (error) {
              console.error('[ColumnContentRenderer] Error decoding JSX:', error);
            }
          }
        } else {
          // Regular HTML element
          currentHTML += element.outerHTML;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        currentHTML += node.textContent || '';
      }
    });

    // Add remaining HTML
    if (currentHTML.trim()) {
      parts.push({ type: 'html', content: currentHTML });
    }

    console.log('[ColumnContentRenderer] Total parts:', parts.length);
    console.log('[ColumnContentRenderer] Parts breakdown:', parts.map(p => p.type));

    setContentParts(parts.length > 0 ? parts : [{ type: 'html', content: fixedHtmlContent }]);
  }, [htmlContent]);

  if (contentParts.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="prose prose-invert prose-lg max-w-none">
      {contentParts.map((part, index) => {
        if (part.type === 'jsx') {
          console.log('[ColumnContentRenderer] Rendering JSX part:', index);
          return (
            <div key={`jsx-${index}`} className="my-6 not-prose">
              <DynamicJSXRenderer jsxCode={part.content} />
            </div>
          );
        } else {
          console.log('[ColumnContentRenderer] Rendering HTML part:', index);
          return (
            <div
              key={`html-${index}`}
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          );
        }
      })}
    </div>
  );
}

