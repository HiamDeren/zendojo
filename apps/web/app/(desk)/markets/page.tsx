// Markets đa tài sản (UI v3, docs/design/v3/Markets.dc.html, D60).
// Tab: Tổng quan · Chỉ số · Cổ phiếu · Hàng hoá · Crypto · FX & Lãi suất (?tab=, giữ ?tab=stocks / ?tab=crypto cũ).
// Giá chỉ số / hàng hoá / FX lấy qua ETF đại diện (lib/markets/provider.ts); crypto qua CoinGecko. Mỗi khối stream bằng <Suspense>.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { marketConfigured } from "@/lib/market";
import { CRYPTO_CATS, cryptoConfigured, fmtUsd, getCrypto, getOverview, NQ_MAP, SECTORS, sparkPath } from "@/lib/markets";
import { type AssetGroup, byGroup, GROUP_LABEL, INSTRUMENTS, marketProvider, type Px, sessionsOpen } from "@/lib/markets/provider";
import { getT } from "@/lib/prefs-server";
import { getQuotes } from "@/lib/stock";
import { fmtTime } from "@/lib/time";
import Icon from "../_components/Icon";
import { Chg, DivergingBar, PageHead, Spark } from "../_components/kit";
import { CardSkeleton } from "../_components/Skeleton";
import { NotConfigured } from "../_components/States";

export const metadata: Metadata = { title: "Markets" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "over", label: "Tổng quan" },
  { id: "indices", label: "Chỉ số" },
  { id: "stocks", label: "Cổ phiếu" },
  { id: "commod", label: "Hàng hoá" },
  { id: "crypto", label: "Crypto" },
  { id: "fx", label: "FX & Lãi suất" },
] as const;

type T = (s: string, v?: Record<string, string | number>) => string;
const pct = (v: number | null) => (v === null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%");
const tone = (v: number | null) => (v === null ? "dim" : v >= 0 ? "long" : "short");
const fmtPx = (v: number | null) => (v === null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// Màu ô heatmap: 2 cực xanh / cam, đậm dần theo |%|, gần 0 là xám
function heat(v: number | null) {
  if (v === null || Math.abs(v) < 0.1) return "h0";
  const a = Math.abs(v);
  const k = a >= 2 ? 3 : a >= 1 ? 2 : 1;
  return (v > 0 ? "hp" : "hn") + k;
}

export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ tab?: string; sector?: string; cat?: string; map?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((x) => x.id === sp.tab) ? (sp.tab as (typeof TABS)[number]["id"]) : "over";
  const { t } = await getT();
  const href = (o: Record<string, string>) => "/markets?" + new URLSearchParams({ tab, ...o }).toString();
  const prov = marketProvider();
  const now = Date.now();

  return (
    <>
      <PageHead
        kicker={t("Thị trường · đa tài sản")}
        title="Markets"
        sub={
          <>
            {t("Cập nhật")} <span className="mono t2">{fmtTime(now, "America/New_York")} ET</span> · {t("chỉ số, hàng hoá, crypto, FX trên một màn hình")}
          </>
        }
        actions={sessionsOpen(new Date(now)).map((s) => (
          <span key={s.name} className="pill">
            <span className="dot" style={{ background: s.open ? "var(--long)" : "var(--ghost)" }} aria-hidden="true" />
            {s.name}{" "}
            <span className="dim" style={{ fontWeight: 500 }}>
              {s.open ? t("Đang mở") : t("Đang đóng")}
            </span>
          </span>
        ))}
      />
      <div className="ch wrap">
        <nav className="seg" aria-label={t("Loại tài sản")}>
          {TABS.map((x) => (
            <Link
              key={x.id}
              href={`/markets?tab=${x.id}`}
              className={"seg-link" + (x.id === tab ? " on" : "")}
              aria-current={x.id === tab ? "page" : undefined}
            >
              {t(x.label)}
            </Link>
          ))}
        </nav>
        <form className="search" action="/stock" role="search" style={{ width: 260, maxWidth: "100%" }}>
          <Icon name="search" size={16} />
          <input type="search" name="q" placeholder={t("Tìm mã: AAPL, NVDA, SPY…")} aria-label={t("Tìm mã")} />
        </form>
      </div>
      {!marketConfigured() && tab !== "crypto" ? (
        <NotConfigured what="Markets" />
      ) : (
        <Suspense key={`${tab}-${sp.sector || ""}-${sp.cat || ""}-${sp.map || ""}`} fallback={<MarketsSkeleton />}>
          {tab === "crypto" ? (
            <Crypto cat={sp.cat || ""} t={t} href={href} />
          ) : tab === "stocks" ? (
            <Stocks sector={sp.sector || "tech"} t={t} href={href} />
          ) : tab === "indices" ? (
            <>
              <GroupTable group="us" t={t} />
              <GroupTable group="global" t={t} />
            </>
          ) : tab === "commod" ? (
            <GroupTable group="commod" t={t} />
          ) : tab === "fx" ? (
            <GroupTable group="fx" t={t} />
          ) : (
            <Overview t={t} map={sp.map === "nq" ? "nq" : "spx"} viaLabel={prov.label} />
          )}
        </Suspense>
      )}
    </>
  );
}

function MarketsSkeleton() {
  return (
    <div className="g4" aria-busy="true">
      <CardSkeleton lines={5} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={5} />
    </div>
  );
}

// ---------- Tổng quan ----------
function Overview({ t, map, viaLabel }: { t: T; map: "spx" | "nq"; viaLabel: string }) {
  return (
    <>
      <Suspense fallback={<CardSkeleton label={t("Hiệu suất liên thị trường")} lines={8} />}>
        <CrossMarket t={t} viaLabel={viaLabel} />
      </Suspense>
      <p className="small dim" style={{ margin: "-8px 0 0" }}>
        {t("Chỉ số Mỹ, hàng hoá, FX lấy giá ETF đại diện (cột 'Đại diện cho' ở từng tab); crypto từ CoinGecko.")}
      </p>
      <div className="g4">
        <Suspense fallback={<CardSkeleton label={t(GROUP_LABEL.us)} lines={5} />}>
          <GroupCard group="us" t={t} tab="indices" />
        </Suspense>
        <Suspense fallback={<CardSkeleton label={t(GROUP_LABEL.commod)} lines={5} />}>
          <GroupCard group="commod" t={t} tab="commod" />
        </Suspense>
        <Suspense fallback={<CardSkeleton label="Crypto" lines={5} />}>
          <CryptoCard t={t} />
        </Suspense>
        <Suspense fallback={<CardSkeleton label={t(GROUP_LABEL.fx)} lines={5} />}>
          <GroupCard group="fx" t={t} tab="fx" />
        </Suspense>
      </div>
      <Suspense fallback={<CardSkeleton label={t("Sector & biến động mạnh")} lines={8} tall />}>
        <SectorsAndMovers t={t} map={map} />
      </Suspense>
      <Suspense fallback={<CardSkeleton label={t(GROUP_LABEL.global)} lines={3} />}>
        <GlobalCard t={t} />
      </Suspense>
    </>
  );
}

// Hiệu suất liên thị trường: đại diện mỗi nhóm + BTC / ETH, xếp theo % thay đổi (diverging bar)
async function CrossMarket({ t, viaLabel }: { t: T; viaLabel: string }) {
  const prov = marketProvider();
  const pick = ["SPY", "QQQ", "DIA", "IWM", "GLD", "SLV", "USO", "UNG", "UUP", "TLT", "FXE", "FXY"];
  const [etf, crypto] = await Promise.all([
    prov.quotes(INSTRUMENTS.filter((x) => pick.includes(x.sym))),
    cryptoConfigured() ? getCrypto("").catch(() => null) : Promise.resolve(null),
  ]);
  const rows: { sym: string; name: string; chg: number | null }[] = [
    ...etf.map((x) => ({ sym: x.sym, name: `${t(x.name)} · ${x.ref}`, chg: x.chg })),
    ...(crypto?.coins || []).filter((c) => ["BTC", "ETH"].includes(c.symbol)).map((c) => ({ sym: c.symbol, name: c.name, chg: c.h24 })),
  ]
    .filter((r) => r.chg !== null)
    .sort((a, b) => (b.chg ?? 0) - (a.chg ?? 0));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.chg ?? 0)));
  return (
    <section className="card" aria-label={t("Hiệu suất liên thị trường")}>
      <div className="ch wrap">
        <div className="stack" style={{ gap: 4 }}>
          <span className="lbl">{t("Hiệu suất liên thị trường")}</span>
          <span className="small muted">{t("Chỉ số, hàng hoá, FX ({via}), crypto · xếp theo % thay đổi", { via: t(viaLabel) })}</span>
        </div>
        <div className="seg" role="group" aria-label={t("Khoảng thời gian")}>
          {(["1D", "1W", "1M", "YTD"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === "1D"}
              disabled={!marketProvider().periods.includes(p)}
              title={p === "1D" ? undefined : t("Cần nguồn dữ liệu có lịch sử giá (chờ chọn nguồn)")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="xm-grid">
          {rows.map((r) => (
            <div key={r.sym} className="xm-row">
              <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>
                {r.sym}
              </span>
              <span className="small dim ellipsis">{r.name}</span>
              <DivergingBar value={r.chg} max={max} />
              <span style={{ textAlign: "right", fontSize: 13 }}>
                <Chg v={r.chg} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="small dim">{t("Chưa lấy được giá.")}</p>
      )}
    </section>
  );
}

function PxRow({ x, href, t }: { x: Px; href: string; t: T }) {
  return (
    <Link href={href} className={"drow px-row" + (x.spark.length > 1 ? "" : " nospark")}>
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>
          {x.sym}
        </span>
        <span className="small dim ellipsis">
          {t(x.name)} · {x.ref}
        </span>
      </span>
      {x.spark.length > 1 && <Spark values={x.spark} />}
      <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {fmtPx(x.price)}
        </span>
        <span style={{ fontSize: 12 }}>
          <Chg v={x.chg} />
        </span>
      </span>
    </Link>
  );
}

async function GroupCard({ group, t, tab }: { group: AssetGroup; t: T; tab: string }) {
  const prov = marketProvider();
  const rows = await prov.quotes(byGroup(group).slice(0, 5));
  return (
    <section className="card" aria-label={t(GROUP_LABEL[group])} style={{ gap: 8 }}>
      <div className="ch" style={{ padding: "0 8px" }}>
        <span className="lbl" title={t(prov.label)}>
          {t(GROUP_LABEL[group])}
        </span>
        <Link className="more" href={`/markets?tab=${tab}`}>
          {t("Xem thêm")} <span aria-hidden="true">›</span>
        </Link>
      </div>
      <div className="stack" style={{ gap: 0 }}>
        {rows.map((x) => (
          <PxRow key={x.sym} x={x} href={`/stock/${x.sym}`} t={t} />
        ))}
      </div>
    </section>
  );
}

async function CryptoCard({ t }: { t: T }) {
  if (!cryptoConfigured())
    return (
      <section className="card" aria-label="Crypto">
        <span className="lbl">Crypto</span>
        <p className="small dim">{t("Chưa có COINGECKO_API_KEY trên Vercel.")}</p>
      </section>
    );
  const d = await getCrypto("");
  const coins = d.coins.slice(0, 4);
  return (
    <section className="card" aria-label="Crypto" style={{ gap: 8 }}>
      <div className="ch" style={{ padding: "0 8px" }}>
        <span className="lbl">Crypto</span>
        <Link className="more" href="/markets?tab=crypto">
          {t("Xem thêm")} <span aria-hidden="true">›</span>
        </Link>
      </div>
      {d.error ? (
        <p className="small short" style={{ padding: "0 8px" }}>
          {d.error}
        </p>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {coins.map((c) => (
            <Link key={c.id} href="/markets?tab=crypto" className="drow px-row">
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>
                  {c.symbol}
                </span>
                <span className="small dim ellipsis">{c.name}</span>
              </span>
              <Spark values={c.spark} />
              <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {fmtUsd(c.price)}
                </span>
                <span style={{ fontSize: 12 }}>
                  <Chg v={c.h24} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
      <div className="ch" style={{ padding: "8px 8px 0", borderTop: "1px solid var(--line-2)" }}>
        <span className="small dim">{t("Vốn hoá · BTC dominance")}</span>
        <span className="mono small t2">
          {fmtUsd(d.global.cap, true)} · {d.global.btc === null ? "—" : `${d.global.btc.toFixed(1)}%`}
        </span>
      </div>
    </section>
  );
}

async function SectorsAndMovers({ t, map }: { t: T; map: "spx" | "nq" }) {
  const { by } = await getOverview();
  const nq = NQ_MAP.map(([s, w, h]) => ({ s, w, h, q: by.get(s) })).filter((x) => x.q);
  const pool =
    map === "nq"
      ? nq.map((x) => ({ s: x.s, c: x.q!.c, dp: x.q!.dp }))
      : SECTORS.map((s) => ({ s: s.etf, name: s.name, c: by.get(s.etf)?.c ?? null, dp: by.get(s.etf)?.dp ?? null })).filter((x) => x.c !== null);
  const movers = [...pool].sort((a, b) => (b.dp ?? 0) - (a.dp ?? 0));
  const seg = (
    <nav className="seg" aria-label={t("Rổ")}>
      <Link href="/markets?map=spx" className={"seg-link" + (map === "spx" ? " on" : "")} aria-current={map === "spx" ? "true" : undefined}>
        S&amp;P 500
      </Link>
      <Link href="/markets?map=nq" className={"seg-link" + (map === "nq" ? " on" : "")} aria-current={map === "nq" ? "true" : undefined}>
        NQ 100
      </Link>
    </nav>
  );
  return (
    <div className="g2-1">
      <section className="card" aria-label={map === "nq" ? t("Bản đồ NQ top") : t("Sector S&P 500")}>
        <div className="ch wrap">
          <span className="lbl">{map === "nq" ? t("NQ top · ô to theo nhóm vốn hoá") : t("S&P 500 · 11 sector qua ETF")}</span>
          {seg}
        </div>
        {map === "nq" ? (
          <div className="heat heat-8">
            {nq.map((x) => (
              <Link key={x.s} href={`/stock/${x.s}`} className={"heat-c center " + heat(x.q!.dp)} style={{ gridColumn: `span ${x.w}`, gridRow: `span ${x.h}` }}>
                <b className="mono" style={{ fontSize: x.w * x.h >= 4 ? 18 : 13 }}>
                  {x.s}
                </b>
                <span className="mono small">{pct(x.q!.dp)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="heat heat-6">
            {SECTORS.map((s) => {
              const q = by.get(s.etf);
              return (
                <Link
                  key={s.key}
                  href={`/markets?tab=stocks&sector=${s.key}`}
                  className={"heat-c " + heat(q?.dp ?? null)}
                  style={{ gridColumn: `span ${s.w}`, gridRow: `span ${s.h}` }}
                >
                  <span className="heat-n">{t(s.name)}</span>
                  <span className="row">
                    <span className="mono small">{s.etf}</span>
                    <b className="mono">{pct(q?.dp ?? null)}</b>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <section className="card" aria-label={t("Biến động mạnh")} style={{ gap: 4 }}>
        <span className="lbl" style={{ paddingBottom: 6 }}>
          {t("Tăng mạnh")}
        </span>
        {movers.slice(0, 4).map((m) => (
          <MoverRow key={m.s} s={m.s} c={m.c} dp={m.dp} />
        ))}
        <span className="lbl" style={{ padding: "12px 0 6px" }}>
          {t("Giảm mạnh")}
        </span>
        {movers
          .slice(-4)
          .reverse()
          .map((m) => (
            <MoverRow key={m.s} s={m.s} c={m.c} dp={m.dp} />
          ))}
      </section>
    </div>
  );
}

function MoverRow({ s, c, dp }: { s: string; c: number | null; dp: number | null }) {
  return (
    <Link href={`/stock/${s}`} className="drow" style={{ gridTemplateColumns: "64px minmax(0,1fr) 72px" }}>
      <span className="mono" style={{ fontWeight: 600 }}>
        {s}
      </span>
      <span className="mono">{c === null ? "—" : c.toFixed(2)}</span>
      <span className={"mono small " + tone(dp)} style={{ textAlign: "right" }}>
        {pct(dp)}
      </span>
    </Link>
  );
}

async function GlobalCard({ t }: { t: T }) {
  const prov = marketProvider();
  const rows = await prov.quotes(byGroup("global"));
  return (
    <section className="card" aria-label={t(GROUP_LABEL.global)}>
      <div className="ch">
        <span className="lbl">
          {t(GROUP_LABEL.global)} · {t(prov.label)}
        </span>
        <Link className="more" href="/markets?tab=indices">
          {t("Xem thêm")} <span aria-hidden="true">›</span>
        </Link>
      </div>
      <div className="gl-grid">
        {rows.map((x) => (
          <Link key={x.sym} href={`/stock/${x.sym}`} className="gl-tile">
            <span className="small dim ellipsis">{x.ref}</span>
            <span className="mono" style={{ fontWeight: 600 }}>
              {fmtPx(x.price)}
            </span>
            <span className="row small">
              <span className="mono dim">{x.sym}</span>
              <Chg v={x.chg} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Bảng một nhóm tài sản (tab Chỉ số / Hàng hoá / FX & Lãi suất)
async function GroupTable({ group, t }: { group: AssetGroup; t: T }) {
  const prov = marketProvider();
  const rows = await prov.quotes(byGroup(group));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.chg ?? 0)));
  return (
    <section className="card flush" aria-label={t(GROUP_LABEL[group])}>
      <div className="ch">
        <span className="lbl">
          {t(GROUP_LABEL[group])} · {t(prov.label)}
        </span>
        <span className="small dim">{t("Giá là giá ETF đại diện, không phải giá futures / tỷ giá")}</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ETF</th>
              <th>{t("Tài sản")}</th>
              <th>{t("Đại diện cho")}</th>
              <th className="r">{t("Giá")}</th>
              <th className="r">{t("Hôm nay")}</th>
              <th style={{ width: 180 }} aria-label={t("Biểu đồ % thay đổi")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.sym}>
                <td>
                  <Link className="mono" href={`/stock/${x.sym}`} style={{ fontWeight: 700, color: "var(--text)" }}>
                    {x.sym}
                  </Link>
                </td>
                <td>{t(x.name)}</td>
                <td className="mono dim">{x.ref}</td>
                <td className="r">{fmtPx(x.price)}</td>
                <td className="r">
                  <Chg v={x.chg} />
                </td>
                <td>
                  <DivergingBar value={x.chg} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Cổ phiếu, Crypto (giữ từ bản trước) ----------
async function Stocks({ sector, t, href }: { sector: string; t: T; href: (o: Record<string, string>) => string }) {
  const sec = SECTORS.find((s) => s.key === sector) || SECTORS[0];
  const [etfs, rows] = await Promise.all([
    getQuotes(
      SECTORS.map((s) => s.etf),
      180,
    ),
    getQuotes(
      sec.stocks.map((x) => x[0]),
      180,
    ),
  ]);
  const etf = new Map(etfs.map((q) => [q.symbol, q]));
  const by = new Map(rows.map((q) => [q.symbol, q]));
  return (
    <section className="card" aria-label={t("Cổ phiếu theo sector")} style={{ padding: 0, gap: 0 }}>
      <div className="chips mk-chips">
        {SECTORS.map((s) => {
          const q = etf.get(s.etf);
          const on = s.key === sec.key;
          return (
            <Link key={s.key} href={href({ sector: s.key })} className={"chip" + (on ? " on" : "")} aria-current={on ? "true" : undefined}>
              {t(s.name)} <span className={"mono " + tone(q?.dp ?? null)}>{pct(q?.dp ?? null)}</span>
            </Link>
          );
        })}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("Mã")}</th>
              <th>{t("Công ty")}</th>
              <th className="r">{t("Giá")}</th>
              <th className="r">{t("Hôm nay")}</th>
            </tr>
          </thead>
          <tbody>
            {sec.stocks.map(([s, name]) => {
              const q = by.get(s);
              return (
                <tr key={s}>
                  <td>
                    <Link className="mono" href={`/stock/${s}`} style={{ fontWeight: 700, color: "var(--text)" }}>
                      {s}
                    </Link>
                  </td>
                  <td className="muted">{name}</td>
                  <td className="r mono">{q ? q.c.toFixed(2) : "—"}</td>
                  <td className={"r mono " + tone(q?.dp ?? null)}>{pct(q?.dp ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Crypto({ cat, t, href }: { cat: string; t: T; href: (o: Record<string, string>) => string }) {
  if (!cryptoConfigured()) return <NotConfigured what="Crypto (COINGECKO_API_KEY)" />;
  const d = await getCrypto(cat);
  const g = d.global;
  const stats: [string, string, number | null][] = [
    [t("Vốn hoá crypto"), fmtUsd(g.cap, true), g.capCh],
    [t("Volume 24h"), fmtUsd(g.vol, true), null],
    ["BTC dominance", g.btc === null ? "—" : g.btc.toFixed(1) + "%", null],
    ["ETH dominance", g.eth === null ? "—" : g.eth.toFixed(1) + "%", null],
  ];
  return (
    <>
      <div className="mk-strip">
        {stats.map(([k, v, ch]) => (
          <div key={k} className="mk-tile">
            <span className="small dim">{k}</span>
            <span className="mono mk-px">{v}</span>
            {ch !== null ? <span className={"mono small " + tone(ch)}>{pct(ch)} 24h</span> : <span className="small">&nbsp;</span>}
          </div>
        ))}
      </div>
      {d.trending.length > 0 && (
        <div className="hstack small" style={{ gap: 8 }}>
          <span className="lbl">{t("Đang được tìm nhiều")}</span>
          {d.trending.map((s) => (
            <span key={s} className="chip mono">
              {s}
            </span>
          ))}
        </div>
      )}
      <section className="card" aria-label={t("Bảng coin")} style={{ padding: 0, gap: 0 }}>
        <div className="chips mk-chips">
          {CRYPTO_CATS.map((c) => {
            const on = c.id === cat || (!c.id && !CRYPTO_CATS.some((x) => x.id && x.id === cat));
            const ch = c.id ? (d.catChange.get(c.id) ?? null) : null;
            return (
              <Link key={c.id || "all"} href={href({ cat: c.id })} className={"chip" + (on ? " on" : "")} aria-current={on ? "true" : undefined}>
                {t(c.label)} {c.id && <span className={"mono " + tone(ch)}>{pct(ch)}</span>}
              </Link>
            );
          })}
        </div>
        {d.error ? (
          <div className="notice" style={{ margin: 16 }}>
            {t("Không tải được dữ liệu crypto")}: {d.error}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Coin</th>
                  <th className="r">{t("Giá")}</th>
                  <th className="r">1h</th>
                  <th className="r">24h</th>
                  <th className="r">{t("7 ngày")}</th>
                  <th className="r">{t("Vốn hoá")}</th>
                  <th className="r">Volume 24h</th>
                  <th className="r">{t("7 ngày qua")}</th>
                </tr>
              </thead>
              <tbody>
                {d.coins.map((c) => (
                  <tr key={c.id}>
                    <td className="mono dim">{c.rank ?? "—"}</td>
                    <td>
                      <span className="hstack" style={{ gap: 8, flexWrap: "nowrap" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.image && <img src={c.image} alt="" width={20} height={20} style={{ borderRadius: "50%" }} referrerPolicy="no-referrer" />}
                        <b style={{ fontWeight: 600 }}>{c.name}</b> <span className="mono small dim">{c.symbol}</span>
                      </span>
                    </td>
                    <td className="r mono">{fmtUsd(c.price)}</td>
                    <td className={"r mono " + tone(c.h1)}>{pct(c.h1)}</td>
                    <td className={"r mono " + tone(c.h24)}>{pct(c.h24)}</td>
                    <td className={"r mono " + tone(c.d7)}>{pct(c.d7)}</td>
                    <td className="r mono">{fmtUsd(c.cap, true)}</td>
                    <td className="r mono">{fmtUsd(c.vol, true)}</td>
                    <td className="r">
                      <svg width="100" height="28" viewBox="0 0 100 28" aria-hidden="true">
                        <path d={sparkPath(c.spark, 100, 28)} fill="none" className={"spark " + tone(c.d7)} />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
