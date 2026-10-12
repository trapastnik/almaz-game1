import { buildRegionalComparison } from "./research-model.js";

const $ = (id) => document.getElementById(id);
const integer = (number) => new Intl.NumberFormat("ru-RU").format(number);
const decimal = (number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number);
const percent = (number) => number === null ? "—" : `${decimal(number)}%`;
let data = null;
let parameters = new URLSearchParams();
let selected = null;
let comparison = null;
let request;

function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function emptyRow(body, columns, message) {
  const row = make("tr");
  const cell = make("td", message, "empty");
  cell.colSpan = columns;
  row.append(cell);
  body.replaceChildren(row);
}

function threshold(id) {
  const input = $(id);
  return input.validity.valid && input.value !== "" ? Number(input.value) : null;
}

function resetExports() {
  for (const id of ["regions-export", "products-export"]) {
    $(id).removeAttribute("href");
    $(id).setAttribute("aria-disabled", "true");
  }
}

export async function loadResearch(nextParameters) {
  request?.abort();
  request = new AbortController();
  const signal = request.signal;
  parameters = new URLSearchParams(nextParameters);
  data = null;
  comparison = null;
  resetExports();
  $("research-panel").setAttribute("aria-busy", "true");
  $("research-notice").className = "data-notice";
  $("research-notice").textContent = "Загрузка региональных данных...";
  $("compare-regions").replaceChildren();
  $("research-totals").replaceChildren();
  $("comparison-head").replaceChildren();
  $("products-head").replaceChildren();
  $("coverage-note").textContent = "";
  $("products-note").textContent = "";
  emptyRow($("comparison-body"), 1, "Загрузка...");
  emptyRow($("products-body"), 1, "Загрузка...");
  try {
    const response = await fetch(`/api/analytics/admin/research?${parameters}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить сравнение");
    if (signal.aborted) return;
    data = result;
    renderRegionOptions();
    renderComparison();
  } catch (error) {
    if (error.name === "AbortError") return;
    $("research-notice").className = "data-notice error";
    $("research-notice").textContent = error.message;
    emptyRow($("comparison-body"), 1, "Данные не загружены");
    emptyRow($("products-body"), 1, "Данные не загружены");
  } finally {
    if (!signal.aborted) $("research-panel").removeAttribute("aria-busy");
  }
}

function renderRegionOptions() {
  const regions = buildRegionalComparison(data).availableRegions;
  $("compare-regions").replaceChildren(...regions.map((region) => {
    const label = make("label", undefined, "region-option");
    const input = make("input");
    input.type = "checkbox";
    input.checked = selected === null || selected.includes(region);
    input.addEventListener("change", () => {
      if (selected === null) selected = [...regions];
      selected = input.checked ? [...new Set([...selected, region])] : selected.filter((value) => value !== region);
      renderComparison();
    });
    label.append(input, make("span", region));
    return label;
  }));
  if (!regions.length) $("compare-regions").append(make("span", "За этот период данных нет", "muted-value"));
}

function renderComparison() {
  if (!data) return;
  const minimumSessions = threshold("minimum-sessions");
  const minimumAnswers = threshold("minimum-answers");
  if (minimumSessions === null || minimumAnswers === null) {
    resetExports();
    $("research-notice").className = "data-notice error";
    $("research-notice").textContent = "Пороги выборки: целые числа от 1 до 10 000.";
    comparison = null;
    emptyRow($("comparison-body"), 1, "Укажите корректные пороги выборки");
    emptyRow($("products-body"), 1, "Укажите корректные пороги выборки");
    return;
  }
  comparison = buildRegionalComparison(data, selected, minimumSessions, minimumAnswers);
  const hasDemo = comparison.demoSessions > 0;
  $("research-notice").className = `data-notice${hasDemo ? " demo" : ""}`;
  $("research-notice").textContent = hasDemo
    ? `ДЕМО: ${integer(comparison.demoSessions)} из ${integer(comparison.sessions)} прохождений — искусственные. Не использовать для исследовательских выводов.`
    : data.dataSource === "demo" ? "ДЕМО-режим. За выбранный период нет демонстрационных данных."
      : "Анонимные результаты прохождений. Выборка посетителей столов, не всех жителей региона.";
  const totals = [["Регионы", integer(comparison.regions.length)], ["Прохождения", integer(comparison.sessions)], ["Ответы", integer(comparison.answers)], ["Общие уровни", comparison.commonLevels.join(", ") || "Нет"]];
  $("research-totals").replaceChildren(...totals.map(([label, value]) => {
    const item = make("div");
    item.append(make("span", label), make("strong", value));
    return item;
  }));
  const common = comparison.commonLevels;
  $("coverage-note").textContent = common.length
    ? `Сопоставимая точность: уровни ${common.join(", ")} с равным весом (${decimal(100 / common.length)}% каждый). Разница — относительно среднего других выбранных регионов. Малая выборка: менее ${integer(minimumSessions)} игр хотя бы на одном общем уровне.`
    : "Нет общих уровней с данными во всех выбранных регионах. Сопоставимая точность и разница не рассчитываются.";
  renderRegionTable();
  renderProducts();
  const exportParameters = new URLSearchParams(parameters);
  exportParameters.set("selection", "explicit");
  exportParameters.set("minSessions", minimumSessions);
  exportParameters.set("minAnswers", minimumAnswers);
  comparison.regions.forEach((region) => exportParameters.append("compareRegion", region));
  for (const [id, kind] of [["regions-export", "regions"], ["products-export", "products"]]) {
    exportParameters.set("kind", kind);
    $(id).href = `/api/analytics/admin/research/export.csv?${exportParameters}`;
    $(id).removeAttribute("aria-disabled");
  }
}

function renderRegionTable() {
  const headings = ["Регион", "Игр / ответов", ...comparison.levels.map((level) => `Уровень ${level}`), "Сопоставимая точность", "Разница, п.п.", "Выборка"];
  const head = make("tr");
  headings.forEach((title) => head.append(make("th", title)));
  $("comparison-head").replaceChildren(head);
  const rows = comparison.regionRows.map((region) => {
    const row = make("tr");
    const name = make("th", region.region);
    name.scope = "row";
    row.append(name);
    const counts = make("td");
    counts.append(make("strong", integer(region.sessions)), make("small", `${integer(region.answers)} ответов`));
    row.append(counts);
    for (const level of comparison.levels) {
      const item = region.levels.find((value) => value.level === level);
      const cell = make("td");
      if (item) cell.append(make("strong", percent(item.accuracy)), make("small", `${integer(item.sessions)} игр`));
      else cell.textContent = "Нет данных";
      if (!comparison.commonLevels.includes(level)) cell.className = "excluded-level";
      row.append(cell);
    }
    const accuracy = make("td", undefined, "adjusted-cell");
    accuracy.append(make("strong", percent(region.adjustedAccuracy)));
    if (region.adjustedAccuracy !== null) {
      const meter = make("meter");
      meter.min = 0;
      meter.max = 100;
      meter.value = region.adjustedAccuracy;
      meter.setAttribute("aria-label", `Сопоставимая точность: ${percent(region.adjustedAccuracy)}`);
      accuracy.append(meter);
    }
    row.append(accuracy);
    const difference = region.difference === null ? "—" : `${region.difference > 0 ? "+" : ""}${decimal(region.difference)}`;
    row.append(make("td", difference, "difference-cell"));
    const sample = make("td");
    sample.append(make("span", !comparison.commonLevels.length ? "Нет сравнения" : region.smallSample ? "Малая выборка" : "Порог достигнут", `sample-label${region.smallSample ? " small" : ""}`));
    sample.append(make("small", `${integer(region.comparableSessions)} игр на общих уровнях`));
    row.append(sample);
    return row;
  });
  $("comparison-body").replaceChildren(...rows);
  if (!rows.length) emptyRow($("comparison-body"), headings.length, data.cohorts.length ? "Не выбраны регионы" : "Нет прохождений за выбранный период");
}

function renderProducts() {
  if (!comparison) return;
  const head = make("tr");
  ["Продукт / уровень", ...comparison.regions, "Разрыв, п.п."].forEach((text) => head.append(make("th", text)));
  $("products-head").replaceChildren(head);
  const search = $("product-search").value.trim().toLocaleLowerCase("ru");
  const sort = $("product-sort").value;
  const products = comparison.productRows.filter((product) => product.foodName.toLocaleLowerCase("ru").includes(search)).sort((a, b) => {
    if (sort === "name") return a.foodName.localeCompare(b.foodName, "ru") || a.level - b.level;
    const key = sort === "gap" ? "gap" : "averageErrorRate";
    return (b[key] ?? -1) - (a[key] ?? -1) || b.averageErrorRate - a.averageErrorRate || a.foodName.localeCompare(b.foodName, "ru");
  });
  $("products-body").replaceChildren(...products.map((product) => {
    const row = make("tr");
    const name = make("th");
    name.scope = "row";
    name.append(make("strong", product.foodName), make("small", `Уровень ${product.level}`));
    row.append(name);
    for (const region of comparison.regions) {
      const item = product.cells[region];
      const cell = make("td");
      if (item) {
        const rate = make("strong", percent(item.errorRate));
        cell.className = `error-cell heat-${Math.min(3, Math.floor(item.errorRate / 25))}${item.smallSample ? " low-sample" : ""}`;
        cell.title = `Полезное назвали вредным: ${item.goodAsHarmful}. Вредное назвали полезным: ${item.harmfulAsGood}.`;
        cell.append(rate, make("small", `${integer(item.mistakes)} / ${integer(item.answers)}${item.smallSample ? " · мало данных" : ""}`));
      } else {
        cell.className = "no-data-cell";
        cell.textContent = "Нет данных";
      }
      row.append(cell);
    }
    row.append(make("td", product.gap === null ? "—" : decimal(product.gap), "difference-cell"));
    return row;
  }));
  if (!products.length) emptyRow($("products-body"), comparison.regions.length + 2, search ? "По этому названию ничего не найдено" : "Нет ответов для сравнения");
  $("products-note").textContent = `${integer(products.length)} из ${integer(comparison.productRows.length)} продуктов с учётом уровня. Бледные ячейки: менее ${integer(threshold("minimum-answers"))} ответов, исключены из расчёта разрыва. CSV содержит все продукты выбранных регионов.`;
}

for (const id of ["minimum-sessions", "minimum-answers"]) $(id).addEventListener("input", renderComparison);
$("product-search").addEventListener("input", renderProducts);
$("product-sort").addEventListener("change", renderProducts);
const tabs = [$("research-tab"), $("overview-tab")];
function activateTab(tab) {
  for (const item of tabs) {
    const active = tab === item;
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    $(item.getAttribute("aria-controls")).hidden = !active;
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + 1) % tabs.length];
    activateTab(next);
    next.focus();
  });
});
