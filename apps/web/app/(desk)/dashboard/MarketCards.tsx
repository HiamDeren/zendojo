// Card Dashboard lấy dữ liệu Finnhub (earnings tuần, tin nổi bật). Async server component, page bọc <Suspense>
// nên plan / lịch tin / journal (Supabase, đã cache) hiện trước, card thị trường tới sau.
// UI v3: bỏ Watchlist (giá cổ phiếu xem ở Markets).
import Link from "next/link";
import { DOW_SHORT } from "@/lib/i18n";
import { getEarnings, getNews, marketConfigured, NQ_WATCH } from "@/lib/market";
import { getT } from "@/lib/prefs-server";
import { addDays, dowOf, viDayMonth } from "@/lib/time";
import { CardHead } from "../_components/kit";

const MAX_EARN = 6;
const HOUR: Record<string, string> = { bmo: "Trước mở cửa", amc: "Sau đóng cửa", dmh: "Trong phiên" };

export async function EarningsWeekCard({ today, mon }: { today: string; mon: string }) {
  const { t, ui } = await getT();
  const earn = await getEarnings(mon, addDays(mon, 4));
  const nq = earn.items.filter((e) => NQ_WATCH.includes(e.symbol)).sort((a, b) => (a.date === b.date ? (a.hour === "bmo" ? -1 : 1) : a.date < b.date ? -1 : 1));
  const shown = nq.slice(0, MAX_EARN);
  return (
    <section className="card" aria-label={t("Earnings tuần này · NQ top")}>
      <CardHead label={t("Earnings tuần này · NQ top")} href="/earnings" more="Earnings" />
      {!earn.ok ? (
        <p className="small dim">{earn.configured ? earn.error : t("Chưa có FINNHUB_API_KEY trên Vercel.")}</p>
      ) : shown.length ? (
        <div className="stack" style={{ gap: 2 }}>
          {shown.map((e) => (
            <Link key={e.symbol + e.date} href={`/stock/${e.symbol}`} className={"drow earn-line" + (e.date < today ? " past" : "")}>
              <span className="small dim">
                {DOW_SHORT[ui.lang][dowOf(e.date)]} {viDayMonth(e.date)}
              </span>
              <span className="mono" style={{ fontWeight: 700 }}>
                {e.symbol}
              </span>
              <span className="small muted">{HOUR[e.hour] ? t(HOUR[e.hour]) : "—"}</span>
            </Link>
          ))}
          {nq.length > shown.length && (
            <Link href="/earnings" className="small dim" style={{ paddingLeft: 8 }}>
              {t("+{n} mã khác", { n: nq.length - shown.length })}
            </Link>
          )}
        </div>
      ) : (
        <p className="small dim">{t("Tuần này không có mã NQ top báo cáo.")}</p>
      )}
    </section>
  );
}

function ago(ts: number, now: number, t: (s: string, v?: Record<string, string | number>) => string) {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}'`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : t("{n} ngày", { n: Math.round(h / 24) });
}

export async function NewsCard({ nowMs }: { nowMs: number }) {
  const { t } = await getT();
  const news = await getNews("general", 6);
  return (
    <section className="card" aria-label={t("Tin nổi bật")}>
      <CardHead label={t("Tin nổi bật")} href="/news" more="News" />
      {!marketConfigured() ? (
        <p className="small dim">{t("Chưa có FINNHUB_API_KEY trên Vercel.")}</p>
      ) : !news.ok ? (
        <p className="small short">{news.error}</p>
      ) : news.items.length ? (
        <div className="stack" style={{ gap: 2 }}>
          {news.items.slice(0, 3).map((n) => (
            <Link key={n.id} href={`/news?cat=general&id=${encodeURIComponent(n.id)}`} className="drow news-top">
              <span className="small dim">
                {n.source} · {ago(n.ts, nowMs, t)}
                {n.related ? (
                  <>
                    {" · "}
                    <span className="acc mono">{n.related.split(",")[0]}</span>
                  </>
                ) : null}
              </span>
              <span className="news-top-h">{n.headline}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="small dim">{t("Chưa có tin.")}</p>
      )}
    </section>
  );
}
