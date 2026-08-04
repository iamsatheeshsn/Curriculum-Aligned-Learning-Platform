import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'apricot';
export type ButtonSize = 'xs' | 'sm' | 'md';

const styles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--stem-teal-bright), var(--stem-teal-deep))',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: '0 10px 22px rgba(5, 84, 86, 0.18)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.72)',
    color: 'var(--stem-teal-deep)',
    border: '1px solid rgba(12, 124, 128, 0.35)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--stem-ink)',
    border: '1px solid transparent',
  },
  danger: {
    background: '#b42318',
    color: '#fff',
    border: '1px solid transparent',
  },
  apricot: {
    background: 'linear-gradient(135deg, #f0a05c, var(--stem-apricot-deep))',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: '0 10px 22px rgba(201, 106, 46, 0.22)',
  },
};

/** Shared density tokens — use with Button and ConfirmButton so action rows match. */
export const buttonSizeStyles: Record<ButtonSize, CSSProperties> = {
  md: {
    padding: '0.65rem 1.15rem',
    fontSize: 'var(--stem-text-base)',
    lineHeight: 1.25,
    minHeight: 44,
    borderRadius: 11,
    gap: 8,
  },
  sm: {
    padding: '0.55rem 0.9rem',
    fontSize: 'var(--stem-text-md)',
    lineHeight: 1.25,
    minHeight: 40,
    borderRadius: 10,
    gap: 6,
  },
  xs: {
    padding: '0.4rem 0.7rem',
    fontSize: 'var(--stem-text-sm)',
    lineHeight: 1.25,
    minHeight: 34,
    borderRadius: 8,
    gap: 4,
  },
};

export function Button({
  variant = 'primary',
  size = 'sm',
  to,
  children,
  style,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  to?: string;
  children: ReactNode;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    fontWeight: 600,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    textAlign: 'center',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    opacity: rest.disabled ? 0.65 : 1,
    transition: 'transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
    ...buttonSizeStyles[size],
    ...styles[variant],
    ...style,
  };

  const classes = ['stem-btn', `stem-btn--${size}`, className].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link to={to} style={base} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} style={base} className={classes} {...rest}>
      {children}
    </button>
  );
}

export function BrandMark({
  size = 'md',
  inverted = false,
  name = 'Stemora',
  color,
}: {
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
  /** Visible brand label — use tenant name on Parent / Tutor portals. */
  name?: string;
  /** Optional label color override (mark glyph stays white). */
  color?: string;
}) {
  const fontSize = size === 'lg' ? '2rem' : size === 'sm' ? '1.05rem' : '1.35rem';
  const mark = size === 'lg' ? 38 : size === 'sm' ? 24 : 30;
  const label = (name || 'Stemora').trim() || 'Stemora';
  const initial = label.charAt(0).toUpperCase() || 'S';
  const labelColor = color || (inverted ? '#fff' : 'var(--stem-ink)');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--stem-font-display)',
        fontWeight: 700,
        fontSize,
        color: labelColor,
        letterSpacing: '-0.03em',
      }}
    >
      <span
        aria-hidden
        style={{
          width: mark,
          height: mark,
          borderRadius: 12,
          background: 'linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep))',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontSize: mark * 0.42,
          fontFamily: 'var(--stem-font-body)',
          fontWeight: 700,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.22), 0 8px 18px rgba(5,84,86,0.2)',
        }}
      >
        {initial}
      </span>
      {label}
    </span>
  );
}
