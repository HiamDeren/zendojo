"use client";
// Checklist xác nhận lúc 10:00 ET (khung Composite × pRTH × OVN: open type + VWAP RTH + EMA 9/34).
// Trạng thái lưu localStorage theo ngày (khoá ofs.chk10.<ngày>); trình duyệt chặn storage thì vẫn tick được trong phiên.
import { useEffect, useState } from "react";
import { useUi } from "./Ui";

export const CHECK_10 = ["Open type rõ hướng (OD / OTD / ORR), không phải OA", "Giá đúng phía VWAP RTH theo bias", "EMA 9 / 34 (5') cùng hướng bias"] as const;

const key = (date: string) => `ofs.chk10.${date}`;

export default function Checklist10({ date, compact = false }: { date: string; compact?: boolean }) {
  const { t } = useUi();
  const [done, setDone] = useState<boolean[]>(() => CHECK_10.map(() => false));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(date));
      const v = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(v)) setDone(CHECK_10.map((_, i) => v[i] === true));
    } catch {
      /* storage bị chặn: bắt đầu trống */
    }
  }, [date]);
  const toggle = (i: number) =>
    setDone((cur) => {
      const next = cur.map((x, j) => (j === i ? !x : x));
      try {
        localStorage.setItem(key(date), JSON.stringify(next));
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  return (
    <fieldset className="chk10">
      <legend className="lbl">
        {t("Xác nhận lúc 10:00")}
        {!compact && (
          <span className="mono dim" style={{ marginLeft: 8, letterSpacing: 0 }}>
            {done.filter(Boolean).length}/{CHECK_10.length}
          </span>
        )}
      </legend>
      {CHECK_10.map((label, i) => (
        <label key={label} className="chk10-row">
          <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} />
          <span>{t(label)}</span>
        </label>
      ))}
    </fieldset>
  );
}
