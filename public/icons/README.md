# PWA 아이콘 생성 가이드

## 필요한 아이콘 파일

PWA가 제대로 작동하려면 다음 두 개의 PNG 아이콘 파일이 필요합니다:

- `icon-192.png` (192x192 픽셀)
- `icon-512.png` (512x512 픽셀)

## 아이콘 생성 방법

### 방법 1: 온라인 도구 사용

1. [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) 사용
2. 또는 [RealFaviconGenerator](https://realfavicongenerator.net/) 사용
3. 제공된 로고 이미지를 업로드하여 아이콘 생성

### 방법 2: 이미지 편집 도구 사용

1. 제공된 로고 이미지를 512x512 크기로 리사이즈
2. 배경을 투명 또는 매버릭스 블루(#00538C)로 설정
3. maskable 영역 고려 (중앙 80% 영역에 중요한 내용 배치)
4. 192x192 버전도 생성

### 방법 3: 명령줄 도구 사용 (ImageMagick 설치 필요)

```bash
# 512x512 아이콘 생성
convert logo.png -resize 512x512 -background "#00538C" -gravity center -extent 512x512 icon-512.png

# 192x192 아이콘 생성
convert logo.png -resize 192x192 -background "#00538C" -gravity center -extent 192x192 icon-192.png
```

## Maskable 아이콘 가이드

Maskable 아이콘은 안전 영역(safe zone)을 고려해야 합니다:
- 전체 아이콘의 80%가 안전 영역
- 가장자리 10%는 잘릴 수 있음
- 중요한 내용은 중앙에 배치

## 파일 위치

생성된 아이콘 파일은 다음 위치에 저장하세요:
- `/public/icons/icon-192.png`
- `/public/icons/icon-512.png`

## 참고

- 아이콘은 투명 배경 또는 매버릭스 블루(#00538C) 배경 사용 권장
- iOS에서도 예쁘게 보이려면 maskable 옵션을 고려하세요
- 현재 manifest.json에서 이미 설정되어 있으므로, 파일만 추가하면 됩니다

