// UI v3 dùng chung (docs/design/v3). Server component, không state: dùng được ở cả trang server lẫn client.
// Phần thuần style (Card, Seg, Chip, Pill, Tag, DataRow, Table, Bar) là class CSS trong desk.css; ở đây chỉ những khối có cấu trúc.
import Link from "next/link";
import type { ReactNode } from "react";

// Tiêu đề trang: kicker + H1 28 px + dòng phụ, nút hành động bên phải (xuống dòng trên mobile)
export function PageHead({ kicker, title, sub, actions }: { kicker?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <span className="lbl">{kicker}</span>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  );
}

// Đầu card: nhãn trái + link "Xem thêm ›" màu accent bên phải
export function CardHead({ label, href, more, right }: { label: ReactNode; href?: string; more?: ReactNode; right?: ReactNode }) {
  return (
    <div className="ch">
      <span className="lbl">{label}</span>
      {right}
      {href && (
        <Link className="more" href={href}>
          {more ?? "Xem thêm"} <span aria-hidden="true">›</span>
        </Link>
      )}
    </div>
  );
}

// Tab gạch chân (link): Journal · Nhật ký / PnL / Thống kê
export function LinkTabs({ items, active, label }: { items: { href: string; label: ReactNode }[]; active: string; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.href === active ? "on" : ""} aria-current={it.href === active ? "page" : undefined}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

// Sparkline 1.5 px, màu theo dấu (cuối − đầu)
export function Spark({ values, w = 72, h = 22, label }: { values: number[]; w?: number; h?: number; label?: string }) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return <svg className="spark flat" width={w} height={h} aria-hidden="true" />;
  const lo = Math.min(...v);
  const span = Math.max(...v) - lo || 1;
  const d = v.map((x, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * w).toFixed(1)} ${(h - 1 - ((x - lo) / span) * (h - 2)).toFixed(1)}`).join("");
  const tone = v[v.length - 1] > v[0] ? "up" : v[v.length - 1] < v[0] ? "dn" : "flat";
  return (
    <svg
      className={`spark ${tone}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={d} />
    </svg>
  );
}

// Thanh tiến độ 6 px
export function Bar({ pct, color }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar" role="presentation">
      <i style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

// Thanh lệch tâm cho % thay đổi: lệch phải = tăng (long), trái = giảm (short). `max` = % ứng với nửa thanh.
export function DivergingBar({ value, max }: { value: number | null; max: number }) {
  if (value === null || !Number.isFinite(value) || !max) return <div className="dbar" />;
  const half = Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <div className="dbar">
      <i className={value >= 0 ? "up" : "dn"} style={{ width: `${half}%` }} />
    </div>
  );
}

// Số có dấu + màu long / short (giá trị null → "—")
export function Chg({ v, suffix = "%", digits = 2 }: { v: number | null | undefined; suffix?: string; digits?: number }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <span className="mono dim">—</span>;
  return (
    <span className={`mono ${v > 0 ? "long" : v < 0 ? "short" : "dim"}`}>
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {Math.abs(v).toFixed(digits)}
      {suffix}
    </span>
  );
}
