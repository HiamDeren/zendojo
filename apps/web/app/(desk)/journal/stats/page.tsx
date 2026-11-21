// Journal · Thống kê (UI v3): thống kê 20 ngày gần nhất + khung Composite × pRTH × OVN (Wilson CI), chuyển từ trang Nhật ký.
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { errText } from "@/lib/db";
import { getRecentDays, type Rate, type SessionStats, type Stats, sessionStatsOf, statsOf } from "@/lib/journal";
import { getT } from "@/lib/prefs-server";

export const metadata: Metadata = { title: "Journal · Thống kê" };
export const dynamic = "force-dynamic";

const rFmt = (r: number) => (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(1) + "R";

export default async function JournalStatsPage() {
  await requireOwner("/journal/stats");
  const { t } = await getT();
  let stats: Stats | null = null;
  let session: SessionStats | null = null;
  let error = "";
  try {
    const recent = await getRecentDays(250);
    stats = statsOf(recent.slice(0, 20));
    session = sessionStatsOf(recent);
  } catch (e) {
    error = errText(e);
  }
  if (error)
    return (
      <div className="notice">
        {t("Không đọc được journal")}: {error}
      </div>
    );
  return (
    <div className="stats-grid">
      <section className="card" aria-label={t("Thống kê")}>
        <span className="lbl">{t("Thống kê · {n} ngày gần nhất", { n: stats?.days || 0 })}</span>
        {stats && stats.days ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <Tile k="Win rate" v={stats.winRate == null ? "—" : stats.winRate + "%"} />
              <Tile k={t("R TB / lệnh")} v={stats.avgR == null ? "—" : rFmt(stats.avgR)} />
              <Tile k={t("Theo plan")} v={stats.followed == null ? "—" : stats.followed + "%"} />
              <Tile k={t("Bias đúng")} v={stats.biasOk == null ? "—" : stats.biasOk + "%"} />
            </div>
            {stats.byType.length > 0 && (
              <div className="bars">
                <span className="lbl">{t("R theo day type")}</span>
                {stats.byType.map((b) => {
                  const max = Math.max(...stats!.byType.map((x) => Math.abs(x.r)), 0.1);
                  const c = b.r >= 0 ? "var(--long)" : "var(--short)";
                  return (
                    <div key={b.name} className="stack" style={{ gap: 5 }}>
                      <div className="row small">
                        <span style={{ color: "var(--text-2)" }}>
                          {t(b.name)} <span className="dim">· {b.n}</span>
                        </span>
                        <span className="mono" style={{ color: c }}>
                          {rFmt(b.r)}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(Math.abs(b.r) / max) * 100}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {stats.mistakes.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="lbl">{t("Lỗi lặp lại")}</span>
                <div className="hstack" style={{ gap: 6 }}>
                  {stats.mistakes.map((m) => (
                    <span key={m.name} className="pill">
                      {m.name} · {m.n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="small dim">{t("Chưa đủ dữ liệu. Thống kê hiện khi có journal.")}</p>
        )}
      </section>
      <section className="card" aria-label={t("Khung Composite")}>
        {session && session.logged > 0 ? (
          <div className="stack" style={{ gap: 10 }}>
            <span className="lbl">{t("Khung Composite · {n} phiên đã log", { n: session.logged })}</span>
            <span className="small dim">
              {session.logged < 30
                ? t("Đang tập xếp loại (mốc 30 phiên)")
                : session.logged < 100
                  ? t("Xem xu hướng, chưa đủ kết luận")
                  : t("Đủ mẫu để so tỉ lệ")}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <RateTile k={t("Bias đúng")} r={session.biasOk} t={t} />
              <RateTile k={t("Mép HVN giữ")} r={session.edgeHeld} t={t} />
              <RateTile k={t("Ra mép → HVN kế")} r={session.reachNext} t={t} />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="lbl">{t("R theo setup")}</span>
              {session.bySetup.map((b) => (
                <div key={b.key} className="row small">
                  <span style={{ color: "var(--text-2)" }}>
                    {b.name}{" "}
                    <span className="dim">
                      · {b.n} {t("lệnh")}
                      {b.n ? ` · ${t("thắng")} ${b.win.pct}%` : ""}
                    </span>
                  </span>
                  <span className={"mono " + (b.avgR == null ? "dim" : b.avgR >= 0 ? "long" : "short")}>{b.avgR == null ? "—" : rFmt(b.avgR)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="small dim">{t("Chưa có phiên nào được log khung Composite.")}</p>
        )}
      </section>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="tile">
      <span className="lbl">{k}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
        {v}
      </span>
    </div>
  );
}

function RateTile({ k, r, t }: { k: string; r: Rate; t: (s: string, v?: Record<string, string | number>) => string }) {
  return (
    <div className="tile" title={r.n ? t("Khoảng tin cậy 95%: {lo}–{hi}%", { lo: r.lo ?? 0, hi: r.hi ?? 0 }) : undefined}>
      <span className="lbl">{k}</span>
      <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
        {r.pct == null ? "—" : r.pct + "%"}
      </span>
      <span className="small dim">{r.n ? `${r.k}/${r.n} · ${r.lo}–${r.hi}%` : t("chưa có mẫu")}</span>
    </div>
  );
}
