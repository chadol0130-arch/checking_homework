import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import AvatarEngine from "./avatar/AvatarEngine.js";
import { resolveAvatarSources, setCharacterStyleClass } from "./avatar/avatarConfig.js";

const firebaseConfig = {
  apiKey: "AIzaSyChYb-nd-jhtkrCub8thxAU1xQHrQ2Zk-A",
  authDomain: "checking-homework-5647d.firebaseapp.com",
  projectId: "checking-homework-5647d",
  storageBucket: "checking-homework-5647d.firebasestorage.app",
  messagingSenderId: "220286491925",
  appId: "1:220286491925:web:1526b0a7b167e9e4ce1d1c",
  measurementId: "G-24VJYH8SEH",
  databaseURL: "https://checking-homework-5647d-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

const form = document.getElementById("upload-form");
const resultBox = document.getElementById("result");
const levelText = document.getElementById("level");
const experienceText = document.getElementById("experience");
const avatar = document.getElementById("avatar");
const avatarCanvas = document.getElementById("paperdoll-avatar");
const previewImage = document.getElementById("preview-image");
const previewPdf = document.getElementById("preview-pdf");
const previewLink = document.getElementById("preview-link");
const previewHint = document.getElementById("preview-hint");
const localPreviewImage = document.getElementById("local-preview-image");
const localPreviewPdf = document.getElementById("local-preview-pdf");
const localPreviewHint = document.getElementById("local-preview-hint");
const localFileMeta = document.getElementById("local-file-meta");
const fileInput = document.getElementById("photo");
let localObjectUrl = null;
const dayGoalList = document.getElementById("day-goal-list");
const daySubmissionList = document.getElementById("day-submission-list");
const dayDateText = document.getElementById("day-date");
const daySubtitleText = document.getElementById("day-subtitle");
const dayStatusText = document.getElementById("day-status");
const dayRateText = document.getElementById("day-rate");
const calendarLabel = document.getElementById("calendar-label");
const calendarViewButtons = document.querySelectorAll(".calendar-tab");
const calendarPanels = document.querySelectorAll(".calendar-panel");
const calendarNavButtons = document.querySelectorAll(".calendar-nav-button");
const calendarTodayButton = document.getElementById("calendar-today");
const weekPlanCount = document.getElementById("week-plan-count");
const weekAchievedCount = document.getElementById("week-achieved-count");
const weekAchievementRate = document.getElementById("week-achievement-rate");
const weekGrid = document.getElementById("week-grid");
const monthGrid = document.getElementById("month-grid");
const dayGoalInput = document.getElementById("day-goal-input");
const dayGoalAddBtn = document.getElementById("day-goal-add-btn");
const dayGoalWarning = document.getElementById("day-goal-warning");
const weekGoalInput = document.getElementById("week-goal-input");
const weekGoalAddBtn = document.getElementById("week-goal-add-btn");
const weekGoalWarning = document.getElementById("week-goal-warning");
const monthGoalInput = document.getElementById("month-goal-input");
const monthGoalAddBtn = document.getElementById("month-goal-add-btn");
const monthGoalWarning = document.getElementById("month-goal-warning");
const dailyGoalList = document.getElementById("goal-list-daily");
const weeklyGoalList = document.getElementById("goal-list-weekly");
const monthlyGoalList = document.getElementById("goal-list-monthly");
const achievementRateText = document.getElementById("achievement-rate");
const achievementCountText = document.getElementById("achievement-count");
const achievementBar = document.getElementById("achievement-bar");

let currentUserId = null;
let currentUserEmail = null;
let dataUnsubscribers = [];

let currentTotalXp = 0;
let currentLevel = 1;
let activeGoalPeriod = "daily";
let goalsCache = {
  daily: {},
  weekly: {},
  monthly: {},
};
let submissionsCache = [];
let submissionsByDay = {};
let activeCalendarView = "day";
let selectedDate = startOfDay(new Date());
let currentCharacterStyle = "classic";
let avatarEngine = null;
let lastAvatarXp = null;
let lastAvatarLevel = null;
let lastAvatarSourceKey = null;
let isAuthLocked = false;

const levelClassMap = [
  { threshold: 5, className: "level-5" },
  { threshold: 3, className: "level-3" },
  { threshold: 1, className: "level-1" },
];

initAvatarEngine();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUserId = null;
    currentUserEmail = null;
    detachDataListeners();
    resetDataState();
    setAuthLockedState(true);
    return;
  }

  currentUserId = user.uid;
  currentUserEmail = user.email ? user.email.toLowerCase() : null;
  lastAvatarSourceKey = null;
  setAuthLockedState(false);
  attachUserData(currentUserId);
});

function attachUserData(userId) {
  detachDataListeners();
  const sessionRef = ref(database, `sessions/${userId}`);
  const submissionsRef = ref(database, `submissions/${userId}`);
  const goalsRef = ref(database, `goals/${userId}`);

  const unsubSession = onValue(sessionRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      currentLevel = 1;
      currentTotalXp = 0;
      levelText.textContent = "-";
      experienceText.textContent = "-";
      updateAvatar(1);
      lastAvatarSourceKey = null;
      syncAvatarState(1, 0);
      updateAchievementUI(0, 0, 0);
      return;
    }
    currentLevel = data.level ?? 1;
    currentTotalXp = data.total_xp ?? 0;
    levelText.textContent = currentLevel ?? "-";
    experienceText.textContent = currentTotalXp ?? "-";
    updateAvatar(currentLevel ?? 1);
    syncAvatarState(currentLevel ?? 1, currentTotalXp ?? 0);
    if (typeof data.achievement_rate === "number") {
      updateAchievementUI(data.achievement_rate, data.achieved_goals ?? 0, data.total_goals ?? 0);
    }
  });

  const unsubSubmissions = onValue(submissionsRef, (snapshot) => {
    const data = snapshot.val() || {};
    submissionsCache = Object.entries(data).map(([id, entry]) => {
      const parsedDate = parseIsoDate(entry?.created_at);
      return {
        id,
        ...entry,
        _parsedDate: parsedDate,
      };
    });
    submissionsCache.sort(
      (a, b) => (b._parsedDate?.getTime() ?? 0) - (a._parsedDate?.getTime() ?? 0)
    );
    submissionsByDay = groupSubmissionsByDay(submissionsCache);
    renderCalendar();
  });

  const unsubGoals = onValue(goalsRef, (snapshot) => {
    const data = snapshot.val() || {};
    goalsCache = {
      daily: data.daily || {},
      weekly: data.weekly || {},
      monthly: data.monthly || {},
    };
    backfillGoalKeys(userId, goalsCache);
    renderGoalLists(goalsCache);
    const totals = calculateGoalTotals(goalsCache, new Date());
    updateAchievementUI(totals.rate, totals.achieved, totals.total);
    renderCalendar();
  });

  const profileRef = ref(database, `users/${userId}/profile`);
  const unsubProfile = onValue(profileRef, (snapshot) => {
    const data = snapshot.val() || {};
    currentCharacterStyle = data.character_style || "classic";
    updateAvatar(currentLevel ?? 1);
    applyAvatarCanvasStyle(currentCharacterStyle);
    lastAvatarSourceKey = null;
    syncAvatarState(currentLevel ?? 1, currentTotalXp ?? 0);
  });

  dataUnsubscribers = [unsubSession, unsubSubmissions, unsubGoals, unsubProfile];
}

function detachDataListeners() {
  dataUnsubscribers.forEach((unsub) => {
    if (typeof unsub === "function") {
      unsub();
    }
  });
  dataUnsubscribers = [];
}

function resetDataState() {
  currentTotalXp = 0;
  currentLevel = 1;
  goalsCache = { daily: {}, weekly: {}, monthly: {} };
  submissionsCache = [];
  submissionsByDay = {};
  currentCharacterStyle = "classic";
  lastAvatarSourceKey = null;
  levelText.textContent = "-";
  experienceText.textContent = "-";
  updateAvatar(1);
  applyAvatarCanvasStyle(currentCharacterStyle);
  syncAvatarState(1, 0);
  renderGoalLists(goalsCache);
  updateAchievementUI(0, 0, 0);
  renderCalendar();
  resetServerPreview();
}

function setAuthLockedState(isLocked) {
  isAuthLocked = isLocked;
  const submitButton = form?.querySelector("button[type=\"submit\"]");
  if (dayGoalInput) dayGoalInput.disabled = isLocked;
  if (dayGoalAddBtn) dayGoalAddBtn.disabled = isLocked;
  if (weekGoalInput) weekGoalInput.disabled = isLocked;
  if (weekGoalAddBtn) weekGoalAddBtn.disabled = isLocked;
  if (monthGoalInput) monthGoalInput.disabled = isLocked;
  if (monthGoalAddBtn) monthGoalAddBtn.disabled = isLocked;
  if (fileInput) fileInput.disabled = isLocked;
  if (submitButton) submitButton.disabled = isLocked;

  if (isLocked && resultBox) {
    resultBox.innerHTML = "<p class=\"hint\">로그인 후 숙제를 업로드할 수 있습니다.</p>";
  }
}

if (dayGoalAddBtn) {
  dayGoalAddBtn.addEventListener("click", () => addGoalForPeriod("daily"));
}
if (dayGoalInput) {
  dayGoalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      dayGoalAddBtn?.click();
    }
  });
}

if (weekGoalAddBtn) {
  weekGoalAddBtn.addEventListener("click", () => addGoalForPeriod("weekly"));
}
if (weekGoalInput) {
  weekGoalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      weekGoalAddBtn?.click();
    }
  });
}

if (monthGoalAddBtn) {
  monthGoalAddBtn.addEventListener("click", () => addGoalForPeriod("monthly"));
}
if (monthGoalInput) {
  monthGoalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      monthGoalAddBtn?.click();
    }
  });
}

setActiveGoalPeriod(activeGoalPeriod);

calendarViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setCalendarView(button.dataset.view || "day");
  });
});

calendarNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const shift = Number(button.dataset.shift || 0);
    shiftCalendar(shift);
  });
});

if (calendarTodayButton) {
  calendarTodayButton.addEventListener("click", () => {
    selectedDate = startOfDay(new Date());
    renderCalendar();
  });
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) {
      resetLocalPreview();
      return;
    }

    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl);
    }
    localObjectUrl = URL.createObjectURL(file);
    if (localFileMeta) {
      localFileMeta.textContent = `${file.name} 쨌 ${(file.size / 1024).toFixed(1)} KB`;
    }
    if (localPreviewHint) {
      localPreviewHint.style.display = "none";
    }

    if (file.type === "application/pdf") {
      if (localPreviewPdf) {
        localPreviewPdf.src = localObjectUrl;
        localPreviewPdf.style.display = "block";
      }
      if (localPreviewImage) {
        localPreviewImage.style.display = "none";
      }
    } else {
      if (localPreviewImage) {
        localPreviewImage.src = localObjectUrl;
        localPreviewImage.style.display = "block";
      }
      if (localPreviewPdf) {
        localPreviewPdf.style.display = "none";
      }
    }
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUserId) {
    resultBox.innerHTML = "<p class=\"error\">로그인 후 제출할 수 있습니다.</p>";
    return;
  }
  if (!fileInput.files.length) {
    return;
  }

  const formData = new FormData();
  formData.append("photo", fileInput.files[0]);

  resultBox.innerHTML = "<p>목표 달성 여부를 확인 중입니다...</p>";

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "업로드에 실패했습니다.");
    }

    const photoText = fileInput.files[0]?.name || "";
    const now = new Date();
    const ocrText = typeof payload.ocr_text === "string" ? payload.ocr_text.trim() : "";
    const ocrEngine =
      typeof payload.ocr_engine === "string" && payload.ocr_engine ? payload.ocr_engine : "none";
    const ocrSource =
      typeof payload.ocr_source === "string" && payload.ocr_source ? payload.ocr_source : "unknown";
    const matchSourceText = buildMatchSourceText({
      ocrText,
      fallbackText: photoText,
    });
    const matchResult = evaluateGoalsAgainstText(matchSourceText, goalsCache, now);
    const totalsBefore = calculateGoalTotals(goalsCache, now);
    const totalGoals = totalsBefore.total;
    const newlyAchievedCount = matchResult.newlyAchieved.length;
    const achievedAfter = totalGoals ? totalsBefore.achieved + newlyAchievedCount : totalsBefore.achieved;
    const achievementRate = totalGoals
      ? Math.round((achievedAfter / totalGoals) * 100)
      : 0;
    const gainedXp = totalGoals
      ? calculateGainedXp({ matchedCount: newlyAchievedCount, achievementRate })
      : 0;
    const totalXp = currentTotalXp + gainedXp;
    const level = Math.floor(totalXp / 100) + 1;

    const matchedGoalsLabel = matchResult.matchedGoals.length
      ? matchResult.matchedGoals.join(", ")
      : "없음";

    const scoreText = typeof payload.score === "number" ? `${payload.score}점` : "-";
    const feedbackText = payload.feedback || "피드백 없음";
    const goalSummaryText = totalGoals
      ? `<p><strong>달성률:</strong> ${achievementRate}% (${achievedAfter}/${totalGoals})</p>`
      : "<p><strong>목표 상태:</strong> 설정된 목표가 없어 XP 변동 없음</p>";
    const ocrSummaryText = ocrText
      ? `<p><strong>OCR 인식:</strong> ${ocrText.length}자 (${ocrEngine}/${ocrSource})</p>`
      : `<p><strong>OCR 상태:</strong> 인식 실패/비활성 (${ocrEngine}/${ocrSource})</p>`;
    resultBox.innerHTML = `
      <p><strong>채점 점수:</strong> ${scoreText}</p>
      <p><strong>피드백:</strong> ${feedbackText}</p>
      <p><strong>달성 목표:</strong> ${matchedGoalsLabel}</p>
      ${goalSummaryText}
      ${ocrSummaryText}
      <p><strong>획득 XP:</strong> ${gainedXp}</p>
    `;

    if (payload.file_url) {
      updateServerPreview(payload.file_url, payload.file_type);
    }

    if (totalGoals > 0) {
      const updates = {
        [`sessions/${currentUserId}`]: {
          level,
          total_xp: totalXp,
          achievement_rate: achievementRate,
          achieved_goals: achievedAfter,
          total_goals: totalGoals,
          updated_at: payload.submitted_at,
        },
      };
      for (const entry of matchResult.newlyAchieved) {
        updates[`goals/${currentUserId}/${entry.period}/${entry.id}/achieved`] = true;
        updates[`goals/${currentUserId}/${entry.period}/${entry.id}/achieved_at`] =
          payload.submitted_at;
      }
      await update(ref(database), updates);
    }

    const submissionRef = push(ref(database, `submissions/${currentUserId}`));
    await set(submissionRef, {
      gained_xp: gainedXp,
      achievement_rate: achievementRate,
      score: payload.score ?? null,
      feedback: payload.feedback ?? null,
      matched_goals: matchResult.matchedGoals,
      total_goals: totalGoals,
      achieved_goals: achievedAfter,
      file_url: payload.file_url,
      file_type: payload.file_type,
      created_at: payload.submitted_at,
    });
  } catch (error) {
    resultBox.innerHTML = `<p class="error">${error.message}</p>`;
  }
  });
}

function updateServerPreview(fileUrl, fileType) {
  previewHint.style.display = "none";
  previewLink.href = fileUrl;
  previewLink.style.display = "inline-flex";

  if (fileType === "pdf") {
    previewPdf.src = fileUrl;
    previewPdf.style.display = "block";
    previewImage.style.display = "none";
  } else {
    previewImage.src = fileUrl;
    previewImage.style.display = "block";
    previewPdf.style.display = "none";
  }
}

function resetServerPreview() {
  previewImage.src = "";
  previewPdf.src = "";
  previewImage.style.display = "none";
  previewPdf.style.display = "none";
  previewLink.removeAttribute("href");
  previewLink.style.display = "none";
  previewHint.style.display = "block";
}

function resetLocalPreview() {
  if (localObjectUrl) {
    URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = null;
  }
  localPreviewImage.src = "";
  localPreviewPdf.src = "";
  localPreviewImage.style.display = "none";
  localPreviewPdf.style.display = "none";
  localPreviewHint.style.display = "block";
  localFileMeta.textContent = "";
}

function updateAvatar(level) {
  if (!avatar) {
    return;
  }
  avatar.className = "avatar";
  if (currentCharacterStyle) {
    avatar.classList.add(`character-${currentCharacterStyle}`);
  }
  for (const entry of levelClassMap) {
    if (level >= entry.threshold) {
      avatar.classList.add(entry.className);
      break;
    }
  }
}

function applyAvatarCanvasStyle(style) {
  if (!avatarCanvas) {
    return;
  }
  setCharacterStyleClass(avatarCanvas, style);
}

function initAvatarEngine() {
  if (!avatarCanvas) {
    return;
  }
  avatarEngine = new AvatarEngine({
    canvasId: "paperdoll-avatar",
    frameW: 96,
    frameH: 96,
    scale: 2,
    autoScale: true,
  });
  avatarEngine
    .load({
      bodySrc: "/static/sprites/body_base.png",
      topSrc: "/static/sprites/top_basic.png",
      bottomSrc: "/static/sprites/bottom_basic.png",
    })
    .then(() => {
      syncAvatarState(currentLevel ?? 1, currentTotalXp ?? 0);
      applyAvatarCanvasStyle(currentCharacterStyle);
    })
    .catch((error) => {
      console.error("아바타 로딩 실패:", error);
    });
}

function syncAvatarState(level, totalXp) {
  if (!avatarEngine) {
    return;
  }
  const parsedLevel = Number(level);
  const parsedXp = Number(totalXp);
  const safeLevel = Number.isFinite(parsedLevel) ? parsedLevel : 1;
  const safeXp = Number.isFinite(parsedXp) ? parsedXp : 0;
  const prevXp = lastAvatarXp;
  const prevLevel = lastAvatarLevel;

  const customSources = resolveAvatarSources({
    userEmail: currentUserEmail,
    level: safeLevel,
    style: currentCharacterStyle,
  });
  if (customSources) {
    const sourceKey = `${customSources.bodySrc || ""}`;
    if (sourceKey && sourceKey !== lastAvatarSourceKey) {
      lastAvatarSourceKey = sourceKey;
      avatarEngine
        .setOutfit({
          bodySrc: customSources.bodySrc,
          topSrc: null,
          bottomSrc: null,
          frameW: customSources.frameW,
          frameH: customSources.frameH,
          frameCount: customSources.frameCount,
        })
        .catch((error) => {
          console.error("아바타 로딩 실패:", error);
        });
    }
  } else {
    if (lastAvatarSourceKey) {
      avatarEngine
        .setOutfit({ bodySrc: "/static/sprites/body_base.png" })
        .catch((error) => {
          console.error("아바타 로딩 실패:", error);
        });
    }
    lastAvatarSourceKey = null;
    avatarEngine.setLevel(safeLevel);
  }
  avatarEngine.setXp(safeXp);

  if (prevXp !== null && safeXp > prevXp) {
    avatarEngine.playCheer();
  } else if (prevLevel !== null && safeLevel > prevLevel) {
    avatarEngine.playCheer();
  }

  lastAvatarXp = safeXp;
  lastAvatarLevel = safeLevel;
}

function setActiveGoalPeriod(period) {
  const allowed = ["daily", "weekly", "monthly"];
  activeGoalPeriod = allowed.includes(period) ? period : "daily";
}

function showGoalWarning(target, message) {
  if (!target) {
    return;
  }
  if (message) {
    target.textContent = message;
    target.style.display = "block";
  } else {
    target.textContent = "";
    target.style.display = "none";
  }
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function createGoalUpload(goal) {
  const wrapper = document.createElement("label");
  wrapper.className = "goal-upload";
  if (goal.submission_url) {
    wrapper.classList.add("has-image");
    wrapper.style.backgroundImage = `url(${goal.submission_url})`;
  }
  if (goal.achieved) {
    wrapper.classList.add("achieved");
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,application/pdf";
  input.disabled = isAuthLocked;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    handleGoalUpload(goal, file, wrapper);
    input.value = "";
  });

  const checkmark = document.createElement("span");
  checkmark.className = "checkmark";
  checkmark.textContent = "V";

  wrapper.append(input, checkmark);
  return wrapper;
}

function getGoalControls(period) {
  if (period === "weekly") {
    return { input: weekGoalInput, button: weekGoalAddBtn, warning: weekGoalWarning };
  }
  if (period === "monthly") {
    return { input: monthGoalInput, button: monthGoalAddBtn, warning: monthGoalWarning };
  }
  return { input: dayGoalInput, button: dayGoalAddBtn, warning: dayGoalWarning };
}

function getPeriodGoalCount(period, referenceDate) {
  const refDayKey = toDayKey(referenceDate);
  const refWeekKey = getWeekKey(referenceDate);
  const refMonthKey = getMonthKey(referenceDate);
  let count = 0;
  for (const goal of Object.values(goalsCache[period] || {})) {
    const { dayKey, weekKey, monthKey } = getGoalDateKeys(goal);
    if (period === "daily" && dayKey === refDayKey) {
      count += 1;
    } else if (period === "weekly" && weekKey === refWeekKey) {
      count += 1;
    } else if (period === "monthly" && monthKey === refMonthKey) {
      count += 1;
    }
  }
  return count;
}

function updateGoalInputState() {
  const referenceDate = selectedDate || new Date();
  const dailyControls = getGoalControls("daily");
  const weeklyControls = getGoalControls("weekly");
  const monthlyControls = getGoalControls("monthly");

  if (dailyControls.input) {
    dailyControls.input.disabled = isAuthLocked;
  }
  if (dailyControls.button) {
    dailyControls.button.disabled = isAuthLocked;
  }
  showGoalWarning(dailyControls.warning, "");

  const weeklyCount = getPeriodGoalCount("weekly", referenceDate);
  const weeklyLocked = isAuthLocked || weeklyCount >= 1;
  if (weeklyControls.input) {
    weeklyControls.input.disabled = weeklyLocked;
  }
  if (weeklyControls.button) {
    weeklyControls.button.disabled = weeklyLocked;
  }
  showGoalWarning(
    weeklyControls.warning,
    weeklyLocked && !isAuthLocked ? "주 목표는 1개만 설정할 수 있습니다." : ""
  );

  const monthlyCount = getPeriodGoalCount("monthly", referenceDate);
  const monthlyLocked = isAuthLocked || monthlyCount >= 1;
  if (monthlyControls.input) {
    monthlyControls.input.disabled = monthlyLocked;
  }
  if (monthlyControls.button) {
    monthlyControls.button.disabled = monthlyLocked;
  }
  showGoalWarning(
    monthlyControls.warning,
    monthlyLocked && !isAuthLocked ? "월 목표는 1개만 설정할 수 있습니다." : ""
  );
}

async function addGoalForPeriod(period) {
  const controls = getGoalControls(period);
  if (!currentUserId) {
    showGoalWarning(controls.warning, "로그인 후 목표를 설정할 수 있습니다.");
    return;
  }
  const text = controls.input?.value?.trim();
  if (!text) {
    showGoalWarning(controls.warning, "목표 내용을 입력해 주세요.");
    return;
  }

  const referenceDate = selectedDate || new Date();
  const limitReached =
    (period === "weekly" || period === "monthly") &&
    getPeriodGoalCount(period, referenceDate) >= 1;
  if (limitReached) {
    showGoalWarning(
      controls.warning,
      period === "weekly" ? "주 목표는 1개만 설정할 수 있습니다." : "월 목표는 1개만 설정할 수 있습니다."
    );
    updateGoalInputState();
    return;
  }

  try {
    const dayKey = toDayKey(referenceDate);
    const weekKey = getWeekKey(referenceDate);
    const monthKey = getMonthKey(referenceDate);
    const goalRef = push(ref(database, `goals/${currentUserId}/${period}`));
    await set(goalRef, {
      text,
      achieved: false,
      created_at: new Date().toISOString(),
      date_key: dayKey,
      week_key: weekKey,
      month_key: monthKey,
    });
    if (controls.input) {
      controls.input.value = "";
    }
    showGoalWarning(controls.warning, "");
    updateGoalInputState();
  } catch (error) {
    console.error("목표 저장 오류:", error);
    showGoalWarning(controls.warning, "목표 저장에 실패했습니다.");
  }
}

async function handleGoalUpload(goal, file, wrapper) {
  if (!currentUserId || !goal?.id || !goal?.period) {
    showGoalWarning(dayGoalWarning, "로그인 후 제출할 수 있습니다.");
    return;
  }
  const controls = getGoalControls(goal.period);
  try {
    wrapper?.classList.add("is-uploading");
    const formData = new FormData();
    formData.append("photo", file);
    formData.append("goal_text", goal.text || "");

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "업로드에 실패했습니다.");
    }

    const submittedAt = payload.submitted_at || new Date().toISOString();
    const feedback = payload.feedback || `${goal.text || "목표"} 완료!`;
    const fileUrl = payload.file_url || "";
    const fileType = payload.file_type || "image";
    const alreadyAchieved = Boolean(goal.achieved);

    await update(ref(database), {
      [`goals/${currentUserId}/${goal.period}/${goal.id}/achieved`]: true,
      [`goals/${currentUserId}/${goal.period}/${goal.id}/achieved_at`]: submittedAt,
      [`goals/${currentUserId}/${goal.period}/${goal.id}/submission_url`]: fileUrl,
      [`goals/${currentUserId}/${goal.period}/${goal.id}/submission_type`]: fileType,
      [`goals/${currentUserId}/${goal.period}/${goal.id}/submission_feedback`]: feedback,
      [`goals/${currentUserId}/${goal.period}/${goal.id}/submission_at`]: submittedAt,
    });

    const referenceDate = selectedDate || new Date();
    const totalsBefore = calculateGoalTotals(goalsCache, referenceDate);
    const totalGoals = totalsBefore.total;
    const achievedBefore = Math.min(totalsBefore.achieved, totalGoals);
    const achievedAfter = alreadyAchieved
      ? achievedBefore
      : Math.min(totalGoals, achievedBefore + 1);
    const achievementRate = totalGoals
      ? Math.round((achievedAfter / totalGoals) * 100)
      : 0;
    const safeRate = clampNumber(achievementRate, 0, 100);
    const gainedXp = alreadyAchieved ? 0 : GOAL_UPLOAD_XP;
    const totalXp = currentTotalXp + gainedXp;
    const level = Math.floor(totalXp / 100) + 1;

    const submissionRef = push(ref(database, `submissions/${currentUserId}`));
    await set(submissionRef, {
      gained_xp: gainedXp,
      achievement_rate: safeRate,
      score: null,
      feedback,
      matched_goals: goal.text ? [goal.text] : [],
      total_goals: totalGoals,
      achieved_goals: achievedAfter,
      file_url: fileUrl,
      file_type: fileType,
      goal_id: goal.id,
      goal_period: goal.period,
      created_at: submittedAt,
    });

    if (!alreadyAchieved) {
      await update(ref(database), {
        [`sessions/${currentUserId}`]: {
          level,
          total_xp: totalXp,
          achievement_rate: safeRate,
          achieved_goals: achievedAfter,
          total_goals: totalGoals,
          updated_at: submittedAt,
        },
      });
    }

    if (wrapper) {
      if (fileUrl) {
        wrapper.style.backgroundImage = `url(${fileUrl})`;
        wrapper.classList.add("has-image");
      }
      wrapper.classList.add("achieved");
    }

    showGoalWarning(controls.warning, "");
    updateGoalInputState();
  } catch (error) {
    console.error("제출 업로드 오류:", error);
    showGoalWarning(
      controls.warning,
      error?.message ? String(error.message) : "업로드에 실패했습니다."
    );
  } finally {
    wrapper?.classList.remove("is-uploading");
  }
}

function renderGoalLists(goalsData) {
  renderGoalList(dailyGoalList, goalsData.daily, "일");
  renderGoalList(weeklyGoalList, goalsData.weekly, "주");
  renderGoalList(monthlyGoalList, goalsData.monthly, "월");
}

function renderGoalList(listElement, goals, label) {
  if (!listElement) {
    return;
  }
  const entries = Object.entries(goals || {}).sort((a, b) =>
    (a[1].created_at || "").localeCompare(b[1].created_at || "")
  );
  listElement.innerHTML = "";
  if (!entries.length) {
    listElement.innerHTML = `<li class="meta">등록된 ${label} 목표가 없습니다.</li>`;
    return;
  }
  for (const [, goal] of entries) {
    const item = document.createElement("li");
    item.className = `goal-item ${goal.achieved ? "achieved" : ""}`;
    item.innerHTML = `
      <span>${goal.text}</span>
      <span class="goal-status">${goal.achieved ? "달성" : "진행 중"}</span>
    `;
    listElement.appendChild(item);
  }
}

function calculateGoalTotals(goalsData, referenceDate = null) {
  let total = 0;
  let achieved = 0;
  const refDayKey = referenceDate ? toDayKey(referenceDate) : null;
  const refWeekKey = referenceDate ? getWeekKey(referenceDate) : null;
  const refMonthKey = referenceDate ? getMonthKey(referenceDate) : null;
  for (const period of ["daily", "weekly", "monthly"]) {
    for (const goal of Object.values(goalsData[period] || {})) {
      if (referenceDate) {
        const { dayKey, weekKey, monthKey } = getGoalDateKeys(goal);
        if (period === "daily" && dayKey !== refDayKey) {
          continue;
        }
        if (period === "weekly" && weekKey !== refWeekKey) {
          continue;
        }
        if (period === "monthly" && monthKey !== refMonthKey) {
          continue;
        }
      }
      total += 1;
      if (goal.achieved) {
        achieved += 1;
      }
    }
  }
  const safeAchieved = Math.min(achieved, total);
  const rate = total ? Math.round((safeAchieved / total) * 100) : 0;
  return { total, achieved: safeAchieved, rate: clampNumber(rate, 0, 100) };
}

function updateAchievementUI(rate, achieved, total) {
  if (achievementRateText) {
    achievementRateText.textContent = `${rate}%`;
  }
  if (achievementCountText) {
    achievementCountText.textContent = `${achieved}/${total}`;
  }
  if (achievementBar) {
    achievementBar.style.width = `${rate}%`;
  }
}

const fullDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});
const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
const successRateThreshold = 70;
const XP_PER_MATCH = 50;
const XP_RATE_BONUS = 1;
const GOAL_UPLOAD_XP = 50;

function setCalendarView(view) {
  const allowed = ["day", "week", "month"];
  activeCalendarView = allowed.includes(view) ? view : "day";
  setActiveGoalPeriod(
    activeCalendarView === "week" ? "weekly" : activeCalendarView === "month" ? "monthly" : "daily"
  );
  calendarViewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeCalendarView);
  });
  calendarPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.view === activeCalendarView);
  });
  renderCalendar();
}

function shiftCalendar(step) {
  if (!step) {
    return;
  }
  const next = new Date(selectedDate);
  if (activeCalendarView === "day") {
    next.setDate(next.getDate() + step);
  } else if (activeCalendarView === "week") {
    next.setDate(next.getDate() + step * 7);
  } else {
    next.setMonth(next.getMonth() + step);
  }
  selectedDate = startOfDay(next);
  renderCalendar();
}

function renderCalendar() {
  updateCalendarLabel();
  renderDayView();
  renderWeekView();
  renderMonthView();
  updateGoalInputState();
}

function updateCalendarLabel() {
  if (!calendarLabel) {
    return;
  }
  if (activeCalendarView === "day") {
    calendarLabel.textContent = fullDateFormatter.format(selectedDate);
  } else if (activeCalendarView === "week") {
    const start = startOfWeek(selectedDate);
    const end = addDays(start, 6);
    calendarLabel.textContent = `${shortDateFormatter.format(start)} ~ ${shortDateFormatter.format(end)}`;
  } else {
    calendarLabel.textContent = monthFormatter.format(selectedDate);
  }
}

function renderDayView() {
  if (!dayDateText || !daySubmissionList || !dayGoalList) {
    return;
  }
  const dayKey = toDayKey(selectedDate);
  const dayStats = getDayStats(dayKey);
  const submissionCount = dayStats.count;
  const rate = dayStats.rate;

  dayDateText.textContent = fullDateFormatter.format(selectedDate);
  if (daySubtitleText) {
    daySubtitleText.textContent = `제출 ${submissionCount}건 · 목표 달성률 ${rate}%`;
  }

  let statusText = "제출 없음";
  let statusClass = "neutral";
  if (submissionCount > 0) {
    if (rate >= successRateThreshold) {
      statusText = "잘 수행";
      statusClass = "success";
    } else {
      statusText = "아직 미달성";
      statusClass = "danger";
    }
  }
  if (dayStatusText) {
    dayStatusText.textContent = statusText;
    dayStatusText.className = `status-pill ${statusClass}`;
  }
  if (dayRateText) {
    dayRateText.textContent = `달성률 ${rate}%`;
  }

  renderDayGoals(goalsCache);
  renderDaySubmissions(dayStats.entries);

  const previewEntry = dayStats.entries.find((entry) => entry.file_url);
  if (previewEntry?.file_url) {
    updateServerPreview(previewEntry.file_url, previewEntry.file_type);
  } else {
    resetServerPreview();
  }
}

function renderDayGoals(goalsData) {
  if (!dayGoalList) {
    return;
  }
  dayGoalList.innerHTML = "";
  const selectedDayKey = toDayKey(selectedDate);
  const selectedWeekKey = getWeekKey(selectedDate);
  const selectedMonthKey = getMonthKey(selectedDate);
  const periodLabels = {
    daily: "일",
    weekly: "주",
    monthly: "월",
  };
  const entries = [];
  for (const period of ["daily", "weekly", "monthly"]) {
    for (const [id, goal] of Object.entries(goalsData[period] || {})) {
      const { dayKey, weekKey, monthKey } = getGoalDateKeys(goal);

      if (period === "daily" && dayKey !== selectedDayKey) {
        continue;
      }
      if (period === "weekly" && weekKey !== selectedWeekKey) {
        continue;
      }
      if (period === "monthly" && monthKey !== selectedMonthKey) {
        continue;
      }

      entries.push({ id, ...goal, period });
    }
  }

  entries.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  if (!entries.length) {
    dayGoalList.innerHTML = "<li class=\"meta\">등록된 계획이 없습니다.</li>";
    return;
  }

  for (const goal of entries) {
    const item = document.createElement("li");
    item.className = `plan-item ${goal.achieved ? "achieved" : "pending"}`;

    const header = document.createElement("div");
    header.className = "plan-item-header";

    const period = document.createElement("span");
    period.className = "plan-period";
    period.textContent = periodLabels[goal.period] || "계획";

    const status = document.createElement("span");
    status.className = `status-pill ${goal.achieved ? "success" : "danger"}`;
    status.textContent = goal.achieved ? "달성" : "미달성";

    const text = document.createElement("p");
    text.className = "plan-text";
    text.textContent = goal.text || "";

    const body = document.createElement("div");
    body.className = "plan-item-body";
    body.append(text, createGoalUpload(goal));

    header.append(period, status);
    item.append(header, body);
    dayGoalList.appendChild(item);
  }
}

function renderDaySubmissions(entries) {
  if (!daySubmissionList) {
    return;
  }
  daySubmissionList.innerHTML = "";
  if (!entries.length) {
    daySubmissionList.innerHTML = "<li class=\"meta\">해당 날짜에 제출이 없습니다.</li>";
    return;
  }

  for (const entry of entries) {
    const rate = Number(entry.achievement_rate) || 0;
    const statusClass = rate >= successRateThreshold ? "success" : "danger";
    const matchedGoals = Array.isArray(entry.matched_goals) ? entry.matched_goals : [];
    const createdDate = entry._parsedDate || parseIsoDate(entry.created_at);

    const item = document.createElement("li");
    item.className = `submission-item ${statusClass}`;
    if (entry.file_url) {
      item.classList.add("has-preview");
      item.addEventListener("click", () => {
        updateServerPreview(entry.file_url, entry.file_type);
      });
    }

    const head = document.createElement("div");
    head.className = "submission-head";

    const timeText = document.createElement("span");
    timeText.textContent = createdDate ? timeFormatter.format(createdDate) : "시간 없음";

    const rateText = document.createElement("span");
    rateText.className = "submission-rate";
    rateText.textContent = `달성률 ${rate}%`;

    head.append(timeText, rateText);

    const meta = document.createElement("div");
    meta.className = "submission-meta";

    const xpText = document.createElement("span");
    xpText.textContent = `+${entry.gained_xp ?? 0} XP`;

    const goalProgress = document.createElement("span");
    if (entry.total_goals) {
      goalProgress.textContent = `목표 ${entry.achieved_goals ?? 0}/${entry.total_goals}`;
    } else {
      goalProgress.textContent = "목표 -";
    }

    const messageText = document.createElement("span");
    messageText.textContent = entry.feedback ? "응원 메시지" : "응원 없음";

    meta.append(xpText, goalProgress, messageText);

    const feedback = document.createElement("p");
    feedback.className = "submission-feedback";
    feedback.textContent = entry.feedback || "피드백 없음";

    const tags = document.createElement("div");
    tags.className = "submission-tags";
    if (matchedGoals.length) {
      matchedGoals.forEach((goalText) => {
        tags.appendChild(createTag(goalText, "match"));
      });
    } else {
      tags.appendChild(createTag("매칭 없음", "miss"));
    }

    item.append(head, meta, feedback, tags);
    daySubmissionList.appendChild(item);
  }
}

function renderWeekView() {
  if (!weekGrid || !weekPlanCount || !weekAchievedCount || !weekAchievementRate) {
    return;
  }
  const weekDays = getWeekDays(selectedDate);
  const weekDayKeys = new Set(weekDays.map((day) => toDayKey(day)));
  const selectedWeekKey = getWeekKey(selectedDate);
  const selectedMonthKey = getMonthKey(selectedDate);
  const weekGoals = [];
  for (const period of ["daily", "weekly", "monthly"]) {
    for (const goal of Object.values(goalsCache[period] || {})) {
      const { dayKey, weekKey, monthKey } = getGoalDateKeys(goal);
      if (period === "daily" && dayKey && weekDayKeys.has(dayKey)) {
        weekGoals.push(goal);
      } else if (period === "weekly" && weekKey === selectedWeekKey) {
        weekGoals.push(goal);
      } else if (period === "monthly" && monthKey === selectedMonthKey) {
        weekGoals.push(goal);
      }
    }
  }

  const total = weekGoals.length;
  const achieved = weekGoals.filter((goal) => goal.achieved).length;
  const rate = total ? Math.round((achieved / total) * 100) : 0;

  weekPlanCount.textContent = total;
  weekAchievedCount.textContent = achieved;
  weekAchievementRate.textContent = `${rate}%`;

  weekGrid.innerHTML = "";
  for (const day of weekDays) {
    const key = toDayKey(day);
    const stats = getDayStats(key);
    const dayRate = stats.rate;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `week-day ${rateToClass(dayRate)}${
      key === toDayKey(selectedDate) ? " selected" : ""
    }`;
    button.addEventListener("click", () => {
      selectedDate = startOfDay(day);
      setCalendarView("day");
    });

    const name = document.createElement("span");
    name.className = "week-day-name";
    name.textContent = weekdayFormatter.format(day);

    const date = document.createElement("span");
    date.className = "week-day-date";
    date.textContent = String(day.getDate());

    const rateText = document.createElement("span");
    rateText.className = "week-day-rate";
    rateText.textContent = `${dayRate}%`;

    button.append(name, date, rateText);
    weekGrid.appendChild(button);
  }
}

function renderMonthView() {
  if (!monthGrid) {
    return;
  }
  monthGrid.innerHTML = "";

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const gridStart = startOfWeek(monthStart);
  const todayKey = toDayKey(new Date());

  for (let i = 0; i < 42; i += 1) {
    const day = addDays(gridStart, i);
    const key = toDayKey(day);
    const stats = getDayStats(key);
    const dayRate = stats.rate;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `month-cell ${rateToClass(dayRate)}${
      day.getMonth() !== month ? " outside" : ""
    }${key === toDayKey(selectedDate) ? " selected" : ""}${key === todayKey ? " today" : ""}`;
    cell.title = stats.count
      ? `제출 ${stats.count}건 · 달성률 ${dayRate}%`
      : "제출 없음";
    cell.addEventListener("click", () => {
      selectedDate = startOfDay(day);
      setCalendarView("day");
    });

    const dateText = document.createElement("span");
    dateText.className = "month-date";
    dateText.textContent = String(day.getDate());

    const rateText = document.createElement("span");
    rateText.className = "month-rate";
    rateText.textContent = `${dayRate}%`;

    cell.append(dateText, rateText);
    monthGrid.appendChild(cell);
  }
}

function rateToClass(rate) {
  if (rate >= 80) {
    return "rate-high";
  }
  if (rate >= 50) {
    return "rate-mid";
  }
  if (rate >= 1) {
    return "rate-low";
  }
  return "rate-zero";
}

function createTag(text, type) {
  const tag = document.createElement("span");
  tag.className = `tag-pill ${type}`;
  tag.textContent = text;
  return tag;
}

function getDayStats(dayKey) {
  const entries = submissionsByDay[dayKey] || [];
  const referenceDate = parseDayKey(dayKey);
  const totals = referenceDate
    ? calculateGoalTotals(goalsCache, referenceDate)
    : { total: 0, achieved: 0, rate: 0 };
  const rate = totals.rate ?? 0;
  return { entries, count: entries.length, rate, totals };
}

function groupSubmissionsByDay(submissions) {
  const grouped = {};
  for (const entry of submissions) {
    const parsedDate = entry._parsedDate || parseIsoDate(entry.created_at);
    if (!parsedDate) {
      continue;
    }
    const key = toDayKey(parsedDate);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({ ...entry, _parsedDate: parsedDate });
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) => (b._parsedDate?.getTime() ?? 0) - (a._parsedDate?.getTime() ?? 0)
    );
  }
  return grouped;
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseDayKey(dayKey) {
  if (!dayKey || typeof dayKey !== "string") {
    return null;
  }
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getGoalDateKeys(goal) {
  const createdDate = parseIsoDate(goal?.created_at);
  return {
    dayKey: goal?.date_key || (createdDate ? toDayKey(createdDate) : null),
    weekKey: goal?.week_key || (createdDate ? getWeekKey(createdDate) : null),
    monthKey: goal?.month_key || (createdDate ? getMonthKey(createdDate) : null),
  };
}

function getWeekKey(date) {
  const start = startOfWeek(date);
  return toDayKey(start);
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const dayIndex = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - dayIndex);
  return copy;
}

function isDateInRange(date, start, end) {
  const day = startOfDay(date);
  return day >= start && day <= end;
}

function getWeekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function deriveKeywordHints(text) {
  if (!text) {
    return [];
  }
  const hints = new Set();
  const lowered = text.toLowerCase();
  const codeTokens = [
    "def ",
    "class ",
    "import ",
    "from ",
    "print(",
    "console.log",
    "function",
    "const ",
    "let ",
    "var ",
    "#include",
    "int main",
    "public static",
    "system.out",
    "return ",
  ];
  const hasCodeTokens = codeTokens.some((token) => lowered.includes(token));
  const symbolCount = (text.match(/[{}()[\];=<>:+\-*/]/g) || []).length;
  const hasCodeSymbols = symbolCount >= 8;

  if (hasCodeTokens || hasCodeSymbols) {
    hints.add("코딩");
    hints.add("코드");
    hints.add("프로그래밍");
    hints.add("과제");
    hints.add("coding");
    hints.add("programming");
    hints.add("code");
  }

  const mathKeywords = [
    "math",
    "mathematics",
    "algebra",
    "geometry",
    "calculus",
    "trigonometry",
    "equation",
    "function",
    "integral",
    "derivative",
    "matrix",
    "probability",
    "statistics",
  ];
  const calculusTokens = [
    "미적분",
    "미분",
    "적분",
    "d/dx",
    "dy/dx",
    "dx",
    "dy",
    "∫",
    "sqrt",
  ];
  const mathSymbols = /[±×÷√π∑∫∞]/;
  const hasCalculusTokens =
    calculusTokens.some((token) => lowered.includes(token) || text.includes(token)) ||
    /d\s*\/\s*dx/.test(lowered) ||
    /dy\s*\/\s*dx/.test(lowered);
  if (
    mathKeywords.some((keyword) => lowered.includes(keyword)) ||
    mathSymbols.test(text) ||
    hasCalculusTokens
  ) {
    hints.add("수학");
    hints.add("math");
    hints.add("mathematics");
    if (hasCalculusTokens || lowered.includes("calculus")) {
      hints.add("미적분");
      hints.add("미분");
      hints.add("적분");
      hints.add("calculus");
      hints.add("derivative");
      hints.add("integral");
    }
  }

  const englishKeywords = [
    "coding",
    "programming",
    "program",
    "code",
    "developer",
    "develop",
    "algorithm",
    "data structure",
    "datastructure",
    "python",
    "java",
    "javascript",
    "js",
    "typescript",
    "c++",
    "c#",
    "html",
    "css",
    "react",
    "node",
    "backend",
    "frontend",
  ];
  if (englishKeywords.some((keyword) => lowered.includes(keyword))) {
    hints.add("코딩");
    hints.add("코드");
    hints.add("프로그래밍");
    hints.add("과제");
  }

  if (lowered.includes("html") || lowered.includes("<div") || lowered.includes("<script")) {
    hints.add("웹");
    hints.add("프론트엔드");
  }
  if (lowered.includes("select") || lowered.includes("insert") || lowered.includes("update")) {
    hints.add("데이터베이스");
  }

  return Array.from(hints);
}

function buildMatchSourceText({ ocrText, fallbackText }) {
  const hints = deriveKeywordHints(ocrText || "");
  return [ocrText, fallbackText, ...hints].filter(Boolean).join(" ");
}

function expandGoalKeywords(goalText) {
  const variants = new Set();
  const normalizedGoal = normalizeText(goalText);
  if (normalizedGoal) {
    variants.add(normalizedGoal);
  }

  const raw = String(goalText || "");
  const lower = raw.toLowerCase();
  const hasKoreanCoding = /코딩|코드|프로그래밍/.test(raw);
  const hasEnglishCoding = /coding|programming|code/.test(lower);
  const hasAlgorithm = /알고리즘|algorithm/.test(raw) || /algorithm/.test(lower);
  const hasDataStructure = /자료구조|data\s*structure|datastructure/.test(raw) || /data\s*structure/.test(lower);

  if (hasKoreanCoding || hasEnglishCoding) {
    ["코딩", "코드", "프로그래밍", "과제", "coding", "programming", "code"].forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized) {
        variants.add(normalized);
      }
    });
  }

  if (hasAlgorithm) {
    ["알고리즘", "algorithm"].forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized) {
        variants.add(normalized);
      }
    });
  }

  if (hasDataStructure) {
    ["자료구조", "datastructure", "data structure"].forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized) {
        variants.add(normalized);
      }
    });
  }

  const hasMath =
    /수학|계산|공식|방정식|함수/.test(raw) ||
    /math|mathematics|algebra|geometry|calculus|trigonometry|equation|function|integral|derivative|matrix|probability|statistics/.test(
      lower
    );
  const hasCalculus =
    /미적분|미분|적분/.test(raw) ||
    /calculus|integral|derivative/.test(lower) ||
    /d\s*\/\s*dx|dy\s*\/\s*dx/.test(lower);
  if (hasMath) {
    [
      "수학",
      "math",
      "mathematics",
      "algebra",
      "geometry",
      "calculus",
      "trigonometry",
      "equation",
      "function",
      "integral",
      "derivative",
      "matrix",
      "probability",
      "statistics",
    ].forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized) {
        variants.add(normalized);
      }
    });
  }
  if (hasCalculus) {
    [
      "미적분",
      "미분",
      "적분",
      "calculus",
      "derivative",
      "integral",
      "dx",
      "dy",
      "d/dx",
      "dy/dx",
    ].forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized) {
        variants.add(normalized);
      }
    });
  }

  return Array.from(variants);
}

function evaluateGoalsAgainstText(photoText, goalsData, referenceDate = new Date()) {
  const normalizedPhoto = normalizeText(photoText);
  const matchedGoals = [];
  const newlyAchieved = [];
  if (!normalizedPhoto) {
    return { matchedGoals, newlyAchieved };
  }
  const refDayKey = toDayKey(referenceDate);
  const refWeekKey = getWeekKey(referenceDate);
  const refMonthKey = getMonthKey(referenceDate);
  for (const period of ["daily", "weekly", "monthly"]) {
    for (const [id, goal] of Object.entries(goalsData[period] || {})) {
      if (!goal?.text) {
        continue;
      }
      const { dayKey, weekKey, monthKey } = getGoalDateKeys(goal);
      if (period === "daily" && dayKey !== refDayKey) {
        continue;
      }
      if (period === "weekly" && weekKey !== refWeekKey) {
        continue;
      }
      if (period === "monthly" && monthKey !== refMonthKey) {
        continue;
      }
      const goalVariants = expandGoalKeywords(goal.text);
      if (!goalVariants.length) {
        continue;
      }
      const isMatched = goalVariants.some((variant) => normalizedPhoto.includes(variant));
      if (isMatched) {
        matchedGoals.push(goal.text);
        if (!goal.achieved) {
          newlyAchieved.push({ id, period, text: goal.text });
        }
      }
    }
  }
  return { matchedGoals, newlyAchieved };
}

setCalendarView(activeCalendarView);

function backfillGoalKeys(userId, goalsData) {
  if (!userId || !goalsData) {
    return;
  }
  const updates = {};
  for (const period of ["daily", "weekly", "monthly"]) {
    for (const [id, goal] of Object.entries(goalsData[period] || {})) {
      const createdDate = parseIsoDate(goal.created_at) || new Date();
      const dayKey = goal.date_key || toDayKey(createdDate);
      const weekKey = goal.week_key || getWeekKey(createdDate);
      const monthKey = goal.month_key || getMonthKey(createdDate);

      if (!goal.date_key) {
        updates[`goals/${userId}/${period}/${id}/date_key`] = dayKey;
      }
      if (!goal.week_key) {
        updates[`goals/${userId}/${period}/${id}/week_key`] = weekKey;
      }
      if (!goal.month_key) {
        updates[`goals/${userId}/${period}/${id}/month_key`] = monthKey;
      }
    }
  }
  if (Object.keys(updates).length) {
    update(ref(database), updates).catch((error) => {
      console.error("목표 키 백필 실패:", error);
    });
  }
}

function calculateGainedXp({ matchedCount, achievementRate }) {
  if (!matchedCount) {
    return 0;
  }
  const rateBonus = Math.round(achievementRate * XP_RATE_BONUS);
  return matchedCount * XP_PER_MATCH + rateBonus;
}


