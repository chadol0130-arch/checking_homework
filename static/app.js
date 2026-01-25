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
