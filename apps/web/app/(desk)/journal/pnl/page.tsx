import { requireOwner } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { errText } from "@/lib/db";
import { type DayWithTrades, dayNet, getDaysBetween, tradeStats } from "@/lib/journal";
import { MONTH_RE, addDays, dowOf, etNow, monthRange, shiftMonth } from "@/lib/time";
import { getT } from "@/lib/prefs-server";
import PnlView, { type PnlDay, type PnlWeek } from "./PnlView";

export const metadata: Metadata = { title: "Journal · PnL & lịch" };
export const dynamic = "force-dynamic";

export default async function PnlPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireOwner("/journal/pnl"); // layout + page render song song: chặn trước khi đọc database
  const q = await searchParams;
  const { t } = await getT();
  const today = etNow().date;
  const month = q.month && MONTH_RE.test(q.month) ? q.month : today.slice(0, 7);
  const { start, days } = monthRange(month);
  const end = addDays(start, days - 1);
  // Lưới theo tuần (Thứ 2 → Chủ nhật), chỉ vẽ Thứ 2–6; lệnh cuối tuần cộng vào tổng tuần.
  const gridStart = addDays(start, -((dowOf(start) + 6) % 7));
  const gridEnd = addDays(end, (7 - dowOf(end)) % 7);

  let error = "";
  let rows: DayWithTrades[] = [];
  try {
    rows = await getDaysBetween(gridStart, addDays(gridEnd, 1));
  } catch (e) {
    error = errText(e);
  }
  const byDate = new Map(rows.map((d) => [d.trade_date, d]));

  const weeks: PnlWeek[] = [];
  for (let w = gridStart; w <= gridEnd; w = addDays(w, 7)) {
    const week: PnlWeek = { days: [], net: 0, r: 0, n: 0, traded: 0 };
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      const j = d >= start && d <= end ? byDate.get(d) : undefined;
      const s = j ? dayNet(j) : { net: 0, r: 0, n: 0 };
      if (s.n) {
        week.net += s.net;
        week.r += s.r;
        week.n += s.n;
        week.traded += 1;
      }
      if (i < 5) {
        const inMonth = d >= start && d <= end;
        const cell: PnlDay = inMonth
          ? { date: d, net: s.net, r: s.r, n: s.n, has: !!j, result: j?.result ?? null }
          : { date: null, net: 0, r: 0, n: 0, has: false, result: null };
        week.days.push(cell);
      }
    }
    weeks.push(week);
  }

  const [y, m] = month.split("-");
  const inMonth = rows.filter((d) => d.trade_date >= start && d.trade_date <= end);
  const st = tradeStats(inMonth);
  const usd = (n: number | null) => (n === null ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);
  const rr = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}R`);
  return (
    <>
      <div className="ch wrap">
        <span className="h2">{t("Tháng {m} · {y}", { m: Number(m), y })}</span>
        <span className="hstack" style={{ gap: 6 }}>
          <Link className="btn icon sm" aria-label={t("Tháng trước")} href={`/journal/pnl?month=${shiftMonth(month, -1)}`}>
            ‹
          </Link>
          {month < today.slice(0, 7) && (
            <Link className="btn icon sm" aria-label={t("Tháng sau")} href={`/journal/pnl?month=${shiftMonth(month, 1)}`}>
              ›
            </Link>
          )}
        </span>
      </div>
      {error ? (
        <div className="notice">
          {t("Không đọc được journal")}: {error}
        </div>
      ) : (
        <>
          <div className="stat6">
            <Stat k={t("Net PnL")} v={usd(st.net)} tone={st.net} sub={t("{n} lệnh", { n: st.trades })} />
            <Stat k="Win rate" v={st.winRate === null ? "—" : `${st.winRate}%`} sub={t("theo lệnh")} />
            <Stat k="Expectancy" v={usd(st.expectancy)} tone={st.expectancy ?? 0} sub={t("net / lệnh")} />
            <Stat k="Profit factor" v={st.profitFactor === null ? "—" : st.profitFactor.toFixed(2)} sub={t("lãi / lỗ")} />
            <Stat k={t("R TB thắng / thua")} v={`${rr(st.avgWinR)} / ${rr(st.avgLossR)}`} sub={t("theo lệnh có R")} />
            <Stat k="Max DD" v={st.maxDD ? `−$${Math.round(st.maxDD).toLocaleString("en-US")}` : "$0"} tone={st.maxDD ? -1 : 0} sub={t("trong tháng")} />
          </div>
          <div className="g2-1">
            <div className="stack-20">
              <PnlView weeks={weeks} today={today} />
            </div>
            <div className="stack-20">
              <section className="card" aria-label={t("Đường vốn")}>
                <span className="lbl">{t("Đường vốn · net cộng dồn")}</span>
                <Equity points={st.equity} />
              </section>
              <section className="card" aria-label={t("Expectancy theo setup")}>
                <div className="ch">
                  <span className="lbl">{t("Expectancy theo setup")}</span>
                  <Link className="more" href="/journal/stats">
                    {t("Thống kê khung")} <span aria-hidden="true">›</span>
                  </Link>
                </div>
                {st.bySetup.map((b) => (
                  <div key={b.key} className="ch small">
                    <span className="t2">
                      {b.name} <span className="dim">· {t("{n} lệnh", { n: b.n })}</span>
                    </span>
                    <span className={`mono ${b.expR === null ? "dim" : b.expR >= 0 ? "long" : "short"}`}>{rr(b.expR)}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: number }) {
  return (
    <div className="card stat">
      <span className="lbl">{k}</span>
      <span className={`mono stat-v ${tone === undefined || tone === 0 ? "" : tone > 0 ? "long" : "short"}`}>{v}</span>
      {sub && <span className="small dim">{sub}</span>}
    </div>
  );
}

// Đường vốn (SVG): net cộng dồn theo ngày, vạch 0
function Equity({ points }: { points: { date: string; cum: number }[] }) {
  if (points.length < 2) return <p className="small dim">—</p>;
  const W = 320;
  const H = 120;
  const vals = [0, ...points.map((p) => p.cum)];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * W).toFixed(1)} ${y(p.cum).toFixed(1)}`).join("");
  const last = points[points.length - 1].cum;
  return (
    <svg className="equity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Net ${Math.round(last)} USD`}>
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="eq-zero" />
      <path d={d} className={last >= 0 ? "eq-up" : "eq-dn"} />
    </svg>
  );
}
