import { Node, mergeAttributes } from '@tiptap/core';

export const JSXBlock = Node.create({
  name: 'jsxBlock',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      jsxCode: {
        default: '',
      },
      id: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="jsx-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'jsx-block',
        'data-jsx-code': HTMLAttributes.jsxCode,
        'data-id': HTMLAttributes.id,
        'class': 'jsx-block-placeholder my-4 p-3 bg-purple-900/20 border-2 border-purple-500/30 rounded-lg'
      }),
      [
        'div',
        { class: 'flex items-center gap-2 text-purple-400 text-sm font-medium' },
        [
          'svg',
          { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          ['path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' }]
        ],
        ['span', {}, '📊 JSX 차트/시각화 블록']
      ]
    ];
  },
});

