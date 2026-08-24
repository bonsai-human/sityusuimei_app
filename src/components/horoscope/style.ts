import type { AspectTone, Element4 } from '../../core/horoscope/constants';
import { SIGN_ELEMENT } from '../../core/horoscope/constants';

/**
 * 四大元素を、五行の配色に割り当てる。
 *
 * 火と水はそのまま、地は土（黄）へ、風は金（淡い灰黄）へ寄せた。
 * 別の体系なので色の意味も別だが、同じアプリの中で色数を増やさないほうが読みやすい。
 */
export const ELEMENT4_CLASS: Record<Element4, string> = {
  fire: 'element-fire',
  earth: 'element-earth',
  air: 'element-metal',
  water: 'element-water',
};

export function signClass(sign: number): string {
  return ELEMENT4_CLASS[SIGN_ELEMENT[sign]];
}

/**
 * アスペクトの色。四柱推命側で合を緑（木）、沖を赤（火）にしているのに合わせ、
 * 調和を緑、緊張を赤、コンジャンクションは中立の灰にする。
 */
export function toneLine(tone: AspectTone): string {
  if (tone === 'hard') return 'var(--fire-line)';
  if (tone === 'soft') return 'var(--wood-line)';
  return 'var(--line-strong)';
}

export function toneChip(tone: AspectTone): { background: string; color: string; border: string } {
  if (tone === 'hard') {
    return { background: 'var(--fire-bg)', color: 'var(--fire-fg)', border: '1px solid var(--fire-line)' };
  }
  if (tone === 'soft') {
    return { background: 'var(--wood-bg)', color: 'var(--wood-fg)', border: '1px solid var(--wood-line)' };
  }
  return { background: 'var(--surface-sunken)', color: 'var(--ink-muted)', border: '1px solid var(--line)' };
}
