// Trade Plan (UI v3, docs/design/v3/TradePlan.dc.html): điều hướng ngày + "Gửi JSON tay" (drawer) → trạng thái DB / Storage / Discord →
// trái: ảnh plan (server vẽ) + bảng level · phải: Bias của ngày, kịch bản A / B, checklist 10:00, lịch sử plan tháng.
// Mọi số lấy từ plan-core / payload (lib/plans.ts), không tính lại.
import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { db, errText } from "@/lib/db";
import { DOW } from "@/lib/i18n";
import { planImageSrc } from "@/lib/plan-url";
import { fmtPx, getPlan, type PlanView as PlanData, planView } from "@/lib/plans";
import { getT } from "@/lib/prefs-server";
import { addDays, DATE_RE, dowOf, etNow, isWeekday, monthRange, viDate } from "@/lib/time";
import Checklist10 from "../_components/Checklist10";
import CopyImage from "../_components/CopyImage";
import { PageHead } from "../_components/kit";
import PlanView, { type PlanItem } from "./PlanView";
import SendDrawer from "./SendDrawer";

export const metadata: Metadata = { title: "Trade Plan" };
export const dynamic = "force-dynamic";

type T = (s: string, v?: Record<string, string | number>) => string;
const BIAS = { long: "Long", short: "Short", flat: "Trung tính" } as const;
const ROLE: Record<string, string> = { comp: "Composite", prth: "pRTH", poc: "POC", ovn: "OVN", hvn: "HVN", target: "Target", price: "Giá 9:29" };

function weekdayStep(d: string, dir: 1 | -1) {
  let x = addDays(d, dir);
  while (!isWeekday(x)) x = addDays(x, dir);
  return x;
}

export default async function TradePlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  // Kiểm chủ sở hữu trước khi đọc database (layout cũng kiểm, nhưng layout và page render song song; cache() nên không tốn thêm)
  await requireOwner("/trade-plan");
  const { date: q } = await searchParams;
  const { t, ui } = await getT();
  const today = etNow().date;
  const date = q && DATE_RE.test(q) && q <= today ? q : today;
  // Lịch sử plan của tháng đang xem (cùng truy vấn với GET /api/plan?month=). Lỗi → null, client tự gọi API.
  const { start, next } = monthRange(date.slice(0, 7));
  const [res, initialPlans] = await Promise.all([
    getPlan(date)
      .then(async (r) => ({ ok: true as const, v: r ? await planView(r) : null }))
      .catch((e: unknown) => ({ ok: false as const, error: errText(e) })),
    db
      .select<PlanItem>(
        "trade_plans",
        `select=trade_date,symbol,summary,image_path,updated_at&trade_date=gte.${start}&trade_date=lt.${next}&order=trade_date.asc`,
      )
      .catch(() => null),
  ]);
  const p = res.ok ? res.v : null;
  const prev = weekdayStep(date, -1);
  const nextDay = weekdayStep(date, 1);

  return (
    <>
      <PageHead
        kicker={`${t("Giao dịch")} · ${DOW[ui.lang][dowOf(date)]} ${viDate(date)}`}
        title="Trade Plan"
        sub={t("Web và ATAS X dùng chung /api/plan: Database → ảnh WebP → Storage → Discord")}
        actions={
          <>
            <nav className="hstack" style={{ gap: 6 }} aria-label={t("Chọn ngày")}>
              <Link className="btn icon" href={`/trade-plan?date=${prev}`} aria-label={t("Ngày trước")}>
                ‹
              </Link>
              <Link className="btn sm" href="/trade-plan" aria-current={date === today ? "date" : undefined}>
                {t("Hôm nay")}
              </Link>
              {nextDay <= today ? (
                <Link className="btn icon" href={`/trade-plan?date=${nextDay}`} aria-label={t("Ngày sau")}>
                  ›
                </Link>
              ) : (
                <span className="btn icon" aria-disabled="true" style={{ opacity: 0.4 }}>
                  ›
                </span>
              )}
            </nav>
            <SendDrawer today={today} date={date} plans={initialPlans} />
          </>
        }
      />

      <div className="hstack" style={{ gap: 8 }}>
        <span className={"pill " + (res.ok ? "long" : "short")}>
          <span className="dot" style={{ background: "currentColor" }} aria-hidden="true" />
          Database {res.ok ? (p ? "OK" : t("chưa có plan")) : t("lỗi")}
        </span>
        <span className={"pill " + (p?.image_path ? "long" : "")}>
          <span className="dot" style={{ background: p?.image_path ? "currentColor" : "var(--ghost)" }} aria-hidden="true" />
          Storage {p?.image_path ? "OK" : t("chưa có ảnh")}
        </span>
        <span className="pill" title={t("Trạng thái gửi Discord không lưu trong database; xem kênh #trade-plan")}>
          <span className="dot" style={{ background: "var(--ghost)" }} aria-hidden="true" />
          Discord · {t("không theo dõi")}
        </span>
        {p && (
          <span className="small dim">
            {t("Cập nhật")}{" "}
            <span className="mono t2">
              {new Date(p.updated_at).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" })} ET
            </span>
          </span>
        )}
      </div>

      {!res.ok && (
        <div className="notice">
          {t("Không đọc được database")}: {res.error}
        </div>
      )}

      <div className="g2-1">
        <div className="stack-20">
          {p ? (
            <>
              <PlanImage p={p} t={t} />
              <LevelTable p={p} t={t} />
            </>
          ) : (
            <section className="card" aria-label={t("Chưa có plan")}>
              <span className="lbl">{t("Plan ngày {d}", { d: viDate(date) })}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="empty-art" src="/assets/img/zendojo/empty.webp" alt="" aria-hidden="true" />
              <h2 className="h2">{isWeekday(date) ? t("Chưa có plan ngày này") : t("Cuối tuần, không có phiên")}</h2>
              <p className="muted small">{t("ATAS X thường gửi lúc 09:29 ET. Có thể gửi tay bằng JSON (nút Gửi JSON tay).")}</p>
            </section>
          )}
        </div>
        <div className="stack-20">
          {p && <BiasCard p={p} t={t} />}
          {p && <Scenarios p={p} t={t} />}
          {p && (
            <section className="card" aria-label={t("Xác nhận lúc 10:00")}>
              <Checklist10 date={date} />
            </section>
          )}
          <PlanView today={today} initialDate={date} initialPlans={initialPlans} mode="history" />
        </div>
      </div>
    </>
  );
}

function PlanImage({ p, t }: { p: PlanData; t: T }) {
  const img = p.image_path ? planImageSrc(p.trade_date, p.updated_at) : null;
  return (
    <section className="card" aria-label={t("Ảnh plan")}>
      <div className="ch">
        <span className="lbl">
          {t("Ảnh plan")} · {p.symbol}
        </span>
        {img && (
          <span className="hstack" style={{ gap: 8 }}>
            <CopyImage src={img} small />
            <a className="btn sm" href={img} target="_blank" rel="noreferrer">
              {t("Mở lớn")}
            </a>
          </span>
        )}
      </div>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="plan-img" src={img} alt={`Plan ${p.trade_date}`} />
      ) : (
        <div className="placeholder" style={{ height: 220 }}>
          {t("Chưa có ảnh plan")}
        </div>
      )}
      {p.plan_text && (
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>
            {t("Plan chữ")}
          </summary>
          <pre className="code" style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>
            {p.plan_text}
          </pre>
        </details>
      )}
    </section>
  );
}

function LevelTable({ p, t }: { p: PlanData; t: T }) {
  const px = p.summary?.price ?? null;
  const rows = [...p.levels].sort((a, b) => b.px - a.px);
  return (
    <section className="card flush" aria-label={t("Bảng level")}>
      <div className="ch">
        <span className="lbl">{t("Bảng level")}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("Level")}</th>
              <th className="r">{t("Giá")}</th>
              <th className="r">{t("Cách 9:29")}</th>
              <th>{t("Vai trò")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const dist = px === null ? null : l.px - px;
              return (
                <tr key={`${l.kind}-${l.name}-${l.px}`} className={l.kind === "price" ? "row-price" : undefined}>
                  <td>{t(l.name)}</td>
                  <td className="r">{fmtPx(l.px)}</td>
                  <td className={"r " + (dist === null || l.kind === "price" ? "dim" : dist > 0 ? "long" : "short")}>
                    {dist === null || l.kind === "price" ? "—" : `${dist > 0 ? "+" : "−"}${fmtPx(Math.abs(dist))}`}
                  </td>
                  <td>
                    <span className={"tag" + (l.kind === "target" ? " long" : l.kind === "price" || l.kind === "poc" ? " acc" : "")}>
                      {t(ROLE[l.kind] || l.kind)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BiasCard({ p, t }: { p: PlanData; t: T }) {
  const s = p.summary;
  return (
    <section className="card" aria-label={t("Bias của ngày")}>
      <span className="lbl">{t("Bias của ngày")}</span>
      <div className="hstack" style={{ gap: 10, alignItems: "baseline" }}>
        <span className={`bias-big ${p.bias}`}>{t(BIAS[p.bias])}</span>
        {s?.conf && <span className="pill acc">{s.conf}</span>}
      </div>
      {s?.setup && <h2 className="h2">{s.setup}</h2>}
      <div className="bias-cells">
        <div>
          <span className="lbl">Composite</span>
          <span>{s?.location || "—"}</span>
        </div>
        <div>
          <span className="lbl">pRTH build</span>
          <span>{s?.prth || "—"}</span>
        </div>
        <div>
          <span className="lbl">OVN</span>
          <span>{s?.ovn || "—"}</span>
        </div>
      </div>
      {s?.target != null && (
        <p className="small t2" style={{ margin: 0 }}>
          Target {fmtPx(s.target)}
          {s.distance != null ? ` · ${t("cách giá 9:29 {n} điểm", { n: fmtPx(s.distance) })}` : ""}
          {s.zone ? ` · HVN ${fmtPx(s.zone.lo)}–${fmtPx(s.zone.hi)}` : ""}
        </p>
      )}
    </section>
  );
}

function Scenarios({ p, t }: { p: PlanData; t: T }) {
  const s = p.summary;
  return (
    <section className="card" aria-label={t("Kịch bản")}>
      <span className="lbl">{t("Kịch bản")}</span>
      <div className="sunk">
        <div className="hstack" style={{ gap: 8 }}>
          <span className={`tag ${p.bias === "short" ? "short" : "long"}`}>A</span>
          <span className="h3">{s?.setup || t("Kịch bản chính")}</span>
        </div>
        <p className="small t2" style={{ margin: 0, lineHeight: 1.55 }}>
          {s?.location ? `${t("Vị trí")}: ${s.location}. ` : ""}
          {s?.target != null ? `Target ${fmtPx(s.target)}.` : t("Target theo mô tả setup.")}
        </p>
      </div>
      {s?.flip && (
        <div className="sunk">
          <div className="hstack" style={{ gap: 8 }}>
            <span className={`tag ${p.bias === "short" ? "long" : "short"}`}>B</span>
            <span className="h3">{t("Đổi bias")}</span>
          </div>
          <p className="small t2" style={{ margin: 0, lineHeight: 1.55 }}>
            {s.flip}
          </p>
        </div>
      )}
    </section>
  );
}
