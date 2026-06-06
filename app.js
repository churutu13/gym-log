const state = {
  exercises: load("gym-log-current", []),
  history: load("gym-log-history", []),
  templates: load("gym-log-templates", []),
  profile: load("gym-log-profile", null),
  editingTemplate: load("gym-log-editing-template", null),
  sessionStartedAt: load("gym-log-started-at", null),
  activeTemplateWorkout: load("gym-log-active-template-workout", false),
};

const views = {
  onboarding: document.querySelector("#onboardingView"),
  home: document.querySelector("#homeView"),
  workout: document.querySelector("#workoutView"),
  progress: document.querySelector("#progressView"),
  templates: document.querySelector("#templatesView"),
  history: document.querySelector("#historyView"),
  profile: document.querySelector("#profileView"),
};
const form = document.querySelector("#exerciseForm");
const list = document.querySelector("#exerciseList");
const templatePageList = document.querySelector("#templatePageList");
const templateHistoryList = document.querySelector("#templateHistoryList");
const templatePageEmpty = document.querySelector("#templatePageEmpty");
const templateHistorySummary = document.querySelector("#templateHistorySummary");
const progressPageList = document.querySelector("#progressPageList");
const progressPageEmpty = document.querySelector("#progressPageEmpty");
const historyPageList = document.querySelector("#historyPageList");
const historyPageEmpty = document.querySelector("#historyPageEmpty");
const exerciseSuggestions = document.querySelector("#exerciseSuggestions");
const emptyState = document.querySelector("#emptyState");
const setRows = document.querySelector("#setRows");
let selectedRest = 90;
let currentView = "";
let welcomePlayed = sessionStorage.getItem("gym-log-welcome-played") === "true";
let templateAddMode = false;
let templateExerciseEditMode = false;
let replacingActiveWorkout = false;

if (state.exercises.length && !state.sessionStartedAt) {
  state.sessionStartedAt = new Date().toISOString();
  saveCurrent();
}

if (!state.exercises.length && !state.editingTemplate && state.sessionStartedAt) {
  state.sessionStartedAt = null;
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

document.querySelector("#createBlankTemplate").addEventListener("click", createBlankTemplate);
document.querySelector("#newWorkoutButton").addEventListener("click", (event) => {
  event.stopPropagation();
  openStartPanel();
});
document.querySelector("#startBlankWorkout").addEventListener("click", startBlankWorkout);
document.querySelector("#closeStartSheet").addEventListener("click", closeStartPanel);
document.querySelector("#finishOnboarding").addEventListener("click", finishOnboarding);
document.querySelector("#activeWorkoutPill").addEventListener("click", () => showView("workout"));
document.querySelector("#toggleTemplateEdit").addEventListener("click", () => {
  templateExerciseEditMode = !templateExerciseEditMode;
  render();
});
document.querySelector("#toggleTemplateAdd").addEventListener("click", () => {
  templateAddMode = !templateAddMode;
  render();
});
document.querySelector("#resetDatabase").addEventListener("click", resetDatabase);

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.viewTarget);
  });
});

document.querySelector("#exerciseName").addEventListener("input", renderExerciseSuggestions);

document.querySelector("#exerciseName").addEventListener("focus", renderExerciseSuggestions);

document.addEventListener("click", (event) => {
  if (event.target.closest(".field-wide") || event.target.closest("#exerciseSuggestions")) return;
  hideExerciseSuggestions();
});

document.addEventListener("click", (event) => {
  const startSheet = document.querySelector("#startSheet");
  if (startSheet.hidden) return;
  if (event.target.closest(".choice-card") || event.target.closest("#newWorkoutButton")) return;
  closeStartPanel();
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

templatePageList.addEventListener("click", (event) => {
  handleTemplateListClick(event);
});

templateHistoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-template]");
  if (!button) return;
  saveTemplateFromHistory(button.dataset.historyTemplate);
});

document.querySelector("#startTemplateList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-start-template]");
  if (!button) return;
  startTemplateWorkout(button.dataset.startTemplate);
});

document.querySelector("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = {
    name: value("#profileName") || "Roberto",
    weight: value("#profileWeight"),
    age: value("#profileAge"),
  };
  saveProfile();
  render();
  showView("home");
});

function handleTemplateListClick(event) {
  const loadButton = event.target.closest("[data-template-load]");
  const editButton = event.target.closest("[data-template-edit]");
  const deleteButton = event.target.closest("[data-template-delete]");
  const historyButton = event.target.closest("[data-history-template]");

  if (loadButton) {
    loadTemplate(loadButton.dataset.templateLoad);
  }

  if (editButton) {
    editTemplate(editButton.dataset.templateEdit);
  }

  if (deleteButton) {
    deleteTemplate(deleteButton.dataset.templateDelete);
  }

  if (historyButton) {
    saveTemplateFromHistory(historyButton.dataset.historyTemplate);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.editingTemplate && !state.sessionStartedAt) {
    state.sessionStartedAt = new Date().toISOString();
  }

  const sets = getSetValues();
  if (!sets) return;
  if (!sets.length) {
    alert("Compila almeno una serie.");
    return;
  }

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
  templateAddMode = false;
  document.activeElement?.blur();
  render();
});

document.querySelector("#finishWorkout").addEventListener("click", () => {
  if (state.editingTemplate) {
    saveEditingTemplate();
    return;
  }

  if (!state.exercises.length) {
    state.sessionStartedAt = null;
    state.activeTemplateWorkout = false;
    templateAddMode = false;
    templateExerciseEditMode = false;
    saveCurrent();
    showView("home");
    return;
  }

  state.history.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    durationSeconds: getSessionDurationSeconds(),
    exercises: [...state.exercises],
  });
  state.exercises = [];
  state.sessionStartedAt = null;
  state.activeTemplateWorkout = false;
  templateAddMode = false;
  templateExerciseEditMode = false;
  persist();
  showView("home");
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  const addSetButton = event.target.closest("[data-add-set-to-exercise]");
  const removeSetButton = event.target.closest("[data-remove-inline-set]");
  const restButton = event.target.closest("[data-rest-update]");

  if (button) {
    if (state.activeTemplateWorkout && !templateExerciseEditMode) return;
    state.exercises = state.exercises.filter((exercise) => exercise.id !== button.dataset.delete);
    if (!state.exercises.length) {
      state.sessionStartedAt = null;
      state.activeTemplateWorkout = false;
    }
    saveCurrent();
    render();
    return;
  }

  if (addSetButton) {
    updateExercise(addSetButton.dataset.addSetToExercise, (exercise) => ({
      ...exercise,
      sets: [...normalizeSets(exercise), { weight: 0, reps: 1 }],
    }));
    return;
  }

  if (removeSetButton) {
    const setIndex = Number(removeSetButton.dataset.setIndex);
    updateExercise(removeSetButton.dataset.removeInlineSet, (exercise) => {
      const sets = normalizeSets(exercise).filter((_, index) => index !== setIndex);
      return { ...exercise, sets: sets.length ? sets : [{ weight: 0, reps: 1 }] };
    });
    return;
  }

  if (restButton) {
    updateExercise(restButton.dataset.restUpdate, (exercise) => ({
      ...exercise,
      rest: Number(restButton.dataset.restValue),
    }));
  }
});

list.addEventListener("input", (event) => {
  const input = event.target.closest("[data-set-field]");
  if (!input) return;

  const setIndex = Number(input.dataset.setIndex);
  updateExercise(input.dataset.exerciseId, (exercise) => {
    const sets = normalizeSets(exercise).map((set, index) => {
      if (index !== setIndex) return set;
      return {
        ...set,
        [input.dataset.setField]: Number(input.value) || 0,
      };
    });
    return { ...exercise, sets };
  }, false);
});

historyPageList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-history-delete]");
  const renameButton = event.target.closest("[data-history-rename]");

  if (deleteButton) {
    deleteHistoryWorkout(deleteButton.dataset.historyDelete);
    return;
  }

  if (renameButton) {
    renameHistoryWorkout(renameButton.dataset.historyRename);
  }
});

function showView(viewName) {
  currentView = viewName;
  Object.entries(views).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });
  closeStartPanel();
  if (viewName === "home") {
    playHomeWelcome();
  } else {
    document.body.classList.remove("splash-active");
  }
  render();
}

function playHomeWelcome() {
  const homeView = document.querySelector("#homeView");
  homeView.classList.remove("home-ready");

  if (welcomePlayed) {
    homeView.classList.add("home-ready");
    document.body.classList.remove("splash-active");
    return;
  }

  document.body.classList.add("splash-active");
  window.setTimeout(() => {
    homeView.classList.add("home-ready");
    document.body.classList.remove("splash-active");
    welcomePlayed = true;
    sessionStorage.setItem("gym-log-welcome-played", "true");
    renderActiveWorkoutPill();
  }, 2600);
}

function openStartPanel() {
  replacingActiveWorkout = false;

  if (hasActiveWorkout()) {
    const replace = confirm("Hai già un allenamento in corso. Vuoi iniziarne uno nuovo e sostituire quello attuale?");
    if (!replace) return;
    replacingActiveWorkout = true;
  }

  document.querySelector("#startSheet").hidden = false;
  renderStartTemplates();
}

function closeStartPanel() {
  document.querySelector("#startSheet").hidden = true;
  replacingActiveWorkout = false;
}

function startBlankWorkout() {
  const isReplacing = replacingActiveWorkout || state.exercises.length > 0;
  if (state.exercises.length > 0 && !replacingActiveWorkout && !confirm("Sostituire la sessione corrente?")) return;
  state.editingTemplate = null;
  state.activeTemplateWorkout = false;
  templateAddMode = false;
  templateExerciseEditMode = false;
  replacingActiveWorkout = false;
  state.exercises = [];
  state.sessionStartedAt = isReplacing ? new Date().toISOString() : state.sessionStartedAt ?? new Date().toISOString();
  saveCurrent();
  render();
  showView("workout");
}

function startTemplateWorkout(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  const isReplacing = replacingActiveWorkout || state.exercises.length > 0;
  if (state.exercises.length > 0 && !replacingActiveWorkout && !confirm("Sostituire la sessione corrente?")) return;
  state.editingTemplate = null;
  state.activeTemplateWorkout = true;
  templateAddMode = false;
  templateExerciseEditMode = false;
  replacingActiveWorkout = false;
  state.exercises = cloneSessionExercises(template.exercises);
  state.sessionStartedAt = isReplacing ? new Date().toISOString() : state.sessionStartedAt ?? new Date().toISOString();
  saveCurrent();
  render();
  showView("workout");
}

function finishOnboarding() {
  state.profile = {
    name: value("#profileNameSetup") || "Roberto",
    weight: value("#profileWeightSetup"),
    age: value("#profileAgeSetup"),
  };
  saveProfile();
  render();
  showView("home");
}

function render() {
  const totalSets = state.exercises.reduce((sum, item) => sum + normalizeSets(item).length, 0);

  renderProfile();
  renderWorkoutMode();
  renderActiveWorkoutPill();
  document.querySelector("#summaryExercises").textContent = state.exercises.length;
  document.querySelector("#summarySets").textContent = totalSets;
  renderDuration();

  emptyState.hidden = state.exercises.length > 0 || state.activeTemplateWorkout;
  list.innerHTML = state.exercises.map(renderExercise).join("");
  renderExerciseSuggestions();
  renderTemplates();
  renderStartTemplates();
  renderTemplateHistory();
  renderProgressPage();
  renderHistoryPage();
}

function renderWorkoutMode() {
  const isTemplate = Boolean(state.editingTemplate);
  const isTemplateWorkout = Boolean(state.activeTemplateWorkout && !isTemplate);
  document.body.classList.toggle("template-mode", isTemplate);
  document.body.classList.toggle("template-workout-mode", isTemplateWorkout);
  document.body.classList.toggle("template-edit-open", templateExerciseEditMode);
  document.querySelector("#workoutEyebrow").textContent = isTemplate
    ? "Template"
    : "Allenamento";
  document.querySelector("#workoutTitle").textContent = isTemplate
    ? `Crea ${state.editingTemplate.name}`
    : "Sessione attiva";
  document.querySelector("#workoutListTitle").textContent = isTemplate
    ? "Allenamento in modifica"
    : "Sessione";
  document.querySelector("#finishWorkout").textContent = isTemplate
    ? "Salva template"
    : "Fine allenamento";
  form.hidden = isTemplateWorkout && !templateAddMode;
  document.querySelector("#templateWorkoutActions").hidden = !isTemplateWorkout;
  document.querySelector("#toggleTemplateEdit").textContent = templateExerciseEditMode ? "Fine modifica" : "Edita";
  document.querySelector("#toggleTemplateAdd").textContent = templateAddMode ? "Chiudi aggiunta" : "Aggiungi";
}

function renderActiveWorkoutPill() {
  const pill = document.querySelector("#activeWorkoutPill");
  const isActiveWorkout = hasActiveWorkout();
  const homeIntroRunning = currentView === "home" && !document.querySelector("#homeView").classList.contains("home-ready");
  pill.hidden = !isActiveWorkout || currentView === "workout" || homeIntroRunning;
}

function renderProfile() {
  const profile = state.profile ?? { name: "Roberto", weight: "", age: "" };
  document.querySelector("#welcomeTitle").textContent = `Benvenuto, ${profile.name || "Roberto"}`;
  document.querySelector("#profileName").value = profile.name ?? "";
  document.querySelector("#profileWeight").value = profile.weight ?? "";
  document.querySelector("#profileAge").value = profile.age ?? "";
}

function renderDuration() {
  document.querySelector("#summaryDuration").textContent = formatDuration(getSessionDurationSeconds());
}

function renderExercise(exercise) {
  const sets = normalizeSets(exercise);
  const canEditInline = Boolean(state.activeTemplateWorkout && !state.editingTemplate);
  const canDelete = !state.activeTemplateWorkout || state.editingTemplate || templateExerciseEditMode;

  return `
    <li class="exercise-card">
      <header>
        <h3>${escapeHtml(exercise.name)}</h3>
        ${canDelete ? `
          <button class="delete-row" type="button" data-delete="${exercise.id}" aria-label="Elimina esercizio">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ` : ""}
      </header>
      <div class="stats">
        <span>${sets.length} serie</span>
        <span>${exercise.rest ?? 90}s pausa</span>
      </div>
      <ol class="set-list">
        ${sets.map((set, index) => renderExerciseSet(exercise, set, index, canEditInline)).join("")}
      </ol>
      ${canEditInline ? renderInlineExerciseControls(exercise) : ""}
    </li>
  `;
}

function renderExerciseSet(exercise, set, index, canEditInline) {
  if (!canEditInline) {
    return `
      <li>
        <span>Serie ${index + 1}</span>
        <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
      </li>
    `;
  }

  return `
    <li class="editable-set">
      <span>Serie ${index + 1}</span>
      <label>
        <small>Kg</small>
        <input type="number" min="0" step="0.5" inputmode="decimal" value="${set.weight}" data-set-field="weight" data-exercise-id="${exercise.id}" data-set-index="${index}" />
      </label>
      <label>
        <small>Rip.</small>
        <input type="number" min="1" max="100" inputmode="numeric" value="${set.reps}" data-set-field="reps" data-exercise-id="${exercise.id}" data-set-index="${index}" />
      </label>
      <button class="delete-row small-delete" type="button" data-remove-inline-set="${exercise.id}" data-set-index="${index}" aria-label="Elimina serie">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </li>
  `;
}

function renderInlineExerciseControls(exercise) {
  const rest = exercise.rest ?? 90;
  return `
    <div class="inline-exercise-controls">
      <button type="button" data-add-set-to-exercise="${exercise.id}">Aggiungi serie</button>
      <div class="inline-rest">
        ${[60, 90, 120, 180].map((seconds) => `
          <button type="button" class="${rest === seconds ? "active" : ""}" data-rest-update="${exercise.id}" data-rest-value="${seconds}">${seconds}s</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderHistory(workout, options = {}) {
  const exerciseCount = workout.exercises.length;
  const sets = workout.exercises.reduce((sum, item) => sum + normalizeSets(item).length, 0);
  const date = formatHistoryDate(workout.date);
  const title = workout.title?.trim();
  const templateAction = options.templateAction ?? true;
  const deleteAction = options.deleteAction ?? false;
  const renameAction = options.renameAction ?? false;
  const templateLabel = options.templateLabel ?? "Salva come template";

  return `
    <li class="history-card">
      <details>
        <summary>
          <div>
            <h3>${escapeHtml(title || date)}</h3>
            ${title ? `<span class="history-date-label">${date}</span>` : ""}
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
        ${templateAction ? `
          <div class="template-actions single-action">
            <button type="button" data-history-template="${workout.id}">${templateLabel}</button>
          </div>
        ` : ""}
        ${renameAction ? `
          <div class="template-actions single-action">
            <button type="button" data-history-rename="${workout.id}">Rinomina</button>
          </div>
        ` : ""}
        ${deleteAction ? `
          <div class="template-actions single-action">
            <button class="danger-action" type="button" data-history-delete="${workout.id}">Elimina dallo storico</button>
          </div>
        ` : ""}
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

function renderTemplates() {
  templatePageEmpty.hidden = state.templates.length > 0;
  templatePageList.innerHTML = state.templates.map(renderTemplate).join("");
}

function renderStartTemplates() {
  const list = document.querySelector("#startTemplateList");
  const empty = document.querySelector("#startTemplateEmpty");
  empty.hidden = state.templates.length > 0;
  list.innerHTML = state.templates.map((template) => `
    <li class="template-card">
      <button class="start-template-button" type="button" data-start-template="${template.id}">
        <span>${escapeHtml(template.name)}</span>
        <small>${template.exercises.length} esercizi</small>
      </button>
    </li>
  `).join("");
}

function renderTemplateHistory() {
  templateHistorySummary.textContent = `${state.history.length} sessioni`;
  templateHistoryList.innerHTML = state.history.length
    ? state.history.map((workout) => renderHistory(workout, { templateAction: true, templateLabel: "Crea" })).join("")
    : "<li class=\"empty-state\">Nessuna sessione nello storico.</li>";
}

function renderTemplate(template) {
  const exerciseCount = template.exercises.length;
  const sets = template.exercises.reduce((sum, item) => sum + normalizeSets(item).length, 0);

  return `
    <li class="template-card">
      <details>
        <summary>
          <div>
            <h3>${escapeHtml(template.name)}</h3>
            <div class="stats">
              <span>${exerciseCount} esercizi</span>
              <span>${sets} serie</span>
            </div>
          </div>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div class="template-actions">
          <button type="button" data-template-load="${template.id}">Usa</button>
          <button type="button" data-template-edit="${template.id}">Modifica</button>
          <button type="button" data-template-delete="${template.id}">Elimina</button>
        </div>
        <ul class="saved-session-list">
          ${template.exercises.map(renderSavedExercise).join("")}
        </ul>
      </details>
    </li>
  `;
}

function renderHistoryPage() {
  historyPageEmpty.hidden = state.history.length > 0;
  historyPageList.innerHTML = state.history.map((workout) => renderHistory(workout, { templateAction: false, renameAction: true, deleteAction: true })).join("");
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

function renderProgressPage() {
  const progressItems = getProgressItems();
  progressPageEmpty.hidden = progressItems.length > 0;
  progressPageList.innerHTML = progressItems.map(renderProgressItem).join("");
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

function createBlankTemplate() {
  const name = value("#templateNamePage");
  if (!name) {
    alert("Dai un nome all'allenamento.");
    return;
  }

  const key = exerciseKey(name);
  if (state.templates.some((template) => exerciseKey(template.name) === key)) {
    alert("Esiste già un allenamento con questo nome.");
    return;
  }

  if (state.exercises.length && !confirm("Sostituire la sessione corrente?")) return;
  state.editingTemplate = { id: crypto.randomUUID(), name };
  state.activeTemplateWorkout = false;
  state.exercises = [];
  state.sessionStartedAt = null;
  document.querySelector("#templateNamePage").value = "";
  saveCurrent();
  render();
  showView("workout");
}

function saveTemplateFromExercises(name, exercises) {
  const key = exerciseKey(name);
  const existing = state.templates.find((template) => exerciseKey(template.name) === key);
  const templateData = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    exercises: cloneTemplateExercises(exercises),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    state.templates = state.templates.map((template) => template.id === existing.id ? templateData : template);
  } else {
    state.templates.unshift(templateData);
  }
}

function saveTemplateFromHistory(workoutId) {
  const workout = state.history.find((item) => item.id === workoutId);
  if (!workout) return;

  const name = prompt("Nome allenamento");
  if (!name) return;

  saveTemplateFromExercises(name, workout.exercises);

  saveTemplates();
  render();
}

function editTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  if (state.exercises.length && !state.editingTemplate && !confirm("Sostituire la sessione corrente?")) return;

  state.editingTemplate = {
    id: template.id,
    name: template.name,
  };
  state.activeTemplateWorkout = false;
  state.exercises = cloneSessionExercises(template.exercises);
  state.sessionStartedAt = null;
  saveCurrent();
  render();
  showView("workout");
}

function saveEditingTemplate() {
  if (!state.editingTemplate) return;
  if (!state.exercises.length) {
    alert("Aggiungi almeno un esercizio prima di salvare il template.");
    return;
  }

  saveTemplateFromExercises(state.editingTemplate.name, state.exercises);
  state.editingTemplate = null;
  state.activeTemplateWorkout = false;
  state.exercises = [];
  state.sessionStartedAt = null;
  saveCurrent();
  saveTemplates();
  render();
  showView("templates");
}

function loadTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;

  if (hasActiveWorkout() && !confirm("Hai già un allenamento in corso. Vuoi iniziarne uno nuovo con questo template?")) return;
  if (!hasActiveWorkout() && state.exercises.length && !confirm("Sostituire la sessione corrente con questo template?")) return;

  state.editingTemplate = null;
  state.activeTemplateWorkout = true;
  templateAddMode = false;
  templateExerciseEditMode = false;
  state.exercises = cloneSessionExercises(template.exercises);
  state.sessionStartedAt = new Date().toISOString();
  saveCurrent();
  render();
  showView("workout");
}

function deleteTemplate(templateId) {
  if (!confirm("Cancellare questo template?")) return;

  state.templates = state.templates.filter((template) => template.id !== templateId);
  saveTemplates();
  render();
}

function deleteHistoryWorkout(workoutId) {
  if (!confirm("Eliminare questo allenamento dallo storico?")) return;
  state.history = state.history.filter((workout) => workout.id !== workoutId);
  persist();
  render();
}

function renameHistoryWorkout(workoutId) {
  const workout = state.history.find((item) => item.id === workoutId);
  if (!workout) return;

  const currentName = workout.title?.trim() || "";
  const name = prompt("Nome allenamento", currentName);
  if (name === null) return;

  state.history = state.history.map((item) => {
    if (item.id !== workoutId) return item;
    return { ...item, title: name.trim() };
  });
  persist();
  render();
}

function updateExercise(exerciseId, updater, rerender = true) {
  state.exercises = state.exercises.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return updater(exercise);
  });
  saveCurrent();
  if (rerender) render();
}

function resetDatabase() {
  if (!confirm("Eliminare profilo, storico, template e sessione attiva?")) return;

  state.exercises = [];
  state.history = [];
  state.templates = [];
  state.profile = null;
  state.editingTemplate = null;
  state.sessionStartedAt = null;
  state.activeTemplateWorkout = false;
  templateAddMode = false;
  templateExerciseEditMode = false;
  welcomePlayed = false;

  [
    "gym-log-current",
    "gym-log-history",
    "gym-log-templates",
    "gym-log-profile",
    "gym-log-editing-template",
    "gym-log-started-at",
    "gym-log-active-template-workout",
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("gym-log-welcome-played");

  document.querySelector("#profileNameSetup").value = "";
  document.querySelector("#profileWeightSetup").value = "";
  document.querySelector("#profileAgeSetup").value = "";
  showView("onboarding");
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
      <input name="weight" type="number" min="0" step="0.5" inputmode="decimal" value="${set.weight}" />
    </label>
    <label class="field">
      <span>Rip.</span>
      <input name="reps" type="number" min="1" max="100" inputmode="numeric" value="${set.reps}" />
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
  const sets = [];

  for (const row of setRows.querySelectorAll(".set-row")) {
    const weight = row.querySelector("[name='weight']").value.trim();
    const reps = row.querySelector("[name='reps']").value.trim();
    const isEmpty = !weight && !reps;

    if (isEmpty) continue;

    if (!weight || !reps) {
      alert("Completa kg e ripetizioni nelle serie iniziate, oppure lasciale vuote.");
      return null;
    }

    sets.push({
      weight: Number(weight),
      reps: Number(reps),
    });
  }

  return sets;
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

function cloneTemplateExercises(exercises) {
  return exercises.map((exercise) => ({
    name: exercise.name,
    rest: exercise.rest ?? 90,
    sets: normalizeSets(exercise).map((set) => ({
      weight: set.weight,
      reps: set.reps,
    })),
  }));
}

function cloneSessionExercises(exercises) {
  return exercises.map((exercise) => ({
    id: crypto.randomUUID(),
    name: exercise.name,
    rest: exercise.rest ?? 90,
    sets: normalizeSets(exercise).map((set) => ({
      weight: set.weight,
      reps: set.reps,
    })),
    createdAt: new Date().toISOString(),
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

  state.templates.forEach((template) => {
    template.exercises.forEach((exercise) => {
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

function hasActiveWorkout() {
  return Boolean(state.sessionStartedAt && !state.editingTemplate);
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
  saveTemplates();
}

function saveCurrent() {
  localStorage.setItem("gym-log-current", JSON.stringify(state.exercises));
  if (state.editingTemplate) {
    localStorage.setItem("gym-log-editing-template", JSON.stringify(state.editingTemplate));
  } else {
    localStorage.removeItem("gym-log-editing-template");
  }
  if (state.sessionStartedAt && state.exercises.length) {
    localStorage.setItem("gym-log-started-at", JSON.stringify(state.sessionStartedAt));
  } else {
    localStorage.removeItem("gym-log-started-at");
  }
  if (state.activeTemplateWorkout && state.exercises.length) {
    localStorage.setItem("gym-log-active-template-workout", JSON.stringify(true));
  } else {
    localStorage.removeItem("gym-log-active-template-workout");
  }
}

function saveTemplates() {
  localStorage.setItem("gym-log-templates", JSON.stringify(state.templates));
}

function saveProfile() {
  localStorage.setItem("gym-log-profile", JSON.stringify(state.profile));
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
showView(state.profile ? "home" : "onboarding");
setInterval(renderDuration, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update();
    }).catch(() => {});
  });
}
