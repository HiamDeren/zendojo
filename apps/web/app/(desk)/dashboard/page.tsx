// Dashboard (UI v3, docs/design/v3/Main.dc.html): chào + trạng thái phiên → timeline phiên →
// Plan hôm nay | Kỷ luật phiên + Tin hôm nay → Journal 5 phiên · Earnings tuần · Tin nổi bật.
// Khách (D48): không đọc plan / journal, không có thẻ plan / kỷ luật / journal.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { errText } from "@/lib/db";
import { ECON_SOURCE_PAGE, type EconEvent, getEconWeek, localize, topImpact } from "@/lib/econ";
import { IMPACT_RANK, matches, PREFS_COOKIE, parsePrefs } from "@/lib/econ-prefs";
import { DOW, DOW_SHORT } from "@/lib/i18n";
import { type DayWithTrades, dayNet, getRecentDays } from "@/lib/journal";
import { planImageSrc } from "@/lib/plan-url";
import { fmtPx, getPlan, type PlanView, planView } from "@/lib/plans";
import { getT } from "@/lib/prefs-server";
import { SETTINGS } from "@/lib/settings";
import { addDays, dowOf, etNow, isWeekday, mondayOf, nowIn, PLAN_SEND, viDate, viDayMonth } from "@/lib/time";
import Checklist10 from "../_components/Checklist10";
import CopyImage from "../_components/CopyImage";
import Icon from "../_components/Icon";
import { SessionSub, SessionTimeline, type TlEvent } from "../_components/SessionTimeline";
import { CardSkeleton } from "../_components/Skeleton";
import { Bar, CardHead, PageHead } from "../_components/kit";
import { EarningsWeekCard, NewsCard } from "./MarketCards";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type T = (s: string, v?: Record<string, string | number>) => string;
const BIAS_LABEL = { long: "Long", short: "Short", flat: "Trung tính" } as const;
const MAX_LINES = 6;
const usd = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

async function safe<V>(p: Promise<V>): Promise<{ ok: true; v: V } | { ok: false; error: string }> {
  try {
    return { ok: true, v: await p };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

export default async function DashboardPage() {
  const nowMs = Date.now();
  const et = etNow(new Date(nowMs));
  const today = et.date;
  const { t, ui } = await getT();
  const localToday = nowIn(ui.tz, new Date(nowMs)).date;
  const mon = mondayOf(today);
  const viewer = await getViewer();
  const isOwner = viewer?.role === "owner";
  const needEquity = isOwner && SETTINGS.trailingDrawdown != null;

  // Card thị trường (Finnhub) nằm trong MarketCards.tsx + <Suspense>: trang không chờ nguồn chậm nhất
  const [planRes, econ, recent, equity] = await Promise.all([
    isOwner ? safe(getPlan(today).then((r) => (r ? planView(r) : null))) : safe(Promise.resolve(null)),
    getEconWeek(),
    isOwner ? safe(getRecentDays(5)) : safe(Promise.resolve([] as DayWithTrades[])),
    needEquity ? safe(getRecentDays(250)) : safe(Promise.resolve(null)),
  ]);

  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  const events = localize(econ.events, ui.tz).filter((e) => matches(prefs, e));
  const todayEvents = events.filter((e) => e.dateLocal === localToday);
  // Gọn cho dashboard: ưu tiên tin mạnh, rồi theo giờ
  const lines = [...todayEvents]
    .filter((e) => e.impact !== "Holiday")
    .sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || a.ts - b.ts)
    .slice(0, MAX_LINES)
    .sort((a, b) => a.ts - b.ts);
  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(mondayOf(localToday), i));
  const week = weekDays.map((d) => {
    const list = events.filter((e) => e.dateLocal === d);
    const holiday = list.find((e) => e.impact === "Holiday");
    return { d, n: list.length, top: topImpact(list.filter((e) => e.impact !== "Holiday")), holiday };
  });
  const holidays = week.filter((w) => w.holiday);
  const tl: TlEvent[] = events
    .filter((e) => e.dateEt === today && !e.allDay)
    .map((e) => {
      const [h, m] = e.timeEt.split(":").map(Number);
      return {
        id: e.id,
        minutes: h * 60 + m,
        impact: e.impact,
        title: e.title,
        country: e.country,
        et: e.timeEt,
        local: ui.tz === "America/New_York" ? "" : e.timeLocal,
        href: `/calendar?day=${e.dateLocal}`,
      };
    });
  const name = viewer?.name?.split(/[ツ\s]/)[0] || "Deren";

  return (
    <>
      <PageHead
        kicker={`${DOW[ui.lang][et.dow]} · ${viDate(today)}`}
        title={t("Chào {name}", { name })}
        sub={<SessionSub initial={nowMs} today={today} />}
        actions={
          isOwner && (
            <>
              <Link className="btn" href="/journal">
                <Icon name="journal" size={16} /> {t("Recap hôm nay")}
              </Link>
              <Link className="btn primary" href="/trade-plan">
                <Icon name="plan" size={16} /> {t("Mở Trade Plan")}
              </Link>
            </>
          )
        }
      />

      <SessionTimeline initial={nowMs} events={tl} today={today} />

      <div className="g2-1">
        {isOwner ? (
          <div className="dash-plan">
            {planRes.ok ? (
              planRes.v ? (
                <PlanCard p={planRes.v} t={t} today={today} />
              ) : (
                <NoPlan t={t} weekday={isWeekday(today)} late={et.minutes >= PLAN_SEND + 5} />
              )
            ) : (
              <section className="card warn">
                <span className="lbl short">{t("Plan hôm nay · lỗi đọc database")}</span>
                <p className="small t2">{planRes.error}</p>
              </section>
            )}
          </div>
        ) : null}

        <div className="stack-20">
          {isOwner && <DisciplineCard t={t} today={today} recent={recent} equity={equity} />}
          <section className="card" aria-label={t("Tin hôm nay")}>
            <CardHead
              label={`${t("Tin hôm nay")} · ${prefs.cur.length === 9 ? t("mọi currency") : prefs.cur.join(", ") || "—"}`}
              href="/calendar"
              more="Econ Calendar"
            />
            {!econ.ok ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="notice">{t("Không tải được lịch tin")}</div>
                <a className="small" href={ECON_SOURCE_PAGE} target="_blank" rel="noreferrer">
                  {t("Mở trang nguồn")}
                </a>
              </div>
            ) : lines.length ? (
              <div className="stack" style={{ gap: 2 }}>
                {lines.map((e: EconEvent) => (
                  <Link key={e.id} href={`/calendar?day=${e.dateLocal}`} className="drow news-line">
                    <span className="mono small t2">{e.timeLocal || e.timeEt}</span>
                    <span className={`imp-bar imp-${e.impact}`}>
                      <span className="sr-only">
                        {t("Tác động")} {e.impact}
                      </span>
                    </span>
                    <span className="ellipsis" style={{ fontSize: 13 }}>
                      {e.title}
                    </span>
                    <span className="mono small dim">{e.actual || (e.forecast ? `${e.forecast} ${t("dự báo")}` : "")}</span>
                  </Link>
                ))}
                {todayEvents.length > lines.length && (
                  <Link href={`/calendar?day=${localToday}`} className="small dim" style={{ paddingLeft: 8 }}>
                    {t("+{n} tin khác", { n: todayEvents.length - lines.length })}
                  </Link>
                )}
              </div>
            ) : (
              <p className="small dim">{isWeekday(localToday) ? t("Không có tin khớp bộ lọc hôm nay.") : t("Cuối tuần, không có tin.")}</p>
            )}
            <div className="week-v3">
              {week.map((w) => (
                <Link
                  key={w.d}
                  href={`/calendar?day=${w.d}`}
                  className={w.d === localToday ? "today" : ""}
                  aria-label={`${DOW[ui.lang][dowOf(w.d)]} ${viDayMonth(w.d)}, ${w.holiday ? t("Nghỉ lễ") : t("{n} tin", { n: w.n })}`}
                >
                  <span className="small dim">{DOW_SHORT[ui.lang][dowOf(w.d)]}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {w.d.slice(8)}
                  </span>
                  {w.holiday ? (
                    <span className="dim" style={{ fontSize: 10.5 }}>
                      {t("Nghỉ lễ")}
                    </span>
                  ) : (
                    <span className={"dot" + (w.top ? ` imp-${w.top}` : "")} style={w.top ? undefined : { background: "transparent" }} aria-hidden="true" />
                  )}
                </Link>
              ))}
            </div>
            {holidays.map((w) => (
              <p key={w.d} className="small dim">
                {DOW[ui.lang][dowOf(w.d)]} {viDayMonth(w.d)} · {w.holiday?.country} {w.holiday?.title}
              </p>
            ))}
          </section>
        </div>
      </div>

      <div className="g3">
        {isOwner && <Journal5 t={t} recent={recent} mon={mon} today={today} />}
        <Suspense fallback={<CardSkeleton label={t("Earnings tuần này · NQ top")} lines={5} />}>
          <EarningsWeekCard today={today} mon={mon} />
        </Suspense>
        <Suspense fallback={<CardSkeleton label={t("Tin nổi bật")} lines={4} />}>
          <NewsCard nowMs={nowMs} />
        </Suspense>
      </div>
    </>
  );
}

function PlanCard({ p, t, today }: { p: PlanView; t: T; today: string }) {
  const s = p.summary;
  const tone = p.bias;
  const img = p.image_path ? planImageSrc(p.trade_date, p.updated_at) : null;
  return (
    <section className="card" aria-label={t("Plan hôm nay")} style={{ gap: 18 }}>
      <div className="ch wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="lbl">{t("Plan hôm nay · Composite × pRTH × OVN")}</span>
          <h2 className="h2" style={{ fontSize: 22 }}>
            {p.symbol} · {s?.setup || "Plan"}
          </h2>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <span className={"pill " + (tone === "flat" ? "" : tone)}>
            Bias {t(BIAS_LABEL[tone])}
            {s?.conf ? ` · ${s.conf}` : ""}
          </span>
          {s?.location && <span className="pill">{s.location}</span>}
          {s?.price != null && <span className="pill acc mono">9:29 · {fmtPx(s.price)}</span>}
        </div>
      </div>
      <div className="plan-v3">
        <div role="group" aria-label={t("Các level")} style={{ minWidth: 0 }}>
          {p.levels.length ? (
            <Ladder levels={p.levels} zones={p.zones} price={s?.price ?? null} t={t} />
          ) : (
            <p className="small dim">{t("Không đọc được level từ payload.")}</p>
          )}
        </div>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div className="sunk">
            <div className="hstack" style={{ gap: 8 }}>
              <span className={`tag ${tone === "short" ? "short" : "long"}`}>A</span>
              <span className="h3">{s?.setup || t("Kịch bản chính")}</span>
            </div>
            <p className="small t2" style={{ margin: 0, lineHeight: 1.55 }}>
              {s?.location ? `${t("Vị trí")}: ${s.location}. ` : ""}
              {s?.target != null
                ? `Target ${fmtPx(s.target)}${s.distance != null ? ` · ${t("cách giá 9:29 {n} điểm", { n: fmtPx(s.distance) })}` : ""}.`
                : t("Target theo mô tả setup.")}
            </p>
          </div>
          {s?.flip && (
            <div className="sunk">
              <div className="hstack" style={{ gap: 8 }}>
                <span className={`tag ${tone === "short" ? "long" : "short"}`}>B</span>
                <span className="h3">{t("Đổi bias")}</span>
              </div>
              <p className="small t2" style={{ margin: 0, lineHeight: 1.55 }}>
                {s.flip}
              </p>
            </div>
          )}
          <Checklist10 date={today} />
          <div style={{ flex: 1 }} />
          <div className="hstack" style={{ gap: 8 }}>
            <Link className="btn sm" href={`/trade-plan?date=${p.trade_date}`}>
              {t("Xem plan")}
            </Link>
            {img && <CopyImage src={img} small />}
          </div>
        </div>
      </div>
      <div className="ch wrap" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
        <span className="small dim hstack" style={{ gap: 14 }}>
          <span>
            {t("Cập nhật")}{" "}
            <span className="mono t2">
              {new Date(p.updated_at).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" })} ET
            </span>
          </span>
          <span className="hstack" style={{ gap: 6 }}>
            <span className="dot ok" aria-hidden="true" />
            Database
          </span>
          <span className="hstack" style={{ gap: 6 }}>
            <span className={"dot " + (p.image_path ? "ok" : "err")} aria-hidden="true" />
            Storage{p.image_path ? "" : ` · ${t("chưa có ảnh")}`}
          </span>
          <span className="hstack" style={{ gap: 6 }} title={t("Trạng thái gửi Discord không lưu trong database; xem kênh #trade-plan")}>
            <span className="dot" style={{ background: "var(--ghost)" }} aria-hidden="true" />
            Discord · {t("không theo dõi")}
          </span>
        </span>
      </div>
    </section>
  );
}

function NoPlan({ t, weekday, late }: { t: T; weekday: boolean; late: boolean }) {
  if (!weekday)
    return (
      <section className="card">
        <span className="lbl">{t("Plan hôm nay")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="empty-art" src="/assets/img/zendojo/empty.webp" alt="" aria-hidden="true" />
        <h2 className="h2">{t("Cuối tuần, không có phiên")}</h2>
        <p className="muted small">{t("Dùng thời gian này để recap tuần trong Journal.")}</p>
        <div className="hstack">
          <Link className="btn" href="/journal">
            Journal
          </Link>
        </div>
      </section>
    );
  if (late)
    return (
      <section className="card warn" aria-label={t("Chưa nhận plan")}>
        <span className="lbl short">{t("Quá giờ mà chưa nhận plan")}</span>
        <h2 className="h2">{t("Chưa nhận plan từ ATAS")}</h2>
        <ul className="small t2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{t("ATAS đang mở chart NQ M30 và indicator Plan Sender đang bật?")}</li>
          <li>{t("Tuỳ chọn gửi web trong indicator có bật, đúng API URL?")}</li>
          <li>{t("Xem log indicator: cần thấy HTTP 200")}</li>
        </ul>
        <Link className="btn danger" href="/trade-plan" style={{ alignSelf: "flex-start" }}>
          {t("Gửi tay bằng JSON")}
        </Link>
      </section>
    );
  return (
    <section className="card" aria-label={t("Chưa có plan")}>
      <span className="lbl">{t("Plan hôm nay")}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="empty-art" src="/assets/img/zendojo/empty.webp" alt="" aria-hidden="true" />
      <h2 className="h2">{t("Chưa có plan hôm nay")}</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        {t("ATAS X thường gửi lúc 09:29 ET. Có thể gửi tay trước nếu đã có JSON.")}
      </p>
      <div className="hstack">
        <Link className="btn primary" href="/trade-plan">
          {t("Mở Trade Plan")}
        </Link>
      </div>
    </section>
  );
}

type Res<V> = { ok: true; v: V } | { ok: false; error: string };

// Kỷ luật phiên: số lệnh / tối đa, PnL ngày so với giới hạn lỗ ngày, khoảng cách trailing drawdown (SETTINGS, lib/settings.ts)
function DisciplineCard({ t, today, recent, equity }: { t: T; today: string; recent: Res<DayWithTrades[]>; equity: Res<DayWithTrades[] | null> }) {
  const day = recent.ok ? recent.v.find((d) => d.trade_date === today) : undefined;
  const n = day ? dayNet(day) : null;
  const trades = day?.journal_trades || [];
  const max = SETTINGS.maxTradesPerDay;
  // lệnh thua liên tiếp cuối cùng trong ngày
  let streak = 0;
  for (const tr of [...trades].reverse()) {
    if (Number(tr.pnl) < 0 || Number(tr.r) < 0) streak++;
    else break;
  }
  const limit = SETTINGS.dailyLossLimit;
  const hitLimit = limit != null && n != null && n.net <= -limit;
  // Trailing drawdown: vốn = tổng net cộng dồn theo journal; khoảng còn lại = giới hạn − (đỉnh − hiện tại)
  let trail: { left: number; pct: number } | null = null;
  if (SETTINGS.trailingDrawdown != null && equity.ok && equity.v) {
    let cum = 0;
    let peak = 0;
    for (const d of [...equity.v].sort((a, b) => (a.trade_date < b.trade_date ? -1 : 1))) {
      cum += dayNet(d).net;
      peak = Math.max(peak, cum);
    }
    const left = SETTINGS.trailingDrawdown - (peak - cum);
    trail = { left, pct: (left / SETTINGS.trailingDrawdown) * 100 };
  }
  const warn = trades.length >= max || hitLimit || streak >= SETTINGS.stopAfterLosses;
  return (
    <section className={"card" + (warn ? " warn" : "")} aria-label={t("Kỷ luật phiên")}>
      <div className="ch">
        <span className="lbl">{t("Kỷ luật phiên")}</span>
        {warn && <span className="tag short">{t("Dừng giao dịch")}</span>}
      </div>
      <div className="ch" style={{ alignItems: "baseline" }}>
        <span className="small muted">{t("Lệnh hôm nay")}</span>
        <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
          {trades.length}
          <span className="dim" style={{ fontSize: 14 }}>
            {" "}
            / {max}
          </span>
        </span>
      </div>
      <div className="trade-dots" aria-hidden="true">
        {Array.from({ length: Math.max(max, trades.length) }, (_, i) => {
          const tr = trades[i];
          const cls = !tr ? "" : Number(tr.pnl) < 0 || Number(tr.r) < 0 ? "loss" : "win";
          // biome-ignore lint/suspicious/noArrayIndexKey: ô lệnh theo thứ tự trong ngày, chỉ có vị trí
          return <span key={`slot-${i + 1}`} className={cls} />;
        })}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="ch">
          <span className="small muted">{t("PnL ngày")}</span>
          <span className={`mono ${n && n.n ? (n.net >= 0 ? "long" : "short") : "dim"}`} style={{ fontWeight: 600 }}>
            {n && n.n ? usd(n.net) : "—"}
          </span>
        </div>
        <div className="ch">
          <span className="small dim">{t("Giới hạn lỗ ngày")}</span>
          <span className="mono small t2">{limit != null ? `−$${limit.toLocaleString("en-US")}` : t("chưa đặt")}</span>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="ch">
          <span className="small muted">{t("Cách trailing drawdown")}</span>
          <span className="mono" style={{ fontWeight: 600 }}>
            {trail ? `$${Math.max(0, Math.round(trail.left)).toLocaleString("en-US")}` : t("chưa đặt")}
          </span>
        </div>
        {trail && <Bar pct={trail.pct} color={trail.pct < 25 ? "var(--short)" : "var(--accent)"} />}
      </div>
      <p className="small dim" style={{ margin: 0, lineHeight: 1.5 }}>
        {t("Dừng sau {n} lệnh thua liên tiếp hoặc khi chạm giới hạn ngày.", { n: SETTINGS.stopAfterLosses })}
        {limit == null || SETTINGS.trailingDrawdown == null ? ` ${t("Đặt giới hạn trong lib/settings.ts.")}` : ""}
      </p>
    </section>
  );
}

// Journal 5 phiên: biểu đồ cột PnL net
function Journal5({ t, recent, mon, today }: { t: T; recent: Res<DayWithTrades[]>; mon: string; today: string }) {
  if (!recent.ok)
    return (
      <section className="card" aria-label="Journal">
        <CardHead label={t("Journal · 5 phiên gần nhất")} />
        <p className="small short">{recent.error}</p>
      </section>
    );
  const days = [...recent.v].reverse();
  const nets = days.map((d) => dayNet(d));
  const maxAbs = Math.max(1, ...nets.map((x) => Math.abs(x.net)));
  const wk = recent.v.filter((d) => d.trade_date >= mon);
  const wkNet = wk.reduce((a, d) => a + dayNet(d).net, 0);
  const biasDays = wk.filter((d) => d.bias_correct);
  return (
    <section className="card" aria-label="Journal">
      <CardHead label={t("Journal · 5 phiên gần nhất")} href="/journal/pnl" more="PnL" />
      {days.length ? (
        <div className="jbars">
          {days.map((d, i) => {
            const x = nets[i];
            const noTrade = !x.n;
            const cls = noTrade ? "flat" : x.net >= 0 ? "win" : "loss";
            return (
              <Link key={d.trade_date} href={`/journal?date=${d.trade_date}`} className={`jbar ${cls}`}>
                <span className="mono jbar-v">{noTrade ? (d.result === "No Trade" ? "No trade" : "—") : usd(x.net)}</span>
                <span className="jbar-b" style={{ height: noTrade ? 4 : Math.max(6, (Math.abs(x.net) / maxAbs) * 70) }} />
                <span className="small dim">{viDayMonth(d.trade_date)}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="small dim">{t("Chưa có journal.")}</p>
      )}
      <div className="ch wrap" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
        <span className="small muted">
          {t("Tuần này")} <span className={`mono ${wkNet >= 0 ? "long" : "short"}`}>{wk.length ? usd(wkNet) : "—"}</span>
          {biasDays.length ? ` · ${t("bias đúng {a}/{b}", { a: biasDays.filter((d) => d.bias_correct === "Đúng").length, b: biasDays.length })}` : ""}
        </span>
        <Link className="btn sm" href="/journal">
          {recent.v[0]?.trade_date === today ? t("Mở journal hôm nay") : t("Recap hôm nay")}
        </Link>
      </div>
    </section>
  );
}

// Thang level: vạch đúng tỷ lệ giá bên trái, dải HVN, vạch giá 9:29; nhãn giãn ra cho khỏi đè nhau
const LH = 430;
const GAP = 24;
function Ladder({ levels, zones, price, t }: { levels: PlanView["levels"]; zones: PlanView["zones"]; price: number | null; t: T }) {
  const sorted = [...levels].filter((l) => l.kind !== "hvn").sort((a, b) => b.px - a.px);
  if (!sorted.length) return null;
  const hi = Math.max(sorted[0].px, ...zones.map((z) => z.hi).filter((x) => x <= sorted[0].px + 400));
  const lo = Math.min(sorted[sorted.length - 1].px, ...zones.map((z) => z.lo).filter((x) => x >= sorted[sorted.length - 1].px - 400));
  const span = hi - lo || 1;
  const y = (px: number) => 12 + ((hi - px) / span) * (LH - 24);
  const real = sorted.map((l) => y(l.px));
  const lab = [...real];
  for (let i = 1; i < lab.length; i++) if (lab[i] - lab[i - 1] < GAP) lab[i] = lab[i - 1] + GAP;
  const over = lab[lab.length - 1] - (LH - 12);
  if (over > 0) {
    for (let i = lab.length - 1; i >= 0; i--) lab[i] -= over;
    for (let i = lab.length - 2; i >= 0; i--) if (lab[i + 1] - lab[i] < GAP) lab[i] = lab[i + 1] - GAP;
  }
  const shift = Math.min(0, lab[0] - 12);
  const h = Math.max(LH, lab[lab.length - 1] + 14 - shift);
  const shown = zones.filter((z) => z.hi >= lo && z.lo <= hi);
  const label = [...sorted.map((l) => `${t(l.name)} ${fmtPx(l.px)}`), ...shown.map((z) => `HVN ${fmtPx(z.lo)}–${fmtPx(z.hi)}`)].join(", ");
  return (
    <div className="ladder" style={{ height: h }} role="img" aria-label={label}>
      {shown.map((z) => (
        <div
          key={`${z.lo}-${z.hi}`}
          className="ladder-hvn"
          style={{ top: y(Math.min(z.hi, hi)) - shift, height: Math.max(4, y(Math.max(z.lo, lo)) - y(Math.min(z.hi, hi))) }}
        />
      ))}
      {price != null && <div className="ladder-px" style={{ top: y(price) - shift }} />}
      <svg className="ladder-svg" width="64" height={h} aria-hidden="true">
        <line x1="14" x2="14" y1="6" y2={h - 6} className="ladder-axis" />
        {sorted.map((l, i) => (
          <g key={`${l.kind}-${l.name}-${l.px}`} className={"lk-" + l.kind}>
            <line x1="6" x2="22" y1={real[i] - shift} y2={real[i] - shift} />
            <line x1="22" x2="62" y1={real[i] - shift} y2={lab[i] - shift} className="ladder-conn" />
          </g>
        ))}
      </svg>
      {sorted.map((l, i) => (
        <div key={`${l.kind}-${l.name}-${l.px}`} className={"lvl ladder-l " + l.kind} style={{ top: lab[i] - shift }}>
          <span>{t(l.name)}</span>
          <span className="mono">{fmtPx(l.px)}</span>
        </div>
      ))}
      {shown.length > 0 && (
        <div className="ladder-legend small" aria-hidden="true">
          <span className="ladder-legend-sw" />
          HVN {shown.map((z) => `${fmtPx(z.lo)}–${fmtPx(z.hi)}`).join(" · ")}
          {price != null && (
            <>
              <span className="ladder-legend-px" /> 9:29
            </>
          )}
        </div>
      )}
    </div>
  );
}
