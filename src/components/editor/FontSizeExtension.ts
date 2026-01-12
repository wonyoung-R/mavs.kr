import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';

// 글씨 크기 단계 정의 (1~5단계)
export const FONT_SIZES = {
  1: '0.875rem',   // 14px - 작은 글씨
  2: '1rem',       // 16px - 기본
  3: '1.25rem',    // 20px - 중간
  4: '1.5rem',     // 24px - 큰 글씨
  5: '2rem',       // 32px - 매우 큰 글씨
} as const;

export type FontSizeLevel = keyof typeof FONT_SIZES;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customFontSize: {
      setCustomFontSize: (level: FontSizeLevel) => ReturnType;
      unsetCustomFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'customFontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setCustomFontSize:
        (level: FontSizeLevel) =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontSize: FONT_SIZES[level] })
            .run();
        },
      unsetCustomFontSize:
        () =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

export { TextStyle };

