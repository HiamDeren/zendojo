// Markets đa tài sản (UI v3, D60). Lớp provider tách khỏi giao diện để sau này thay bằng nguồn futures / FX thật
// (ES, NQ, GC, CL, DXY…) mà không sửa trang. Hiện tại: ETF đại diện qua Finnhub /quote (không cần key mới),
// giao diện ghi rõ "qua ETF". [CẦN XÁC NHẬN] nguồn futures / hàng hoá / FX / chỉ số ngoài Mỹ: xem claude/08-roadmap.md.
// Giới hạn của Finnhub free: chỉ có giá hiện tại + % hôm nay, không có lịch sử → không có sparkline, không có 1W / 1M / YTD.
import { getQuotes } from "@/lib/stock";

export type AssetGroup = "us" | "commod" | "fx" | "global";

// sym = mã hiển thị (ETF đang dùng); ref = tài sản gốc mà ETF đại diện (để nói rõ trên UI)
export type Instrument = { sym: string; name: string; ref: string; group: AssetGroup };

// biome-ignore format: bảng dữ liệu, giữ một dòng / mã
export const INSTRUMENTS: Instrument[] = [
  // Chỉ số Mỹ
  { sym: "SPY", name: "S&P 500", ref: "ES", group: "us" },
  { sym: "QQQ", name: "Nasdaq 100", ref: "NQ", group: "us" },
  { sym: "DIA", name: "Dow Jones", ref: "YM", group: "us" },
  { sym: "IWM", name: "Russell 2000", ref: "RTY", group: "us" },
  { sym: "VIXY", name: "VIX futures ngắn hạn", ref: "VIX", group: "us" },
  // Hàng hoá
  { sym: "GLD", name: "Vàng", ref: "GC", group: "commod" },
  { sym: "SLV", name: "Bạc", ref: "SI", group: "commod" },
  { sym: "USO", name: "Dầu WTI", ref: "CL", group: "commod" },
  { sym: "UNG", name: "Khí tự nhiên", ref: "NG", group: "commod" },
  { sym: "CPER", name: "Đồng", ref: "HG", group: "commod" },
  // FX & lãi suất (giá ETF, không phải tỷ giá / lợi suất)
  { sym: "UUP", name: "Đô la Mỹ (DXY)", ref: "DXY", group: "fx" },
  { sym: "FXE", name: "Euro", ref: "EUR/USD", group: "fx" },
  { sym: "FXY", name: "Yên Nhật", ref: "JPY/USD", group: "fx" },
  { sym: "SHY", name: "Trái phiếu Mỹ 1–3 năm", ref: "US2Y", group: "fx" },
  { sym: "IEF", name: "Trái phiếu Mỹ 7–10 năm", ref: "US10Y", group: "fx" },
  { sym: "TLT", name: "Trái phiếu Mỹ 20+ năm", ref: "US30Y", group: "fx" },
  // Chỉ số toàn cầu
  { sym: "EWJ", name: "Nhật Bản", ref: "Nikkei 225", group: "global" },
  { sym: "EWH", name: "Hồng Kông", ref: "Hang Seng", group: "global" },
  { sym: "FXI", name: "Trung Quốc large cap", ref: "Shanghai / CSI", group: "global" },
  { sym: "VNM", name: "Việt Nam", ref: "VN-Index", group: "global" },
  { sym: "EWG", name: "Đức", ref: "DAX", group: "global" },
  { sym: "EWU", name: "Anh", ref: "FTSE 100", group: "global" },
  { sym: "FEZ", name: "Euro Stoxx 50", ref: "Euro Stoxx 50", group: "global" },
  { sym: "EWQ", name: "Pháp", ref: "CAC 40", group: "global" },
];

export const GROUP_LABEL: Record<AssetGroup, string> = {
  us: "Chỉ số Mỹ",
  commod: "Hàng hoá",
  fx: "FX & Lãi suất",
  global: "Chỉ số toàn cầu",
};

export type Px = Instrument & { price: number | null; chg: number | null; spark: number[] };

export interface MarketProvider {
  id: string;
  label: string; // ghi trên UI, vd. "qua ETF"
  periods: readonly ("1D" | "1W" | "1M" | "YTD")[]; // khoảng % thay đổi nguồn hỗ trợ
  quotes(list: Instrument[]): Promise<Px[]>;
}

const etfFinnhub: MarketProvider = {
  id: "finnhub-etf",
  label: "qua ETF",
  periods: ["1D"],
  async quotes(list) {
    const q = await getQuotes(
      list.map((x) => x.sym),
      180,
    );
    const by = new Map(q.map((x) => [x.symbol, x]));
    return list.map((x) => {
      const r = by.get(x.sym);
      return { ...x, price: r ? r.c : null, chg: r ? r.dp : null, spark: [] };
    });
  },
};

export function marketProvider(): MarketProvider {
  return etfFinnhub;
}

export function byGroup(group: AssetGroup) {
  return INSTRUMENTS.filter((x) => x.group === group);
}

// Phiên giao dịch chính (giờ địa phương sàn, T2–T6; bỏ qua nghỉ trưa / ngày lễ)
const SESSIONS = [
  { name: "Tokyo", tz: "Asia/Tokyo", open: 9 * 60, close: 15 * 60 },
  { name: "London", tz: "Europe/London", open: 8 * 60, close: 16 * 60 + 30 },
  { name: "New York", tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60 },
] as const;

export function sessionsOpen(now = new Date()) {
  return SESSIONS.map((s) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: s.tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" })
        .formatToParts(now)
        .map((x) => [x.type, x.value]),
    );
    const m = (Number(p.hour) % 24) * 60 + Number(p.minute);
    const weekday = !["Sat", "Sun"].includes(p.weekday);
    return { name: s.name, open: weekday && m >= s.open && m < s.close };
  });
}
