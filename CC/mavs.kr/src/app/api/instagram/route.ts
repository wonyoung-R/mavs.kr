import { NextRequest, NextResponse } from 'next/server';
import { InstagramResponse, InstagramPost } from '@/types/instagram';

export async function GET(request: NextRequest) {
  try {
    console.log('Instagram crawling started for @mavs.kr');
    const instagramUrl = 'https://www.instagram.com/mavs.kr/';

    // Instagram 페이지 크롤링 - 더 현실적인 헤더 사용
    const response = await fetch(instagramUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      next: { revalidate: 1800 } // 30분 캐시
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('Instagram HTML fetched, length:', html.length);

    // Instagram의 새로운 데이터 구조에서 게시물 추출
    let posts: InstagramPost[] = [];

    // 패턴 1: window._sharedData (구버전)
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        console.log('Found _sharedData:', Object.keys(sharedData));

        const timelineData = sharedData.entry_data?.ProfilePage?.[0]?.user?.media?.nodes;
        if (timelineData && Array.isArray(timelineData)) {
          posts = timelineData.slice(0, 7).map((post: any, index: number) => ({
            id: post.id || `post_${index}`,
            imageUrl: post.display_url || post.thumbnail_src,
            postUrl: `https://instagram.com/p/${post.shortcode || post.id}/`,
            timestamp: post.taken_at_timestamp ? post.taken_at_timestamp * 1000 : Date.now() - (index * 86400000)
          }));
        }
      } catch (e) {
        console.log('Failed to parse _sharedData:', e);
      }
    }

    // 패턴 2: 새로운 Instagram 구조 - require() 함수에서 데이터 추출
    if (posts.length === 0) {
      // 더 유연한 require 패턴 매칭
      const requirePatterns = [
        /require\(\["PolarisProfileRoot\.react"\],\s*function\([^)]*\)\s*{\s*require\(\["ServerJS"\],\s*function\([^)]*\)\s*{\s*require\(\["ScheduledApplyEach"\],\s*function\([^)]*\)\s*{\s*require\(\["CometResourceScheduler"\],\s*function\([^)]*\)\s*{\s*require\(\["PolarisProfileNestedContentRoot\.react"\],\s*function\([^)]*\)\s*{\s*require\(\["PolarisProfileNestedContentRoot\.entrypoint"\],\s*function\([^)]*\)\s*{\s*require\(\["PolarisProfileRoot\.react"\],\s*function\([^)]*\)\s*{\s*require\(\["CometPlatformRootClient","initialize",\["__inst_[^"]*","RequireDeferredReference"\],\[({.+?})\]\]/,
        /require\(\["CometPlatformRootClient","initialize",\["__inst_[^"]*","RequireDeferredReference"\],\[({.+?})\]\]/,
        /window\.__initialDataLoaded\s*\(\s*'[^']+',\s*({.+?})\s*\)/
      ];

      for (const pattern of requirePatterns) {
        const requireMatch = html.match(pattern);
        if (requireMatch) {
          try {
            const configData = JSON.parse(requireMatch[1]);
            console.log('Found config data:', Object.keys(configData));

            // configData에서 게시물 정보 추출 시도
            if (configData.initialRouteInfo?.route?.props?.polaris_preload?.timeline) {
              const timelineConfig = configData.initialRouteInfo.route.props.polaris_preload.timeline;
              console.log('Timeline config found:', timelineConfig);

              // timeline API URL에서 게시물 데이터 추출 시도
              if (timelineConfig.request?.url) {
                console.log('Timeline API URL:', timelineConfig.request.url);
              }
            }
          } catch (e) {
            console.log('Failed to parse config data:', e);
          }
          break;
        }
      }
    }

    // 패턴 3: JSON-LD 구조화된 데이터
    if (posts.length === 0) {
      const jsonLdMatches = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/g);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const jsonLdContent = match.match(/<script type="application\/ld\+json">(.+?)<\/script>/)?.[1];
            if (jsonLdContent) {
              const jsonLdData = JSON.parse(jsonLdContent);
              console.log('Found JSON-LD data:', Object.keys(jsonLdData));

              // JSON-LD에서 게시물 정보 추출
              if (jsonLdData['@type'] === 'Person' && jsonLdData.mainEntityOfPage) {
                // 프로필 정보는 있지만 게시물은 별도로 추출해야 함
                console.log('Profile JSON-LD found, but posts need separate extraction');
              }
            }
          } catch (e) {
            console.log('Failed to parse JSON-LD:', e);
          }
        }
      }
    }

    // 패턴 4: 실제 게시물 이미지와 URL 추출 (더 정교한 방법)
    if (posts.length === 0) {
      // Instagram의 실제 게시물 이미지 패턴 (더 구체적인 필터링)
      const postImagePatterns = [
        // 실제 게시물 이미지 패턴들 - 더 구체적으로
        /https:\/\/scontent-[^"'\s]*\.cdninstagram\.com\/[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[^"'\s]*\.fbcdn\.net\/[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[^"'\s]*instagram\.com\/[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi
      ];

      let allImageUrls: string[] = [];
      for (const pattern of postImagePatterns) {
        const matches = html.match(pattern);
        if (matches) {
          allImageUrls = allImageUrls.concat(matches);
        }
      }

      // 중복 제거 및 필터링 (로고, 아이콘 제외)
      const filteredUrls = allImageUrls
        .filter((url, index, self) => self.indexOf(url) === index) // 중복 제거
        .filter(url => {
          // Instagram 로고, 아이콘, 정적 리소스 제외
          const excludePatterns = [
            /rsrc\.php/, // Instagram 정적 리소스
            /logo/, /icon/, /avatar/, /profile/, /thumbnail/, // 로고/아이콘 관련
            /static\.cdninstagram\.com\/rsrc/, // 정적 리소스
            /\.svg/, // SVG 파일 제외
            /emoji/, /symbol/, /badge/, /story/, // 이모지, 심볼, 배지, 스토리
            /profile_pic/, /profilepic/, /profile-pic/ // 프로필 사진
          ];
          return !excludePatterns.some(pattern => pattern.test(url));
        })
        .slice(0, 7); // 최대 7개

      console.log('Filtered post image URLs:', filteredUrls.length);

      if (filteredUrls.length > 0) {
        // 게시물 URL 추출 시도 - 더 다양한 패턴과 방법
        const postUrlPatterns = [
          /https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\//g,
          /https:\/\/instagram\.com\/p\/[A-Za-z0-9_-]+\//g,
          /\/p\/[A-Za-z0-9_-]+\//g,
          /"shortcode":"([A-Za-z0-9_-]+)"/g, // JSON에서 shortcode 추출
          /shortcode['"]:\s*['"]([A-Za-z0-9_-]+)['"]/g // 다른 JSON 패턴
        ];

        let allPostUrls: string[] = [];
        for (const pattern of postUrlPatterns) {
          const matches = html.match(pattern);
          if (matches) {
            allPostUrls = allPostUrls.concat(matches.map(match => {
              // shortcode 패턴인 경우
              if (pattern.source.includes('shortcode')) {
                const shortcode = match.match(/[A-Za-z0-9_-]+/)?.[0];
                return shortcode ? `https://www.instagram.com/p/${shortcode}/` : match;
              }
              // 상대 URL을 절대 URL로 변환
              if (match.startsWith('/p/')) {
                return `https://www.instagram.com${match}`;
              }
              return match;
            }));
          }
        }

        const uniquePostUrls = [...new Set(allPostUrls)].slice(0, 7);
        console.log('Found post URLs:', uniquePostUrls.length, uniquePostUrls);

        posts = filteredUrls.map((imageUrl, index) => {
          // 이미지 URL에서 게시물 ID 추출 시도
          let postUrl = uniquePostUrls[index] || 'https://instagram.com/mavs.kr/';

          // 이미지 URL에서 게시물 ID 패턴 찾기
          const imageIdMatch = imageUrl.match(/\/([A-Za-z0-9_-]+)_n\.jpg/);
          if (imageIdMatch) {
            const imageId = imageIdMatch[1];
            // 이미지 ID를 기반으로 게시물 URL 생성 (추정)
            postUrl = `https://instagram.com/p/${imageId}/`;
          }

          return {
            id: `post_${index}`,
            imageUrl: imageUrl,
            postUrl: postUrl,
            timestamp: Date.now() - (index * 86400000)
          };
        });
      }
    }

    console.log('Extracted posts:', posts.length);

    // 패턴 5: Instagram API 직접 호출 시도
    if (posts.length === 0 || posts.every(post => post.postUrl === 'https://instagram.com/mavs.kr/')) {
      try {
        console.log('Attempting Instagram API call...');

        // Instagram의 비공식 API 엔드포인트 시도
        const apiResponse = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=mavs.kr', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.instagram.com/mavs.kr/',
          },
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          console.log('Instagram API response:', Object.keys(apiData));

          if (apiData.data?.user?.edge_owner_to_timeline_media?.edges) {
            const mediaEdges = apiData.data.user.edge_owner_to_timeline_media.edges;
            const apiPosts = mediaEdges.slice(0, 7).map((edge: any, index: number) => ({
              id: edge.node.id || `api_post_${index}`,
              imageUrl: edge.node.display_url || edge.node.thumbnail_src,
              postUrl: `https://www.instagram.com/p/${edge.node.shortcode}/`,
              timestamp: edge.node.taken_at_timestamp ? edge.node.taken_at_timestamp * 1000 : Date.now() - (index * 86400000)
            }));

            if (apiPosts.length > 0) {
              console.log('Successfully extracted posts from Instagram API:', apiPosts.length);
              return NextResponse.json({
                posts: apiPosts,
                success: true
              } as InstagramResponse);
            }
          }
        }
      } catch (apiError) {
        console.log('Instagram API call failed:', apiError);
      }
    }

    if (posts.length > 0) {
      return NextResponse.json({
        posts: posts,
        success: true
      } as InstagramResponse);
    }

    // 크롤링 실패 시 더미 데이터 반환 - 실제 이미지 사용, 실제 Instagram 계정으로 연결
    console.log('No posts found, returning dummy data');
    const dummyPosts: InstagramPost[] = [
      {
        id: 'dummy1',
        imageUrl: 'https://picsum.photos/400/400?random=1',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 86400000 // 1일 전
      },
      {
        id: 'dummy2',
        imageUrl: 'https://picsum.photos/400/400?random=2',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 172800000 // 2일 전
      },
      {
        id: 'dummy3',
        imageUrl: 'https://picsum.photos/400/400?random=3',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 259200000 // 3일 전
      },
      {
        id: 'dummy4',
        imageUrl: 'https://picsum.photos/400/400?random=4',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 345600000 // 4일 전
      },
      {
        id: 'dummy5',
        imageUrl: 'https://picsum.photos/400/400?random=5',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 432000000 // 5일 전
      },
      {
        id: 'dummy6',
        imageUrl: 'https://picsum.photos/400/400?random=6',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 518400000 // 6일 전
      },
      {
        id: 'dummy7',
        imageUrl: 'https://picsum.photos/400/400?random=7',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 604800000 // 7일 전
      }
    ];

    return NextResponse.json({
      posts: dummyPosts,
      success: true
    } as InstagramResponse);

  } catch (error) {
    console.error('Instagram crawling error:', error);

    // 에러 시 더미 데이터 반환 - 실제 이미지 사용, 실제 Instagram 계정으로 연결
    const dummyPosts: InstagramPost[] = [
      {
        id: 'dummy1',
        imageUrl: 'https://picsum.photos/400/400?random=1',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 86400000
      },
      {
        id: 'dummy2',
        imageUrl: 'https://picsum.photos/400/400?random=2',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 172800000
      },
      {
        id: 'dummy3',
        imageUrl: 'https://picsum.photos/400/400?random=3',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 259200000
      },
      {
        id: 'dummy4',
        imageUrl: 'https://picsum.photos/400/400?random=4',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 345600000
      },
      {
        id: 'dummy5',
        imageUrl: 'https://picsum.photos/400/400?random=5',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 432000000
      },
      {
        id: 'dummy6',
        imageUrl: 'https://picsum.photos/400/400?random=6',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 518400000
      },
      {
        id: 'dummy7',
        imageUrl: 'https://picsum.photos/400/400?random=7',
        postUrl: 'https://instagram.com/mavs.kr/',
        timestamp: Date.now() - 604800000
      }
    ];

    return NextResponse.json({
      posts: dummyPosts,
      success: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as InstagramResponse);
  }
}
