import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const MAVERICKS_BLUE = '#00538C';
const sizes = [192, 512];

async function generateIcons() {
  const svgPath = path.join(process.cwd(), 'public', 'images', 'logos', 'mavericks.svg');
  const outputDir = path.join(process.cwd(), 'public', 'icons');

  // 출력 디렉토리 확인
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // SVG 파일 읽기
  const svgContent = fs.readFileSync(svgPath, 'utf-8');

  // 각 크기별로 아이콘 생성
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);

    // SVG를 PNG로 변환 (매버릭스 블루 배경 추가)
    // SVG를 먼저 렌더링한 후 배경과 합성
    const svgSize = Math.floor(size * 0.8);
    const padding = Math.floor(size * 0.1);

    await sharp(Buffer.from(svgContent))
      .resize(svgSize, svgSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // 투명 배경
      })
      .png()
      .toBuffer()
      .then((svgImage) => {
        // 매버릭스 블루 배경에 SVG 합성
        return sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 83, b: 140, alpha: 1 }, // #00538C
          },
        })
          .composite([
            {
              input: svgImage,
              top: padding, // 상하 여백 10%
              left: padding, // 좌우 여백 10%
            },
          ])
          .png()
          .toFile(outputPath);
      });

    console.log(`✅ 생성 완료: ${outputPath}`);
  }

  console.log('\n🎉 모든 아이콘 생성이 완료되었습니다!');
}

generateIcons().catch((error) => {
  console.error('❌ 아이콘 생성 중 오류 발생:', error);
  process.exit(1);
});

