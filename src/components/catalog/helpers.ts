import type { CSSProperties, ReactNode } from 'react';
import type { ComponentNode } from '../../models/contracts';
export interface CatalogProps {
  node: ComponentNode;
  children?: ReactNode;
}
export const text = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
export const lines = (value: unknown) =>
  text(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
export const pairs = (value: unknown) =>
  lines(value).map((item) => {
    const position = item.indexOf('|');
    return position < 0 ? [item, ''] : [item.slice(0, position), item.slice(position + 1)];
  });
export const safeUrl = (value: unknown) =>
  /^(https?:\/\/|\/(?!\/)|#)/i.test(text(value)) ? text(value) : undefined;
export const safeLength = (value: unknown, fallback: string) =>
  /^(?:\d+(?:\.\d+)?)(?:px|rem|em|%|vh|vw)$/.test(text(value)) ? text(value) : fallback;
export const number = (value: unknown, fallback: number) =>
  value !== '' && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback;
export function layout(props: Record<string, unknown>): CSSProperties {
  const result: CSSProperties = {};
  for (const key of [
    'display',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'justifyItems',
    'alignItems',
    'gap',
    'gridTemplateColumns',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ] as const) {
    const value = props[key];
    if (typeof value === 'string' && !/url\s*\(|expression|[;{}]/i.test(value))
      Object.assign(result, { [key]: value });
  }
  return result;
}
