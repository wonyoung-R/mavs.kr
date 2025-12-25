'use client';

import React, { useMemo } from 'react';
import * as Recharts from 'recharts';
import { transform } from '@babel/standalone';

interface DynamicJSXRendererProps {
  jsxCode: string;
}

export default function DynamicJSXRenderer({ jsxCode }: DynamicJSXRendererProps) {
  const Component = useMemo(() => {
    if (!jsxCode || typeof jsxCode !== 'string') {
      return () => (
        <div className="text-red-500 p-4 border border-red-700 rounded-lg">
          JSX 코드가 없습니다.
        </div>
      );
    }

    try {
      // Helper function to convert self-closing tags to JSX format
      const fixSelfClosingTags = (code: string): string => {
        return code
          .replace(/<br\s*\/?>/gi, '<br />')
          .replace(/<hr\s*\/?>/gi, '<hr />')
          .replace(/<img([^>]*?)\s*\/?>/gi, (match, attrs) => {
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

      // Remove import and export statements - they're not needed
      let cleanedCode = jsxCode
        .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
        .replace(/import\s+['"].*?['"];?\s*/g, '')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+/g, '')
        .trim();

      // Fix self-closing tags to JSX format
      cleanedCode = fixSelfClosingTags(cleanedCode);

      console.log('[DynamicJSXRenderer] Cleaned code:', cleanedCode.substring(0, 100));

      // Extract component name from code
      const componentNameMatch = cleanedCode.match(/const\s+(\w+)\s*=\s*\(/);
      const componentName = componentNameMatch ? componentNameMatch[1] : 'Component';
      console.log('[DynamicJSXRenderer] Component name:', componentName);

      // Transform JSX to JavaScript using Babel
      const transformed = transform(cleanedCode, {
        presets: ['react'],
        filename: 'component.jsx',
      });

      console.log('[DynamicJSXRenderer] Transformed code:', transformed.code?.substring(0, 100));

      // Create a function that returns the component
      // Available in scope: React, Recharts
      const func = new Function(
        'React',
        'Recharts',
        `
        const {
          LineChart, BarChart, PieChart, AreaChart, RadarChart, ScatterChart,
          Line, Bar, Pie, Area, Radar, Scatter,
          XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
          Cell, PolarGrid, PolarAngleAxis, PolarRadiusAxis
        } = Recharts;

        const { useState, useEffect, useMemo, useCallback } = React;

        ${transformed.code}

        // Return the component
        return ${componentName};
        `
      );

      return func(React, Recharts);
    } catch (error) {
      console.error('JSX 렌더링 에러:', error);
      return () => (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-400">
          <h3 className="font-bold mb-2">렌더링 오류</h3>
          <pre className="text-sm overflow-auto whitespace-pre-wrap">
            {error instanceof Error ? error.message : '알 수 없는 오류'}
          </pre>
          <div className="mt-4 text-xs text-red-300">
            JSX 파일이 올바른 형식인지 확인해주세요.
          </div>
        </div>
      );
    }
  }, [jsxCode]);

  return <Component />;
}

