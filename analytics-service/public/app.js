const elements = {
  status: document.querySelector("#load-status"),
  from: document.querySelector("#from-date"),
  to: document.querySelector("#to-date"),
  region: document.querySelector("#region-filter"),
  city: document.querySelector("#city-filter"),
  venue: document.querySelector("#venue-filter"),
  level: document.querySelector("#level-filter"),
  export: document.querySelector("#export-link"),
  dialog: document.querySelector("#activation-dialog"),
};

let locations = [];

function localDateInput(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatDuration(milliseconds) {
  const seconds = Math.round((Number(milliseconds) || 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "Ещё не выходил на связь";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function queryParameters() {
  const parameters = new URLSearchParams();
  for (const [name, control] of [["from", elements.from], ["to", elements.to], ["region", elements.region], ["city", elements.city], ["venue", elements.venue], ["level", elements.level]]) {
    if (control.value) parameters.set(name, control.value);
  }
  return parameters;
}

function fillSelect(select, values, emptyLabel) {
  const current = select.value;
  select.replaceChildren(new Option(emptyLabel, ""), ...values.map((value) => new Option(value, value)));
  if (values.includes(current)) select.value = current;
}

function refreshLocationFilters(changed) {
  if (changed === "region") {
    elements.city.value = "";
    elements.venue.value = "";
  }
  if (changed === "city") elements.venue.value = "";
  const selectedRegion = elements.region.value;
  const selectedCity = elements.city.value;
  const relevantCities = [...new Set(locations.filter((item) => !selectedRegion || item.region === selectedRegion).map((item) => item.city))].sort();
  fillSelect(elements.city, relevantCities, "Все города");
  const relevantVenues = [...new Set(locations.filter((item) => (!selectedRegion || item.region === selectedRegion) && (!selectedCity || item.city === selectedCity)).map((item) => item.venue))].sort();
  fillSelect(elements.venue, relevantVenues, "Все площадки");
}

function renderTrend(rows) {
  const container = document.querySelector("#trend-chart");
  if (!rows.length) return container.replaceChildren(make("p", "Данные пока не поступали", "empty"));
  const maximum = Math.max(...rows.map((row) => Number(row.sessions)));
  container.replaceChildren(...rows.map((row) => {
    const column = make("div", undefined, "trend-column");
    column.title = `${row.day}: ${row.sessions}`;
    const bar = make("i");
    bar.style.height = `${Math.max(3, (Number(row.sessions) / maximum) * 100)}%`;
    const label = make("span", row.day.slice(5).replace("-", "."));
    column.append(bar, label);
    return column;
  }));
}

function renderLevels(rows) {
  const container = document.querySelector("#level-list");
  if (!rows.length) return container.replaceChildren(make("p", "Нет данных", "empty"));
  container.replaceChildren(...rows.map((row) => {
    const item = make("div", undefined, "level-row");
    const title = make("strong", `Уровень ${row.level}`);
    const track = make("div", undefined, "level-track");
    const fill = make("i");
    fill.style.width = `${row.accuracy}%`;
    track.append(fill);
    const details = make("span", `${row.accuracy}% · ${formatNumber(row.sessions)} игр · ${formatDuration(row.average_duration_ms)}`);
    item.append(title, track, details);
    return item;
  }));
}

function renderRegions(rows) {
  const body = document.querySelector("#regions-body");
  body.replaceChildren(...rows.map((row) => {
    const tr = document.createElement("tr");
    [row.region, formatNumber(row.sessions), `${row.accuracy}%`, formatNumber(row.average_score)].forEach((value) => tr.append(make("td", value)));
    return tr;
  }));
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = make("td", "Нет данных за выбранный период", "empty");
    td.colSpan = 4;
    tr.append(td);
    body.append(tr);
  }
}

function renderHardest(rows) {
  const list = document.querySelector("#hardest-list");
  if (!rows.length) return list.replaceChildren(make("li", "Ошибок пока нет", "empty"));
  list.replaceChildren(...rows.map((row, index) => {
    const item = document.createElement("li");
    item.append(make("span", String(index + 1)), make("strong", row.food_name), make("b", `${row.mistakes} из ${row.answers}`));
    return item;
  }));
}

async function disableDevice(row, button) {
  if (!window.confirm(`Отключить «${row.table_label}»? Стол перестанет отправлять результаты, для повторного подключения потребуется новый код.`)) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/analytics/admin/devices/${row.id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Не удалось отключить стол");
    await loadSummary();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
}

function renderDevices(rows) {
  const body = document.querySelector("#devices-body");
  body.replaceChildren(...rows.map((row) => {
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at) : null;
    const age = lastSeen ? Date.now() - lastSeen.getTime() : Infinity;
    const status = row.disabled_at ? ["Отключён", ""] : age < 86_400_000 ? ["На связи", "online"] : age < 7 * 86_400_000 ? ["Нет связи", "stale"] : ["Давно не в сети", ""];
    const tr = document.createElement("tr");
    [row.region, row.city, row.venue, row.table_label, formatDate(row.last_seen_at), formatNumber(row.sessions)].forEach((value) => tr.append(make("td", value)));
    const statusCell = document.createElement("td");
    statusCell.append(make("span", status[0], `status-pill ${status[1]}`));
    tr.append(statusCell);
    const actionCell = document.createElement("td");
    if (!row.disabled_at) {
      const button = make("button", "Отключить", "table-action danger");
      button.type = "button";
      button.addEventListener("click", () => void disableDevice(row, button));
      actionCell.append(button);
    } else {
      actionCell.append(make("span", "Доступ закрыт", "muted-value"));
    }
    tr.append(actionCell);
    return tr;
  }));
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = make("td", "Столы ещё не подключены", "empty");
    td.colSpan = 8;
    tr.append(td);
    body.append(tr);
  }
}

async function loadSummary() {
  elements.status.textContent = "Обновление...";
  const parameters = queryParameters();
  elements.export.href = `/api/analytics/admin/export.csv?${parameters}`;
  try {
    const response = await fetch(`/api/analytics/admin/summary?${parameters}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить аналитику");
    const data = await response.json();
    document.querySelector("#metric-sessions").textContent = formatNumber(data.overview.sessions);
    document.querySelector("#metric-accuracy").textContent = `${data.overview.accuracy}%`;
    document.querySelector("#metric-answers").textContent = `${formatNumber(data.overview.answers)} ответов`;
    document.querySelector("#metric-score").textContent = formatNumber(data.overview.average_score);
    document.querySelector("#metric-devices").textContent = `${data.overview.active_devices} / ${data.overview.devices}`;
    renderTrend(data.byDay);
    renderLevels(data.byLevel);
    renderRegions(data.byRegion);
    renderHardest(data.hardest);
    renderDevices(data.devices);
    locations = data.locations;
    fillSelect(elements.region, [...new Set(locations.map((item) => item.region))].sort(), "Все регионы");
    refreshLocationFilters();
    elements.status.textContent = `Обновлено ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    elements.status.textContent = error.message;
  }
}

const today = new Date();
const monthAgo = new Date(today.getTime() - 29 * 86_400_000);
elements.from.value = localDateInput(monthAgo);
elements.to.value = localDateInput(today);

document.querySelector("#apply-filters").addEventListener("click", loadSummary);
elements.region.addEventListener("change", () => refreshLocationFilters("region"));
elements.city.addEventListener("change", () => refreshLocationFilters("city"));
document.querySelector("#show-activation").addEventListener("click", () => elements.dialog.showModal());
document.querySelector("#close-activation").addEventListener("click", () => elements.dialog.close());

document.querySelector("#activation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#activation-error");
  const codeBox = document.querySelector("#activation-code");
  error.textContent = "";
  codeBox.hidden = true;
  const body = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch("/api/analytics/admin/activation-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось создать код");
    codeBox.querySelector("strong").textContent = result.code;
    codeBox.hidden = false;
    form.querySelector("button[type=submit]").textContent = "Создать другой код";
  } catch (caught) {
    error.textContent = caught.message;
  }
});

loadSummary();
