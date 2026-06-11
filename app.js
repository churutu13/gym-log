const state = {
  exercises: load("gym-log-current", []),
  history: load("gym-log-history", []),
  templates: load("gym-log-templates", []),
  schedule: load("gym-log-weekly-schedule", []),
  myExercises: load("gym-log-my-exercises", []),
  weightEntries: load("gym-log-weight-entries", []),
  profile: load("gym-log-profile", null),
  editingTemplate: load("gym-log-editing-template", null),
  sessionStartedAt: load("gym-log-started-at", null),
  activeTemplateWorkout: load("gym-log-active-template-workout", false),
  activeTemplateId: load("gym-log-active-template-id", null),
  activeScheduleId: load("gym-log-active-schedule-id", null),
  pendingTemplateSetUpdates: load("gym-log-pending-template-set-updates", []),
};

const views = {
  intro: document.querySelector("#introView"),
  onboarding: document.querySelector("#onboardingView"),
  home: document.querySelector("#homeView"),
  schedule: document.querySelector("#scheduleView"),
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
const scheduleForm = document.querySelector("#scheduleForm");
const scheduleList = document.querySelector("#scheduleList");
const scheduleEmpty = document.querySelector("#scheduleEmpty");
const scheduleSummary = document.querySelector("#scheduleSummary");
const scheduleTemplateSelect = document.querySelector("#scheduleTemplate");
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
const supersetPanel = document.querySelector("#supersetPanel");
const supersetToggle = document.querySelector("#supersetToggle");
const supersetFields = document.querySelector("#supersetFields");
const supersetThirdField = document.querySelector("#supersetThirdField");
const supersetSetRows2 = document.querySelector("#supersetSetRows2");
const supersetSetRows3 = document.querySelector("#supersetSetRows3");
const myExercisesList = document.querySelector("#myExercisesList");
const myExercisesEmpty = document.querySelector("#myExercisesEmpty");
const myExercisesSummary = document.querySelector("#myExercisesSummary");
let selectedRest = 90;
let currentView = "";
let currentExerciseType = "strength";
let introPlayed = localStorage.getItem("gym-log-intro-played") === "true";
let welcomePlayed = sessionStorage.getItem("gym-log-welcome-played") === "true";
let templateAddMode = false;
let templateExerciseEditMode = false;
let replacingActiveWorkout = false;
let saveCurrentTimer = null;
let activeSuggestionInput = document.querySelector("#exerciseName");
let introTimer = null;
let introOpenedFromInfo = false;
let restTimerEndsAt = null;
let restTimerInterval = null;
let restTimerNotified = false;
let restTimerExerciseId = null;
let scheduleReminderInterval = null;
let viewBackStack = [];
let isNavigatingBack = false;
let edgeSwipe = null;
let movingExerciseId = null;

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

document.querySelectorAll("[data-add-superset-set]").forEach((button) => {
  button.addEventListener("click", () => {
    const container = button.dataset.addSupersetSet === "2" ? supersetSetRows2 : supersetSetRows3;
    addSetRow(getLastSetValue(container), container);
  });
});

document.querySelector("#createBlankTemplate").addEventListener("click", createBlankTemplate);
document.querySelector("#newWorkoutButton").addEventListener("click", async (event) => {
  event.stopPropagation();
  await openStartPanel();
});
document.querySelector("#startBlankWorkout").addEventListener("click", startBlankWorkout);
document.querySelector("#closeStartSheet").addEventListener("click", closeStartPanel);
document.querySelector("#finishOnboarding").addEventListener("click", finishOnboarding);
document.querySelector("#closeIntro").addEventListener("click", closeIntro);
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
    if (currentExerciseType !== "strength") {
      supersetToggle.checked = false;
      supersetThirdField.hidden = true;
      document.querySelector("#toggleSupersetThird").textContent = "Aggiungi terzo esercizio";
    }
    renderExerciseTypeFields();
  });
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.viewTarget === "intro") {
      introOpenedFromInfo = true;
    }
    showView(button.dataset.viewTarget);
  });
});

document.addEventListener("pointerdown", startEdgeSwipe);
document.addEventListener("pointermove", moveEdgeSwipe);
document.addEventListener("pointerup", endEdgeSwipe);
document.addEventListener("pointercancel", cancelEdgeSwipe);

document.querySelector("#exerciseName").addEventListener("input", renderExerciseSuggestions);

document.querySelector("#exerciseName").addEventListener("focus", renderExerciseSuggestions);

document.querySelectorAll("[data-suggestion-input], #exerciseName").forEach((input) => {
  input.addEventListener("input", renderExerciseSuggestions);
  input.addEventListener("focus", () => {
    activeSuggestionInput = input;
    renderExerciseSuggestions();
  });
});

supersetToggle.addEventListener("change", () => {
  renderExerciseTypeFields();
});

document.querySelector("#toggleSupersetThird").addEventListener("click", () => {
  const isOpening = supersetThirdField.hidden;
  supersetThirdField.hidden = !isOpening;
  document.querySelector("#toggleSupersetThird").textContent = isOpening ? "Rimuovi terzo esercizio" : "Aggiungi terzo esercizio";
  if (!isOpening) document.querySelector("#supersetName3").value = "";
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".field") || event.target.closest("#exerciseSuggestions")) return;
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

  activeSuggestionInput.value = button.dataset.suggestion;
  hideExerciseSuggestions();
  if (currentExerciseType === "strength" && activeSuggestionInput.id === "exerciseName") {
    setRows.querySelector("[name='weight']").focus();
  } else {
    activeSuggestionInput.blur();
  }
});

list.addEventListener("pointerdown", startExerciseMove);
list.addEventListener("pointermove", moveExercise);
list.addEventListener("pointerup", endExerciseMove);
list.addEventListener("pointercancel", endExerciseMove);

setRows.addEventListener("click", (event) => {
  handleSetRowsClick(event);
});

[supersetSetRows2, supersetSetRows3].forEach((container) => {
  container.addEventListener("click", handleSetRowsClick);
});

function handleSetRowsClick(event) {
  const button = event.target.closest("[data-remove-set]");
  const container = event.currentTarget;
  if (!button || container.children.length === 1) return;
  button.closest(".set-row").remove();
  syncSetLabels(container);
}

templatePageList.addEventListener("click", (event) => {
  handleTemplateListClick(event);
});

templateHistoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-history-template]");
  if (!button) return;
  await saveTemplateFromHistory(button.dataset.historyTemplate);
});

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addScheduleItem();
});

scheduleList.addEventListener("click", async (event) => {
  const startButton = event.target.closest("[data-schedule-start]");
  const deleteButton = event.target.closest("[data-schedule-delete]");
  const recurringButton = event.target.closest("[data-schedule-toggle-recurring]");

  if (startButton) {
    await startTemplateWorkout(startButton.dataset.scheduleStart, startButton.dataset.scheduleItem);
  }

  if (deleteButton) {
    deleteScheduleItem(deleteButton.dataset.scheduleDelete);
  }

  if (recurringButton) {
    toggleScheduleRecurring(recurringButton.dataset.scheduleToggleRecurring);
  }
});

document.querySelector("#startTemplateList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-start-template]");
  if (!button) return;
  await startTemplateWorkout(button.dataset.startTemplate);
});

document.querySelector("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const weight = value("#profileWeight");
  const newGoal = checkedValue("profileGoal") || "massa";
  const previousGoal = state.profile?.goal ?? "massa";
  const previousWeight = parseDecimal(state.profile?.weight ?? "");
  const nextWeight = parseDecimal(weight);
  if (state.profile && previousGoal !== newGoal) {
    const confirmed = await appConfirm("Cambiare obiettivo?", "I progressi peso useranno la nuova direzione.");
    if (!confirmed) {
      renderProfile();
      return;
    }
  }
  state.profile = {
    name: value("#profileName") || "Roberto",
    weight,
    initialWeight: state.profile?.initialWeight ?? state.profile?.weight ?? weight,
    age: value("#profileAge"),
    goal: newGoal,
    gender: checkedValue("profileGender") || "neutral",
  };
  if (nextWeight && nextWeight !== previousWeight) {
    addWeightEntry(weight, false, true);
  }
  saveProfile();
  render();
  showView("home");
});

document.querySelector("#myExerciseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addMyExercise(value("#myExerciseName"), checkedValue("myExerciseType") || "strength");
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

weightProgressPanel.addEventListener("click", (event) => {
  const point = event.target.closest("[data-weight-point]");
  if (!point) return;
  const readout = weightProgressPanel.querySelector("#weightChartReadout");
  if (!readout) return;
  readout.textContent = `${point.dataset.weight} kg · ${point.dataset.date}`;
});

async function handleTemplateListClick(event) {
  const loadButton = event.target.closest("[data-template-load]");
  const editButton = event.target.closest("[data-template-edit]");
  const deleteButton = event.target.closest("[data-template-delete]");
  const historyButton = event.target.closest("[data-history-template]");

  if (loadButton) {
    await loadTemplate(loadButton.dataset.templateLoad);
  }

  if (editButton) {
    await editTemplate(editButton.dataset.templateEdit);
  }

  if (deleteButton) {
    await deleteTemplate(deleteButton.dataset.templateDelete);
  }

  if (historyButton) {
    await saveTemplateFromHistory(historyButton.dataset.historyTemplate);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.editingTemplate && !state.sessionStartedAt) {
    state.sessionStartedAt = new Date().toISOString();
  }

  const exerciseType = currentExerciseType;
  const durationValue = Number(value("#exerciseDuration"));
  const stretchingSets = Number(value("#stretchingSets"));
  const isSuperset = exerciseType === "strength" && supersetToggle.checked;
  const sets = exerciseType === "strength" ? getSetValues() : [];
  const supersetExercises = isSuperset ? getSupersetExerciseValues() : [];
  if (sets === null) return;

  if (isSuperset && supersetExercises.length < 2) {
    await appAlert("Superset incompleto", "Inserisci almeno due esercizi per il superset.");
    return;
  }

  if (isSuperset && supersetExercises.some((item) => !item.sets)) return;

  if (isSuperset && supersetExercises.some((item) => !item.sets.length)) {
    await appAlert("Serie mancanti", "Compila almeno una serie per ogni esercizio del superset.");
    return;
  }

  if (exerciseType === "strength" && !sets.length) {
    await appAlert("Serie mancanti", "Compila almeno una serie.");
    return;
  }

  if (exerciseType !== "strength" && (!durationValue || durationValue < 1)) {
    await appAlert("Durata mancante", "Inserisci la durata dell'esercizio.");
    return;
  }

  if (exerciseType === "stretching" && (!stretchingSets || stretchingSets < 1)) {
    await appAlert("Serie mancanti", "Inserisci le serie dello stretching.");
    return;
  }

  const exercise = {
    id: createId(),
    name: isSuperset ? supersetExercises.map((item) => item.name).join(" + ") : value("#exerciseName"),
    names: isSuperset ? supersetExercises.map((item) => item.name) : null,
    supersetExercises: isSuperset ? supersetExercises : null,
    isSuperset,
    type: exerciseType,
    sets: isSuperset ? [] : sets,
    durationMinutes: exerciseType === "cardio" ? durationValue : null,
    durationSeconds: exerciseType === "stretching" ? durationValue : null,
    stretchSets: exerciseType === "stretching" ? stretchingSets : null,
    rest: selectedRest,
    createdAt: new Date().toISOString(),
  };

  state.exercises.push(exercise);
  if (isSuperset) {
    supersetExercises.forEach((item) => rememberExerciseName(item.name, exercise.type));
  } else {
    rememberExerciseName(exercise.name, exercise.type);
  }
  saveCurrent();
  form.reset();
  currentExerciseType = exerciseType;
  supersetToggle.checked = false;
  supersetThirdField.hidden = true;
  document.querySelector("#toggleSupersetThird").textContent = "Aggiungi terzo esercizio";
  selectedRest = exercise.rest;
  resetSetRows();
  resetSetRows(supersetSetRows2);
  resetSetRows(supersetSetRows3);
  renderExerciseTypeFields();
  syncRestButtons();
  hideExerciseSuggestions();
  templateAddMode = false;
  document.activeElement?.blur();
  render();
});

document.querySelector("#finishWorkout").addEventListener("click", async () => {
  if (state.editingTemplate) {
    await saveEditingTemplate();
    return;
  }

  if (!state.exercises.length) {
    state.sessionStartedAt = null;
    state.activeTemplateWorkout = false;
    state.activeTemplateId = null;
    state.activeScheduleId = null;
    clearPendingTemplateSetUpdates();
    templateAddMode = false;
    templateExerciseEditMode = false;
    stopRestTimer();
    saveCurrent();
    showView("home");
    return;
  }

  await resolvePendingTemplateSetUpdates();
  const finishedTemplate = getTemplateById(state.activeTemplateId);
  const effortEntries = await promptWorkoutEfforts(state.exercises, finishedTemplate);
  if (effortEntries === null) return;
  const primaryEffort = effortEntries[0] ?? null;
  const scheduleId = state.activeScheduleId;

  state.history.unshift({
    id: createId(),
    date: new Date().toISOString(),
    title: finishedTemplate?.name ?? "",
    templateId: finishedTemplate?.id ?? null,
    templateName: finishedTemplate?.name ?? "",
    effort: primaryEffort?.effort ?? null,
    effortType: primaryEffort?.type ?? null,
    effortGroupKey: primaryEffort?.groupKey ?? null,
    effortGroupName: primaryEffort?.groupName ?? null,
    effortEntries,
    durationSeconds: getSessionDurationSeconds(),
    exercises: [...state.exercises],
  });
  completeScheduledWorkout(scheduleId);
  state.exercises = [];
  state.sessionStartedAt = null;
  state.activeTemplateWorkout = false;
  state.activeTemplateId = null;
  state.activeScheduleId = null;
  state.pendingTemplateSetUpdates = [];
  clearPendingTemplateSetUpdates();
  templateAddMode = false;
  templateExerciseEditMode = false;
  stopRestTimer();
  persist();
  showView("home");
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  const addSetButton = event.target.closest("[data-add-set-to-exercise]");
  const removeSetButton = event.target.closest("[data-remove-inline-set]");
  const restButton = event.target.closest("[data-rest-update]");
  const timerButton = event.target.closest("[data-start-rest-timer]");
  const moveButton = event.target.closest("[data-move-exercise]");

  if (button) {
    if (state.activeTemplateWorkout && !templateExerciseEditMode) return;
    state.exercises = state.exercises.filter((exercise) => exercise.id !== button.dataset.delete);
    if (!state.exercises.length) {
      state.sessionStartedAt = null;
      state.activeTemplateWorkout = false;
      state.activeTemplateId = null;
      state.activeScheduleId = null;
      clearPendingTemplateSetUpdates();
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
    return;
  }

  if (timerButton) {
    startRestTimer(Number(timerButton.dataset.restSeconds) || 90, timerButton.dataset.startRestTimer);
    return;
  }

  if (moveButton) {
    moveExerciseByDirection(moveButton.dataset.moveExercise, Number(moveButton.dataset.moveDirection));
  }
});

list.addEventListener("input", (event) => {
  const input = event.target.closest("[data-set-field]");
  if (!input) return;

  const setIndex = Number(input.dataset.setIndex);
  const field = input.dataset.setField;
  const parsedValue = field === "weight" ? parseDecimal(input.value) : Number(input.value) || 0;
  updateExercise(input.dataset.exerciseId, (exercise) => {
    const sets = normalizeSets(exercise).map((set, index) => {
      if (index !== setIndex) return set;
      return {
        ...set,
        [field]: parsedValue,
      };
    });
    return { ...exercise, sets };
  }, false);
  syncTemplateSetEdit(input.dataset.exerciseId, setIndex, field, parsedValue);
});

historyPageList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-history-delete]");
  const renameButton = event.target.closest("[data-history-rename]");

  if (deleteButton) {
    await deleteHistoryWorkout(deleteButton.dataset.historyDelete);
    return;
  }

  if (renameButton) {
    await renameHistoryWorkout(renameButton.dataset.historyRename);
  }
});

function showView(viewName) {
  const previousView = currentView;
  if (previousView && previousView !== viewName && !isNavigatingBack) {
    viewBackStack.push(previousView);
    viewBackStack = viewBackStack.slice(-12);
  }
  isNavigatingBack = false;
  currentView = viewName;
  Object.entries(views).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });
  closeStartPanel();
  if (viewName === "home") {
    introOpenedFromInfo = false;
    playHomeWelcome();
  } else if (viewName === "intro") {
    playIntro();
  } else {
    introOpenedFromInfo = false;
    document.body.classList.remove("splash-active");
  }
  render();
  if (previousView && previousView !== viewName) {
    closeCollapsibleMenus();
  }
}

function goBackView() {
  const previousView = viewBackStack.pop();
  if (!previousView) return;
  isNavigatingBack = true;
  resetEdgeSwipeView(false);
  showView(previousView);
}

function startEdgeSwipe(event) {
  if (event.pointerType === "mouse" || event.clientX > 24 || currentView === "home" || currentView === "intro" || !viewBackStack.length) return;
  edgeSwipe = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    view: views[currentView],
    tracking: false,
  };
  edgeSwipe.view?.setPointerCapture?.(event.pointerId);
}

function moveEdgeSwipe(event) {
  if (!edgeSwipe || edgeSwipe.id !== event.pointerId) return;
  const deltaX = event.clientX - edgeSwipe.startX;
  const deltaY = Math.abs(event.clientY - edgeSwipe.startY);
  if (deltaX < 0 || deltaY > 46) return;
  edgeSwipe.tracking = true;
  const progress = Math.min(deltaX, 180);
  edgeSwipe.view.style.transform = `translateX(${progress}px)`;
  edgeSwipe.view.style.opacity = String(Math.max(0.72, 1 - progress / 420));
  edgeSwipe.view.classList.add("edge-swiping");
}

function endEdgeSwipe(event) {
  if (edgeSwipe?.id !== event.pointerId) return;
  const deltaX = event.clientX - edgeSwipe.startX;
  const deltaY = Math.abs(event.clientY - edgeSwipe.startY);
  const shouldGoBack = edgeSwipe.tracking && deltaX > 92 && deltaX > deltaY * 1.25;
  if (shouldGoBack) {
    goBackView();
    edgeSwipe = null;
    return;
  }
  resetEdgeSwipeView(true);
  edgeSwipe = null;
}

function cancelEdgeSwipe() {
  resetEdgeSwipeView(true);
  edgeSwipe = null;
}

function resetEdgeSwipeView(animate = false) {
  if (!edgeSwipe?.view) return;
  const view = edgeSwipe.view;
  if (animate) {
    view.classList.add("edge-swipe-reset");
    view.style.transform = "";
    view.style.opacity = "";
    window.setTimeout(() => {
      view.classList.remove("edge-swiping", "edge-swipe-reset");
    }, 180);
    return;
  }
  view.classList.remove("edge-swiping", "edge-swipe-reset");
  view.style.transform = "";
  view.style.opacity = "";
}

function playIntro() {
  document.body.classList.add("splash-active");
  if (introTimer) window.clearTimeout(introTimer);
  document.querySelector("#closeIntro").hidden = !introOpenedFromInfo;
  localStorage.setItem("gym-log-intro-played", "true");
  introPlayed = true;
  if (introOpenedFromInfo) return;
  introTimer = window.setTimeout(() => {
    showView(state.profile ? "home" : "onboarding");
  }, 8000);
}

function closeIntro() {
  if (introTimer) {
    window.clearTimeout(introTimer);
    introTimer = null;
  }
  localStorage.setItem("gym-log-intro-played", "true");
  introPlayed = true;
  introOpenedFromInfo = false;
  showView(state.profile ? "home" : "onboarding");
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

async function openStartPanel() {
  replacingActiveWorkout = false;

  if (hasActiveWorkout()) {
    const replace = await appConfirm("Allenamento in corso", "Vuoi iniziarne uno nuovo e sostituire quello attuale?");
    if (!replace) return;
    replacingActiveWorkout = true;
    await startBlankWorkout();
    return;
  }

  document.querySelector("#startSheet").hidden = false;
  renderStartTemplates();
}

function closeStartPanel() {
  document.querySelector("#startSheet").hidden = true;
  replacingActiveWorkout = false;
}

async function startBlankWorkout() {
  const isReplacing = replacingActiveWorkout || state.exercises.length > 0;
  if (state.exercises.length > 0 && !replacingActiveWorkout && !await appConfirm("Sostituire sessione?", "La sessione corrente verra' rimossa.")) return;
  state.editingTemplate = null;
  state.activeTemplateWorkout = false;
  state.activeTemplateId = null;
  state.activeScheduleId = null;
  templateAddMode = false;
  templateExerciseEditMode = false;
  currentExerciseType = "strength";
  resetExerciseEntryState();
  replacingActiveWorkout = false;
  state.exercises = [];
  state.sessionStartedAt = isReplacing ? new Date().toISOString() : state.sessionStartedAt ?? new Date().toISOString();
  saveCurrent();
  render();
  showView("workout");
}

async function startTemplateWorkout(templateId, scheduleId = null) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  const isReplacing = replacingActiveWorkout || state.exercises.length > 0;
  if (state.exercises.length > 0 && !replacingActiveWorkout && !await appConfirm("Sostituire sessione?", "La sessione corrente verra' rimossa.")) return;
  state.editingTemplate = null;
  state.activeTemplateWorkout = true;
  state.activeTemplateId = template.id;
  state.activeScheduleId = scheduleId;
  clearPendingTemplateSetUpdates();
  templateAddMode = false;
  templateExerciseEditMode = false;
  currentExerciseType = "strength";
  resetExerciseEntryState();
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
    initialWeight: weight,
    age: value("#profileAgeSetup"),
    goal: checkedValue("goalSetup") || "massa",
    gender: checkedValue("genderSetup") || "neutral",
  };
  saveProfile();
  try {
    addWeightEntry(weight, false, true);
  } catch (error) {
    console.warn("Weight setup could not be saved", error);
  }
  welcomePlayed = false;
  sessionStorage.removeItem("gym-log-welcome-played");
  document.body.classList.remove("splash-active");
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
  document.querySelector("#summaryExercises").textContent = countSessionExercises(state.exercises);
  document.querySelector("#summarySets").textContent = totalSets;
  renderDuration();

  emptyState.hidden = state.exercises.length > 0 || state.activeTemplateWorkout;
  list.innerHTML = state.exercises.map(renderExercise).join("");
  renderExerciseSuggestions();

  if (shouldRenderAll || currentView === "templates") {
    renderTemplates();
    renderTemplateHistory();
  }

  if (shouldRenderAll || currentView === "schedule") {
    renderWeeklySchedule();
  }

  if (shouldRenderAll || currentView === "progress") {
    renderProgressPage();
  }

  if (shouldRenderAll || currentView === "history" || currentView === "profile") {
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
    : (isTemplateWorkout ? (getTemplateById(state.activeTemplateId)?.name ?? "Sessione da template") : "Sessione attiva");
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
  supersetPanel.hidden = !isStrength;
  supersetFields.hidden = !isStrength || !supersetToggle.checked;
  supersetToggle.disabled = !isStrength;
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

function startRestTimer(seconds, exerciseId) {
  restTimerEndsAt = Date.now() + seconds * 1000;
  restTimerExerciseId = exerciseId;
  restTimerNotified = false;
  requestNotificationPermission();
  renderRestTimer();
  if (restTimerInterval) window.clearInterval(restTimerInterval);
  restTimerInterval = window.setInterval(renderRestTimer, 1000);
}

function renderRestTimer() {
  if (!restTimerEndsAt) {
    render();
    return;
  }

  const remaining = Math.max(0, Math.ceil((restTimerEndsAt - Date.now()) / 1000));
  document.querySelectorAll("[data-rest-timer-value]").forEach((node) => {
    const isActive = node.dataset.restTimerValue === restTimerExerciseId;
    node.hidden = !isActive || remaining === 0;
    node.textContent = isActive ? formatDuration(remaining) : "";
  });

  if (remaining === 0 && restTimerInterval) {
    window.clearInterval(restTimerInterval);
    restTimerInterval = null;
  }

  if (remaining === 0 && !restTimerNotified) {
    restTimerNotified = true;
    markRestTimerCompleted(restTimerExerciseId);
    notifyRestDone();
  }
}

function markRestTimerCompleted(exerciseId) {
  if (!exerciseId) return;
  state.exercises = state.exercises.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return {
      ...exercise,
      restCompletions: Number(exercise.restCompletions ?? 0) + 1,
    };
  });
  saveCurrent();
  render();
}

function stopRestTimer() {
  if (restTimerInterval) {
    window.clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
  restTimerEndsAt = null;
  restTimerExerciseId = null;
  restTimerNotified = false;
  document.querySelectorAll("[data-rest-timer-value]").forEach((node) => {
    node.hidden = true;
    node.textContent = "";
    node.classList.remove("done");
  });
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => {});
}

function notifyRestDone() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Recupero finito", {
      body: "Puoi ripartire con la prossima serie.",
    });
  } catch {}
}

function startScheduleReminderLoop() {
  if (scheduleReminderInterval) window.clearInterval(scheduleReminderInterval);
  checkScheduleReminders();
  scheduleReminderInterval = window.setInterval(checkScheduleReminders, 60 * 1000);
}

function checkScheduleReminders() {
  const now = new Date();

  state.schedule.forEach((item) => {
    if (!item.reminder) return;
    const workoutDate = getScheduledWorkoutDate(item, now);
    const reminderDate = new Date(workoutDate.getTime() - 60 * 60 * 1000);
    if (now < reminderDate || now >= workoutDate) return;

    const key = `gym-log-schedule-reminder-${item.id}-${workoutDate.toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, "true");
    notifyScheduledWorkout(item, workoutDate);
  });
}

function getScheduledWorkoutDate(item, now = new Date()) {
  if (!item.recurring && item.scheduledFor) {
    return new Date(item.scheduledFor);
  }

  const currentDay = now.getDay() || 7;
  const scheduledDate = new Date(now);
  scheduledDate.setDate(now.getDate() + (Number(item.day) - currentDay));
  const [hours, minutes] = String(item.time || "18:30").split(":").map(Number);
  scheduledDate.setHours(hours || 0, minutes || 0, 0, 0);
  if (item.recurring && scheduledDate < now) {
    scheduledDate.setDate(scheduledDate.getDate() + 7);
  }
  return scheduledDate;
}

function notifyScheduledWorkout(item, workoutDate) {
  const template = state.templates.find((entry) => entry.id === item.templateId);
  if (!template || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Allenamento tra 1 ora", {
      body: `${template.name} · ${workoutDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
    });
  } catch {}
}

function renderExercise(exercise) {
  const sets = normalizeSets(exercise);
  const type = exercise.type ?? "strength";
  const names = getExerciseNames(exercise);
  const supersetExercises = getSupersetExercises(exercise);
  const canEditInline = Boolean(!state.editingTemplate && type === "strength" && !exercise.isSuperset);
  const canDelete = !state.activeTemplateWorkout || state.editingTemplate || templateExerciseEditMode;
  const canStartTimer = Boolean(!state.editingTemplate && type === "strength");
  const canReorder = Boolean(state.editingTemplate);
  const completedRestTimers = Number(exercise.restCompletions ?? 0);
  const targetRestTimers = Math.max(1, countRestRounds(exercise));
  const isExerciseDone = canStartTimer && completedRestTimers >= targetRestTimers;
  const restTimerRemaining = canStartTimer && restTimerExerciseId === exercise.id && restTimerEndsAt
    ? Math.max(0, Math.ceil((restTimerEndsAt - Date.now()) / 1000))
    : null;

  return `
    <li class="exercise-card" data-exercise-card="${exercise.id}">
      <header>
        <div>
          <h3>${exercise.isSuperset ? "Superset" : escapeHtml(exercise.name)}</h3>
          ${exercise.isSuperset ? `<ul class="superset-name-list">${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : ""}
          ${type !== "strength" ? `<span class="type-label">${exerciseTypeLabel(type)}</span>` : ""}
        </div>
        ${canDelete ? `
          <button class="delete-row" type="button" data-delete="${exercise.id}" aria-label="Elimina esercizio">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ` : ""}
      </header>
      ${canReorder ? `
        <div class="exercise-reorder-controls">
          <button class="drag-handle" type="button" data-drag-exercise="${exercise.id}" aria-label="Sposta esercizio">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 12h8M8 17h8" /></svg>
            Sposta
          </button>
          <div>
            <button type="button" data-move-exercise="${exercise.id}" data-move-direction="-1" aria-label="Sposta su">Su</button>
            <button type="button" data-move-exercise="${exercise.id}" data-move-direction="1" aria-label="Sposta giu">Giu</button>
          </div>
        </div>
      ` : ""}
      <div class="stats">
        ${type === "strength" ? `
          <span>${countExerciseSets(exercise)} serie</span>
          <span>${exercise.rest ?? 90}s pausa</span>
          ${canStartTimer ? `
            <button class="timer-row-button" type="button" data-start-rest-timer="${exercise.id}" data-rest-seconds="${exercise.rest ?? 90}">Timer ${Math.min(completedRestTimers, targetRestTimers)}/${targetRestTimers}</button>
            <span class="rest-timer-bubble" data-rest-timer-value="${exercise.id}" ${restTimerRemaining === null ? "hidden" : ""}>${restTimerRemaining === null ? "" : formatDuration(restTimerRemaining)}</span>
            <span class="exercise-done-check" ${isExerciseDone ? "" : "hidden"} aria-label="Esercizio completato">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
            </span>
          ` : ""}
        ` : `
          <span>${formatExerciseDuration(exercise)} durata</span>
          ${type === "stretching" ? `<span>${getStretchSets(exercise)} serie</span>` : ""}
        `}
      </div>
      ${exercise.isSuperset ? `
        <div class="superset-detail-list">
          ${supersetExercises.map((item) => `
            <section>
              <h4>${escapeHtml(item.name)}</h4>
              <ol class="set-list">
                ${item.sets.map((set, index) => `
                  <li>
                    <span>Serie ${index + 1}</span>
                    <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
                  </li>
                `).join("")}
              </ol>
            </section>
          `).join("")}
        </div>
      ` : type === "strength" ? `
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
        <input type="text" inputmode="decimal" value="${set.weight}" data-set-field="weight" data-exercise-id="${exercise.id}" data-set-index="${index}" />
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
  const exerciseCount = countSessionExercises(workout.exercises);
  const sets = countSessionSets(workout.exercises);
  const date = formatHistoryDate(workout.date);
  const title = workout.title?.trim();
  const templateAction = options.templateAction ?? true;
  const deleteAction = options.deleteAction ?? false;
  const renameAction = options.renameAction ?? false;
  const templateLabel = options.templateLabel ?? "Salva come template";
  const effort = Number(workout.effort ?? 0);
  const effortCopy = getWorkoutEffortEntries(workout)
    .map((entry) => `${exerciseTypeLabel(entry.type)} ${entry.effort}/10`)
    .join(" · ");

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
              ${effortCopy ? `<span>Fatica ${escapeHtml(effortCopy)}</span>` : (effort ? `<span>Fatica ${effort}/10</span>` : "")}
            </div>
          </div>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        ${workout.templateName ? `<p class="history-extra">Da template ${escapeHtml(workout.templateName)} · ${date}</p>` : ""}
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
  const names = getExerciseNames(exercise);
  const supersetExercises = getSupersetExercises(exercise);

  return `
    <li>
      <header>
        <div>
          <h4>${exercise.isSuperset ? "Superset" : escapeHtml(exercise.name)}</h4>
          ${exercise.isSuperset ? `<ul class="superset-name-list small">${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : ""}
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
      ${exercise.isSuperset ? `
        <div class="superset-detail-list">
          ${supersetExercises.map((item) => `
            <section>
              <h4>${escapeHtml(item.name)}</h4>
              <ol class="set-list">
                ${item.sets.map((set, index) => `
                  <li>
                    <span>Serie ${index + 1}</span>
                    <strong>${formatNumber(set.weight)} kg x ${set.reps}</strong>
                  </li>
                `).join("")}
              </ol>
            </section>
          `).join("")}
        </div>
      ` : type === "strength" ? `
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

function renderWeeklySchedule() {
  pruneExpiredScheduleItems();
  const sortedSchedule = getSortedSchedule();
  scheduleSummary.textContent = `${sortedSchedule.length} ${sortedSchedule.length === 1 ? "allenamento" : "allenamenti"}`;
  scheduleEmpty.hidden = sortedSchedule.length > 0;
  scheduleTemplateSelect.innerHTML = state.templates.length
    ? state.templates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join("")
    : "<option value=\"\">Salva prima un template</option>";
  scheduleTemplateSelect.disabled = state.templates.length === 0;
  scheduleForm.querySelector("button[type='submit']").disabled = state.templates.length === 0;
  scheduleList.innerHTML = sortedSchedule.map(renderScheduleItem).join("");
}

function renderScheduleItem(item) {
  const template = state.templates.find((entry) => entry.id === item.templateId);
  const templateName = template?.name ?? "Template non trovato";
  const recurrenceCopy = item.recurring ? " · fisso settimanale" : "";
  const recurringLabel = item.recurring ? "Fisso" : "Rendi fisso";
  const detailCopy = template
    ? `${item.reminder ? "notifica 1h prima" : "senza notifica"}${recurrenceCopy}`
    : "Allenamento eliminato";

  return `
    <li class="schedule-card">
      <div>
        <strong>${dayLabel(item.day)} · ${item.time}</strong>
        <span>${escapeHtml(templateName)}</span>
        <small>${detailCopy}</small>
      </div>
      <div class="schedule-actions">
        ${template ? `<button type="button" data-schedule-start="${template.id}" data-schedule-item="${item.id}">Avvia</button>` : ""}
        <button class="${item.recurring ? "active" : ""}" type="button" data-schedule-toggle-recurring="${item.id}">${recurringLabel}</button>
        <button type="button" data-schedule-delete="${item.id}" aria-label="Elimina programma">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </li>
  `;
}

function renderStartTemplates() {
  const list = document.querySelector("#startTemplateList");
  const empty = document.querySelector("#startTemplateEmpty");
  empty.hidden = state.templates.length > 0;
  list.innerHTML = state.templates.map((template) => `
    <li class="template-card">
      <button class="start-template-button" type="button" data-start-template="${template.id}">
        <span>${escapeHtml(template.name)}</span>
        <small>${countSessionExercises(template.exercises)} esercizi</small>
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
  const exerciseCount = countSessionExercises(template.exercises);
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

async function addScheduleItem() {
  const templateId = scheduleTemplateSelect.value;
  if (!templateId) {
    await appAlert("Template mancante", "Salva prima un allenamento template.");
    return;
  }

  const item = {
    id: createId(),
    day: Number(value("#scheduleDay")),
    time: value("#scheduleTime") || "18:30",
    templateId,
    reminder: document.querySelector("#scheduleReminder").checked,
    recurring: document.querySelector("#scheduleRecurring").checked,
    createdAt: new Date().toISOString(),
  };
  const scheduledFor = getScheduledWorkoutDate(item);
  if (!item.recurring && scheduledFor <= new Date()) {
    scheduledFor.setDate(scheduledFor.getDate() + 7);
  }
  item.scheduledFor = item.recurring ? null : scheduledFor.toISOString();

  state.schedule = [...state.schedule, item].sort(compareScheduleItems);
  saveSchedule();
  if (item.reminder) requestNotificationPermission();
  renderWeeklySchedule();
}

function deleteScheduleItem(scheduleId) {
  state.schedule = state.schedule.filter((item) => item.id !== scheduleId);
  saveSchedule();
  renderWeeklySchedule();
}

function toggleScheduleRecurring(scheduleId) {
  state.schedule = state.schedule.map((item) => {
    if (item.id !== scheduleId) return item;
    const recurring = !item.recurring;
    const scheduledFor = getScheduledWorkoutDate({ ...item, recurring: false });
    if (!recurring && scheduledFor <= new Date()) {
      scheduledFor.setDate(scheduledFor.getDate() + 7);
    }
    return {
      ...item,
      recurring,
      scheduledFor: recurring ? null : scheduledFor.toISOString(),
    };
  }).sort(compareScheduleItems);
  saveSchedule();
  renderWeeklySchedule();
}

function completeScheduledWorkout(scheduleId) {
  if (!scheduleId) return;
  const item = state.schedule.find((entry) => entry.id === scheduleId);
  if (!item || item.recurring) return;
  state.schedule = state.schedule.filter((entry) => entry.id !== scheduleId);
  saveSchedule();
}

function pruneExpiredScheduleItems() {
  const now = new Date();
  const activeScheduleIds = new Set(state.activeScheduleId ? [state.activeScheduleId] : []);
  const nextSchedule = state.schedule.filter((item) => {
    if (item.recurring || activeScheduleIds.has(item.id)) return true;
    return getScheduledWorkoutDate(item, now) > now;
  });
  if (nextSchedule.length === state.schedule.length) return;
  state.schedule = nextSchedule;
  saveSchedule();
}

function getTemplateById(templateId) {
  if (!templateId) return null;
  return state.templates.find((template) => template.id === templateId) ?? null;
}

function getWorkoutEffortMeta(exercises, template = null) {
  const type = getDominantWorkoutType(exercises);
  if (type === "strength") {
    return {
      type,
      groupKey: template ? `strength:${template.id}` : "strength:free",
      groupName: template?.name ?? "Forza libera",
      label: template ? `il template ${template.name}` : "l'allenamento di forza",
      shouldAsk: Boolean(template),
    };
  }

  return {
    type,
    groupKey: type,
    groupName: exerciseTypeLabel(type),
    label: `l'allenamento ${exerciseTypeLabel(type).toLocaleLowerCase("it-IT")}`,
    shouldAsk: type === "cardio" || type === "stretching",
  };
}

function getWorkoutEffortMetas(exercises, template = null) {
  const types = [...new Set(exercises.map((exercise) => exercise.type ?? "strength"))];
  const isMixedWorkout = types.length > 1;

  return ["strength", "cardio", "stretching"]
    .filter((type) => types.includes(type))
    .map((type) => {
      if (type === "strength") {
        return {
          type,
          groupKey: template ? `strength:${template.id}` : "strength:free",
          groupName: template?.name ?? "Forza libera",
          label: template ? `la parte forza di ${template.name}` : "la parte forza dell'allenamento",
          shouldAsk: Boolean(template) || isMixedWorkout,
        };
      }

      return {
        type,
        groupKey: type,
        groupName: exerciseTypeLabel(type),
        label: `la parte ${exerciseTypeLabel(type).toLocaleLowerCase("it-IT")}`,
        shouldAsk: true,
      };
    })
    .filter((meta) => meta.shouldAsk);
}

function getDominantWorkoutType(exercises) {
  const counts = exercises.reduce((result, exercise) => {
    const type = exercise.type ?? "strength";
    result[type] = (result[type] ?? 0) + countExerciseSets(exercise) + (type === "cardio" ? 1 : 0);
    return result;
  }, {});

  return ["strength", "cardio", "stretching"]
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? "strength";
}

function getEffortGroups(workouts) {
  const groups = new Map();

  workouts.forEach((workout) => {
    getWorkoutEffortEntries(workout).forEach((entry) => {
      const type = entry.type;
      const groupKey = entry.groupKey;
      const groupName = entry.groupName;
      if (type === "strength" && groupName === "Forza libera") return;

      const existing = groups.get(groupKey) ?? {
        key: groupKey,
        type,
        name: type === "strength" ? `Forza · ${groupName}` : groupName,
        workouts: [],
      };
      existing.workouts.push({ ...workout, effort: entry.effort });
      groups.set(groupKey, existing);
    });
  });

  return [...groups.values()].sort((a, b) => {
    const order = { strength: 0, cardio: 1, stretching: 2 };
    if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
    return a.name.localeCompare(b.name, "it-IT");
  });
}

function getWorkoutEffortEntries(workout) {
  if (Array.isArray(workout.effortEntries) && workout.effortEntries.length) {
    return workout.effortEntries
      .filter((entry) => Number(entry.effort ?? 0) > 0)
      .map((entry) => ({
        effort: Number(entry.effort),
        type: entry.type ?? "strength",
        groupKey: entry.groupKey ?? entry.type ?? "strength",
        groupName: entry.groupName ?? exerciseTypeLabel(entry.type ?? "strength"),
      }));
  }

  if (Number(workout.effort ?? 0) <= 0) return [];
  const inferred = getWorkoutEffortMeta(workout.exercises ?? [], workout.templateId ? getTemplateById(workout.templateId) : null);
  const type = workout.effortType ?? inferred.type;
  return [{
    effort: Number(workout.effort),
    type,
    groupKey: workout.effortGroupKey ?? (type === "strength" && workout.templateName ? `strength:${exerciseKey(workout.templateName)}` : inferred.groupKey),
    groupName: workout.effortGroupName ?? (type === "strength" && workout.templateName ? workout.templateName : inferred.groupName),
  }];
}

async function promptWorkoutEffort(effortMeta) {
  const answer = await appPrompt(
    "Fatica allenamento",
    `Quanto pesante e' stato ${effortMeta.label}? Usa 1 facile, 10 durissimo.`,
    "",
    { inputMode: "numeric", placeholder: "1-10" },
  );
  if (answer === null) return null;
  if (!answer.trim()) return { cancelled: true };
  const effort = Math.round(parseDecimal(answer));
  if (!effort || effort < 1 || effort > 10) {
    await appAlert("Fatica non salvata", "Inserisci un numero da 1 a 10.");
    return { cancelled: true };
  }
  return effort;
}

async function promptWorkoutEfforts(exercises, template = null) {
  const metas = getWorkoutEffortMetas(exercises, template);
  const entries = [];

  for (const meta of metas) {
    const effort = await promptWorkoutEffort(meta);
    if (effort === null || effort?.cancelled) return null;
    entries.push({
      effort,
      type: meta.type,
      groupKey: meta.groupKey,
      groupName: meta.groupName,
    });
  }

  return entries;
}

function renderHistoryPage() {
  historyPageEmpty.hidden = state.history.length > 0;
  historyPageList.innerHTML = state.history.map((workout) => renderHistory(workout, { templateAction: false, renameAction: true, deleteAction: true })).join("");
}

function renderExerciseSuggestions() {
  const input = activeSuggestionInput ?? document.querySelector("#exerciseName");
  if (document.activeElement !== input) {
    hideExerciseSuggestions();
    return;
  }

  const query = input.value.trim();
  const matches = getExerciseSuggestions(query, currentExerciseType).slice(0, 6);
  input.closest(".field")?.after(exerciseSuggestions);

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
  const effortProgress = renderEffortProgress();
  renderWeightProgress();
  progressPageEmpty.hidden = progressItems.length > 0 || Boolean(effortProgress);
  progressPageList.innerHTML = `${effortProgress}${progressItems.map(renderProgressItem).join("")}`;
}

function renderEffortProgress() {
  const workouts = [...state.history]
    .filter((workout) => getWorkoutEffortEntries(workout).length > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!workouts.length) return "";

  const groups = getEffortGroups(workouts);

  return `
    <li class="progress-card effort-card">
      <details>
        <summary>
          <header>
            <div>
              <h3>Fatica allenamenti</h3>
              <span>${groups.length} ${groups.length === 1 ? "gruppo" : "gruppi"} monitorati</span>
            </div>
          </header>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div class="effort-group-list">
          ${groups.map(renderEffortGroup).join("")}
        </div>
      </details>
    </li>
  `;
}

function renderEffortGroup(group) {
  const latest = group.workouts.at(-1);
  const previous = group.workouts.at(-2);
  const recent = group.workouts.slice(-5);
  const average = recent.reduce((sum, workout) => sum + Number(workout.effort), 0) / recent.length;
  const delta = previous ? Number(latest.effort) - Number(previous.effort) : 0;

  return `
    <section class="effort-group">
      <h4>${escapeHtml(group.name)}</h4>
      <div class="progress-grid two-up">
        <div>
          <span>Media recente</span>
          <strong>${formatNumber(average)}/10</strong>
          <small>ultimi ${recent.length} allenamenti</small>
        </div>
        <div>
          <span>Dal precedente</span>
          <strong class="${effortDeltaClass(delta)}">${previous ? formatSigned(delta, 0) : "0"}</strong>
          <small>${previous ? effortTrendCopy(delta) : "primo dato"}</small>
        </div>
      </div>
    </section>
  `;
}

function renderWeightProgress() {
  const entries = [...state.weightEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = entries.at(-1);
  const previous = entries.at(-2);
  const profile = state.profile ?? {};
  const goal = profile.goal ?? "massa";
  const initialWeight = getInitialProfileWeight();
  const due = isWeightUpdateDue(latest?.date);
  const delta = latest && previous ? latest.weight - previous.weight : 0;
  const initialDelta = latest && initialWeight ? latest.weight - initialWeight : 0;
  const isGoalAligned = isWeightGoalAligned(goal, initialDelta, Boolean(latest && initialWeight));
  const goalCopy = goal === "perdere-peso"
    ? "Obiettivo: perdere peso"
    : "Obiettivo: massa";

  weightProgressPanel.innerHTML = `
    <article class="progress-card weight-card">
      <header>
        <div>
          <h3>Peso corporeo</h3>
          <span>${goalCopy}</span>
          <small class="${isGoalAligned ? "delta-up" : "delta-down"}">Stato: ${isGoalAligned ? "in linea" : "non in linea"}</small>
        </div>
        ${latest ? `<strong class="${isGoalAligned ? "delta-up" : "delta-down"}">${formatNumber(latest.weight)} kg</strong>` : ""}
      </header>
      <div class="progress-grid two-up">
        <div>
          <span>Variazione assoluta</span>
          <strong class="${deltaClass(initialDelta)}">${latest && initialWeight ? `${formatSigned(initialDelta)} kg` : "0"}</strong>
          <small>${initialWeight ? `dal peso iniziale ${formatNumber(initialWeight)} kg` : "peso iniziale mancante"}</small>
        </div>
        <div>
          <span>Ultima variazione</span>
          <strong>${latest && previous ? `${formatSigned(delta)} kg` : "0"}</strong>
          <small>${previous ? `da ${formatDate(previous.date)}` : "primo dato"}</small>
        </div>
      </div>
      ${entries.length >= 2 ? renderWeightChart(entries) : ""}
      <details class="weight-entry-toggle">
        <summary>
          <div>
            <h4>Nuova misurazione peso</h4>
            <span>${due ? "Promemoria settimanale" : "Aggiorna quando vuoi"}</span>
          </div>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <form class="weekly-weight-form">
          <label class="field">
            <span>Peso</span>
            <input name="weeklyWeight" type="text" inputmode="decimal" placeholder="Aggiorna peso" required />
          </label>
          <button class="primary-action" type="submit">Aggiorna peso</button>
        </form>
      </details>
    </article>
  `;
}

function renderWeightChart(entries) {
  const width = 320;
  const height = 112;
  const padding = 16;
  const weights = entries.map((entry) => entry.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const points = entries.map((entry, index) => {
    const x = padding + (index / Math.max(entries.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((entry.weight - min) / range) * (height - padding * 2);
    return { x, y, entry };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return `
    <div class="weight-chart" aria-label="Grafico peso">
      <div class="weight-chart-heading">
        <span>Andamento peso</span>
        <strong>${formatNumber(min)}-${formatNumber(max)} kg</strong>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento del peso corporeo">
        <path class="chart-grid-line" d="M ${padding} ${height - padding} H ${width - padding}" />
        <path class="chart-line" d="${path}" />
        ${points.map((point) => `
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="4.4"
            tabindex="0"
            data-weight-point
            data-weight="${formatNumber(point.entry.weight)}"
            data-date="${formatDate(point.entry.date)}"
            aria-label="${formatNumber(point.entry.weight)} kg, ${formatDate(point.entry.date)}"
          />
        `).join("")}
      </svg>
      <div class="weight-chart-readout" id="weightChartReadout">Tocca un punto per leggere il peso</div>
    </div>
  `;
}

function renderProgressItem(item) {
  return `
    <li class="progress-card">
      <details>
        <summary>
          <header>
            <div>
              <h3>${escapeHtml(item.name)}</h3>
            </div>
          </header>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div class="progress-detail-meta">
          <span>Ultimo: ${formatDate(item.latest.date)}</span>
          <span>Precedente: ${formatDate(item.previous.date)}</span>
          <span>Primo: ${formatDate(item.first.date)}</span>
        </div>
        ${renderProgressComparison("Dal precedente", item.fromPrevious)}
        ${renderProgressComparison("Dal primo", item.fromFirst)}
      </details>
    </li>
  `;
}

function renderProgressComparison(title, comparison) {
  return `
    <section class="progress-comparison">
      <h4>${title}</h4>
      <div class="progress-grid two-up">
        <div>
          <span>Peso totale</span>
          <strong class="${deltaClass(comparison.totalWeightDelta)}">${formatSigned(comparison.totalWeightDelta)} kg</strong>
          <small>${trendCopy(comparison.totalWeightDelta)}</small>
        </div>
        <div>
          <span>Reps totali</span>
          <strong class="${deltaClass(comparison.totalRepsDelta)}">${formatSigned(comparison.totalRepsDelta, 0)}</strong>
          <small>${trendCopy(comparison.totalRepsDelta)}</small>
        </div>
      </div>
    </section>
  `;
}

async function createBlankTemplate() {
  const name = value("#templateNamePage");
  if (!name) {
    await appAlert("Nome mancante", "Dai un nome all'allenamento.");
    return;
  }

  const key = exerciseKey(name);
  if (state.templates.some((template) => exerciseKey(template.name) === key)) {
    await appAlert("Nome gia' usato", "Esiste gia' un allenamento con questo nome.");
    return;
  }

  if (state.exercises.length && !await appConfirm("Sostituire sessione?", "La sessione corrente verra' rimossa.")) return;
  state.editingTemplate = { id: createId(), name };
  state.activeTemplateWorkout = false;
  state.exercises = [];
  state.sessionStartedAt = null;
  currentExerciseType = "strength";
  resetExerciseEntryState();
  document.querySelector("#templateNamePage").value = "";
  saveCurrent();
  render();
  showView("workout");
}

function saveTemplateFromExercises(name, exercises) {
  const key = exerciseKey(name);
  const existing = state.templates.find((template) => exerciseKey(template.name) === key);
  const templateData = {
    id: existing?.id ?? createId(),
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

async function saveTemplateFromHistory(workoutId) {
  const workout = state.history.find((item) => item.id === workoutId);
  if (!workout) return;

  const name = await appPrompt("Nome allenamento", "Come vuoi salvare questo template?");
  if (!name) return;

  saveTemplateFromExercises(name, workout.exercises);

  saveTemplates();
  render();
}

async function editTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  if (state.exercises.length && !state.editingTemplate && !await appConfirm("Sostituire sessione?", "La sessione corrente verra' rimossa.")) return;

  state.editingTemplate = {
    id: template.id,
    name: template.name,
  };
  state.activeTemplateWorkout = false;
  state.activeTemplateId = null;
  state.activeScheduleId = null;
  clearPendingTemplateSetUpdates();
  state.exercises = cloneSessionExercises(template.exercises);
  state.sessionStartedAt = null;
  currentExerciseType = "strength";
  resetExerciseEntryState();
  saveCurrent();
  render();
  showView("workout");
}

async function saveEditingTemplate() {
  if (!state.editingTemplate) return;
  if (!state.exercises.length) {
    await appAlert("Template vuoto", "Aggiungi almeno un esercizio prima di salvare il template.");
    return;
  }

  saveTemplateFromExercises(state.editingTemplate.name, state.exercises);
  state.editingTemplate = null;
  state.activeTemplateWorkout = false;
  state.activeTemplateId = null;
  state.activeScheduleId = null;
  clearPendingTemplateSetUpdates();
  state.exercises = [];
  state.sessionStartedAt = null;
  saveCurrent();
  saveTemplates();
  render();
  showView("templates");
}

async function loadTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;

  if (hasActiveWorkout() && !await appConfirm("Allenamento in corso", "Vuoi iniziarne uno nuovo con questo template?")) return;
  if (!hasActiveWorkout() && state.exercises.length && !await appConfirm("Sostituire sessione?", "Vuoi sostituire la sessione corrente con questo template?")) return;

  state.editingTemplate = null;
  state.activeTemplateWorkout = true;
  state.activeTemplateId = template.id;
  state.activeScheduleId = null;
  clearPendingTemplateSetUpdates();
  templateAddMode = false;
  templateExerciseEditMode = false;
  state.exercises = cloneSessionExercises(template.exercises);
  state.sessionStartedAt = new Date().toISOString();
  saveCurrent();
  render();
  showView("workout");
}

async function deleteTemplate(templateId) {
  if (!await appConfirm("Cancellare template?", "Il template verra' rimosso anche dal programma settimanale.")) return;

  state.templates = state.templates.filter((template) => template.id !== templateId);
  state.schedule = state.schedule.filter((item) => item.templateId !== templateId);
  saveTemplates();
  savePendingTemplateSetUpdates();
  saveSchedule();
  render();
}

async function deleteHistoryWorkout(workoutId) {
  if (!await appConfirm("Eliminare allenamento?", "Questo allenamento verra' rimosso dallo storico.")) return;
  state.history = state.history.filter((workout) => workout.id !== workoutId);
  persist();
  render();
}

async function renameHistoryWorkout(workoutId) {
  const workout = state.history.find((item) => item.id === workoutId);
  if (!workout) return;

  const currentName = workout.title?.trim() || "";
  const name = await appPrompt("Nome allenamento", "Scegli un nome per lo storico.", currentName);
  if (name === null) return;

  state.history = state.history.map((item) => {
    if (item.id !== workoutId) return item;
    return { ...item, title: name.trim() };
  });
  persist();
  render();
}

async function addMyExercise(name, type = "strength") {
  const cleanName = name.trim();
  if (!cleanName) {
    await appAlert("Nome mancante", "Inserisci il nome dell'esercizio.");
    return;
  }

  const key = exerciseKey(cleanName);
  if (state.myExercises.some((exercise) => exerciseKey(exercise.name) === key && (exercise.type ?? "strength") === type)) {
    await appAlert("Esercizio gia' salvato", "Questo esercizio e' gia' nella tua libreria.");
    return;
  }

  state.myExercises.unshift({
    id: createId(),
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
    id: createId(),
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

function getSortedSchedule() {
  return [...state.schedule].sort(compareScheduleItems);
}

function compareScheduleItems(a, b) {
  return getScheduledWorkoutDate(a).getTime() - getScheduledWorkoutDate(b).getTime();
}

function dayLabel(day) {
  return ["", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato", "Domenica"][Number(day)] ?? "Giorno";
}

function addWeightEntry(weightValue, shouldSyncProfile = false, replaceToday = false) {
  const weight = parseDecimal(weightValue);
  if (!weight || weight <= 0) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const existingIndex = replaceToday
    ? state.weightEntries.findIndex((entry) => entry.date.slice(0, 10) === todayKey)
    : -1;
  const entry = {
    id: existingIndex >= 0 ? state.weightEntries[existingIndex].id : createId(),
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

function startExerciseMove(event) {
  const handle = event.target.closest("[data-drag-exercise]");
  if (!handle || !state.editingTemplate) return;
  movingExerciseId = handle.dataset.dragExercise;
  handle.closest(".exercise-card")?.classList.add("is-moving");
  list.classList.add("is-reordering");
  event.preventDefault();
}

function moveExercise(event) {
  if (!movingExerciseId || !state.editingTemplate) return;
  const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-exercise-card]");
  const targetId = targetCard?.dataset.exerciseCard;
  if (!targetId || targetId === movingExerciseId) return;
  reorderExercise(movingExerciseId, targetId);
  event.preventDefault();
}

function endExerciseMove() {
  if (!movingExerciseId) return;
  movingExerciseId = null;
  list.classList.remove("is-reordering");
  list.querySelectorAll(".is-moving").forEach((card) => card.classList.remove("is-moving"));
}

function moveExerciseByDirection(exerciseId, direction) {
  if (!state.editingTemplate) return;
  const currentIndex = state.exercises.findIndex((exercise) => exercise.id === exerciseId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.exercises.length) return;
  const nextExercises = [...state.exercises];
  const [exercise] = nextExercises.splice(currentIndex, 1);
  nextExercises.splice(nextIndex, 0, exercise);
  state.exercises = nextExercises;
  saveCurrent();
  render();
}

function reorderExercise(sourceId, targetId) {
  const sourceIndex = state.exercises.findIndex((exercise) => exercise.id === sourceId);
  const targetIndex = state.exercises.findIndex((exercise) => exercise.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const nextExercises = [...state.exercises];
  const [exercise] = nextExercises.splice(sourceIndex, 1);
  nextExercises.splice(targetIndex, 0, exercise);
  state.exercises = nextExercises;
  saveCurrent();
  render();
}

function syncTemplateSetEdit(exerciseId, setIndex, field, newValue) {
  if (!state.activeTemplateWorkout || state.editingTemplate || !state.activeTemplateId) return;

  const sessionExercise = state.exercises.find((exercise) => exercise.id === exerciseId);
  if (!sessionExercise || sessionExercise.type !== "strength" || sessionExercise.isSuperset) return;

  const update = {
    templateId: state.activeTemplateId,
    templateExerciseId: sessionExercise.templateExerciseId ?? null,
    templateExerciseIndex: sessionExercise.templateExerciseIndex ?? null,
    setIndex,
    field,
    value: newValue,
  };
  const updateKey = templateSetUpdateKey(update);
  const withoutExisting = state.pendingTemplateSetUpdates.filter((item) => templateSetUpdateKey(item) !== updateKey);
  state.pendingTemplateSetUpdates = [...withoutExisting, update];
  savePendingTemplateSetUpdates();
}

async function resolvePendingTemplateSetUpdates() {
  const relevantUpdates = state.pendingTemplateSetUpdates.filter((item) => item.templateId === state.activeTemplateId);
  if (!relevantUpdates.length) return;

  const shouldUpdateTemplate = await appConfirm("Aggiornare template?", "Pesi o ripetizioni sono cambiati. Vuoi aggiornare anche il template salvato?");
  if (shouldUpdateTemplate) {
    applyPendingTemplateSetUpdates(relevantUpdates);
  }
  clearPendingTemplateSetUpdates();
}

function applyPendingTemplateSetUpdates(updates) {
  let didUpdate = false;
  state.templates = state.templates.map((template) => {
    const templateUpdates = updates.filter((item) => item.templateId === template.id);
    if (!templateUpdates.length) return template;

    const exercises = template.exercises.map((exercise, index) => {
      const exerciseUpdates = templateUpdates.filter((item) => item.templateExerciseId
        ? exercise.id === item.templateExerciseId
        : index === item.templateExerciseIndex);
      if (!exerciseUpdates.length) return exercise;

      const sets = normalizeSets(exercise).map((set, currentIndex) => {
        const setUpdates = exerciseUpdates.filter((item) => item.setIndex === currentIndex);
        if (!setUpdates.length) return set;

        didUpdate = true;
        return setUpdates.reduce((updatedSet, item) => ({
          ...updatedSet,
          [item.field]: item.value,
        }), set);
      });

      return { ...exercise, sets };
    });

    return { ...template, exercises, updatedAt: new Date().toISOString() };
  });

  if (didUpdate) saveTemplates();
}

function templateSetUpdateKey(update) {
  return [
    update.templateId,
    update.templateExerciseId ?? `index-${update.templateExerciseIndex}`,
    update.setIndex,
    update.field,
  ].join(":");
}

function clearPendingTemplateSetUpdates() {
  state.pendingTemplateSetUpdates = [];
  savePendingTemplateSetUpdates();
}

async function resetDatabase() {
  if (!await appConfirm("Eliminare tutto?", "Profilo, storico, template e sessione attiva verranno rimossi.")) return;

  state.exercises = [];
  state.history = [];
  state.templates = [];
  state.schedule = [];
  state.myExercises = [];
  state.weightEntries = [];
  state.profile = null;
  state.editingTemplate = null;
  state.sessionStartedAt = null;
  state.activeTemplateWorkout = false;
  state.activeTemplateId = null;
  state.activeScheduleId = null;
  templateAddMode = false;
  templateExerciseEditMode = false;
  clearPendingTemplateSetUpdates();
  introPlayed = false;
  welcomePlayed = false;

  [
    "gym-log-current",
    "gym-log-history",
    "gym-log-templates",
    "gym-log-weekly-schedule",
    "gym-log-my-exercises",
    "gym-log-weight-entries",
    "gym-log-profile",
    "gym-log-editing-template",
    "gym-log-started-at",
    "gym-log-active-template-workout",
    "gym-log-active-template-id",
    "gym-log-active-schedule-id",
    "gym-log-pending-template-set-updates",
  ].forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("gym-log-welcome-played");
  localStorage.removeItem("gym-log-intro-played");

  document.querySelector("#profileNameSetup").value = "";
  document.querySelector("#profileWeightSetup").value = "";
  document.querySelector("#profileAgeSetup").value = "";
  document.querySelector("[name='genderSetup'][value='male']").checked = true;
  document.querySelector("[name='goalSetup'][value='massa']").checked = true;
  showView("intro");
}

function appAlert(title, message) {
  return appDialog({ title, message, actions: [{ label: "Ok", value: true, primary: true }] });
}

function appConfirm(title, message) {
  return appDialog({
    title,
    message,
    actions: [
      { label: "Annulla", value: false },
      { label: "Conferma", value: true, primary: true },
    ],
  });
}

function appPrompt(title, message, defaultValue = "", options = {}) {
  return appDialog({
    title,
    message,
    defaultValue,
    inputMode: options.inputMode ?? "text",
    placeholder: options.placeholder ?? "",
    prompt: true,
    actions: [
      { label: "Annulla", value: null },
      { label: "Salva", value: "submit", primary: true },
    ],
  });
}

function appDialog({ title, message, actions, prompt = false, defaultValue = "", inputMode = "text", placeholder = "" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "app-dialog";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="app-dialog-card">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
        ${prompt ? `
          <label class="field">
            <span>Valore</span>
            <input class="app-dialog-input" type="text" inputmode="${escapeAttribute(inputMode)}" value="${escapeAttribute(defaultValue)}" placeholder="${escapeAttribute(placeholder)}" />
          </label>
        ` : ""}
        <div class="app-dialog-actions">
          ${actions.map((action, index) => `
            <button class="${action.primary ? "primary" : ""}" type="button" data-dialog-action="${index}">${escapeHtml(action.label)}</button>
          `).join("")}
        </div>
      </div>
    `;

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      finish(actions[0]?.value ?? null);
    });

    overlay.querySelectorAll("[data-dialog-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = actions[Number(button.dataset.dialogAction)];
        if (action.value === "submit") {
          finish(overlay.querySelector(".app-dialog-input")?.value ?? "");
          return;
        }
        finish(action.value);
      });
    });

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish(actions[0]?.value ?? null);
      if (event.key === "Enter" && prompt) finish(overlay.querySelector(".app-dialog-input")?.value ?? "");
    });

    document.body.append(overlay);
    window.setTimeout(() => {
      const focusTarget = overlay.querySelector(".app-dialog-input") ?? overlay.querySelector(".primary") ?? overlay.querySelector("button");
      focusTarget?.focus();
      if (focusTarget?.select) focusTarget.select();
    });
  });
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function parseDecimal(value) {
  return Number(String(value).trim().replace(",", ".")) || 0;
}

function checkedValue(name) {
  return document.querySelector(`[name='${name}']:checked`)?.value ?? "";
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function addSetRow(set = { reps: "", weight: "" }, container = setRows) {
  const row = document.createElement("div");
  row.className = "set-row";
  row.innerHTML = `
    <strong></strong>
    <label class="field">
      <span>Kg</span>
      <input name="weight" type="text" inputmode="decimal" value="${set.weight}" />
    </label>
    <label class="field">
      <span>Rip.</span>
      <input name="reps" type="number" min="1" max="100" inputmode="numeric" value="${set.reps}" />
    </label>
    <button class="delete-row" type="button" data-remove-set aria-label="Elimina serie">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  `;
  container.append(row);
  syncSetLabels(container);
}

function resetSetRows(container = setRows, lastSet = { reps: "", weight: "" }) {
  container.innerHTML = "";
  addSetRow(lastSet, container);
  addSetRow(lastSet, container);
  addSetRow(lastSet, container);
}

function syncSetLabels(container = setRows) {
  container.querySelectorAll(".set-row").forEach((row, index) => {
    row.querySelector("strong").textContent = index + 1;
    row.querySelector("[data-remove-set]").disabled = container.children.length === 1;
  });
}

function syncRestButtons() {
  document.querySelectorAll("[data-rest]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rest) === selectedRest);
  });
}

function resetExerciseEntryState() {
  form.reset();
  currentExerciseType = "strength";
  selectedRest = 90;
  supersetToggle.checked = false;
  supersetThirdField.hidden = true;
  document.querySelector("#toggleSupersetThird").textContent = "Aggiungi terzo esercizio";
  resetSetRows();
  resetSetRows(supersetSetRows2);
  resetSetRows(supersetSetRows3);
  hideExerciseSuggestions();
  renderExerciseTypeFields();
  syncRestButtons();
}

function getSetValues(container = setRows) {
  const sets = [];

  for (const row of container.querySelectorAll(".set-row")) {
    const weight = row.querySelector("[name='weight']").value.trim();
    const reps = row.querySelector("[name='reps']").value.trim();
    const isEmpty = !weight && !reps;

    if (isEmpty) continue;

    if (!weight || !reps) {
      appAlert("Serie incompleta", "Completa kg e ripetizioni nelle serie iniziate, oppure lasciale vuote.");
      return null;
    }

    sets.push({
      weight: parseDecimal(weight),
      reps: Number(reps),
    });
  }

  return sets;
}

function getLastSetValue(container = setRows) {
  const lastSet = getSetValues(container).at(-1);
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
    id: exercise.templateExerciseId ?? exercise.id ?? createId(),
    name: exercise.name,
    names: exercise.names ? [...exercise.names] : null,
    isSuperset: Boolean(exercise.isSuperset),
    supersetExercises: cloneSupersetExercises(exercise),
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
  return exercises.map((exercise, index) => ({
    id: createId(),
    templateExerciseId: exercise.id ?? exercise.templateExerciseId ?? null,
    templateExerciseIndex: index,
    name: exercise.name,
    names: exercise.names ? [...exercise.names] : null,
    isSuperset: Boolean(exercise.isSuperset),
    supersetExercises: cloneSupersetExercises(exercise),
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
      const first = items[0];

      return {
        name: latest.name,
        latest,
        previous,
        first,
        fromPrevious: buildProgressDelta(latest, previous),
        fromFirst: buildProgressDelta(latest, first),
      };
    })
    .sort((a, b) => Math.abs(b.fromPrevious.totalWeightDelta) - Math.abs(a.fromPrevious.totalWeightDelta));
}

function getExerciseSuggestions(query = "", type = currentExerciseType) {
  const suggestions = new Map();
  const normalizedQuery = exerciseKey(query);

  state.myExercises.forEach((exercise) => {
    if ((exercise.type ?? "strength") !== type) return;
    addExerciseSuggestionNames(suggestions, [exercise.name]);
  });

  state.history.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      if ((exercise.type ?? "strength") !== type) return;
      addExerciseSuggestionNames(suggestions, getExerciseNames(exercise));
    });
  });

  state.templates.forEach((template) => {
    template.exercises.forEach((exercise) => {
      if ((exercise.type ?? "strength") !== type) return;
      addExerciseSuggestionNames(suggestions, getExerciseNames(exercise));
    });
  });

  return [...suggestions.values()].filter((name) => {
    if (!normalizedQuery) return true;
    return exerciseKey(name).includes(normalizedQuery);
  });
}

function addExerciseSuggestionNames(suggestions, names) {
  names
    .flatMap((name) => String(name).split(" + "))
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = exerciseKey(name);
      if (!key || suggestions.has(key)) return;
      suggestions.set(key, name);
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
    const entries = exercise.isSuperset
      ? getSupersetExercises(exercise)
      : [{ name: exercise.name, sets: normalizeSets(exercise) }];

    entries.forEach((entry) => {
      const key = exerciseKey(entry.name);
      if (!key) return;

      const existing = grouped.get(key) ?? { name: entry.name.trim(), sets: [] };
      grouped.set(key, {
        name: existing.name,
        sets: [...existing.sets, ...entry.sets],
      });
    });
  });

  return grouped;
}

function buildPerformance(key, exerciseGroup, date) {
  const cleanSets = exerciseGroup.sets.filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps));

  return {
    key,
    name: exerciseGroup.name,
    date,
    totalWeight: cleanSets.reduce((sum, set) => sum + set.weight, 0),
    totalReps: cleanSets.reduce((sum, set) => sum + set.reps, 0),
  };
}

function buildProgressDelta(latest, baseline) {
  return {
    totalWeightDelta: latest.totalWeight - baseline.totalWeight,
    totalRepsDelta: latest.totalReps - baseline.totalReps,
  };
}

function getInitialProfileWeight() {
  const initialProfileWeight = parseDecimal(state.profile?.initialWeight ?? "");
  if (initialProfileWeight) return initialProfileWeight;
  const profileWeight = parseDecimal(state.profile?.weight ?? "");
  if (profileWeight) return profileWeight;
  return [...state.weightEntries].sort((a, b) => new Date(a.date) - new Date(b.date))[0]?.weight ?? 0;
}

function countSessionSets(exercises) {
  return exercises.reduce((sum, exercise) => sum + countExerciseSets(exercise), 0);
}

function countSessionExercises(exercises) {
  return exercises.reduce((sum, exercise) => sum + getExerciseNames(exercise).length, 0);
}

function countExerciseSets(exercise) {
  const type = exercise.type ?? "strength";
  if (exercise.isSuperset) {
    return getSupersetExercises(exercise).reduce((sum, item) => sum + item.sets.length, 0);
  }
  if (type === "stretching") return getStretchSets(exercise);
  if (type === "cardio") return 0;
  return normalizeSets(exercise).length;
}

function countRestRounds(exercise) {
  if (!exercise.isSuperset) return countExerciseSets(exercise);
  return getSupersetExercises(exercise).reduce((max, item) => Math.max(max, item.sets.length), 0);
}

function getSupersetNames() {
  return getSupersetExerciseValues().map((item) => item.name);
}

function getSupersetExerciseValues() {
  const entries = [
    { name: value("#exerciseName"), container: setRows },
    { name: value("#supersetName2"), container: supersetSetRows2 },
  ];

  if (!supersetThirdField.hidden) {
    entries.push({ name: value("#supersetName3"), container: supersetSetRows3 });
  }

  const result = [];
  for (const entry of entries) {
    if (!entry.name) continue;
    const sets = getSetValues(entry.container);
    result.push({ name: entry.name, sets });
  }
  return result;
}

function getExerciseNames(exercise) {
  if (Array.isArray(exercise.names) && exercise.names.length) return exercise.names;
  return [exercise.name].filter(Boolean);
}

function getSupersetExercises(exercise) {
  if (Array.isArray(exercise.supersetExercises) && exercise.supersetExercises.length) {
    return exercise.supersetExercises.map((item) => ({
      name: item.name,
      sets: Array.isArray(item.sets) ? item.sets : [],
    }));
  }

  return getExerciseNames(exercise).map((name) => ({
    name,
    sets: normalizeSets(exercise),
  }));
}

function cloneSupersetExercises(exercise) {
  if (!exercise.isSuperset) return null;
  return getSupersetExercises(exercise).map((item) => ({
    name: item.name,
    sets: item.sets.map((set) => ({
      weight: set.weight,
      reps: set.reps,
    })),
  }));
}

function isWeightUpdateDue(lastDate) {
  if (!lastDate) return true;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastDate).getTime() >= weekMs;
}

function isWeightGoalAligned(goal, delta, hasBaseline) {
  if (!hasBaseline || delta === 0) return true;
  if (goal === "perdere-peso") return delta < 0;
  return delta > 0;
}

function trendCopy(delta) {
  if (delta > 0) return "in salita";
  if (delta < 0) return "in discesa";
  return "stabile";
}

function effortTrendCopy(delta) {
  if (delta > 0) return "piu pesante";
  if (delta < 0) return "piu leggero";
  return "stessa fatica";
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

function formatFullDate(date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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

function effortDeltaClass(delta) {
  if (delta > 0) return "delta-hard";
  if (delta < 0) return "delta-easy";
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
  saveSchedule();
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
  if (state.activeTemplateId && state.activeTemplateWorkout && state.exercises.length) {
    localStorage.setItem("gym-log-active-template-id", JSON.stringify(state.activeTemplateId));
  } else {
    localStorage.removeItem("gym-log-active-template-id");
  }
  if (state.activeScheduleId && state.activeTemplateWorkout && state.exercises.length) {
    localStorage.setItem("gym-log-active-schedule-id", JSON.stringify(state.activeScheduleId));
  } else {
    localStorage.removeItem("gym-log-active-schedule-id");
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

function savePendingTemplateSetUpdates() {
  localStorage.setItem("gym-log-pending-template-set-updates", JSON.stringify(state.pendingTemplateSetUpdates));
}

function saveSchedule() {
  localStorage.setItem("gym-log-weekly-schedule", JSON.stringify(state.schedule));
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
resetSetRows(supersetSetRows2);
resetSetRows(supersetSetRows3);
render();
showView(state.profile ? "home" : (introPlayed ? "onboarding" : "intro"));
setInterval(renderDuration, 1000);
startScheduleReminderLoop();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.update();
    }).catch(() => {});
  });
}
