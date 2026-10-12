import { cleanText, csvCell, parseDateRange } from "./lib.mjs";
import { buildRegionalComparison } from "../public/research-model.js";

// These reserved devices are created only by the reversible presentation seed.
export const DEMO_DEVICE_IDS = ["cd62be60-5f11-4d4e-a217-92a7616c5201", "cd62be60-5f11-4d4e-a217-92a7616c5202"];

export function readAnalyticsFilters(parameters) {
  const dataSource = parameters.get("data") || "real";
  const level = parameters.get("level") || "";
  if (!["real", "demo", "all"].includes(dataSource) || (level && !/^(?:[1-9]|[1-4]\d|50)$/.test(level))) {
    throw Object.assign(new Error("Некорректные фильтры"), { status: 400 });
  }
  return {
    ...parseDateRange(parameters),
    region: cleanText(parameters.get("region"), 120),
    city: cleanText(parameters.get("city"), 120),
    venue: cleanText(parameters.get("venue"), 160),
    device: cleanText(parameters.get("device"), 40),
    level,
    gameId: cleanText(parameters.get("game"), 80) || "healthy-food",
    gameVersion: cleanText(parameters.get("version"), 40) || "1.0.0",
    dataSource,
  };
}

export function readComparisonOptions(parameters) {
  const threshold = (name, fallback) => {
    const value = parameters.get(name);
    if (value === null) return fallback;
    if (!/^\d{1,5}$/.test(value) || Number(value) < 1 || Number(value) > 10000) {
      throw Object.assign(new Error("Порог выборки должен быть от 1 до 10000"), { status: 400 });
    }
    return Number(value);
  };
  return {
    regions: parameters.has("selection") ? parameters.getAll("compareRegion").map((value) => cleanText(value, 120)) : null,
    minimumSessions: threshold("minSessions", 30),
    minimumAnswers: threshold("minAnswers", 20),
  };
}

export function researchCsv(data, options, kind = "regions") {
  const comparison = buildRegionalComparison(data, options.regions, options.minimumSessions, options.minimumAnswers);
  const metadataHeaders = ["С даты, МСК", "По дату, МСК", "Игра", "Версия", "Данные", "Город-фильтр", "Площадка-фильтр", "Регионы сравнения", "Общие уровни", "Мин. игр на уровне", "Мин. ответов на продукт"];
  const moscowTime = (value) => `${new Date(new Date(value).getTime() + 3 * 3_600_000).toISOString().slice(0, -1)}+03:00`;
  const metadata = [moscowTime(data.range.from), moscowTime(data.range.to), data.gameId, data.gameVersion, data.dataSource, data.city, data.venue, comparison.regions.join(" | "), comparison.commonLevels.join(","), options.minimumSessions, options.minimumAnswers];
  const decimal = (value) => value === null ? "" : Number(value.toFixed(4));
  let headers;
  let rows;
  if (kind === "products") {
    headers = ["Регион", "Уровень", "ID продукта", "Продукт", "Ответов", "Ошибок", "Ошибки, %", "Полезное назвали вредным", "Вредное назвали полезным", "Малая выборка", "Межрегиональный разрыв, п.п."];
    rows = comparison.productRows.flatMap((product) => comparison.regions.flatMap((region) => {
      const cell = product.cells[region];
      return cell ? [[region, product.level, product.foodId, product.foodName, cell.answers, cell.mistakes, decimal(cell.errorRate), cell.goodAsHarmful, cell.harmfulAsGood, cell.smallSample ? "да" : "нет", decimal(product.gap)]] : [];
    }));
  } else {
    headers = ["Регион", "Прохождений", "Ответов", "ДЕМО-прохождений", "Средняя точность игр, %", "Точность с равным весом уровней, %", "Разница с другими регионами, п.п.", "Игр на общих уровнях", "Минимум игр среди общих уровней", "Малая выборка", "Уровень", "Игр на уровне", "Точность уровня, %"];
    rows = comparison.regionRows.flatMap((region) => region.levels.map((level) => [region.region, region.sessions, region.answers, region.demoSessions, decimal(region.rawAccuracy), decimal(region.adjustedAccuracy), decimal(region.difference), region.comparableSessions, region.minimumLevelSessions, region.smallSample ? "да" : "нет", level.level, level.sessions, decimal(level.accuracy)]));
  }
  return `\uFEFF${[...metadataHeaders, ...headers].map(csvCell).join(";")}\n${rows.map((row) => [...metadata, ...row].map(csvCell).join(";")).join("\n")}`;
}
