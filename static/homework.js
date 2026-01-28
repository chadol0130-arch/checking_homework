const form = document.getElementById("uploadForm");
const errorEl = document.getElementById("error");
const previewEl = document.getElementById("preview");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const fd = new FormData(form);

    try {
      const res = await fetch("/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        if (errorEl) errorEl.textContent = data.error || "업로드에 실패했습니다.";
        return;
      }

      const scoreEl = document.getElementById("score");
      const feedbackEl = document.getElementById("feedback");
      const gainedXpEl = document.getElementById("gainedXp");
      const totalXpEl = document.getElementById("totalXp");
      const levelEl = document.getElementById("level");

      if (scoreEl) scoreEl.textContent = data.score;
      if (feedbackEl) feedbackEl.textContent = data.feedback;
      if (gainedXpEl) gainedXpEl.textContent = data.gained_xp;
      if (totalXpEl) totalXpEl.textContent = data.total_xp;
      if (levelEl) levelEl.textContent = data.level;

      if (data.image_url && previewEl) {
        previewEl.src = data.image_url;
        previewEl.style.display = "block";
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = "네트워크 오류가 발생했습니다.";
    }
  });
}
