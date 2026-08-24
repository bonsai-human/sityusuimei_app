import { useEffect, useState, type ReactNode } from 'react';

import type { Element } from '../core/constants';

/** 五行のカラートークンを解決するクラス名。index.css の element-* に対応する。 */
export function elementClass(element: Element): string {
  return `element-${element}`;
}

export function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {actions}
        {subtitle && (
          <p className="w-full text-xs" style={{ color: 'var(--ink-muted)' }}>
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: 'var(--ink-faint)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * 数値の入力欄。
 *
 * `<input type="number">` に `Number(e.target.value)` をそのまま渡すと、欄を空にした
 * 瞬間に 0 が入ってしまい、1980 を消して 2003 と打つと "02003" になる。それを避けるため、
 * 打ちかけの文字列は内部で持ち、値として意味が通るようになってから親へ渡す。
 *
 * 打っている途中の "2" や "20" を親へ渡すと、その値で命式を組もうとしてエラーが
 * 一瞬出るので、範囲に収まったときだけ伝える。欄から離れたときに範囲へ丸める。
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  decimal = false,
  ariaLabel,
  placeholder,
}: {
  /** null なら未入力（空欄）として表示する */
  value: number | null;
  onChange: (value: number) => void;
  min: number;
  max: number;
  decimal?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const text = (v: number | null) => (v == null ? '' : String(v));
  const [draft, setDraft] = useState(text(value));
  const [editing, setEditing] = useState(false);

  // 都市を選び直したときなど、外から値が変わったら追従する（編集中は邪魔しない）
  useEffect(() => {
    if (!editing) setDraft(text(value));
  }, [value, editing]);

  const parse = (s: string) => (decimal ? Number.parseFloat(s) : Number.parseInt(s, 10));

  return (
    <input
      className="field"
      // type="number" だと空欄と不正な値を区別できないので text で受け、
      // inputMode でスマートフォンには数字キーボードを出す
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(decimal ? /[^0-9.-]/g : /[^0-9-]/g, '');
        setDraft(cleaned);
        const n = parse(cleaned);
        if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        setEditing(false);
        const n = parse(draft);
        if (!Number.isFinite(n)) {
          setDraft(text(value));
          return;
        }
        const clamped = Math.min(max, Math.max(min, n));
        onChange(clamped);
        setDraft(String(clamped));
      }}
    />
  );
}

/**
 * ボタン群など、単一の入力欄ではないものに見出しを付ける。
 * `<label>` で囲んでしまうと、中の最初のボタンの読み上げ名が見出しに乗っ取られるので、
 * 見出しは div + role="group" の aria-label として渡す。
 */
export function LabeledGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: 'var(--ink-faint)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** 排他選択のセグメントボタン。ラジオボタンより指で押しやすい。 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
  wrap = false,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
  /**
   * 選択肢が多いときに使う。1 行に詰め込むと狭い画面で端が切れて押せなくなるので、
   * 独立したボタンを折り返して並べる。
   */
  wrap?: boolean;
}) {
  const padding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';

  if (wrap) {
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              title={o.title}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`whitespace-nowrap rounded-lg transition-colors ${padding}`}
              style={{
                background: active ? 'var(--accent)' : 'var(--surface-raised)',
                color: active ? 'var(--surface-raised)' : 'var(--ink-muted)',
                border: `1px solid ${active ? 'transparent' : 'var(--line-strong)'}`,
                fontWeight: active ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="inline-flex w-full overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--line-strong)' }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap transition-colors ${padding}`}
            style={{
              background: active ? 'var(--accent)' : 'var(--surface-raised)',
              color: active ? 'var(--surface-raised)' : 'var(--ink-muted)',
              fontWeight: active ? 600 : 400,
              borderLeft: i === 0 ? undefined : '1px solid var(--line)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-current"
        style={{ color: 'var(--accent)' }}
      />
      <span className="text-sm leading-snug">
        {label}
        {hint && (
          <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-faint)' }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  full?: boolean;
}) {
  const style: Record<string, string> =
    variant === 'primary'
      ? { background: 'var(--accent)', color: 'var(--surface-raised)', border: '1px solid transparent' }
      : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--ink-muted)', border: '1px solid transparent' }
        : { background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--line-strong)' };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 ${
        full ? 'w-full' : ''
      }`}
      style={style}
    >
      {children}
    </button>
  );
}

/** 用語の脇に置く注釈。ホバー/長押しで読める。 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
      {children}
    </p>
  );
}
