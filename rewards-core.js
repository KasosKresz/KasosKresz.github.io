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
    progressField: "relaxProgress",
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
    progressField: "knowledgeProgress",
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
    progressField: "organizeProgress",
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
    progressField: "creativeProgress",
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

function normalizeItemList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeProgressMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([itemId, points]) => [String(itemId || "").trim(), Math.max(0, Math.min(REWARD_POINTS, Number(points) || 0))])
      .filter(([itemId, points]) => itemId && points > 0)
  );
}

function buildProgressMap(items, storedProgress) {
  const progress = { ...storedProgress };
  items.forEach((itemId) => {
    progress[itemId] = Math.max(REWARD_POINTS, Number(progress[itemId]) || 0);
  });
  return progress;
}

function buildCompletedItems(items, progress) {
  const completed = new Set(items);

  Object.entries(progress).forEach(([itemId, points]) => {
    if ((Number(points) || 0) >= REWARD_POINTS) {
      completed.add(itemId);
    }
  });

  return [...completed];
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
    user: uid || data.user || null
  };

  Object.values(CATEGORY_CONFIG).forEach((config) => {
    const items = normalizeItemList(data[config.itemsField]);
    const progress = buildProgressMap(items, normalizeProgressMap(data[config.progressField]));
    normalized[config.itemsField] = buildCompletedItems(items, progress);
    normalized[config.progressField] = progress;
    normalized[config.pointsField] = Number(data[config.pointsField]) || 0;
  });

  normalized.mindeasePoints = calculateMindEasePoints(normalized);
  normalized.mindeaseLevel = getOverallLevel(normalized.mindeasePoints).label;

  return normalized;
}

export function getRewardDocRef(db, uid) {
  return doc(db, REWARDS_COLLECTION, uid);
}

export function getItemRewardProgress(data, type, itemId) {
  const config = CATEGORY_CONFIG[type];
  if (!config || !itemId) {
    return 0;
  }

  const progress = data?.[config.progressField];
  return Math.max(0, Math.min(REWARD_POINTS, Number(progress?.[itemId]) || 0));
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

export async function awardRewardProgress(db, uid, type, itemId, targetPoints, maxPoints = REWARD_POINTS) {
  const config = CATEGORY_CONFIG[type];

  if (!config) {
    throw new Error(`Unsupported reward category: ${type}`);
  }

  const ref = getRewardDocRef(db, uid);
  await ensureRewardDoc(db, uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = normalizeRewardData(snapshot.exists() ? snapshot.data() : {}, uid);
    const currentItems = normalizeItemList(current[config.itemsField]);
    const currentProgressMap = { ...(current[config.progressField] || {}) };
    const cappedMax = Math.max(1, Number(maxPoints) || REWARD_POINTS);
    const cappedTarget = Math.max(0, Math.min(cappedMax, Number(targetPoints) || 0));
    const currentProgress = itemId ? Math.max(0, Math.min(cappedMax, Number(currentProgressMap[itemId]) || 0)) : 0;
    const pointsAwarded = Math.max(0, cappedTarget - currentProgress);

    if (!pointsAwarded) {
      return {
        awarded: false,
        pointsAwarded: 0,
        completed: itemId ? currentProgress >= cappedMax : false,
        data: current
      };
    }

    const updated = {
      ...current,
      user: uid,
      [config.itemsField]: currentItems,
      [config.progressField]: currentProgressMap,
      [config.pointsField]: (Number(current[config.pointsField]) || 0) + pointsAwarded
    };

    if (itemId) {
      const nextProgress = currentProgress + pointsAwarded;
      updated[config.progressField] = {
        ...currentProgressMap,
        [itemId]: nextProgress
      };

      if (nextProgress >= cappedMax && !currentItems.includes(itemId)) {
        updated[config.itemsField] = [...currentItems, itemId];
      }
    }

    updated.mindeasePoints = calculateMindEasePoints(updated);
    updated.mindeaseLevel = getOverallLevel(updated.mindeasePoints).label;

    transaction.set(ref, updated, { merge: true });

    return {
      awarded: true,
      pointsAwarded,
      completed: itemId ? getItemRewardProgress(updated, type, itemId) >= cappedMax : false,
      data: updated
    };
  });
}

export async function awardReward(db, uid, type, itemId, points = REWARD_POINTS) {
  return awardRewardProgress(db, uid, type, itemId, points, points);
}
