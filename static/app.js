// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChYb-nd-jhtkrCub8thxAU1xQHrQ2Zk-A",
  authDomain: "checking-homework-5647d.firebaseapp.com",
  projectId: "checking-homework-5647d",
  storageBucket: "checking-homework-5647d.firebasestorage.app",
  messagingSenderId: "220286491925",
  appId: "1:220286491925:web:1526b0a7b167e9e4ce1d1c",
  measurementId: "G-24VJYH8SEH"
  databaseURL: "https://checking-homework-5647d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);




const form = document.getElementById("upload-form");
const resultBox = document.getElementById("result");
const levelText = document.getElementById("level");
const experienceText = document.getElementById("experience");
const avatar = document.getElementById("avatar");

const levelClassMap = [
  { threshold: 5, className: "level-5" },
  { threshold: 3, className: "level-3" },
  { threshold: 1, className: "level-1" },
];

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
    `;

    experienceText.textContent = payload.experience;
    levelText.textContent = payload.level;
    updateAvatar(payload.level);
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
