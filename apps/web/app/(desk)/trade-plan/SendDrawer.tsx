"use client";
// "Gửi JSON tay" (UI v3): luồng gửi plan cũ (dán JSON / ATAS X → /api/plan) đặt trong ngăn kéo <dialog> bên phải.
import { useRef } from "react";
import Icon from "../_components/Icon";
import { useUi } from "../_components/Ui";
import PlanView, { type PlanItem } from "./PlanView";

export default function SendDrawer({ today, date, plans }: { today: string; date: string; plans: PlanItem[] | null }) {
  const { t } = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}>
        <Icon name="plus" size={16} /> {t("Gửi JSON tay")}
      </button>
      <dialog ref={ref} className="drawer" aria-label={t("Gửi plan")}>
        <div className="drawer-in">
          <div className="ch">
            <span className="h2">{t("Gửi plan")}</span>
            <button type="button" className="btn icon sm" aria-label={t("Đóng")} onClick={() => ref.current?.close()}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <PlanView today={today} initialDate={date} initialPlans={plans} mode="send" />
        </div>
      </dialog>
    </>
  );
}
