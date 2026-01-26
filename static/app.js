import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  set,
  query,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const database = getDatabase(app);

const form = document.getElementById("upload-form");
const resultBox = document.getElementById("result");
const levelText = document.getElementById("level");
const experienceText = document.getElementById("experience");
const avatar = document.getElementById("avatar");
const previewImage = document.getElementById("preview");
const previewHint = document.getElementById("preview-hint");
const historyList = document.getElementById("history");

const sessionId = (() => {
  const existing = localStorage.getItem("session_id");
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  localStorage.setItem("session_id", created);
  return created;
})();

const levelClassMap = [
  { threshold: 5, className: "level-5" },
  { threshold: 3, className: "level-3" },
  { threshold: 1, className: "level-1" },
];

const sessionRef = ref(database, `sessions/${sessionId}`);
const historyRef = query(ref(database, `submissions/${sessionId}`), limitToLast(5));

onValue(sessionRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    return;
  }
  levelText.textContent = data.level ?? "-";
  experienceText.textContent = data.total_xp ?? "-";
  updateAvatar(data.level ?? 1);
});

onValue(historyRef, (snapshot) => {
  const data = snapshot.val();
  historyList.innerHTML = "";
  if (!data) {
    historyList.innerHTML = "<li class=\"meta\">아직 기록이 없습니다.</li>";
    return;
  }

  const entries = Object.values(data)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);

  for (const entry of entries) {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${entry.score}점 · +${entry.gained_xp} XP</strong>
      <span class="meta">${entry.feedback}</span>
      <span class="meta">${entry.created_at || ""}</span>
    `;
    historyList.appendChild(item);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById("photo");
  if (!fileInput.files.length) {
    return;
  }

  const formData = new FormData();
  formData.append("photo", fileInput.files[0]);

  resultBox.innerHTML = "<p>AI가 숙제를 분석 중입니다...</p>";

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "업로드에 실패했습니다.");
    }

    resultBox.innerHTML = `
      <p><strong>점수:</strong> ${payload.score}점</p>
      <p><strong>피드백:</strong> ${payload.feedback}</p>
      <p><strong>획득 XP:</strong> ${payload.gained_xp}</p>
    `;

    if (payload.image_url) {
      previewImage.src = payload.image_url;
      previewImage.style.display = "block";
      previewHint.style.display = "none";
    }

    await set(sessionRef, {
      level: payload.level,
      total_xp: payload.total_xp,
      updated_at: payload.submitted_at,
    });

    const submissionRef = push(ref(database, `submissions/${sessionId}`));
    await set(submissionRef, {
      score: payload.score,
      feedback: payload.feedback,
      gained_xp: payload.gained_xp,
      image_url: payload.image_url,
      created_at: payload.submitted_at,
    });
  } catch (error) {
    resultBox.innerHTML = `<p class="error">${error.message}</p>`;
  }
});

function updateAvatar(level) {
  avatar.className = "avatar";
  for (const entry of levelClassMap) {
    if (level >= entry.threshold) {
      avatar.classList.add(entry.className);
      break;
    }
  }
}
