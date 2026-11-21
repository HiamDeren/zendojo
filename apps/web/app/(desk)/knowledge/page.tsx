import type { Metadata } from "next";
import Link from "next/link";
import { COURSES } from "@/lib/courses";
import { getT } from "@/lib/prefs-server";
import { PageHead } from "../_components/kit";
import ContinueCard from "./ContinueCard";
import KnowledgeTabs from "./KnowledgeTabs";

export const metadata: Metadata = { title: "Knowledge" };

const FLOW = [
  { n: "01", t: "AMT", s: "Thị trường đang cân bằng hay mất cân bằng", hi: false },
  { n: "02", t: "Context", s: "TPO / VPO: value, POC, HVN / LVN, day type", hi: true },
  { n: "03", t: "Plan", s: "Bias, kịch bản chính, điểm đổi ý", hi: false },
  { n: "04", t: "Entry", s: "Trigger orderflow tại level của plan", hi: true },
  { n: "05", t: "Journal", s: "Recap, R, lỗi, bài học → thống kê", hi: false },
];

export default async function KnowledgePage() {
  const { t } = await getT();
  return (
    <>
      <PageHead
        kicker={t("Học")}
        title="Knowledge"
        sub={t("Lộ trình AMT → Context → Entry, khoá học, trắc nghiệm")}
        actions={
          <Link className="btn" href="/knowledge/quiz">
            {t("Làm quiz ôn tập")}
          </Link>
        }
      />
      <div className="g2-1">
        <ContinueCard />
        <section className="card" aria-label={t("Trắc nghiệm")}>
          <span className="lbl">{t("Trắc nghiệm")}</span>
          <div className="stack" style={{ gap: 2 }}>
            <Link className="drow" href="/knowledge/quiz#luyen-tap" style={{ gridTemplateColumns: "28px minmax(0,1fr)" }}>
              <span className="mono acc">A</span>
              {t("Luyện tập")}
            </Link>
            <Link className="drow" href="/knowledge/quiz#thi-thu" style={{ gridTemplateColumns: "28px minmax(0,1fr)" }}>
              <span className="mono acc">B</span>
              {t("Thi thử")}
            </Link>
            <Link className="drow" href="/knowledge/quiz#cau-sai" style={{ gridTemplateColumns: "28px minmax(0,1fr)" }}>
              <span className="mono acc">C</span>
              {t("Ôn câu sai")}
            </Link>
          </div>
          <Link className="more" href="/knowledge/tools#thuat-ngu">
            {t("Thuật ngữ orderflow & TPO")} <span aria-hidden="true">›</span>
          </Link>
        </section>
      </div>
      <section className="card" aria-label={t("Luồng mỗi ngày")}>
        <span className="lbl">{t("Luồng mỗi ngày")}</span>
        <ol className="flow">
          {FLOW.map((f) => (
            <li key={f.n} className={f.hi ? "hi" : ""}>
              <span className="mono small" style={{ color: f.hi ? "var(--accent)" : "var(--dim)" }}>
                {f.n}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{f.t}</span>
              <span className="small muted" style={{ lineHeight: 1.45 }}>
                {t(f.s)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <KnowledgeTabs />
      <section className="course-cards" aria-label={t("Khoá học")}>
        {COURSES.map((c) => (
          <Link key={c.key} href={`/knowledge/${c.key}`} className="card course-card">
            <span className="lbl">
              {t(c.track)} · {t("{n} chương", { n: c.chapters.length })}
            </span>
            <span className="h3">{t(c.title)}</span>
            <span className="small dim">{t(c.sub)}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
