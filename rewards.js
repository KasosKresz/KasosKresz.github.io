import { auth, db } from "./firebase-config.js";
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const REWARD_POINTS = 10;
const REWARDS_DOC = "user_rewards";

const LEVELS = {
  relax: [
    { threshold: 0, label: "Calm Starter" },
    { threshold: 50, label: "Steady Relaxer" },
    { threshold: 150, label: "Deep Breather" },
    { threshold: 300, label: "Stillness Guide" },
    { threshold: 500, label: "Calm Master" }
  ],
  knowledge: [
    { threshold: 0, label: "Curious Student" },
    { threshold: 50, label: "Insight Seeker" },
    { threshold: 150, label: "Thoughtful Teacher" },
    { threshold: 300, label: "Mind Mentor" },
    { threshold: 500, label: "Wisdom Master" }
  ]
};

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
let rewardData = {
  user: null,
  relaxPoints: 0,
  knowledgePoints: 0,
  relaxItems: [],
  knowledgeItems: []
};

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
      margin: 0;
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

function getLevel(type, points) {
  const levels = LEVELS[type];
  let current = levels[0];

  levels.forEach((level) => {
    if (points >= level.threshold) {
      current = level;
    }
  });

  return current;
}

function getNextLevel(type, points) {
  return LEVELS[type].find((level) => level.threshold > points) || null;
}

function createRewardItemId(sourceValue) {
  return decodeURIComponent(sourceValue.split("/").pop().split(".")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRewardDocRef(uid) {
  return doc(db, REWARDS_DOC, uid);
}

function normalizeRewardData(data, uid) {
  return {
    user: uid,
    relaxPoints: Number(data.relaxPoints || 0),
    knowledgePoints: Number(data.knowledgePoints || 0),
    relaxItems: Array.isArray(data.relaxItems) ? data.relaxItems : [],
    knowledgeItems: Array.isArray(data.knowledgeItems) ? data.knowledgeItems : []
  };
}

async function loadRewardData(uid) {
  const snapshot = await getDoc(getRewardDocRef(uid));
  rewardData = snapshot.exists()
    ? normalizeRewardData(snapshot.data(), uid)
    : normalizeRewardData({}, uid);
  return rewardData;
}

async function awardPoints(type, itemId) {
  if (!currentUser) {
    return { awarded: false, reason: "signed_out" };
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      const ref = getRewardDocRef(currentUser.uid);
      const snapshot = await transaction.get(ref);
      const data = snapshot.exists()
        ? normalizeRewardData(snapshot.data(), currentUser.uid)
        : normalizeRewardData({}, currentUser.uid);

      const itemsField = type === "relax" ? "relaxItems" : "knowledgeItems";
      const pointsField = type === "relax" ? "relaxPoints" : "knowledgePoints";

      if (data[itemsField].includes(itemId)) {
        return { awarded: false, data };
      }

      const updatedData = {
        ...data,
        [itemsField]: [...data[itemsField], itemId],
        [pointsField]: data[pointsField] + REWARD_POINTS,
        updatedAt: new Date().toISOString()
      };

      transaction.set(ref, updatedData, { merge: true });
      return { awarded: true, data: updatedData };
    });

    rewardData = result.data;
    return result;
  } catch (error) {
    console.warn("Rewards unavailable.", error);
    return { awarded: false, reason: "error" };
  }
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
      <h3>MindEase Points</h3>
      <p>Sign in to collect Relax Points from completed audio and Knowledge Points from full articles and guides.</p>
    `;
    return;
  }

  if (!rewardsAvailable) {
    rewardPanel.innerHTML = `
      <h3>MindEase Points</h3>
      <p>Points are unavailable right now.</p>
    `;
    return;
  }

  const sections = [];

  if (showRelaxSummary) {
    const relaxLevel = getLevel("relax", rewardData.relaxPoints);
    const relaxNext = getNextLevel("relax", rewardData.relaxPoints);
    const relaxNextText = relaxNext
      ? `${relaxNext.threshold - rewardData.relaxPoints} more points to reach ${relaxNext.label}.`
      : "Top relax level reached.";

    sections.push(`
      <p><strong>Relax Points:</strong> ${rewardData.relaxPoints} - ${relaxLevel.label}<br>${relaxNextText}</p>
    `);
  }

  if (showKnowledgeSummary) {
    const knowledgeLevel = getLevel("knowledge", rewardData.knowledgePoints);
    const knowledgeNext = getNextLevel("knowledge", rewardData.knowledgePoints);
    const knowledgeNextText = knowledgeNext
      ? `${knowledgeNext.threshold - rewardData.knowledgePoints} more points to reach ${knowledgeNext.label}.`
      : "Top knowledge level reached.";

    sections.push(`
      <p><strong>Knowledge Points:</strong> ${rewardData.knowledgePoints} - ${knowledgeLevel.label}<br>${knowledgeNextText}</p>
    `);
  }

  rewardPanel.innerHTML = `
    <h3>MindEase Points</h3>
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
      const result = await awardPoints("relax", itemId);
      renderSummaryPanel();
      markEarnedAudioItems();

      if (!currentUser) {
        showToast("Sign in to collect Relax Points.");
      } else if (result.awarded) {
        showToast("+10 Relax Points");
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
    const result = await awardPoints("knowledge", itemId);
    renderSummaryPanel();

    if (!currentUser) {
      showToast("Sign in to collect Knowledge Points.");
    } else if (result.awarded) {
      showToast("+10 Knowledge Points");
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
      await loadRewardData(user.uid);
    } catch (error) {
      console.warn("Rewards unavailable.", error);
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

