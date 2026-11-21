"use client";
// "Tiếp tục học" (UI v3): đọc chương xem gần nhất mà trang học cũ ghi vào localStorage (khoá ofs.last, core.js) cùng origin.
// Chưa có / storage bị chặn: gợi ý bắt đầu từ chương đầu khoá TPO Level.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUi } from "../_components/Ui";

type Last = { href?: string; page?: string; course?: string; title?: string; no?: string; ts?: number };

export default function ContinueCard() {
  const { t } = useUi();
  const [last, setLast] = useState<Last | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ofs.last") || "null") as Last | null;
      if (v && typeof v.href === "string") setLast(v);
    } catch {
      /* storage bị chặn */
    }
  }, []);
  // levels.html#ema → /knowledge/levels#ema
  const m = last?.href?.match(/^([a-z]+)(?:\.en)?\.html#?([a-z0-9-]*)$/);
  const href = m ? `/knowledge/${m[1]}${m[2] ? `#${m[2]}` : ""}` : "/knowledge/levels#tong-quan";
  return (
    <section className="card continue" aria-label={t("Tiếp tục học")}>
      <span className="lbl">{t("Tiếp tục học")}</span>
      {last && m ? (
        <>
          <h2 className="h2">
            <span className="mono dim">{last.no}</span> {last.title}
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            {last.course}
            {last.ts ? ` · ${new Date(last.ts).toLocaleDateString("vi-VN")}` : ""}
          </p>
        </>
      ) : (
        <h2 className="h2">{t("Bắt đầu với TPO Level · Tổng quan")}</h2>
      )}
      <div>
        <Link className="btn primary" href={href}>
          {last && m ? t("Học tiếp") : t("Bắt đầu")} ›
        </Link>
      </div>
    </section>
  );
}
