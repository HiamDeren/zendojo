"use client";
// Timeline phiên (UI v3, Dashboard): 04:00–16:00 ET, dải Pre-market / NY AM (cửa sổ giao dịch) / Lunch / NY PM,
// chấm tin trong ngày, vạch "now", 5 mốc 09:29 / 09:30 / 10:00 / 10:30 / 11:30 với trạng thái xong / kế tiếp / chưa tới.
import Link from "next/link";
import { useEffect, useState } from "react";
import { tzShort } from "@/lib/prefs";
import { etNow, isWeekday, SESSION_BANDS, sessionName } from "@/lib/time";
import Icon from "./Icon";
import { useUi } from "./Ui";

export type TlEvent = { id: string; minutes: number; impact: string; title: string; country: string; et: string; local: string; href: string };

const START = 4 * 60;
const SPAN = 12 * 60;
const pct = (min: number) => Math.max(0, Math.min(100, ((min - START) / SPAN) * 100));
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const MILESTONES = [
  { m: 9 * 60 + 29, label: "Plan 9:29 từ ATAS" },
  { m: 9 * 60 + 30, label: "Mở cửa RTH" },
  { m: 10 * 60, label: "Chốt open type" },
  { m: 10 * 60 + 30, label: "Đóng IB" },
  { m: 11 * 60 + 30, label: "Hết cửa sổ" },
];
const TICKS = [4 * 60, 6 * 60, 8 * 60, 9 * 60 + 30, 11 * 60 + 30, 13 * 60 + 30, 16 * 60];

export function useClock(initial: number, everyMs = 1000) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function left(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Phút ET → ms tuyệt đối trong ngày ET `today` (ET lệch UTC lấy ở 12:00 UTC ngày đó)
function etMs(today: string, minutes: number) {
  const base = Date.parse(`${today}T00:00:00Z`);
  const off = 12 * 60 - etNow(new Date(base + 12 * 3600000)).minutes;
  return base + (minutes + off) * 60000;
}

// Dòng phụ ở PageHead: trạng thái phiên + đếm ngược
export function SessionSub({ initial, today }: { initial: number; today: string }) {
  const { t } = useUi();
  const now = useClock(initial);
  const et = etNow(new Date(now));
  const name = sessionName(et.minutes, et.dow);
  const open = 9 * 60 + 30;
  const close = 11 * 60 + 30;
  if (et.date !== today || name === "Cuối tuần") return <>{t("Cuối tuần, không có phiên")}</>;
  if (et.minutes < open)
    return (
      <>
        {t("Mở cửa RTH sau")}{" "}
        <span className="mono t2" suppressHydrationWarning>
          {left(etMs(today, open) - now)}
        </span>
      </>
    );
  if (et.minutes < close)
    return (
      <>
        {t("Đang trong cửa sổ NY AM · còn")}{" "}
        <span className="mono t2" suppressHydrationWarning>
          {left(etMs(today, close) - now)}
        </span>
      </>
    );
  return <>{t("Hết cửa sổ NY AM. Recap phiên trong Journal.")}</>;
}

export function SessionTimeline({ initial, events, today }: { initial: number; events: TlEvent[]; today: string }) {
  const { t, tz } = useUi();
  const now = useClock(initial);
  const et = etNow(new Date(now));
  // Chỉ chạy "now" / trạng thái mốc trong ngày giao dịch (T2–T6) của chính ngày ET đang xem
  const isToday = et.date === today && isWeekday(today);
  const nowMin = et.minutes;
  const showNow = isToday && nowMin >= START && nowMin <= START + SPAN;
  const inRange = events.filter((e) => e.minutes >= START && e.minutes <= START + SPAN);
  const nextIdx = isToday ? MILESTONES.findIndex((x) => x.m > nowMin) : -1;
  return (
    <section className="card" aria-label={t("Timeline phiên")}>
      <div className="ch wrap">
        <span className="lbl">{t("Phiên hôm nay · giờ New York")}</span>
        <span className="small dim">{inRange.length ? t("Bấm chấm tin để mở Econ Calendar") : t("Không có tin trong khung 04:00–16:00 ET")}</span>
      </div>
      <div className="stl">
        <div className="stl-bands" aria-hidden="true">
          {SESSION_BANDS.map((b) => (
            <div key={b.key} className={`stl-band ${b.key}`} style={{ left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%` }}>
              <span>{b.key === "am" ? t("NY AM · cửa sổ giao dịch") : b.label}</span>
            </div>
          ))}
        </div>
        {inRange.map((e) => (
          <Link
            key={e.id}
            href={e.href}
            className={"stl-ev imp-" + e.impact}
            style={{ left: `${pct(e.minutes)}%` }}
            aria-label={`${e.et} ET · ${e.title}`}
            title={`${e.et} ET${e.local ? ` · ${e.local} ${tzShort(tz)}` : ""} · ${e.country} · ${e.title}`}
          />
        ))}
        {showNow && (
          <>
            <div className="stl-now" style={{ left: `${pct(nowMin)}%` }} suppressHydrationWarning />
            <span className="stl-now-t mono" style={{ left: `${pct(nowMin)}%` }} suppressHydrationWarning>
              {hm(nowMin)}
            </span>
          </>
        )}
      </div>
      <div className="stl-ticks" aria-hidden="true">
        {TICKS.map((m) => (
          <span key={m} className={m === 570 || m === 690 ? "key" : ""} style={{ left: `${pct(m)}%` }}>
            {hm(m)}
          </span>
        ))}
      </div>
      <ol className="stl-ms">
        {MILESTONES.map((x, i) => {
          const state = !isToday ? "todo" : x.m <= nowMin ? "done" : i === nextIdx ? "next" : "todo";
          return (
            <li key={x.m} className={`stl-m ${state}`}>
              <span className="stl-mark" aria-hidden="true">
                {state === "done" ? <Icon name="check" size={14} /> : state === "next" ? <span className="dot" /> : null}
              </span>
              <span className="stl-mt">
                <span>
                  <span className="mono">{hm(x.m)}</span> · {t(x.label)}
                </span>
                <span className="small dim mono" suppressHydrationWarning>
                  {state === "done" ? t("xong") : state === "next" || state === "todo" ? (isToday ? `${t("còn")} ${left(etMs(today, x.m) - now)}` : "") : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
