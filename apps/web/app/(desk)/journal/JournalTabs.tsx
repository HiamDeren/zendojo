"use client";
// Tab con của Journal (UI v3, gạch chân accent, cao 44 px)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUi } from "../_components/Ui";

export default function JournalTabs() {
  const path = usePathname();
  const { t } = useUi();
  const tabs = [
    { href: "/journal", label: t("Nhật ký") },
    { href: "/journal/pnl", label: t("PnL & lịch") },
    { href: "/journal/stats", label: t("Thống kê") },
  ];
  return (
    <nav className="tabs" aria-label="Journal">
      {tabs.map((x) => (
        <Link key={x.href} href={x.href} className={path === x.href ? "on" : ""} aria-current={path === x.href ? "page" : undefined}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
