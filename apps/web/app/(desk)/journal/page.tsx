import { requireOwner } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { errText } from "@/lib/db";
import { DOW, DOW_SHORT } from "@/lib/i18n";
import { SESSION_FIELDS, TEXT_FIELDS, dayNet, getDay, getMonth, presetFromPlan, type DayWithTrades } from "@/lib/journal";
import { biasTone, getPlan, type PlanRow } from "@/lib/plans";
import { getT } from "@/lib/prefs-server";
import { DATE_RE, addDays, dowOf, etNow, isWeekday, monthRange, viDayMonth } from "@/lib/time";
import { listImages, type JournalImage } from "@/lib/journal-images";
import JournalEditor from "./JournalEditor";
import JournalImages from "./JournalImages";

export const metadata: Metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

const BIAS = { long: "Long", short: "Short", flat: "Trung tính" } as const;

function lastWeekday(d: string) {
  let x = d;
  while (!isWeekday(x)) x = addDays(x, -1);
  return x;
}

const usd = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
function firstWeekday(d: string) {
  let x = d;
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
}
function cellTone(j: DayWithTrades | undefined) {
  if (!j) return "none";
  const n = dayNet(j);
  return !n.n ? "flat" : n.net >= 0 ? "win" : "loss";
}
function cellLabel(j: DayWithTrades | undefined, t: (s: string) => string) {
  if (!j) return t("Chưa recap");
  const n = dayNet(j);
  return !n.n ? "No trade" : usd(n.net);
}
const _rFmt = (r: number) => (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(1) + "R";

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireOwner("/journal"); // layout + page render song song: chặn trước khi đọc database
  const q = await searchParams;
  const { t, ui } = await getT();
  const today = etNow().date;
  const date = q.date && DATE_RE.test(q.date) ? q.date : lastWeekday(today);
  const month = date.slice(0, 7);

  let error = "";
  let day: DayWithTrades | null = null;
  let monthDays: DayWithTrades[] = [];
  let plan: PlanRow | null = null;
  let images: JournalImage[] = [];
  let imgError = "";
  // Ảnh chạy song song với các truy vấn journal (trước đây chạy sau), lỗi ảnh vẫn tách riêng
  const imagesP = listImages(date).then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  try {
    const [d, m, p] = await Promise.all([getDay(date), getMonth(month), getPlan(date).catch(() => null)]);
    day = d;
    monthDays = m;
    plan = p;
  } catch (e) {
    error = errText(e);
  }
  const img = await imagesP;
  if (!error) {
    if (img.ok) images = img.v;
    // Bảng journal_images chưa có (chưa áp migration) → phần còn lại của Journal vẫn chạy
    else imgError = /journal_images|PGRST205|42P01/.test(errText(img.e)) ? "chưa áp migration journal_images" : errText(img.e);
  }

  const { start, days } = monthRange(month);
  const byDate = new Map(monthDays.map((d) => [d.trade_date, d]));
  const tone = biasTone(plan?.summary?.bias);
  const next = addDays(start, days);
  // Lịch mini T2–T6: ô trống đầu tháng theo thứ của ngày đầu tiên có trong tuần
  const cells: (string | null)[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    if (!isWeekday(d)) continue;
    if (!cells.length) for (let k = 1; k < dowOf(d); k++) cells.push(null);
    cells.push(d);
  }
  const traded = monthDays.filter((d) => (d.journal_trades || []).length);
  const monthNet = monthDays.reduce((a, d) => a + dayNet(d).net, 0);

  return (
    <>
      {error && (
        <div className="notice">
          {t("Không đọc được journal")}: {error}
        </div>
      )}

      <div className="journal-grid">
        <nav className="card journal-rail" aria-label={t("Lịch tháng")}>
          <div className="ch">
            <span className="lbl">{t("Tháng {m} · {y}", { m: Number(month.slice(5)), y: month.slice(0, 4) })}</span>
            <span className="hstack" style={{ gap: 4 }}>
              <Link className="btn icon sm" href={`/journal?date=${lastWeekday(addDays(start, -1))}`} aria-label={t("tháng trước")}>
                ‹
              </Link>
              {next <= today && (
                <Link className="btn icon sm" href={`/journal?date=${firstWeekday(next)}`} aria-label={t("tháng sau")}>
                  ›
                </Link>
              )}
            </span>
          </div>
          <div className="mcal" role="group" aria-label={t("Ngày trong tháng")}>
            {DOW_SHORT[ui.lang].slice(1, 6).map((w) => (
              <span key={w} className="mcal-h" aria-hidden="true">
                {w}
              </span>
            ))}
            {cells.map((d, i) =>
              d === null ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: ô trống đầu tháng, chỉ có vị trí
                <span key={`b${i}`} />
              ) : (
                <Link
                  key={d}
                  href={`/journal?date=${d}`}
                  className={"mcal-d " + cellTone(byDate.get(d)) + (d === date ? " on" : "") + (d === today ? " today" : "") + (d > today ? " future" : "")}
                  aria-current={d === date ? "date" : undefined}
                  aria-label={`${viDayMonth(d)} · ${cellLabel(byDate.get(d), t)}`}
                >
                  {Number(d.slice(8))}
                </Link>
              ),
            )}
          </div>
          <div className="mcal-legend small dim" aria-hidden="true">
            <span>
              <i className="win" /> {t("Lãi")}
            </span>
            <span>
              <i className="loss" /> {t("Lỗ")}
            </span>
            <span>
              <i className="flat" /> No trade
            </span>
          </div>
          <div className="stack" style={{ gap: 6, borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
            <div className="ch">
              <span className="small muted">{t("Net tháng")}</span>
              <span className={`mono ${monthNet >= 0 ? "long" : "short"}`} style={{ fontWeight: 600 }}>
                {monthDays.length ? usd(monthNet) : "—"}
              </span>
            </div>
            <div className="ch">
              <span className="small dim">{t("Ngày có lệnh")}</span>
              <span className="mono small t2">{traded.length}</span>
            </div>
            <div className="ch">
              <span className="small dim">{t("Ngày lãi / lỗ")}</span>
              <span className="mono small t2">
                {traded.filter((d) => dayNet(d).net > 0).length} / {traded.filter((d) => dayNet(d).net < 0).length}
              </span>
            </div>
          </div>
        </nav>

        <article aria-label={`Journal ${date}`} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const head = (
              <div className="hstack journal-title" style={{ gap: 12, flexWrap: "wrap" }}>
                <h2 className="h2">
                  {DOW[ui.lang][dowOf(date)]} · {viDayMonth(date)}/{date.slice(0, 4)}
                </h2>
                {plan ? (
                  <Link href={`/trade-plan?date=${date}`} className="hstack small" style={{ fontWeight: 600, gap: 8 }}>
                    <span className={"pill " + (tone === "flat" ? "" : tone)}>Plan · {t(BIAS[tone])}</span>
                    {plan.summary?.location}
                  </Link>
                ) : (
                  <span className="small dim">{t("Ngày này chưa có plan")}</span>
                )}
              </div>
            );
            return error ? (
              <div className="card journal-head">{head}</div>
            ) : (
              <JournalEditor
                key={date + (day?.updated_at || "")}
                date={date}
                initial={day}
                textFields={TEXT_FIELDS}
                sessionFields={SESSION_FIELDS}
                preset={presetFromPlan(plan?.summary)}
                head={head}
              >
                <JournalImages key={"img" + date} date={date} initial={images} tradeCount={day?.journal_trades?.length || 0} error={imgError || undefined} />
              </JournalEditor>
            );
          })()}
        </article>
      </div>
    </>
  );
}
