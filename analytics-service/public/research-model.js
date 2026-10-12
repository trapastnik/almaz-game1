export function buildRegionalComparison(data, selectedRegions = null, minimumSessions = 30, minimumAnswers = 20) {
  const availableRegions = [...new Set(data.cohorts.map((row) => row.region))].sort((a, b) => a.localeCompare(b, "ru"));
  const regions = selectedRegions === null ? availableRegions : availableRegions.filter((region) => selectedRegions.includes(region));
  const cohorts = data.cohorts.filter((row) => regions.includes(row.region));
  const levels = [...new Set(cohorts.map((row) => Number(row.level)))].sort((a, b) => a - b);
  const commonLevels = regions.length ? levels.filter((level) => regions.every((region) => cohorts.some((row) => row.region === region && Number(row.level) === level && Number(row.sessions) > 0))) : [];
  const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const regionRows = regions.map((region) => {
    const rows = cohorts.filter((row) => row.region === region);
    const comparable = rows.filter((row) => commonLevels.includes(Number(row.level)));
    return {
      region,
      sessions: sum(rows, "sessions"),
      answers: sum(rows, "answers"),
      demoSessions: sum(rows, "demo_sessions"),
      rawAccuracy: rows.length ? rows.reduce((total, row) => total + Number(row.mean_accuracy) * Number(row.sessions), 0) / sum(rows, "sessions") : null,
      adjustedAccuracy: comparable.length ? comparable.reduce((total, row) => total + Number(row.mean_accuracy), 0) / commonLevels.length : null,
      comparableSessions: sum(comparable, "sessions"),
      minimumLevelSessions: comparable.length ? Math.min(...comparable.map((row) => Number(row.sessions))) : 0,
      smallSample: !comparable.length || comparable.some((row) => Number(row.sessions) < minimumSessions),
      levels: rows.map((row) => ({ level: Number(row.level), sessions: Number(row.sessions), accuracy: Number(row.mean_accuracy) })),
    };
  });
  for (const row of regionRows) {
    const others = regionRows.filter((other) => other.region !== row.region && other.adjustedAccuracy !== null);
    row.difference = row.adjustedAccuracy !== null && others.length ? row.adjustedAccuracy - others.reduce((sum, other) => sum + other.adjustedAccuracy, 0) / others.length : null;
  }
  const products = new Map();
  for (const row of data.products) {
    if (!regions.includes(row.region)) continue;
    const key = `${row.level}:${row.food_id}`;
    if (!products.has(key)) products.set(key, { foodId: row.food_id, foodName: row.food_name, level: Number(row.level), cells: Object.create(null) });
    const answers = Number(row.answers);
    products.get(key).cells[row.region] = {
      answers,
      mistakes: Number(row.mistakes),
      errorRate: answers ? 100 * Number(row.mistakes) / answers : null,
      goodAsHarmful: Number(row.good_as_harmful),
      harmfulAsGood: Number(row.harmful_as_good),
      smallSample: answers < minimumAnswers,
    };
  }
  const productRows = [...products.values()].map((product) => {
    const cells = Object.values(product.cells);
    const comparable = cells.filter((cell) => !cell.smallSample && cell.errorRate !== null);
    return {
      ...product,
      answers: sum(cells, "answers"),
      averageErrorRate: cells.length ? sum(cells, "mistakes") * 100 / sum(cells, "answers") : null,
      gap: comparable.length >= 2 ? Math.max(...comparable.map((cell) => cell.errorRate)) - Math.min(...comparable.map((cell) => cell.errorRate)) : null,
    };
  });
  return { availableRegions, regions, commonLevels, levels, regionRows, productRows,
    sessions: sum(cohorts, "sessions"), answers: sum(cohorts, "answers"), demoSessions: sum(cohorts, "demo_sessions"),
  };
}
