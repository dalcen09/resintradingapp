// @ts-nocheck
import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { resinEntriesTable } from "@workspace/db/schema";
import { invalidateMatchCache } from "./resinEntries.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// Column alias map — keys are lower-cased, trimmed header values
// Half-width katakana (ｱｲｿﾞｯﾄﾞ etc.) are included alongside full-width
// ---------------------------------------------------------------------------
const FIELD_ALIASES: Record<string, string> = {
  // ── entryType ────────────────────────────────────────────────────────────
  "type": "entryType",
  "entry type": "entryType",
  "entry_type": "entryType",
  "source/demand": "entryType",
  "source or demand": "entryType",
  "区分": "entryType",
  "仕入/販売": "entryType",

  // ── resinCategory ────────────────────────────────────────────────────────
  "category": "resinCategory",
  "resin category": "resinCategory",
  "resin_category": "resinCategory",
  "material category": "resinCategory",
  "カテゴリ": "resinCategory",
  "カテゴリー": "resinCategory",
  "種類": "resinCategory",

  // ── date ─────────────────────────────────────────────────────────────────
  "date": "date",
  "日付": "date",
  "日付け": "date",

  // ── counterparty ─────────────────────────────────────────────────────────
  "counterparty": "counterparty",
  "customer": "counterparty",
  "supplier": "counterparty",
  "customer/supplier": "counterparty",
  "company": "counterparty",
  "company name": "counterparty",
  "紹介先": "counterparty",
  "仕入先": "counterparty",
  "取引先": "counterparty",
  "顧客": "counterparty",
  "供給先": "counterparty",
  "販売先": "counterparty",

  // ── personInCharge ───────────────────────────────────────────────────────
  "person in charge": "personInCharge",
  "pic": "personInCharge",
  "person_in_charge": "personInCharge",
  "contact": "personInCharge",
  "contact person": "personInCharge",
  "仕入担当": "personInCharge",
  "担当者": "personInCharge",
  "担当": "personInCharge",
  "担当名": "personInCharge",
  "販売担当": "personInCharge",

  // ── resinType ────────────────────────────────────────────────────────────
  "resin type": "resinType",
  "resin_type": "resinType",
  "resin": "resinType",
  "polymer": "resinType",
  "樹脂": "resinType",
  "樹脂種類": "resinType",
  "材料": "resinType",
  "ポリマー": "resinType",

  // ── manufacturer ─────────────────────────────────────────────────────────
  "manufacturer": "manufacturer",
  "maker": "manufacturer",
  "brand": "manufacturer",
  "ﾒｰｶｰ": "manufacturer",
  "メーカー": "manufacturer",
  "製造メーカー": "manufacturer",
  "メーカー名": "manufacturer",

  // ── grade ────────────────────────────────────────────────────────────────
  "grade": "grade",
  "grade id": "grade",
  "ｸﾞﾚｰﾄﾞ": "grade",
  "グレード": "grade",
  "グレード名": "grade",
  "品番": "grade",

  // ── resinSubType (generic "タイプ" column — routed at import time) ─────────
  "タイプ": "resinSubType",
  "ﾀｲﾌﾟ": "resinSubType",
  "type (resin)": "resinSubType",
  "resin subtype": "resinSubType",
  "resin sub type": "resinSubType",
  "subtype": "resinSubType",

  // ── ppType ───────────────────────────────────────────────────────────────
  "pp type": "ppType",
  "pp_type": "ppType",
  "homopolymer/copolymer": "ppType",
  "ﾀｲﾌﾟppの場合": "ppType",
  "タイプppの場合": "ppType",
  "ppのタイプ": "ppType",
  "ppタイプ": "ppType",
  "タイプ (pp)": "ppType",
  "type (pp)": "ppType",

  // ── peType / psType / absType (direct column aliases) ────────────────────
  "タイプ (pe)": "peType",
  "type (pe)": "peType",
  "pe type": "peType",
  "pe_type": "peType",
  "タイプ (ps)": "psType",
  "type (ps)": "psType",
  "ps type": "psType",
  "ps_type": "psType",
  "タイプ (abs)": "absType",
  "type (abs)": "absType",
  "abs type": "absType",
  "abs_type": "absType",

  // ── colorTone ────────────────────────────────────────────────────────────
  "colortone": "colorTone",
  "color tone": "colorTone",
  "color": "colorTone",
  "色目": "colorTone",
  "色調": "colorTone",
  "カラー": "colorTone",

  // ── origin ───────────────────────────────────────────────────────────────
  "origin": "origin",
  "由来": "origin",
  "由来先": "origin",
  "原料由来": "origin",

  // ── rohs ─────────────────────────────────────────────────────────────────
  "rohs": "rohs",
  "ｒｏｈｓ": "rohs",
  "rohs対応": "rohs",
  "rohs適合": "rohs",

  // ── mesh ─────────────────────────────────────────────────────────────────
  "mesh": "mesh",
  "メッシュ": "mesh",
  "ﾒｯｼｭ": "mesh",
  "mesh size": "mesh",
  "メッシュサイズ": "mesh",

  // ── physicalOther ─────────────────────────────────────────────────────────
  "physicalother": "physicalOther",
  "physical other": "physicalOther",
  "その他": "physicalOther",
  "その他（物性）": "physicalOther",
  "その他(物性)": "physicalOther",
  "物性その他": "physicalOther",

  // ── shape ────────────────────────────────────────────────────────────────
  "shape": "shape",
  "形状": "shape",
  "形態": "shape",
  "pellet form": "shape",
  "resin form": "shape",

  // ── sampleAvailable ──────────────────────────────────────────────────────
  "sample available": "sampleAvailable",
  "sample": "sampleAvailable",
  "sample_available": "sampleAvailable",
  "サンプル": "sampleAvailable",
  "サンプル有無": "sampleAvailable",
  "試料": "sampleAvailable",

  // ── packaging ────────────────────────────────────────────────────────────
  "packaging": "packaging",
  "packing": "packaging",
  "package type": "packaging",
  "荷姿": "packaging",
  "梱包形態": "packaging",
  "梱包": "packaging",
  "荷形態": "packaging",

  // ── meltFlowIndexLower / meltFlowIndexUpper ──────────────────────────────
  "melt flow index": "meltFlowIndexLower",
  "mfi": "meltFlowIndexLower",
  "melt flow": "meltFlowIndexLower",
  "melt_flow_index": "meltFlowIndexLower",
  "ﾒﾙﾄ": "meltFlowIndexLower",
  "メルト": "meltFlowIndexLower",
  "メルトフロー": "meltFlowIndexLower",
  "mfr": "meltFlowIndexLower",
  "melt flow index lower": "meltFlowIndexLower",
  "mi 下限": "meltFlowIndexLower",
  "mi下限": "meltFlowIndexLower",
  "ﾒﾙﾄ（下限）": "meltFlowIndexLower",
  "melt flow index upper": "meltFlowIndexUpper",
  "mi 上限": "meltFlowIndexUpper",
  "mi上限": "meltFlowIndexUpper",
  "ﾒﾙﾄ（上限）": "meltFlowIndexUpper",

  // ── charpyLower / charpyUpper ────────────────────────────────────────────
  "charpy": "charpyLower",
  "charpy impact": "charpyLower",
  "ｼｬﾙﾋﾟｰ": "charpyLower",
  "シャルピー": "charpyLower",
  "シャルピー衝撃値": "charpyLower",
  "charpy lower": "charpyLower",
  "シャルピー 下限": "charpyLower",
  "シャルピー下限": "charpyLower",
  "ｼｬﾙﾋﾟｰ（下限）": "charpyLower",
  "charpy upper": "charpyUpper",
  "シャルピー 上限": "charpyUpper",
  "シャルピー上限": "charpyUpper",
  "ｼｬﾙﾋﾟｰ（上限）": "charpyUpper",

  // ── izodLower / izodUpper ────────────────────────────────────────────────
  "izod": "izodLower",
  "izod impact": "izodLower",
  "ｱｲｿﾞｯﾄﾞ": "izodLower",
  "アイゾッド": "izodLower",
  "アイゾット": "izodLower",
  "アイゾット衝撃値": "izodLower",
  "izod lower": "izodLower",
  "アイゾット 下限": "izodLower",
  "アイゾット下限": "izodLower",
  "ｱｲｿﾞｯﾄﾞ（下限）": "izodLower",
  "izod upper": "izodUpper",
  "アイゾット 上限": "izodUpper",
  "アイゾット上限": "izodUpper",
  "ｱｲｿﾞｯﾄﾞ（上限）": "izodUpper",

  // ── densityLower / densityUpper ──────────────────────────────────────────
  "density": "densityLower",
  "比重": "densityLower",
  "密度": "densityLower",
  "density lower": "densityLower",
  "密度 下限": "densityLower",
  "密度下限": "densityLower",
  "比重（下限）": "densityLower",
  "density upper": "densityUpper",
  "密度 上限": "densityUpper",
  "密度上限": "densityUpper",
  "比重（上限）": "densityUpper",

  // ── price ─────────────────────────────────────────────────────────────────
  "price": "price",
  "price (usd/mt)": "price",
  "price usd": "price",
  "価格": "price",
  "仕入価格": "price",
  "仕入れ価格": "price",
  "仕入値": "price",
  "仕入れ値": "price",
  "買値": "price",
  "購入価格": "price",
  "単価": "price",
  "参考単価": "price",
  "参考価格": "price",
  "希望価格": "price",
  "指値": "price",
  "提示価格": "price",
  "入荷価格": "price",
  // price lower/upper
  "price lower": "priceLower",
  "price (lower)": "priceLower",
  "価格 下限": "priceLower",
  "価格（下限）": "priceLower",
  "価格下限": "priceLower",
  "price upper": "priceUpper",
  "price (upper)": "priceUpper",
  "価格 上限": "priceUpper",
  "価格（上限）": "priceUpper",
  "価格上限": "priceUpper",

  // ── finalNegotiatedPrice ──────────────────────────────────────────────────
  "final negotiated price": "finalNegotiatedPrice",
  "最終交渉価格": "finalNegotiatedPrice",
  "交渉価格": "finalNegotiatedPrice",
  "最終価格": "finalNegotiatedPrice",
  "成約価格": "finalNegotiatedPrice",
  "決定価格": "finalNegotiatedPrice",

  // ── quantity ──────────────────────────────────────────────────────────────
  "quantity": "quantity",
  "qty": "quantity",
  "quantity (mt)": "quantity",
  "qty (mt)": "quantity",
  "発生数量": "quantity",
  "数量": "quantity",
  "ロット": "quantity",
  "発生量": "quantity",
  "重量": "quantity",
  "在庫量": "quantity",
  "在庫数量": "quantity",
  "入荷量": "quantity",
  "入荷数量": "quantity",
  "ロット数量": "quantity",
  "ロット重量": "quantity",
  "取引数量": "quantity",
  // quantity lower/upper
  "quantity lower": "quantityLower",
  "quantity (lower)": "quantityLower",
  "数量 下限": "quantityLower",
  "数量（下限）": "quantityLower",
  "数量下限": "quantityLower",
  "quantity upper": "quantityUpper",
  "quantity (upper)": "quantityUpper",
  "数量 上限": "quantityUpper",
  "数量（上限）": "quantityUpper",
  "数量上限": "quantityUpper",

  // ── desiredQuantity ───────────────────────────────────────────────────────
  "desired quantity": "desiredQuantity",
  "希望数量": "desiredQuantity",
  "要望数量": "desiredQuantity",
  "ご希望数量": "desiredQuantity",

  // ── quantityType (スポット・月間) ──────────────────────────────────────────
  "quantity type": "quantityType",
  "スポット・月間": "quantityType",
  "月間・スポット": "quantityType",
  "スポット/月間": "quantityType",
  "月間/スポット": "quantityType",
  "数量区分": "quantityType",
  "取引区分": "quantityType",
  "取引形態": "quantityType",
  "受注区分": "quantityType",
  "発注区分": "quantityType",

  // ── packagingWeight (梱包重量) ────────────────────────────────────────────
  "packaging weight": "packagingWeight",
  "梱包重量": "packagingWeight",
  "梱包重量（kg)": "packagingWeight",
  "梱包重量(kg)": "packagingWeight",
  "梱包重量（kg）": "packagingWeight",

  // ── plainMaker (無地・メーカー) ───────────────────────────────────────────
  "plain maker": "plainMaker",
  "無地・メーカー": "plainMaker",
  "無地メーカー": "plainMaker",
  "plain/maker": "plainMaker",

  // ── usageType (ランニング・ワンウェイ) ────────────────────────────────────
  "usage type": "usageType",
  "ランニング・ワンウェイ": "usageType",
  "ランニングワンウェイ": "usageType",
  "running/oneway": "usageType",

  // ── isClosed (クローズ・オープン) ─────────────────────────────────────────
  "is closed": "isClosed",
  "クローズ・オープン": "isClosed",
  "クローズ": "isClosed",
  "open/close": "isClosed",

  // ── remarks ──────────────────────────────────────────────────────────────
  "remarks": "remarks",
  "notes": "remarks",
  "comment": "remarks",
  "comments": "remarks",
  "備考": "remarks",
  "メモ": "remarks",
  "コメント": "remarks",
  "注記": "remarks",

  // ── locationType (納入・置場) ─────────────────────────────────────────────
  "location type": "locationType",
  "location_type": "locationType",
  "納入・置場": "locationType",
  "納入置場": "locationType",
  "納入/置場": "locationType",
  "置場区分": "locationType",
  "納入区分": "locationType",
  "納入形態": "locationType",

  // ── storageLocation (他県置場) ────────────────────────────────────────────
  "storage location": "storageLocation",
  "storage": "storageLocation",
  "他県置場": "storageLocation",
  "置き場": "storageLocation",
  "置場": "storageLocation",
  "場所": "storageLocation",
  "保管場所": "storageLocation",
  "在庫場所": "storageLocation",
  "保管先": "storageLocation",

  // ── arrivalPrice (丸喜着) ─────────────────────────────────────────────────
  "arrival price": "arrivalPrice",
  "landed price": "arrivalPrice",
  "丸喜着": "arrivalPrice",
  "着値": "arrivalPrice",
  "着価格": "arrivalPrice",

  // ── spotPrice (スポット) ──────────────────────────────────────────────────
  "spot": "spotPrice",
  "spot price": "spotPrice",
  "スポット": "spotPrice",
  "スポット価格": "spotPrice",

  // ── prospectiveBuyer (ワーク希望者) ──────────────────────────────────────
  "prospective buyer": "prospectiveBuyer",
  "interested party": "prospectiveBuyer",
  "ワーク希望者": "prospectiveBuyer",
  "購入希望者": "prospectiveBuyer",
  "希望者": "prospectiveBuyer",

  // ── proposedTo (提案先) ───────────────────────────────────────────────────
  "proposed to": "proposedTo",
  "proposal target": "proposedTo",
  "提案先": "proposedTo",
  "販売提案先": "proposedTo",

  // ── sellingPrice (販売価格) ────────────────────────────────────────────────
  "selling price": "sellingPrice",
  "sale price": "sellingPrice",
  "販売価格": "sellingPrice",
  "売値": "sellingPrice",
  "販売単価": "sellingPrice",
};

// ---------------------------------------------------------------------------
// Sheet-name auto-detection helpers
// ---------------------------------------------------------------------------
function detectCategoryFromSheet(name: string): "virgin" | "offgrade" | "recycled" | null {
  const n = name.toLowerCase();
  if (n.includes("virgin") || n.includes("バージン")) return "virgin";
  if (n.includes("offgrade") || n.includes("off-grade") || n.includes("オフグレード")) return "offgrade";
  if (n.includes("recycled") || n.includes("recycle") || n.includes("リサイクル") || n.includes("再生")) return "recycled";
  return null;
}

function detectEntryTypeFromSheet(name: string): "source" | "demand" | null {
  const n = name.toLowerCase();
  if (n.includes("仕入") || n.includes("供給") || n.includes("source") || n.includes("supply")) return "source";
  if (n.includes("需要") || n.includes("販売先") || n.includes("demand") || n.includes("buy")) return "demand";
  return null;
}

// ---------------------------------------------------------------------------
// Value normalizers
// ---------------------------------------------------------------------------
const VALID_RESIN_TYPES = [
  "PP", "PE", "PS", "ABS", "PVC", "PET", "PC", "EVA", "PMMA",
  "HDPE", "LDPE", "LLDPE",
  "GPPS", "HIPS",
  "POM", "EPDM", "PEI", "PETG", "AS", "MS", "PVDC",
  "PA", "PA6", "PA66", "PA9T", "PBT", "PET/PBT", "PC/ABS",
  "AAS", "ASA", "COP", "IP", "K-レジン", "MB", "OPS", "PSP", "PSU", "PO", "SBC", "TPE", "TPO",
  "Other",
];
const VALID_PP_TYPES = ["Homopolymer", "Copolymer", "Random", "Impact", "Terpolymer", "N/A"];
const VALID_PACKAGING_JP = ["紙袋", "フレコン", "カートン", "鉄箱", "ポリ袋"];
const PACKAGING_ALIASES: Record<string, string> = {
  "bags": "紙袋", "bag": "紙袋", "紙袋": "紙袋",
  "jumbo_bag": "フレコン", "jumbo bag": "フレコン", "フレコン": "フレコン", "フレキシブルコンテナ": "フレコン",
  "octabin": "カートン", "box": "カートン", "carton": "カートン", "カートン": "カートン",
  "鉄箱": "鉄箱", "metal box": "鉄箱",
  "ポリ袋": "ポリ袋", "poly bag": "ポリ袋", "bulk": "ポリ袋",
};

function resolveField(colName: string): string | null {
  const raw = colName.trim().toLowerCase();
  // 1. Try exact match first
  if (FIELD_ALIASES[raw] != null) return FIELD_ALIASES[raw];
  // 2. Strip parenthetical unit suffixes: 価格(円/kg) → 価格, 数量(kg) → 数量
  const stripped = raw
    .replace(/[\(（][^\)）]*[\)）]/g, "")  // remove (...) and （...）
    .replace(/[（）()]/g, "")              // remove any remaining stray parens
    .replace(/[【】\[\]]/g, "")            // remove bracket decorators
    .replace(/\s+/g, " ")
    .trim();
  if (stripped !== raw && FIELD_ALIASES[stripped] != null) return FIELD_ALIASES[stripped];
  // 3. Also try stripping trailing slash-delimited units: 価格/円kg → 価格
  const slashStripped = raw.replace(/[\/／][^\/／\s]+$/, "").trim();
  if (slashStripped !== raw && FIELD_ALIASES[slashStripped] != null) return FIELD_ALIASES[slashStripped];
  return null;
}

function normalizeEntryType(val: string): "source" | "demand" | null {
  const v = val.trim().toLowerCase();
  if (["source", "仕入れ先", "仕入先", "supply", "s", "仕入"].includes(v)) return "source";
  if (["demand", "需要", "buy", "d", "b", "販売先"].includes(v)) return "demand";
  return null;
}

function normalizeCategory(val: string): "virgin" | "offgrade" | "recycled" | null {
  const v = val.trim().toLowerCase();
  if (v.includes("virgin") || v.includes("バージン")) return "virgin";
  if (v.includes("offgrade") || v.includes("off-grade") || v.includes("オフグレード")) return "offgrade";
  if (v.includes("recycled") || v.includes("recycle") || v.includes("リサイクル") || v.includes("再生")) return "recycled";
  return null;
}

function normalizeResinType(raw: string): string | null {
  // Strip leading/trailing whitespace and normalize
  let v = raw.trim();

  // Strip parenthetical suffixes: LLDPE(C4) → LLDPE, LLDPE(C6) → LLDPE
  v = v.replace(/\s*[\(（].*?[\)）]/g, "").trim();

  // Strip Japanese descriptors before/after: 透明ABS → ABS, PE（架橋入り）→ PE
  v = v.replace(/^透明/i, "").trim();

  // Known aliases that don't match the enum exactly
  const aliases: Record<string, string> = {
    "LLC4": "LLDPE",
    "PVDCパウダー": "PVDC",
    "PVDCﾊﾟｳﾀﾞｰ": "PVDC",
    "PET-G": "PETG",
    "PET-GF": "PETG",
  };
  if (aliases[v]) return aliases[v];

  // Case-insensitive exact match against valid list
  const vUp = v.toUpperCase();
  return VALID_RESIN_TYPES.find(t => t.toUpperCase() === vUp) ?? null;
}

function toFullWidthKatakana(s: string): string {
  // Convert half-width katakana to full-width
  const halfToFull: Record<string, string> = {
    "ｦ":"ヲ","ｧ":"ァ","ｨ":"ィ","ｩ":"ゥ","ｪ":"ェ","ｫ":"ォ","ｬ":"ャ","ｭ":"ュ","ｮ":"ョ","ｯ":"ッ","ｰ":"ー",
    "ｱ":"ア","ｲ":"イ","ｳ":"ウ","ｴ":"エ","ｵ":"オ","ｶ":"カ","ｷ":"キ","ｸ":"ク","ｹ":"ケ","ｺ":"コ",
    "ｻ":"サ","ｼ":"シ","ｽ":"ス","ｾ":"セ","ｿ":"ソ","ﾀ":"タ","ﾁ":"チ","ﾂ":"ツ","ﾃ":"テ","ﾄ":"ト",
    "ﾅ":"ナ","ﾆ":"ニ","ﾇ":"ヌ","ﾈ":"ネ","ﾉ":"ノ","ﾊ":"ハ","ﾋ":"ヒ","ﾌ":"フ","ﾍ":"ヘ","ﾎ":"ホ",
    "ﾏ":"マ","ﾐ":"ミ","ﾑ":"ム","ﾒ":"メ","ﾓ":"モ","ﾔ":"ヤ","ﾕ":"ユ","ﾖ":"ヨ",
    "ﾗ":"ラ","ﾘ":"リ","ﾙ":"ル","ﾚ":"レ","ﾛ":"ロ","ﾜ":"ワ","ﾝ":"ン","ﾞ":"゛","ﾟ":"゜",
  };
  // Multi-char combinations first (dakuten)
  return s.replace(/ｳﾞ/g,"ヴ").replace(/ｶﾞ/g,"ガ").replace(/ｷﾞ/g,"ギ").replace(/ｸﾞ/g,"グ")
    .replace(/ｹﾞ/g,"ゲ").replace(/ｺﾞ/g,"ゴ").replace(/ｻﾞ/g,"ザ").replace(/ｼﾞ/g,"ジ")
    .replace(/ｽﾞ/g,"ズ").replace(/ｾﾞ/g,"ゼ").replace(/ｿﾞ/g,"ゾ").replace(/ﾀﾞ/g,"ダ")
    .replace(/ﾁﾞ/g,"ヂ").replace(/ﾂﾞ/g,"ヅ").replace(/ﾃﾞ/g,"デ").replace(/ﾄﾞ/g,"ド")
    .replace(/ﾊﾞ/g,"バ").replace(/ﾋﾞ/g,"ビ").replace(/ﾌﾞ/g,"ブ").replace(/ﾍﾞ/g,"ベ")
    .replace(/ﾎﾞ/g,"ボ").replace(/ﾊﾟ/g,"パ").replace(/ﾋﾟ/g,"ピ").replace(/ﾌﾟ/g,"プ")
    .replace(/ﾍﾟ/g,"ペ").replace(/ﾎﾟ/g,"ポ")
    .split("").map(c => halfToFull[c] ?? c).join("");
}

function normalizePPType(val: string): string | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = toFullWidthKatakana(val.trim());
  return v || null;
}

function normalizePackaging(val: string): string | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = val.trim();
  if (VALID_PACKAGING_JP.includes(v)) return v;
  return PACKAGING_ALIASES[v.toLowerCase()] ?? null;
}

function normalizeSampleAvailable(val: any): string | null {
  if (val === null || val === undefined || val === "" || val === "-") return null;
  const s = String(val).trim();
  if (["有償", "有償サンプル"].includes(s)) return "有償";
  if (["要相談"].includes(s)) return "要相談";
  const low = s.toLowerCase();
  if (["yes", "true", "1", "y", "あり", "はい", "○", "◯"].includes(low)) return "あり";
  if (["no", "false", "0", "n", "なし", "いいえ", "×", "x"].includes(low)) return "なし";
  return s;
}

function normalizeQuantityType(val: string): "スポット" | "月間" | null {
  if (!val || !val.trim()) return null;
  const v = val.trim().toLowerCase();
  if (v.includes("スポット") || v.includes("spot") || v.includes("ワンウェイ")) return "スポット";
  if (v.includes("月間") || v.includes("monthly") || v.includes("ランニング")) return "月間";
  return null;
}

function normalizeIsClosed(val: string): "クローズ" | "オープン" {
  const v = val.trim().toLowerCase();
  if (v.includes("クローズ") || v.includes("close") || v === "1" || v === "true") return "クローズ";
  return "オープン";
}

function normalizePEType(val: string): string | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = val.trim();
  const vUp = v.toUpperCase();
  if (vUp === "LD" || vUp.includes("LDPE") || v.includes("低密度")) return "LD";
  if (vUp === "HD" || vUp.includes("HDPE") || v.includes("高密度")) return "HD";
  if (vUp === "LLD" || vUp.includes("LLDPE") || v.includes("直鎖")) return "LLD";
  return v;
}

function normalizePSType(val: string): string | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = val.trim();
  const vUp = v.toUpperCase();
  if (vUp === "HI" || vUp.includes("HIPS") || v.includes("耐衝")) return "HI";
  if (vUp === "GP" || vUp.includes("GPPS") || v.includes("汎用")) return "GP";
  return v;
}

function normalizeABSType(val: string): string | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = val.trim();
  if (v === "難燃" || v.toLowerCase().includes("flame") || v.toLowerCase().includes("fr")) return "難燃";
  return v;
}

function normalizeLocationType(val: string): "納入" | "置場" | null {
  if (!val || !val.trim() || val.trim() === "-") return null;
  const v = val.trim();
  if (v === "納入" || v.toLowerCase().includes("deliver") || v.toLowerCase().includes("delivery")) return "納入";
  if (v === "置場" || v.includes("置き場") || v.toLowerCase().includes("storage") || v.toLowerCase().includes("warehouse")) return "置場";
  return null;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Convert Excel serial date to calendar date
    // 25569 = days between Excel epoch (Jan 0 1900) and Unix epoch (Jan 1 1970)
    const ms = (val - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  const s = String(val).trim();
  // yyyy/mm/dd or yyyy-mm-dd (including single-digit month/day)
  const slash = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (slash) return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return null;
}

function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function numStr(val: any): string | null {
  const n = parseNumber(val);
  return n !== null ? String(n) : null;
}

// ---------------------------------------------------------------------------
// Import route
// ---------------------------------------------------------------------------
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ファイルがアップロードされていません" });

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false });
  } catch {
    return res.status(400).json({ error: "Excelファイルの読み込みに失敗しました。有効な .xlsx / .xls / .csv ファイルをアップロードしてください。" });
  }

  // Debug mode: return header mapping without importing
  if (req.query.debug === "1") {
    const debugInfo: Record<string, { mapped: string | null; raw: string }[]> = {};
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rows.length < 2) continue;
      const headers = rows[0].map((h: any) => String(h));
      debugInfo[sheetName] = headers.map(h => ({ raw: h, mapped: resolveField(h) }));
    }
    return res.json({ debug: debugInfo });
  }

  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length < 2) continue;

    // Auto-detect category and entry type from sheet name
    const sheetCategory = detectCategoryFromSheet(sheetName);
    const sheetEntryType = detectEntryTypeFromSheet(sheetName);

    // Auto-detect header row: scan first 10 rows, pick the one with most mapped fields
    let headerRowIdx = 0;
    let bestMappedCount = 0;
    const scanLimit = Math.min(10, rows.length);
    for (let si = 0; si < scanLimit; si++) {
      const count = rows[si].filter((h: any) => resolveField(String(h)) !== null).length;
      if (count > bestMappedCount) { bestMappedCount = count; headerRowIdx = si; }
    }

    // Build column → field mapping from detected header row
    const headers = rows[headerRowIdx].map((h: any) => String(h));
    const fieldMap: Record<number, string> = {};
    const unmapped: string[] = [];
    headers.forEach((h, i) => {
      const field = resolveField(h);
      if (field) fieldMap[i] = field;
      else if (h && h.trim()) unmapped.push(h);
    });
    if (unmapped.length > 0) {
      console.log(`[import] Sheet "${sheetName}" — unmapped headers:`, JSON.stringify(unmapped));
    }
    console.log(`[import] Sheet "${sheetName}" — header row index: ${headerRowIdx}, mapped:`, JSON.stringify(Object.values(fieldMap)));
    console.log(`[import] Sheet "${sheetName}" — total rows (incl. header): ${rows.length}, data rows to process: ${rows.length - headerRowIdx - 1}`);
    // Log first and last few data rows for diagnostics
    const dataStart = headerRowIdx + 1;
    for (const debugRi of [dataStart, dataStart + 1, rows.length - 2, rows.length - 1].filter(i => i >= dataStart && i < rows.length)) {
      const r = rows[debugRi];
      const dateCol = Object.entries(fieldMap).find(([, f]) => f === "date")?.[0];
      const cpCol = Object.entries(fieldMap).find(([, f]) => f === "counterparty")?.[0];
      console.log(`[import]   row[${debugRi}] date="${dateCol ? r[+dateCol] : "?"}" counterparty="${cpCol ? r[+cpCol] : "?"}"`);
    }

    const batchValues: any[] = [];

    for (let ri = dataStart; ri < rows.length; ri++) {
      const row = rows[ri];
      // Skip fully empty rows
      if (row.every((c: any) => c === "" || c === null || c === undefined)) continue;

      // Collect raw values by field name
      const data: Record<string, any> = {};
      Object.entries(fieldMap).forEach(([ci, field]) => {
        data[field] = row[parseInt(ci)];
      });

      // Silently skip rows with no date and no counterparty (blank trailing rows)
      const rawDate = data.date;
      const rawCounterparty = data.counterparty;
      if ((!rawDate || rawDate === "") && (!rawCounterparty || String(rawCounterparty).trim() === "")) continue;

      // Resolve required fields — fall back to sheet-name detection
      const entryType: "source" | "demand" | null =
        data.entryType ? normalizeEntryType(String(data.entryType)) : sheetEntryType;
      const resinCategory: "virgin" | "offgrade" | "recycled" | null =
        data.resinCategory ? normalizeCategory(String(data.resinCategory)) : sheetCategory;
      const date = rawDate ? parseDate(rawDate) : null;
      const counterparty = rawCounterparty ? String(rawCounterparty).trim() : null;
      const personInCharge = data.personInCharge ? String(data.personInCharge).trim() : null;
      const rawResinType = data.resinType ? String(data.resinType).trim() : "";
      const normalizedResinType = rawResinType ? normalizeResinType(rawResinType) : null;
      // Store as normalized if known, otherwise store raw value as-is (free text)
      const resinType = normalizedResinType ?? rawResinType ?? null;
      const importedOtherResinType = data.otherResinType ? String(data.otherResinType).trim() : null;

      // Route generic "タイプ" value to the correct resin-specific type field
      if (data.resinSubType && String(data.resinSubType).trim()) {
        const sub = String(data.resinSubType).trim();
        const rt = (normalizedResinType ?? "").toUpperCase();
        if (["PE", "HDPE", "LDPE", "LLDPE"].includes(rt)) {
          if (!data.peType) data.peType = sub;
        } else if (rt === "PS") {
          if (!data.psType) data.psType = sub;
        } else if (rt === "ABS") {
          if (!data.absType) data.absType = sub;
        } else {
          // Default / PP: route to ppType
          if (!data.ppType) data.ppType = sub;
        }
      }

      // Validation
      if (!entryType) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): エントリタイプ不明 — 列「type」か「仕入/需要」を追加するか、シート名に「仕入」または「需要」を含めてください`);
        results.skipped++; continue;
      }
      if (!resinCategory) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): カテゴリ不明 — 列「category」か「カテゴリ」を追加するか、シート名に「バージン/オフグレード/リサイクル」を含めてください`);
        results.skipped++; continue;
      }
      if (!date) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): 日付が無効 "${data.date ?? ""}"`);
        results.skipped++; continue;
      }
      if (!counterparty) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): 取引先（紹介先）が空です`);
        results.skipped++; continue;
      }
      if (!personInCharge) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): 担当者（仕入担当）が空です`);
        results.skipped++; continue;
      }
      if (!resinType) {
        results.errors.push(`行 ${ri + 1} (シート: ${sheetName}): 樹脂種別が空です`);
        results.skipped++; continue;
      }

      const gradeNorm = data.grade ? String(data.grade).trim() : "";
      const mfrNorm = data.manufacturer ? String(data.manufacturer).trim() : "";

      batchValues.push({
        entryType,
        resinCategory,
        date,
        counterparty,
        personInCharge,
        resinType: resinType as any,
        manufacturer: mfrNorm || null,
        grade: gradeNorm || null,
        ppType: data.ppType ? normalizePPType(String(data.ppType)) as any : null,
        sampleAvailable: data.sampleAvailable !== undefined ? normalizeSampleAvailable(data.sampleAvailable) : null,
        packaging: data.packaging ? normalizePackaging(String(data.packaging)) as any : null,
        packagingWeight: numStr(data.packagingWeight),
        plainMaker: data.plainMaker ? String(data.plainMaker).trim() || null : null,
        usageType: data.usageType ? String(data.usageType).trim() || null : null,
        meltFlowIndexLower: numStr(data.meltFlowIndexLower),
        meltFlowIndexUpper: numStr(data.meltFlowIndexUpper),
        charpyLower: numStr(data.charpyLower),
        charpyUpper: numStr(data.charpyUpper),
        izodLower: numStr(data.izodLower),
        izodUpper: numStr(data.izodUpper),
        densityLower: numStr(data.densityLower),
        densityUpper: numStr(data.densityUpper),
        peType: data.peType ? normalizePEType(String(data.peType)) as any : null,
        psType: data.psType ? normalizePSType(String(data.psType)) as any : null,
        absType: data.absType ? normalizeABSType(String(data.absType)) as any : null,
        otherResinType: importedOtherResinType || null,
        price: numStr(data.price),
        priceLower: numStr(data.priceLower),
        priceUpper: numStr(data.priceUpper),
        finalNegotiatedPrice: numStr(data.finalNegotiatedPrice),
        quantity: numStr(data.quantity),
        quantityLower: numStr(data.quantityLower),
        quantityUpper: numStr(data.quantityUpper),
        quantityType: data.quantityType ? normalizeQuantityType(String(data.quantityType)) as any : null,
        locationType: data.locationType ? normalizeLocationType(String(data.locationType)) as any : null,
        remarks: data.remarks ? String(data.remarks).trim() || null : null,
        // Extended fields
        origin: data.origin ? String(data.origin).trim() || null : null,
        colorTone: data.colorTone ? String(data.colorTone).trim() || null : null,
        rohs: data.rohs ? String(data.rohs).trim() || null : null,
        mesh: data.mesh ? String(data.mesh).trim() || null : null,
        physicalOther: data.physicalOther ? String(data.physicalOther).trim() || null : null,
        shape: data.shape ? String(data.shape).trim() || null : null,
        storageLocation: data.storageLocation ? String(data.storageLocation).trim() || null : null,
        arrivalPrice: numStr(data.arrivalPrice),
        spotPrice: numStr(data.spotPrice),
        prospectiveBuyer: data.prospectiveBuyer ? String(data.prospectiveBuyer).trim() || null : null,
        desiredQuantity: numStr(data.desiredQuantity),
        proposedTo: data.proposedTo ? String(data.proposedTo).trim() || null : null,
        sellingPrice: numStr(data.sellingPrice),
        isClosed: data.isClosed ? normalizeIsClosed(String(data.isClosed)) : "オープン",
      });
    }

    // Bulk insert all valid rows from this sheet in one query
    if (batchValues.length > 0) {
      const CHUNK = 200;
      for (let ci = 0; ci < batchValues.length; ci += CHUNK) {
        try {
          await db.insert(resinEntriesTable).values(batchValues.slice(ci, ci + CHUNK));
          results.imported += Math.min(CHUNK, batchValues.length - ci);
        } catch (err) {
          results.errors.push(`シート「${sheetName}」の一括挿入エラー (行 ${ci + 1}〜${Math.min(ci + CHUNK, batchValues.length)}): ${String(err).slice(0, 100)}`);
          results.skipped += Math.min(CHUNK, batchValues.length - ci);
        }
      }
    }
  }

  if (results.imported > 0) invalidateMatchCache();

  res.json(results);
});

export default router;
