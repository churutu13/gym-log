const state = {
  exercises: load("gym-log-current", []),
  history: load("gym-log-history", []),
  templates: load("gym-log-templates", []),
  myExercises: load("gym-log-my-exercises", []),
  weightEntries: load("gym-log-weight-entries", []),
  profile: load("gym-log-profile", null),
  editingTemplate: load("gym-log-editing-template", null),
  sessionStartedAt: load("gym-log-started-at", null),
  activeTemplateWorkout: load("gym-log-active-template-workout", false),
};

const views = {
  intro: document.querySelector("#introView"),
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
const weightProgressPanel = document.querySelector("#weightProgressPanel");
const historyPageList = document.querySelector("#historyPageList");
const historyPageEmpty = document.querySelector("#historyPageEmpty");
const exerciseSuggestions = document.querySelector("#exerciseSuggestions");
const emptyState = document.querySelector("#emptyState");
const setRows = document.querySelector("#setRows");
const durationField = document.querySelector("#durationField");
const stretchingSetsField = document.querySelector("#stretchingSetsField");
const myExercisesList = document.querySelector("#myExercisesList");
const myExercisesEmpty = document.querySelector("#myExercisesEmpty");
const myExercisesSummary = document.querySelector("#myExercisesSummary");
let selectedRest = 90;
let currentView = "";
let currentExerciseType = "strength";
let introPlayed = sessionStorage.getItem("gym-log-intro-played") === "true";
let welcomePlayed = sessionStorage.getItem("gym-log-welcome-played") === "true";
let templateAddMode = false;
let templateExerciseEditMode = false;
let replacingActiveWorkout = false;
let saveCurrentTimer = null;

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

document.querySelectorAll("[name='exerciseType']").forEach((input) => {
  input.addEventListener("change", () => {
    currentExerciseType = input.value;
    renderExerciseTypeFields();
  });
});

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
  if (currentExerciseType === "strength") {
    setRows.querySelector("[name='weight']").focus();
  } else {
    document.querySelector("#exerciseDuration").focus();
  }
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
  const weight = value("#profileWeight");
  const newGoal = checkedValue("profileGoal") || "massa";
  const previousGoal = state.profile?.goal ?? "massa";
  if (state.profile && previousGoal !== newGoal) {
    const confirmed = confirm("Vuoi cambiare obiettivo? I progressi peso useranno la nuova direzione.");
    if (!confirmed) {
      renderProfile();
      return;
    }
  }
  state.profile = {
    name: value("#profileName") || "Roberto",
    weight,
    age: value("#profileAge"),
    goal: newGoal,
    gender: checkedValue("profileGender") || "neutral",
  };
  addWeightEntry(weight);
  saveProfile();
  render();
  showView("home");
});

document.querySelector("#myExerciseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  addMyExercise(value("#myExerciseName"), checkedValue("myExerciseType") || "strength");
});

myExercisesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-my-exercise-delete]");
  if (!button) return;
  deleteMyExercise(button.dataset.myExerciseDelete);
});

weightProgressPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.target.querySelector("[name='weeklyWeight']");
  addWeightEntry(input.value.trim(), true);
  renderProgressPage();
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

  const exerciseType = currentExerciseType;
  const durationValue = Number(value("#exerciseDuration"));
  const stretchingSets = Number(value("#stretchingSets"));
  const sets = exerciseType === "strength" ? getSetValues() : [];
  if (sets === null) return;

  if (exerciseType === "strength" && !sets.length) {
    alert("Compila almeno una serie.");
    return;
  }

  if (exerciseType !== "strength" && (!durationValue || durationValue < 1)) {
    alert("Inserisci la durata dell'esercizio.");
    return;
  }

  if (exerciseType === "stretching" && (!stretchingSets || stretchingSets < 1)) {
    alert("Inserisci le serie dello stretching.");
    return;
  }

  const exercise = {
    id: crypto.randomUUID(),
    name: value("#exerciseName"),
    type: exerciseType,
    sets,
    durationMinutes: exerciseType === "cardio" ? durationValue : null,
    durationSeconds: exerciseType === "stretching" ? durationValue : null,
    stretchSets: exerciseType === "stretching" ? stretchingSets : null,
    rest: selectedRest,
    createdAt: new Date().toISOString(),
  };

  state.exercises.unshift(exercise);
  rememberExerciseName(exercise.name, exercise.type);
  saveCurrent();
  form.reset();
  currentExerciseType = exerciseType;
  selectedRest = exercise.rest;
  resetSetRows();
  renderExerciseTypeFields();
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
  const previousView = currentView;
  currentView = viewName;
  Object.entries(views).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });
  closeStartPanel();
  if (viewName === "home") {
    playHomeWelcome();
  } else if (viewName === "intro") {
    playIntro();
  } else {
    document.body.classList.remove("splash-active");
  }
  render();
  if (previousView && previousView !== viewName) {
    closeCollapsibleMenus();
  }
}

function playIntro() {
  document.body.classList.add("splash-active");
  window.setTimeout(() => {
    introPlayed = true;
    sessionStorage.setItem("gym-log-intro-played", "true");
    showView(state.profile ? "home" : "onboarding");
  }, 8000);
}

function closeCollapsibleMenus() {
  document.querySelectorAll("details[open]").forEach((details) => {
    details.open = false;
  });
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
  const weight = value("#profileWeightSetup");
  state.profile = {
    name: value("#profileNameSetup") || "Roberto",
    weight,
    age: value("#profileAgeSetup"),
    goal: checkedValue("goalSetup") || "massa",
    gender: checkedValue("genderSetup") || "neutral",
  };
  addWeightEntry(weight);
  saveProfile();
  render();
  showView("home");
}

function render() {
  const totalSets = countSessionSets(state.exercises);
  const shouldRenderAll = !currentView;

  renderProfile();
  renderWorkoutMode();
  renderExerciseTypeFields();
  renderMyExercises();
  renderActiveWorkoutPill();
  document.querySelector("#summaryExercises").textContent = state.exercises.length;
  document.querySelector("#summarySets").textContent = totalSets;
  renderDuration();

  emptyState.hidden = state.exercises.length > 0 || state.activeTemplateWorkout;
  list.innerHTML = state.exercises.map(renderExercise).join("");
  renderExerciseSuggestions();

  if (shouldRenderAll || currentView === "templates") {
    renderTemplates();
    renderTemplateHistory();
  }

  if (shouldRenderAll || currentView === "progress") {
    renderProgressPage();
  }

  if (shouldRenderAll || currentView === "history") {
    renderHistoryPage();
  }

  if (!document.querySelector("#startSheet").hidden) {
    renderStartTemplates();
  }
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
  const profile = state.profile ?? { name: "Roberto", weight: "", age: "", goal: "massa", gender: "neutral" };
  const gender = profile.gender ?? inferGender(profile.name);
  document.querySelector("#welcomeTitle").textContent = `${welcomeWord(gender)}, ${profile.name || "Roberto"}`;
  document.querySelector("#profileName").value = profile.name ?? "";
  document.querySelector("#profileWeight").value = profile.weight ?? "";
  document.querySelector("#profileAge").value = profile.age ?? "";
  document.querySelectorAll("[name='profileGender']").forEach((input) => {
    input.checked = input.value === gender;
  });
  document.querySelectorAll("[name='profileGoal']").forEach((input) => {
    input.checked = input.value === (profile.goal ?? "massa");
  });
}

function renderExerciseTypeFields() {
  document.querySelectorAll("[name='exerciseType']").forEach((input) => {
    input.checked = input.value === currentExerciseType;
  });
  const isStrength = currentExerciseType === "strength";
  const isStretching = currentExerciseType === "stretching";
  document.querySelector(".set-builder").hidden = !isStrength;
  document.querySelector(".rest-panel").hidden = !isStrength;
  durationField.hidden = isStrength;
  stretchingSetsField.hidden = !isStretching;
  document.querySelector("#exerciseDuration").required = !isStrength;
  document.querySelector("#stretchingSets").required = isStretching;
  document.querySelector("#durationLabel").textContent = isStretching ? "Durata in secondi" : "Durata in minuti";
  document.querySelector("#exerciseDuration").max = isStretching ? "3600" : "600";
}

function renderMyExercises() {
  myExercisesSummary.textContent = `${state.myExercises.length} salvati`;
  myExercisesEmpty.hidden = state.myExercises.length > 0;
  myExercisesList.innerHTML = ["strength", "cardio", "stretching"].map((type) => {
    const exercises = state.myExercises.filter((exercise) => (exercise.type ?? "strength") === type);
    if (!exercises.length) return "";

    return `
      <li class="library-group">
        <h3>${exerciseTypeLabel(type)}</h3>
        <ul>
          ${exercises.map((exercise) => `
            <li class="library-row">
              <span>${escapeHtml(exercise.name)}</span>
              <button class="delete-row" type="button" data-my-exercise-delete="${exercise.id}" aria-label="Elimina esercizio">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </li>
          `).join("")}
        </ul>
      </li>
    `;
  }).join("");
}

function renderDuration() {
  document.querySelector("#summaryDuration").textContent = formatDuration(getSessionDurationSeconds());
}

function renderExercise(exercise) {
  const sets = normalizeSets(exercise);
  const type = exercise.type ?? "strength";
  const canEditInline = Boolean(state.activeTemplateWorkout && !state.editingTemplate);
  const canDelete = !state.activeTemplateWorkout || state.editingTemplate || templateExerciseEditMode;

  return `
    <li class="exercise-card">
      <header>
        <div>
          <h3>${escapeHtml(exercise.name)}</h3>
          ${type !== "strength" ? `<span class="type-label">${exerciseTypeLabel(type)}</span>` : ""}
        </div>
        ${canDelete ? `
          <button class="delete-row" type="button" data-delete="${exercise.id}" aria-label="Elimina esercizio">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ` : ""}
      </header>
      <div class="stats">
        ${type === "strength" ? `
          <span>${sets.length} serie</span>
          <span>${exercise.rest ?? 90}s pausa</span>
        ` : `
          <span>${formatExerciseDuration(exercise)} durata</span>
          ${type === "stretching" ? `<span>${getStretchSets(exercise)} serie</span>` : ""}
        `}
      </div>
      ${type === "strength" ? `
        <ol class="set-list">
          ${sets.map((set, index) => renderExerciseSet(exercise, set, index, canEditInline)).join("")}
        </ol>
        ${canEditInline ? renderInlineExerciseControls(exercise) : ""}
      ` : ""}
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
  const sets = countSessionSets(workout.exercises);
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
  const type = exercise.type ?? "strength";

  return `
    <li>
      <header>
        <div>
          <h4>${escapeHtml(exercise.name)}</h4>
          ${type !== "strength" ? `<span class="type-label">${exerciseTypeLabel(type)}</span>` : ""}
        </div>
        <span>${type === "strength" ? `${exercise.rest ?? 90}s pausa` : formatExerciseDuration(exercise)}</span>
      </header>
      ${type === "stretching" ? `
        <ol class="set-list">
          <li>
            <span>Serie</span>
            <strong>${getStretchSets(exercise)}</strong>
          </li>
        </ol>
      ` : ""}
      ${type === "strength" ? `
        <ol class="set-list">
          ${sets.map((set, index) => `
            <li>
              <span>Serie ${index + 1}</span>
              <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
            </li>
          `).join("")}
        </ol>
      ` : ""}
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
  const sets = countSessionSets(template.exercises);

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
  const matches = getExerciseSuggestions(query, currentExerciseType).slice(0, 6);

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
  renderWeightProgress();
  progressPageEmpty.hidden = progressItems.length > 0;
  progressPageList.innerHTML = progressItems.map(renderProgressItem).join("");
}

function renderWeightProgress() {
  const entries = [...state.weightEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = entries.at(-1);
  const previous = entries.at(-2);
  const profile = state.profile ?? {};
  const goal = profile.goal ?? "massa";
  const due = isWeightUpdateDue(latest?.date);
  const delta = latest && previous ? latest.weight - previous.weight : 0;
  const goalCopy = goal === "perdere-peso"
    ? "Obiettivo: perdere peso"
    : "Obiettivo: massa";

  weightProgressPanel.innerHTML = `
    <article class="progress-card weight-card">
      <header>
        <div>
          <h3>Peso corporeo</h3>
          <span>${goalCopy}</span>
        </div>
        ${latest ? `<strong class="${deltaClass(delta)}">${formatNumber(latest.weight)} kg</strong>` : ""}
      </header>
      <div class="progress-grid">
        <div>
          <span>Ultimo dato</span>
          <strong>${latest ? `${formatNumber(latest.weight)} kg` : "-"}</strong>
          <small>${latest ? formatDate(latest.date) : "Da aggiornare"}</small>
        </div>
        <div>
          <span>Variazione</span>
          <strong>${latest && previous ? `${formatSigned(delta)} kg` : "0"}</strong>
          <small>${previous ? `da ${formatDate(previous.date)}` : "primo dato"}</small>
        </div>
        <div>
          <span>Direzione</span>
          <strong>${goal === "perdere-peso" ? "Peso giu" : "Massa su"}</strong>
          <small>${weightTrendCopy(goal, delta, entries.length)}</small>
        </div>
      </div>
      ${due ? `
        <form class="weekly-weight-form">
          <label class="field">
            <span>Promemoria settimanale</span>
            <input name="weeklyWeight" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Aggiorna peso" required />
          </label>
          <button class="primary-action" type="submit">Aggiorna peso</button>
        </form>
      ` : ""}
    </article>
  `;
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

function addMyExercise(name, type = "strength") {
  const cleanName = name.trim();
  if (!cleanName) {
    alert("Inserisci il nome dell'esercizio.");
    return;
  }

  const key = exerciseKey(cleanName);
  if (state.myExercises.some((exercise) => exerciseKey(exercise.name) === key && (exercise.type ?? "strength") === type)) {
    alert("Questo esercizio e' gia salvato.");
    return;
  }

  state.myExercises.unshift({
    id: crypto.randomUUID(),
    name: cleanName,
    type,
    createdAt: new Date().toISOString(),
  });
  document.querySelector("#myExerciseName").value = "";
  document.querySelector("[name='myExerciseType'][value='strength']").checked = true;
  saveMyExercises();
  render();
}

function rememberExerciseName(name, type = "strength") {
  const cleanName = name.trim();
  const key = exerciseKey(cleanName);
  if (!key || state.myExercises.some((exercise) => exerciseKey(exercise.name) === key && (exercise.type ?? "strength") === type)) return;

  state.myExercises.unshift({
    id: crypto.randomUUID(),
    name: cleanName,
    type,
    createdAt: new Date().toISOString(),
  });
  saveMyExercises();
}

function deleteMyExercise(exerciseId) {
  state.myExercises = state.myExercises.filter((exercise) => exercise.id !== exerciseId);
  saveMyExercises();
  render();
}

function addWeightEntry(weightValue, shouldSyncProfile = false) {
  const weight = Number(weightValue);
  if (!weight || weight <= 0) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const existingIndex = state.weightEntries.findIndex((entry) => entry.date.slice(0, 10) === todayKey);
  const entry = {
    id: existingIndex >= 0 ? state.weightEntries[existingIndex].id : crypto.randomUUID(),
    weight,
    date: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    state.weightEntries[existingIndex] = entry;
  } else {
    state.weightEntries.push(entry);
  }

  if (shouldSyncProfile && state.profile) {
    state.profile = { ...state.profile, weight: String(weight) };
    saveProfile();
  }

  saveWeightEntries();
}

function updateExercise(exerciseId, updater, rerender = true) {
  state.exercises = state.exercises.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return updater(exercise);
  });
  if (rerender) {
    saveCurrent();
    render();
  } else {
    scheduleSaveCurrent();
  }
}

function resetDatabase() {
  if (!confirm("Eliminare profilo, storico, template e sessione attiva?")) return;

  state.exercises = [];
  state.history = [];
  state.templates = [];
  state.myExercises = [];
  state.weightEntries = [];
  state.profile = null;
  state.editingTemplate = null;
  state.sessionStartedAt = null;
  state.activeTemplateWorkout = false;
  templateAddMode = false;
  templateExerciseEditMode = false;
  introPlayed = false;
  welcomePlayed = false;

  [
    "gym-log-current",
    "gym-log-history",
    "gym-log-templates",
    "gym-log-my-exercises",
    "gym-log-weight-entries",
    "gym-log-profile",
    "gym-log-editing-template",
    "gym-log-started-at",
    "gym-log-active-template-workout",
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("gym-log-welcome-played");
  sessionStorage.removeItem("gym-log-intro-played");

  document.querySelector("#profileNameSetup").value = "";
  document.querySelector("#profileWeightSetup").value = "";
  document.querySelector("#profileAgeSetup").value = "";
  document.querySelector("[name='genderSetup'][value='male']").checked = true;
  document.querySelector("[name='goalSetup'][value='massa']").checked = true;
  showView("intro");
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function checkedValue(name) {
  return document.querySelector(`[name='${name}']:checked`)?.value ?? "";
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
    type: exercise.type ?? "strength",
    rest: exercise.rest ?? 90,
    durationMinutes: exercise.durationMinutes ?? null,
    durationSeconds: exercise.durationSeconds ?? null,
    stretchSets: getStretchSets(exercise),
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
    type: exercise.type ?? "strength",
    rest: exercise.rest ?? 90,
    durationMinutes: exercise.durationMinutes ?? null,
    durationSeconds: exercise.durationSeconds ?? null,
    stretchSets: getStretchSets(exercise),
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
    const groupedExercises = groupExercisesByName(workout.exercises.filter((exercise) => (exercise.type ?? "strength") === "strength"));

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

function getExerciseSuggestions(query = "", type = currentExerciseType) {
  const suggestions = new Map();
  const normalizedQuery = exerciseKey(query);

  state.myExercises.forEach((exercise) => {
    if ((exercise.type ?? "strength") !== type) return;
    const key = exerciseKey(exercise.name);
    if (!key || suggestions.has(key)) return;
    suggestions.set(key, exercise.name.trim());
  });

  state.history.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      if ((exercise.type ?? "strength") !== type) return;
      const key = exerciseKey(exercise.name);
      if (!key || suggestions.has(key)) return;
      suggestions.set(key, exercise.name.trim());
    });
  });

  state.templates.forEach((template) => {
    template.exercises.forEach((exercise) => {
      if ((exercise.type ?? "strength") !== type) return;
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

function countSessionSets(exercises) {
  return exercises.reduce((sum, exercise) => sum + countExerciseSets(exercise), 0);
}

function countExerciseSets(exercise) {
  const type = exercise.type ?? "strength";
  if (type === "stretching") return getStretchSets(exercise);
  if (type === "cardio") return 0;
  return normalizeSets(exercise).length;
}

function isWeightUpdateDue(lastDate) {
  if (!lastDate) return true;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastDate).getTime() >= weekMs;
}

function weightTrendCopy(goal, delta, entriesCount) {
  if (entriesCount < 2 || delta === 0) return "monitoraggio attivo";
  if (goal === "perdere-peso") return delta < 0 ? "in linea" : "da rivedere";
  return delta > 0 ? "in linea" : "da rivedere";
}

function exerciseTypeLabel(type) {
  if (type === "cardio") return "Cardio";
  if (type === "stretching") return "Stretching";
  return "Forza";
}

function getStretchSets(exercise) {
  return Number(exercise.stretchSets ?? exercise.reps) || 1;
}

function welcomeWord(gender) {
  if (gender === "female") return "Benvenuta";
  if (gender === "neutral") return "Benvenutə";
  return "Benvenuto";
}

function inferGender(name = "") {
  const normalized = exerciseKey(name);
  if (!normalized) return "neutral";
  const maleAEndings = new Set(["andrea", "luca", "nicola", "elia"]);
  if (maleAEndings.has(normalized)) return "male";
  return normalized.endsWith("a") ? "female" : "male";
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

function formatExerciseDuration(exercise) {
  if ((exercise.type ?? "strength") === "stretching") {
    return `${formatNumber(Number(exercise.durationSeconds ?? exercise.durationMinutes) || 0)} sec`;
  }

  return `${formatNumber(Number(exercise.durationMinutes) || 0)} min`;
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
  saveMyExercises();
  saveWeightEntries();
}

function saveCurrent() {
  if (saveCurrentTimer) {
    window.clearTimeout(saveCurrentTimer);
    saveCurrentTimer = null;
  }
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

function scheduleSaveCurrent() {
  if (saveCurrentTimer) {
    window.clearTimeout(saveCurrentTimer);
  }
  saveCurrentTimer = window.setTimeout(saveCurrent, 180);
}

function saveTemplates() {
  localStorage.setItem("gym-log-templates", JSON.stringify(state.templates));
}

function saveMyExercises() {
  localStorage.setItem("gym-log-my-exercises", JSON.stringify(state.myExercises));
}

function saveWeightEntries() {
  localStorage.setItem("gym-log-weight-entries", JSON.stringify(state.weightEntries));
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
showView(introPlayed ? (state.profile ? "home" : "onboarding") : "intro");
setInterval(renderDuration, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update();
    }).catch(() => {});
  });
}
