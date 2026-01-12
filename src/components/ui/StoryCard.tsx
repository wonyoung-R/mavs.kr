'use client';

import React, { forwardRef } from 'react';

interface StoryCardProps {
  title: string;
  content: string;
  author: string;
  category: string;
  categoryIcon?: string;
}

const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(
  ({ title, content, author, category, categoryIcon = '🗣️' }, ref) => {
    // 제목 자르기 (최대 50자)
    const truncatedTitle = title.length > 50 ? title.slice(0, 50) + '...' : title;

    // 본문 자르기 (최대 100자, HTML 태그 제거)
    const plainContent = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const truncatedContent = plainContent.length > 100
      ? plainContent.slice(0, 100) + '...'
      : plainContent;

    return (
      <div
        ref={ref}
        style={{
          width: '1080px',
          height: '1920px',
          background: 'linear-gradient(180deg, #0a1628 0%, #0d2847 50%, #0a1628 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 30%, rgba(0, 83, 188, 0.3) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Basketball Icon Background */}
        <div
          style={{
            position: 'absolute',
            top: '150px',
            right: '-100px',
            fontSize: '400px',
            opacity: 0.05,
            transform: 'rotate(-15deg)',
          }}
        >
          🏀
        </div>

        {/* Header - Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '60px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: '60px' }}>🏀</span>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            MAVS.KR
          </span>
        </div>

        {/* Main Content Card */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '32px',
              padding: '60px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Category Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '9999px',
                padding: '12px 24px',
                marginBottom: '40px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <span style={{ fontSize: '28px' }}>{categoryIcon}</span>
              <span
                style={{
                  fontSize: '28px',
                  color: '#60a5fa',
                  fontWeight: '600',
                }}
              >
                {category}
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#ffffff',
                lineHeight: 1.3,
                marginBottom: '40px',
                wordBreak: 'keep-all',
              }}
            >
              "{truncatedTitle}"
            </h1>

            {/* Divider */}
            <div
              style={{
                width: '100px',
                height: '4px',
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                borderRadius: '2px',
                marginBottom: '40px',
              }}
            />

            {/* Content Preview */}
            <p
              style={{
                fontSize: '36px',
                color: '#94a3b8',
                lineHeight: 1.6,
                marginBottom: '40px',
              }}
            >
              {truncatedContent}
            </p>

            {/* Author */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  background: 'rgba(59, 130, 246, 0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: '#60a5fa',
                  fontWeight: 'bold',
                }}
              >
                {author?.[0]?.toUpperCase() || 'U'}
              </div>
              <span
                style={{
                  fontSize: '28px',
                  color: '#64748b',
                }}
              >
                by @{author}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            marginTop: '60px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#60a5fa',
              fontSize: '32px',
            }}
          >
            <span>👆</span>
            <span>탭해서 전체 글 보기</span>
          </div>
          <span
            style={{
              fontSize: '36px',
              color: '#475569',
              fontWeight: '600',
            }}
          >
            mavs.kr
          </span>
        </div>
      </div>
    );
  }
);

StoryCard.displayName = 'StoryCard';

export default StoryCard;

