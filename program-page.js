(function () {
  const programs = window.MINDEASE_PROGRAMS || {};
  const programId = window.PROGRAM_ID;
  const storageKey = "mindease_program_progress_v1";

  const program = programs[programId];
  if (!program) {
    const title = document.getElementById("programTitle");
    const daysGrid = document.getElementById("daysGrid");
    if (title) {
      title.textContent = "Program unavailable";
    }
    if (daysGrid) {
      daysGrid.innerHTML = '<div class="empty-state">This program could not be loaded.</div>';
    }
    return;
  }

  function readProgress() {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeProgress(progress) {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }

  function getState() {
    const progress = readProgress();
    const completedDays = Array.isArray(progress[programId]?.completedDays)
      ? progress[programId].completedDays.filter((day) => Number.isInteger(day))
      : [];
    return { completedDays };
  }

  function saveState(completedDays) {
    const progress = readProgress();
    progress[programId] = {
      completedDays: completedDays.slice().sort((left, right) => left - right)
    };
    writeProgress(progress);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderTask(task) {
    return [
      '<div class="task-item">',
      `<strong>${escapeHtml(task.type)}: ${escapeHtml(task.label)}</strong>`,
      `<span>${escapeHtml(task.note)}</span>`,
      '<div class="task-links">',
      `<a class="ghost-button" href="${escapeHtml(task.href)}">Open</a>`,
      "</div>",
      "</div>"
    ].join("");
  }

  function renderDay(day, completedDays) {
    const done = completedDays.includes(day.day);
    return [
      `<article class="day-card${done ? " done" : ""}">`,
      '<div class="day-header">',
      "<div>",
      `<span class="day-label">Day ${day.day}</span>`,
      `<h3>${escapeHtml(day.title)}</h3>`,
      "</div>",
      `<button class="day-button" type="button" data-day="${day.day}">${done ? "Completed" : "Mark Day Complete"}</button>`,
      "</div>",
      `<div class="day-focus">${escapeHtml(day.focus)}</div>`,
      `<div class="task-list">${day.tasks.map(renderTask).join("")}</div>`,
      '<div class="reflection-box">',
      "<strong>Reflection</strong>",
      `<div>${escapeHtml(day.reflection)}</div>`,
      "</div>",
      "</article>"
    ].join("");
  }

  function updatePage() {
    const state = getState();
    const completedCount = state.completedDays.length;
    const totalDays = program.days.length;
    const remainingCount = Math.max(totalDays - completedCount, 0);
    const percent = totalDays ? Math.round((completedCount / totalDays) * 100) : 0;

    document.title = `${program.title} | MindEase`;
    document.getElementById("programEyebrow").textContent = `${program.durationLabel} guided program`;
    document.getElementById("programTitle").textContent = program.title;
    document.getElementById("programDescription").textContent = program.description;
    document.getElementById("programAudience").textContent = program.audience;
    document.getElementById("programTheme").textContent = program.theme;
    document.getElementById("durationMetric").textContent = String(totalDays);
    document.getElementById("completedMetric").textContent = String(completedCount);
    document.getElementById("remainingMetric").textContent = String(remainingCount);
    document.getElementById("programProgressPill").textContent = `${completedCount} of ${totalDays} days complete`;
    document.getElementById("programProgressFill").style.width = `${percent}%`;
    document.getElementById("programProgressNote").textContent = remainingCount
      ? `${remainingCount} ${remainingCount === 1 ? "day" : "days"} still open. Progress is saved on this device.`
      : "Program complete on this device. You can clear progress any time and start again.";
    document.getElementById("daysGrid").innerHTML = program.days
      .map((day) => renderDay(day, state.completedDays))
      .join("");
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches("[data-day]")) {
      const day = Number(target.getAttribute("data-day"));
      if (!Number.isFinite(day)) {
        return;
      }

      const state = getState();
      const completedDays = state.completedDays.slice();
      const dayIndex = completedDays.indexOf(day);

      if (dayIndex >= 0) {
        completedDays.splice(dayIndex, 1);
      } else {
        completedDays.push(day);
      }

      saveState(completedDays);
      updatePage();
    }
  });

  const resetButton = document.getElementById("resetProgramButton");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      saveState([]);
      updatePage();
    });
  }

  updatePage();
})();
