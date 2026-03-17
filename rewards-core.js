import {
  doc,
  getDoc,
  runTransaction,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const REWARD_POINTS = 10;
export const REWARDS_COLLECTION = "user_rewards";

export const CATEGORY_CONFIG = {
  relax: {
    label: "Relax Points",
    itemsField: "relaxItems",
    pointsField: "relaxPoints",
    levels: [
      { threshold: 0, label: "Calm Starter" },
      { threshold: 50, label: "Steady Relaxer" },
      { threshold: 150, label: "Deep Breather" },
      { threshold: 300, label: "Stillness Guide" },
      { threshold: 500, label: "Calm Master" }
    ]
  },
  knowledge: {
    label: "Knowledge Points",
    itemsField: "knowledgeItems",
    pointsField: "knowledgePoints",
    levels: [
      { threshold: 0, label: "Curious Student" },
      { threshold: 50, label: "Insight Seeker" },
      { threshold: 150, label: "Thoughtful Teacher" },
      { threshold: 300, label: "Mind Mentor" },
      { threshold: 500, label: "Wisdom Master" }
    ]
  },
  organize: {
    label: "Organize Points",
    itemsField: "organizeItems",
    pointsField: "organizePoints",
    levels: [
      { threshold: 0, label: "Order Starter" },
      { threshold: 100, label: "Steady Planner" },
      { threshold: 250, label: "Focused Organizer" },
      { threshold: 500, label: "Clarity Guide" },
      { threshold: 800, label: "Master Organizer" }
    ]
  },
  creative: {
    label: "Creative Points",
    itemsField: "creativeItems",
    pointsField: "creativePoints",
    levels: [
      { threshold: 0, label: "Creative Starter" },
      { threshold: 50, label: "Calm Colorer" },
      { threshold: 150, label: "Color Explorer" },
      { threshold: 300, label: "Creative Guide" },
      { threshold: 500, label: "Creative Master" }
    ]
  }
};

export const OVERALL_LEVELS = [
  { threshold: 0, label: "MindEase Explorer" },
  { threshold: 75, label: "Steady Builder" },
  { threshold: 180, label: "Calm Guide" },
  { threshold: 360, label: "Grounded Mentor" },
  { threshold: 600, label: "MindEase Anchor" }
];

export const CATEGORY_WEIGHTS = {
  relax: 30,
  knowledge: 10,
  organize: 20,
  creative: 30
};

function getLevel(levels, points) {
  let current = levels[0];

  levels.forEach((level) => {
    if (points >= level.threshold) {
      current = level;
    }
  });

  return current;
}

function getNextLevel(levels, points) {
  return levels.find((level) => points < level.threshold) || null;
}

export function getCategoryLevel(type, points) {
  return getLevel(CATEGORY_CONFIG[type].levels, points);
}

export function getNextCategoryLevel(type, points) {
  return getNextLevel(CATEGORY_CONFIG[type].levels, points);
}

export function getOverallLevel(points) {
  return getLevel(OVERALL_LEVELS, points);
}

export function getNextOverallLevel(points) {
  return getNextLevel(OVERALL_LEVELS, points);
}

export function calculateMindEasePoints(data) {
  const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((sum, value) => sum + value, 0);

  if (!totalWeight) {
    return 0;
  }

  const weightedSum =
    (Number(data.relaxPoints) || 0) * CATEGORY_WEIGHTS.relax +
    (Number(data.knowledgePoints) || 0) * CATEGORY_WEIGHTS.knowledge +
    (Number(data.organizePoints) || 0) * CATEGORY_WEIGHTS.organize +
    (Number(data.creativePoints) || 0) * CATEGORY_WEIGHTS.creative;

  return Math.round(weightedSum / totalWeight);
}

export function normalizeRewardData(data = {}, uid = null) {
  const normalized = {
    user: uid || data.user || null,
    relaxItems: Array.isArray(data.relaxItems) ? data.relaxItems : [],
    relaxPoints: Number(data.relaxPoints) || 0,
    knowledgeItems: Array.isArray(data.knowledgeItems) ? data.knowledgeItems : [],
    knowledgePoints: Number(data.knowledgePoints) || 0,
    organizeItems: Array.isArray(data.organizeItems) ? data.organizeItems : [],
    organizePoints: Number(data.organizePoints) || 0,
    creativeItems: Array.isArray(data.creativeItems) ? data.creativeItems : [],
    creativePoints: Number(data.creativePoints) || 0
  };

  normalized.mindeasePoints = calculateMindEasePoints(normalized);
  normalized.mindeaseLevel = getOverallLevel(normalized.mindeasePoints).label;

  return normalized;
}

export function getRewardDocRef(db, uid) {
  return doc(db, REWARDS_COLLECTION, uid);
}

async function ensureRewardDoc(db, uid) {
  if (!uid) {
    return;
  }

  await setDoc(
    getRewardDocRef(db, uid),
    {
      user: uid
    },
    { merge: true }
  );
}

export async function loadRewardData(db, uid) {
  await ensureRewardDoc(db, uid);
  const ref = getRewardDocRef(db, uid);
  const snapshot = await getDoc(ref);
  return normalizeRewardData(snapshot.exists() ? snapshot.data() : {}, uid);
}

export async function awardReward(db, uid, type, itemId, points = REWARD_POINTS) {
  const config = CATEGORY_CONFIG[type];

  if (!config) {
    throw new Error(`Unsupported reward category: ${type}`);
  }

  const ref = getRewardDocRef(db, uid);
  await ensureRewardDoc(db, uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = normalizeRewardData(snapshot.exists() ? snapshot.data() : {}, uid);
    const currentItems = Array.isArray(current[config.itemsField]) ? [...current[config.itemsField]] : [];

    if (itemId && currentItems.includes(itemId)) {
      return {
        awarded: false,
        data: current
      };
    }

    const updated = {
      ...current,
      user: uid,
      [config.itemsField]: itemId ? [...currentItems, itemId] : currentItems,
      [config.pointsField]: (Number(current[config.pointsField]) || 0) + points
    };

    updated.mindeasePoints = calculateMindEasePoints(updated);
    updated.mindeaseLevel = getOverallLevel(updated.mindeasePoints).label;

    transaction.set(ref, updated, { merge: true });

    return {
      awarded: true,
      data: updated
    };
  });
}
