const state = {
  exercises: load("gym-log-current", []),
  history: load("gym-log-history", []),
  sessionStartedAt: load("gym-log-started-at", null),
};

const form = document.querySelector("#exerciseForm");
const list = document.querySelector("#exerciseList");
const historyList = document.querySelector("#historyList");
const progressList = document.querySelector("#progressList");
const progressEmpty = document.querySelector("#progressEmpty");
const progressSummary = document.querySelector("#progressSummary");
const exerciseSuggestions = document.querySelector("#exerciseSuggestions");
const emptyState = document.querySelector("#emptyState");
const setRows = document.querySelector("#setRows");
let selectedRest = 90;

if (state.exercises.length && !state.sessionStartedAt) {
  state.sessionStartedAt = new Date().toISOString();
  saveCurrent();
}

document.querySelectorAll("[data-rest]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRest = Number(button.dataset.rest);
    document.querySelectorAll("[data-rest]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
  });
});

document.querySelector("#addSet").addEventListener("click", () => {
  addSetRow(getLastSetValue());
});

document.querySelector("#exerciseName").addEventListener("input", renderExerciseSuggestions);

document.querySelector("#exerciseName").addEventListener("focus", renderExerciseSuggestions);

document.addEventListener("click", (event) => {
  if (event.target.closest(".field-wide") || event.target.closest("#exerciseSuggestions")) return;
  hideExerciseSuggestions();
});

exerciseSuggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggestion]");
  if (!button) return;

  document.querySelector("#exerciseName").value = button.dataset.suggestion;
  hideExerciseSuggestions();
  setRows.querySelector("[name='weight']").focus();
});

setRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-set]");
  if (!button || setRows.children.length === 1) return;
  button.closest(".set-row").remove();
  syncSetLabels();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.sessionStartedAt) {
    state.sessionStartedAt = new Date().toISOString();
  }

  const sets = getSetValues();

  const exercise = {
    id: crypto.randomUUID(),
    name: value("#exerciseName"),
    sets,
    rest: selectedRest,
    createdAt: new Date().toISOString(),
  };

  state.exercises.unshift(exercise);
  saveCurrent();
  form.reset();
  selectedRest = exercise.rest;
  resetSetRows();
  syncRestButtons();
  hideExerciseSuggestions();
  document.querySelector("#exerciseName").focus();
  render();
});

document.querySelector("#finishWorkout").addEventListener("click", () => {
  if (!state.exercises.length) return;

  state.history.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    durationSeconds: getSessionDurationSeconds(),
    exercises: [...state.exercises],
  });
  state.exercises = [];
  state.sessionStartedAt = null;
  persist();
  render();
});

document.querySelector("#clearHistory").addEventListener("click", () => {
  if (!state.history.length || !confirm("Cancellare tutto lo storico?")) return;
  state.history = [];
  persist();
  render();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  state.exercises = state.exercises.filter((exercise) => exercise.id !== button.dataset.delete);
  if (!state.exercises.length) {
    state.sessionStartedAt = null;
  }
  saveCurrent();
  render();
});

function render() {
  const totalSets = state.exercises.reduce((sum, item) => sum + normalizeSets(item).length, 0);

  document.querySelector("#summaryExercises").textContent = state.exercises.length;
  document.querySelector("#summarySets").textContent = totalSets;
  renderDuration();

  emptyState.hidden = state.exercises.length > 0;
  list.innerHTML = state.exercises.map(renderExercise).join("");
  renderExerciseSuggestions();
  renderProgress();
  historyList.innerHTML = state.history.length ? state.history.map(renderHistory).join("") : "<li class=\"empty-state\">Nessun allenamento salvato.</li>";
}

function renderDuration() {
  document.querySelector("#summaryDuration").textContent = formatDuration(getSessionDurationSeconds());
}

function renderExercise(exercise) {
  const sets = normalizeSets(exercise);

  return `
    <li class="exercise-card">
      <header>
        <h3>${escapeHtml(exercise.name)}</h3>
        <button class="delete-row" type="button" data-delete="${exercise.id}" aria-label="Elimina esercizio">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div class="stats">
        <span>${sets.length} serie</span>
        <span>${exercise.rest ?? 90}s pausa</span>
      </div>
      <ol class="set-list">
        ${sets.map((set, index) => `
          <li>
            <span>Serie ${index + 1}</span>
            <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
          </li>
        `).join("")}
      </ol>
    </li>
  `;
}

function renderHistory(workout) {
  const exerciseCount = workout.exercises.length;
  const sets = workout.exercises.reduce((sum, item) => sum + normalizeSets(item).length, 0);
  const date = formatHistoryDate(workout.date);

  return `
    <li class="history-card">
      <details>
        <summary>
          <div>
            <h3>${date}</h3>
            <div class="stats">
              <span>${exerciseCount} esercizi</span>
              <span>${sets} serie</span>
              <span>${formatDuration(workout.durationSeconds ?? 0)}</span>
            </div>
          </div>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <ul class="saved-session-list">
          ${workout.exercises.map(renderSavedExercise).join("")}
        </ul>
      </details>
    </li>
  `;
}

function renderSavedExercise(exercise) {
  const sets = normalizeSets(exercise);

  return `
    <li>
      <header>
        <h4>${escapeHtml(exercise.name)}</h4>
        <span>${exercise.rest ?? 90}s pausa</span>
      </header>
      <ol class="set-list">
        ${sets.map((set, index) => `
          <li>
            <span>Serie ${index + 1}</span>
            <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
          </li>
        `).join("")}
      </ol>
    </li>
  `;
}

function renderExerciseSuggestions() {
  const input = document.querySelector("#exerciseName");
  if (document.activeElement !== input) {
    hideExerciseSuggestions();
    return;
  }

  const query = value("#exerciseName");
  const matches = getExerciseSuggestions(query).slice(0, 6);

  exerciseSuggestions.hidden = matches.length === 0;
  exerciseSuggestions.innerHTML = matches
    .map((name) => `<button type="button" data-suggestion="${escapeAttribute(name)}">${highlightSuggestion(name, query)}</button>`)
    .join("");
}

function hideExerciseSuggestions() {
  exerciseSuggestions.hidden = true;
}

function renderProgress() {
  const progressItems = getProgressItems();

  progressSummary.textContent = progressItems.length
    ? `${progressItems.length} esercizi monitorati`
    : "Ultima vs precedente";
  progressEmpty.hidden = progressItems.length > 0;
  progressList.innerHTML = progressItems.map(renderProgressItem).join("");
}

function renderProgressItem(item) {
  return `
    <li class="progress-card">
      <header>
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <span>${formatDate(item.latest.date)} vs ${formatDate(item.previous.date)}</span>
        </div>
        <strong class="${deltaClass(item.strengthDelta)}">${formatSigned(item.strengthDelta)} kg</strong>
      </header>
      <div class="progress-grid">
        <div>
          <span>Forza stimata</span>
          <strong>${formatNumber(item.latest.estimatedStrength)} kg</strong>
          <small class="${deltaClass(item.strengthDelta)}">${formatSigned(item.strengthDelta)} kg</small>
        </div>
        <div>
          <span>Miglior set</span>
          <strong>${formatNumber(item.latest.bestSet.weight)} kg x ${item.latest.bestSet.reps}</strong>
          <small>${formatNumber(item.previous.bestSet.weight)} kg x ${item.previous.bestSet.reps}</small>
        </div>
        <div>
          <span>Peso / reps</span>
          <strong>${formatSigned(item.maxWeightDelta)} kg</strong>
          <small class="${deltaClass(item.totalRepsDelta)}">${formatSigned(item.totalRepsDelta, 0)} rip. totali</small>
        </div>
      </div>
    </li>
  `;
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function addSetRow(set = { reps: "", weight: "" }) {
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `
    <strong></strong>
    <label class="field">
      <span>Kg</span>
      <input name="weight" type="number" min="0" step="0.5" inputmode="decimal" value="${set.weight}" required />
    </label>
    <label class="field">
      <span>Rip.</span>
      <input name="reps" type="number" min="1" max="100" inputmode="numeric" value="${set.reps}" required />
    </label>
    <button class="delete-row" type="button" data-remove-set aria-label="Elimina serie">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  `;
  setRows.append(row);
  syncSetLabels();
}

function resetSetRows(lastSet = { reps: "", weight: "" }) {
  setRows.innerHTML = "";
  addSetRow(lastSet);
  addSetRow(lastSet);
  addSetRow(lastSet);
}

function syncSetLabels() {
  setRows.querySelectorAll(".set-row").forEach((row, index) => {
    row.querySelector("strong").textContent = index + 1;
    row.querySelector("[data-remove-set]").disabled = setRows.children.length === 1;
  });
}

function syncRestButtons() {
  document.querySelectorAll("[data-rest]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rest) === selectedRest);
  });
}

function getSetValues() {
  return [...setRows.querySelectorAll(".set-row")].map((row) => ({
    weight: Number(row.querySelector("[name='weight']").value),
    reps: Number(row.querySelector("[name='reps']").value),
  }));
}

function getLastSetValue() {
  const lastSet = getSetValues().at(-1);
  if (!lastSet || !lastSet.weight || !lastSet.reps) {
    return { reps: "", weight: "" };
  }
  return lastSet;
}

function normalizeSets(exercise) {
  if (Array.isArray(exercise.sets)) return exercise.sets;

  return Array.from({ length: Number(exercise.sets) || 0 }, () => ({
    reps: Number(exercise.reps) || 0,
    weight: Number(exercise.weight) || 0,
  }));
}

function getProgressItems() {
  const performances = new Map();

  [...state.history].reverse().forEach((workout) => {
    const groupedExercises = groupExercisesByName(workout.exercises);

    groupedExercises.forEach((sets, key) => {
      const item = buildPerformance(key, sets, workout.date);
      if (!performances.has(key)) {
        performances.set(key, []);
      }
      performances.get(key).push(item);
    });
  });

  return [...performances.values()]
    .filter((items) => items.length >= 2)
    .map((items) => {
      const latest = items.at(-1);
      const previous = items.at(-2);

      return {
        name: latest.name,
        latest,
        previous,
        maxWeightDelta: latest.maxWeight - previous.maxWeight,
        totalRepsDelta: latest.totalReps - previous.totalReps,
        strengthDelta: latest.estimatedStrength - previous.estimatedStrength,
      };
    })
    .sort((a, b) => Math.abs(b.strengthDelta) - Math.abs(a.strengthDelta));
}

function getExerciseSuggestions(query = "") {
  const suggestions = new Map();
  const normalizedQuery = exerciseKey(query);

  state.history.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const key = exerciseKey(exercise.name);
      if (!key || suggestions.has(key)) return;
      suggestions.set(key, exercise.name.trim());
    });
  });

  return [...suggestions.values()].filter((name) => {
    if (!normalizedQuery) return true;
    return exerciseKey(name).includes(normalizedQuery);
  });
}

function highlightSuggestion(name, query) {
  const normalizedName = exerciseKey(name);
  const normalizedQuery = exerciseKey(query);
  const index = normalizedQuery ? normalizedName.indexOf(normalizedQuery) : -1;

  if (index === -1) return escapeHtml(name);

  const before = name.slice(0, index);
  const match = name.slice(index, index + query.length);
  const after = name.slice(index + query.length);

  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

function groupExercisesByName(exercises) {
  const grouped = new Map();

  exercises.forEach((exercise) => {
    const key = exerciseKey(exercise.name);
    if (!key) return;

    const existing = grouped.get(key) ?? { name: exercise.name.trim(), sets: [] };
    grouped.set(key, {
      name: existing.name,
      sets: [...existing.sets, ...normalizeSets(exercise)],
    });
  });

  return grouped;
}

function buildPerformance(key, exerciseGroup, date) {
  const cleanSets = exerciseGroup.sets.filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps));
  const bestSet = cleanSets.reduce((best, set) => {
    return estimatedStrength(set) > estimatedStrength(best) ? set : best;
  }, cleanSets[0] ?? { weight: 0, reps: 0 });

  return {
    key,
    name: exerciseGroup.name,
    date,
    maxWeight: Math.max(...cleanSets.map((set) => set.weight), 0),
    totalReps: cleanSets.reduce((sum, set) => sum + set.reps, 0),
    bestSet,
    estimatedStrength: estimatedStrength(bestSet),
  };
}

function estimatedStrength(set) {
  return set.weight * (1 + set.reps / 30);
}

function exerciseKey(name) {
  return name.trim().toLocaleLowerCase("it-IT");
}

function formatNumber(number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(number);
}

function formatSigned(number, fractionDigits = 1) {
  const formatted = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    signDisplay: "always",
  }).format(number);

  return number === 0 ? "0" : formatted;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(date));
}

function formatHistoryDate(date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function deltaClass(number) {
  if (number > 0) return "delta-up";
  if (number < 0) return "delta-down";
  return "delta-flat";
}

function getSessionDurationSeconds() {
  if (!state.sessionStartedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(state.sessionStartedAt).getTime()) / 1000));
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  saveCurrent();
  localStorage.setItem("gym-log-history", JSON.stringify(state.history));
}

function saveCurrent() {
  localStorage.setItem("gym-log-current", JSON.stringify(state.exercises));
  if (state.sessionStartedAt) {
    localStorage.setItem("gym-log-started-at", JSON.stringify(state.sessionStartedAt));
  } else {
    localStorage.removeItem("gym-log-started-at");
  }
}

function escapeHtml(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function escapeAttribute(text) {
  return escapeHtml(text).replaceAll('"', "&quot;");
}

resetSetRows();
render();
setInterval(renderDuration, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
