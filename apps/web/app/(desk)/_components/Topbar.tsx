"use client";
// Thanh trên (desktop, cao 64 px, UI v3): breadcrumb · ô tìm (Ctrl/⌘ K) · chip tin đỏ kế tiếp + đếm ngược · đồng hồ NY + giờ địa phương + tên phiên.
import Link from "next/link";
import { useEffect, useState } from "react";
import { tzShort } from "@/lib/prefs";
import { etNow, fmtTime, sessionName } from "@/lib/time";
import Icon from "./Icon";
import { useUi } from "./Ui";

export type NextEvent = { ts: number; title: string; country: string; dateLocal: string };

function useNow(every: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");
function countdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}h`;
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export default function Topbar({ events, onSearch, guest = false, crumb }: { events: NextEvent[]; onSearch: () => void; guest?: boolean; crumb: string }) {
  const { t, tz } = useUi();
  const now = useNow(1000);
  const next = now === null ? null : events.find((e) => e.ts > now - 60000) || null;
  // Dòng phụ: múi giờ hiển thị (mặc định VN); nếu đang chọn giờ NY thì hiện giờ VN
  const sideTz = tz === "America/New_York" ? "Asia/Ho_Chi_Minh" : tz;
  const et = now === null ? null : etNow(new Date(now));
  return (
    <header className="topbar">
      <nav className="tb-crumb small" aria-label="Breadcrumb">
        <span className="dim">ZenDojo</span>
        {crumb && (
          <>
            <span className="tb-sep" aria-hidden="true">
              /
            </span>
            <span className="tb-here" aria-current="page">
              {crumb}
            </span>
          </>
        )}
      </nav>
      <div className="tb-right">
        <button type="button" className="tb-search" onClick={onSearch} aria-label={t("Tìm nhanh")}>
          <Icon name="search" size={15} />
          <span>{guest ? t("Mã cổ phiếu, tên trang…") : t("Tìm mã, trang, ngày journal…")}</span>
          <kbd className="mono">⌘K</kbd>
        </button>
        {next && now !== null ? (
          <Link
            className="tb-next"
            href={`/calendar?day=${next.dateLocal}`}
            title={`${t("Tin mạnh kế tiếp")}: ${next.country} · ${next.title} · ${fmtTime(next.ts, tz, true)} ${tzShort(tz)}`}
          >
            <span className="tb-dot" aria-hidden="true" />
            <span className="tb-next-t">{next.title}</span>
            <span className="mono dim">{fmtTime(next.ts, "America/New_York", false)} ET</span>
            <span className="mono tb-cd" suppressHydrationWarning>
              {next.ts <= now ? t("đang ra") : countdown(next.ts - now)}
            </span>
          </Link>
        ) : (
          <span className="small dim tb-none">{t("Không còn tin mạnh trong tuần")}</span>
        )}
        <span className="tb-clock" suppressHydrationWarning>
          <span className="mono tb-clock-ny">
            {now === null ? "--:--:--" : fmtTime(now, "America/New_York", false, true)} <span className="dim">ET</span>
          </span>
          <span className="mono small dim">
            {now === null ? "--:--" : `${fmtTime(now, sideTz, false)} ${tzShort(sideTz)}`}
            {et ? ` · ${t(sessionName(et.minutes, et.dow))}` : ""}
          </span>
        </span>
      </div>
    </header>
  );
}
