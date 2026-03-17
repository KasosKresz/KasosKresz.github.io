import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  awardReward,
  getCategoryLevel,
  getNextCategoryLevel,
  getOverallLevel,
  getNextOverallLevel,
  loadRewardData,
  normalizeRewardData
} from "./rewards-core.js";

const KNOWLEDGE_PAGES = {
  "understanding-anxiety.html": "Understanding Anxiety",
  "anxiety-many-faces.html": "Anxiety: Understanding Its Many Faces",
  "embracing-imperfection.html": "Embracing Imperfection",
  "reframing-stress.html": "Reframing Stress",
  "exercise-and-calm.html": "Exercise and Calm",
  "sleep-and-stress.html": "Sleep and Stress",
  "spiritual-balance.html": "Spiritual Balance",
  "two-faces-of-stress.html": "The Two Faces of Stress",
  "written-exposure-guide.html": "Written Exposure Guide",
  "written-exposure-trauma.html": "Healing Through Written Exposure Therapy",
  "written-emotional-disclosure.html": "Written Emotional Disclosure",
  "cognitive-restructuring-guide.html": "Cognitive Restructuring Guide"
};

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isKnowledgeArticle = Object.prototype.hasOwnProperty.call(KNOWLEDGE_PAGES, currentPage);
const hasAudioRewards = document.querySelector("audio source[src]") !== null;
const showKnowledgeSummary = currentPage === "blog.html" || currentPage === "materials.html" || isKnowledgeArticle;
const showRelaxSummary = currentPage === "audio.html" || hasAudioRewards;

let currentUser = null;
let rewardData = normalizeRewardData({}, null);
let rewardPanel = null;
let toast = null;
let knowledgeAwardedThisVisit = false;
let rewardsAvailable = true;

function ensureStyles() {
  if (document.getElementById("rewards-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "rewards-style";
  style.textContent = `
    .rewards-panel {
      background: #edf4f3;
      border: 1px solid #d9e4e2;
      border-radius: 16px;
      padding: 16px 18px;
      margin: 18px 0 22px;
      color: #2f3a3a;
    }

    .rewards-panel h3 {
      margin: 0 0 6px;
      color: #2f5d62;
      font-size: 1rem;
    }

    .rewards-panel p {
      margin: 0 0 10px;
      line-height: 1.6;
    }

    .reward-earned {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dff3ea;
      color: #1f8a5b;
      font-size: 13px;
      font-weight: bold;
    }

    .reward-toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 3200;
      max-width: 320px;
      background: #2f5d62;
      color: white;
      padding: 14px 16px;
      border-radius: 14px;
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.16);
      line-height: 1.5;
    }
  `;

  document.head.appendChild(style);
}

function createRewardItemId(sourceValue) {
  return decodeURIComponent(sourceValue.split("/").pop().split(".")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPlayedSeconds(audio) {
  const played = audio.played;
  let total = 0;

  for (let index = 0; index < played.length; index += 1) {
    total += played.end(index) - played.start(index);
  }

  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return Math.min(total, audio.duration);
  }

  return total;
}

function getRequiredAudioSeconds(audio) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    return 0;
  }

  const byPercent = audio.duration * 0.8;
  const byMinimum = Math.min(30, audio.duration);
  return Math.min(audio.duration, Math.max(byPercent, byMinimum));
}

function getMindEaseGain(previousPoints, nextPoints) {
  return Math.max(0, (Number(nextPoints) || 0) - (Number(previousPoints) || 0));
}

function showToast(message) {
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "reward-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    if (toast) {
      toast.remove();
      toast = null;
    }
  }, 3200);
}

function renderSummaryPanel() {
  if (!showKnowledgeSummary && !showRelaxSummary) {
    return;
  }

  if (!rewardPanel) {
    rewardPanel = document.createElement("div");
    rewardPanel.className = "rewards-panel";

    const host =
      document.querySelector(".article") ||
      document.querySelector(".section") ||
      document.querySelector(".page");

    if (!host) {
      return;
    }

    const heading = host.querySelector("h1");
    if (heading) {
      heading.insertAdjacentElement("afterend", rewardPanel);
    } else {
      host.prepend(rewardPanel);
    }
  }

  if (!currentUser) {
    rewardPanel.innerHTML = `
      <h3>MindEase Journey</h3>
      <p>Sign in to collect Relax Points from completed audio and Knowledge Points from full articles and guides.</p>
    `;
    return;
  }

  if (!rewardsAvailable) {
    rewardPanel.innerHTML = `
      <h3>MindEase Journey</h3>
      <p>Points are unavailable right now.</p>
    `;
    return;
  }

  const overallLevel = getOverallLevel(rewardData.mindeasePoints);
  const nextOverallLevel = getNextOverallLevel(rewardData.mindeasePoints);
  const overallText = nextOverallLevel
    ? `${nextOverallLevel.threshold - rewardData.mindeasePoints} more points to reach ${nextOverallLevel.label}.`
    : "Top MindEase level reached.";

  const sections = [
    `<p><strong>MindEase Points:</strong> ${rewardData.mindeasePoints} - ${overallLevel.label}<br>${overallText}</p>`
  ];

  if (showRelaxSummary) {
    const level = getCategoryLevel("relax", rewardData.relaxPoints);
    const next = getNextCategoryLevel("relax", rewardData.relaxPoints);
    const nextText = next
      ? `${next.threshold - rewardData.relaxPoints} more points to reach ${next.label}.`
      : "Top relax level reached.";

    sections.push(
      `<p><strong>Relax Points:</strong> ${rewardData.relaxPoints} - ${level.label}<br>${nextText}</p>`
    );
  }

  if (showKnowledgeSummary) {
    const level = getCategoryLevel("knowledge", rewardData.knowledgePoints);
    const next = getNextCategoryLevel("knowledge", rewardData.knowledgePoints);
    const nextText = next
      ? `${next.threshold - rewardData.knowledgePoints} more points to reach ${next.label}.`
      : "Top knowledge level reached.";

    sections.push(
      `<p><strong>Knowledge Points:</strong> ${rewardData.knowledgePoints} - ${level.label}<br>${nextText}</p>`
    );
  }

  rewardPanel.innerHTML = `
    <h3>MindEase Journey</h3>
    ${sections.join("")}
  `;
}

function markEarnedAudioItems() {
  const earned = new Set(rewardData.relaxItems || []);

  document.querySelectorAll("audio").forEach((audio) => {
    const source = audio.querySelector("source[src]");
    if (!source) {
      return;
    }

    const itemId = createRewardItemId(source.getAttribute("src"));
    const container = audio.closest(".audio-item");
    if (!container) {
      return;
    }

    const existing = container.querySelector(".reward-earned");
    if (earned.has(itemId)) {
      if (!existing) {
        const badge = document.createElement("div");
        badge.className = "reward-earned";
        badge.textContent = "10 Relax Points collected";
        container.appendChild(badge);
      }
    } else if (existing) {
      existing.remove();
    }
  });
}

function setupAudioRewards() {
  document.querySelectorAll("audio").forEach((audio) => {
    if (audio.dataset.rewardBound === "true") {
      return;
    }

    const source = audio.querySelector("source[src]");
    if (!source) {
      return;
    }

    const itemId = createRewardItemId(source.getAttribute("src"));
    audio.dataset.rewardBound = "true";

    audio.addEventListener("ended", async () => {
      const requiredSeconds = getRequiredAudioSeconds(audio);
      const playedSeconds = getPlayedSeconds(audio);

      if (requiredSeconds && playedSeconds + 0.5 < requiredSeconds) {
        showToast("Listen through most of the audio to collect Relax Points.");
        return;
      }

      if (!currentUser) {
        renderSummaryPanel();
        showToast("Sign in to collect Relax Points.");
        return;
      }

      try {
        const previousMindEasePoints = rewardData.mindeasePoints;
        const result = await awardReward(db, currentUser.uid, "relax", itemId);
        rewardData = result.data;
        renderSummaryPanel();
        markEarnedAudioItems();

        if (result.awarded) {
          const mindEaseGain = getMindEaseGain(previousMindEasePoints, result.data.mindeasePoints);
          showToast(
            mindEaseGain
              ? `+10 Relax Points and +${mindEaseGain} MindEase Points`
              : "+10 Relax Points"
          );
        } else {
          showToast("Relax Points already collected for this audio.");
        }
      } catch (error) {
        rewardsAvailable = false;
        renderSummaryPanel();
      }
    });
  });
}

function setupKnowledgeRewards() {
  if (!isKnowledgeArticle) {
    return;
  }

  const itemId = currentPage.replace(/\.html$/, "");
  const target = document.querySelector(".article") || document.body;
  const activationTime = Date.now() + 15000;

  async function maybeAwardKnowledge() {
    if (knowledgeAwardedThisVisit) {
      return;
    }

    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = target.offsetTop + target.offsetHeight * 0.82;

    if (Date.now() < activationTime || scrollPosition < threshold) {
      return;
    }

    knowledgeAwardedThisVisit = true;

    if (!currentUser) {
      renderSummaryPanel();
      showToast("Sign in to collect Knowledge Points.");
      return;
    }

    try {
      const previousMindEasePoints = rewardData.mindeasePoints;
      const result = await awardReward(db, currentUser.uid, "knowledge", itemId);
      rewardData = result.data;
      renderSummaryPanel();

      if (result.awarded) {
        const mindEaseGain = getMindEaseGain(previousMindEasePoints, result.data.mindeasePoints);
        showToast(
          mindEaseGain
            ? `+10 Knowledge Points and +${mindEaseGain} MindEase Points`
            : "+10 Knowledge Points"
        );
      } else {
        showToast("Knowledge Points already collected for this article.");
      }
    } catch (error) {
      rewardsAvailable = false;
      renderSummaryPanel();
    }
  }

  window.addEventListener("scroll", maybeAwardKnowledge, { passive: true });
  window.addEventListener("load", maybeAwardKnowledge);
}

ensureStyles();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  rewardsAvailable = true;

  if (user) {
    try {
      rewardData = await loadRewardData(db, user.uid);
    } catch (error) {
      rewardData = normalizeRewardData({}, user.uid);
      rewardsAvailable = false;
    }
  } else {
    rewardData = normalizeRewardData({}, null);
  }

  renderSummaryPanel();
  markEarnedAudioItems();
});

renderSummaryPanel();
setupAudioRewards();
setupKnowledgeRewards();
