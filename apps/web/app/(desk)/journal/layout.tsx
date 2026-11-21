// Journal (UI v3): PageHead + tab con Nhật ký · PnL & lịch · Thống kê. Trang chỉ chủ sở hữu (D48).
// Nút "Lưu journal" của tab Nhật ký được JournalEditor gắn vào ô #journal-actions (portal).
import { requireOwner } from "@/lib/auth";
import { getT } from "@/lib/prefs-server";
import { PageHead } from "../_components/kit";
import JournalTabs from "./JournalTabs";

export default async function JournalLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const { t } = await getT();
  return (
    <>
      <PageHead
        kicker={t("Giao dịch")}
        title="Journal"
        sub={t("Nhật ký phiên, PnL và thống kê khung Composite × pRTH × OVN")}
        actions={<div id="journal-actions" className="ph-actions" />}
      />
      <JournalTabs />
      {children}
    </>
  );
}
