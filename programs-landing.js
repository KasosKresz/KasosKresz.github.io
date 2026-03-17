(function () {
  const programs = window.MINDEASE_PROGRAMS || {};
  const storageKey = "mindease_program_progress_v1";
  const programGrid = document.getElementById("programGrid");

  if (!programGrid) {
    return;
  }

  function readProgress() {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const progress = readProgress();
  const cards = Object.entries(programs).map(([slug, program]) => {
    const completedDays = Array.isArray(progress[slug]?.completedDays) ? progress[slug].completedDays.length : 0;
    const progressText = completedDays
      ? `${completedDays}/${program.duration} days completed on this device`
      : "No days completed yet on this device";

    return [
      '<article class="program-card">',
      program.recommended ? '<span class="eyebrow">Recommended first</span>' : "",
      `<span class="program-meta">${escapeHtml(program.durationLabel)}</span>`,
      `<h3>${escapeHtml(program.title)}</h3>`,
      `<p>${escapeHtml(program.shortDescription)}</p>`,
      `<p class="program-note">${escapeHtml(program.audience)}</p>`,
      `<p class="program-note">${escapeHtml(progressText)}</p>`,
      '<div class="actions">',
      `<a class="button" href="/${escapeHtml(slug)}.html">Open Program</a>`,
      "</div>",
      "</article>"
    ].join("");
  });

  programGrid.innerHTML = cards.join("");
})();
