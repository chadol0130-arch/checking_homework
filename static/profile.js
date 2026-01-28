import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getDatabase,
  onValue,
  ref,
  update,
  serverTimestamp,
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const nicknameInput = document.getElementById("profile-nickname");
const schoolInput = document.getElementById("profile-school");
const gradeSelect = document.getElementById("profile-grade");
const genderSelect = document.getElementById("profile-gender");
const heightInput = document.getElementById("profile-height");
const weightInput = document.getElementById("profile-weight");
const scoreKorean = document.getElementById("profile-score-korean");
const scoreEnglish = document.getElementById("profile-score-english");
const scoreMath = document.getElementById("profile-score-math");
const scoreSocial = document.getElementById("profile-score-social");
const scoreScience = document.getElementById("profile-score-science");
const characterOptions = document.getElementById("character-options");
const profileAvatar = document.getElementById("profile-avatar");
const topbarUser = document.getElementById("topbar-user");

const passwordForm = document.getElementById("password-form");
const passwordNote = document.getElementById("password-note");
const passwordMessage = document.getElementById("password-message");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");

let currentUid = null;
let profileUnsub = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUid = null;
    detachProfileListener();
    resetProfileForm();
    setProfileLocked(true);
    updateTopbarUser("");
    return;
  }

  currentUid = user.uid;
  setProfileLocked(false);
  updateTopbarUser(resolveNickname(user, null));
  attachProfileListener(currentUid);
  updatePasswordAvailability(user);
});

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUid) {
      showProfileMessage("로그인 후 저장할 수 있습니다.", false);
      return;
    }

    const nickname = nicknameInput?.value?.trim() || "";
    const characterStyle = getSelectedCharacterStyle();

    const profileData = {
      nickname,
      character_style: characterStyle,
      school: schoolInput?.value?.trim() || "",
      grade: gradeSelect?.value || "",
      gender: genderSelect?.value || "",
      height_cm: parseNumber(heightInput?.value),
      weight_kg: parseNumber(weightInput?.value),
      scores: {
        korean: parseNumber(scoreKorean?.value),
        english: parseNumber(scoreEnglish?.value),
        math: parseNumber(scoreMath?.value),
        social: parseNumber(scoreSocial?.value),
        science: parseNumber(scoreScience?.value),
      },
      updated_at: serverTimestamp(),
    };

    try {
      await update(ref(database, `users/${currentUid}/profile`), profileData);
      showProfileMessage("프로필이 저장되었습니다.", true);
      updateTopbarUser(nickname || resolveNickname(auth.currentUser, null));
      updateProfileAvatar(characterStyle);
    } catch (error) {
      console.error("프로필 저장 오류:", error);
      showProfileMessage("저장에 실패했습니다. 다시 시도해 주세요.", false);
    }
  });
}

if (passwordForm) {
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!auth.currentUser) {
      showPasswordMessage("로그인 후 변경할 수 있습니다.", false);
      return;
    }

    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      showPasswordMessage("모든 비밀번호를 입력해 주세요.", false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showPasswordMessage("새 비밀번호가 일치하지 않습니다.", false);
      return;
    }
    if (newPassword.length < 6) {
      showPasswordMessage("새 비밀번호는 최소 6자 이상이어야 합니다.", false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      showPasswordMessage("비밀번호가 변경되었습니다.", true);
      passwordForm.reset();
    } catch (error) {
      console.error("비밀번호 변경 오류:", error);
      showPasswordMessage(mapPasswordError(error), false);
    }
  });
}

if (characterOptions) {
  characterOptions.addEventListener("change", (event) => {
    if (event.target?.name !== "character-style") {
      return;
    }
    updateProfileAvatar(getSelectedCharacterStyle());
  });
}

function attachProfileListener(userId) {
  detachProfileListener();
  const profileRef = ref(database, `users/${userId}/profile`);
  profileUnsub = onValue(profileRef, (snapshot) => {
    const data = snapshot.val() || {};
    const nickname = data.nickname || resolveNickname(auth.currentUser, data);
    if (nicknameInput) nicknameInput.value = nickname || "";
    if (schoolInput) schoolInput.value = data.school || "";
    if (gradeSelect) gradeSelect.value = data.grade || "";
    if (genderSelect) genderSelect.value = data.gender || "";
    if (heightInput) heightInput.value = data.height_cm ?? "";
    if (weightInput) weightInput.value = data.weight_kg ?? "";
    if (scoreKorean) scoreKorean.value = data.scores?.korean ?? "";
    if (scoreEnglish) scoreEnglish.value = data.scores?.english ?? "";
    if (scoreMath) scoreMath.value = data.scores?.math ?? "";
    if (scoreSocial) scoreSocial.value = data.scores?.social ?? "";
    if (scoreScience) scoreScience.value = data.scores?.science ?? "";

    const characterStyle = data.character_style || "classic";
    setSelectedCharacterStyle(characterStyle);
    updateProfileAvatar(characterStyle);
    updateTopbarUser(nickname);
  });
}

function detachProfileListener() {
  if (typeof profileUnsub === "function") {
    profileUnsub();
  }
  profileUnsub = null;
}

function setProfileLocked(isLocked) {
  const controls = profileForm?.querySelectorAll("input, select, button");
  controls?.forEach((element) => {
    element.disabled = isLocked;
  });
  const passwordControls = passwordForm?.querySelectorAll("input, button");
  passwordControls?.forEach((element) => {
    element.disabled = isLocked;
  });
  if (isLocked) {
    showProfileMessage("로그인 후 프로필을 수정할 수 있습니다.", false);
  }
}

function resetProfileForm() {
  profileForm?.reset();
  passwordForm?.reset();
  updateProfileAvatar("classic");
}

function showProfileMessage(message, isSuccess) {
  if (!profileMessage) {
    return;
  }
  profileMessage.textContent = message;
  profileMessage.className = isSuccess ? "success-message" : "error-message";
  profileMessage.style.display = "inline-flex";
  setTimeout(() => {
    profileMessage.style.display = "none";
  }, 2000);
}

function showPasswordMessage(message, isSuccess) {
  if (!passwordMessage) {
    return;
  }
  passwordMessage.textContent = message;
  passwordMessage.className = isSuccess ? "success-message" : "error-message";
  passwordMessage.style.display = "inline-flex";
  setTimeout(() => {
    passwordMessage.style.display = "none";
  }, 2500);
}

function updatePasswordAvailability(user) {
  const providerIds = user?.providerData?.map((provider) => provider.providerId) || [];
  const hasPassword = providerIds.includes("password");
  if (passwordNote) {
    passwordNote.textContent = hasPassword
      ? "이메일/비밀번호 계정만 변경할 수 있습니다."
      : "구글 로그인 계정은 비밀번호를 변경할 수 없습니다.";
  }
  const controls = passwordForm?.querySelectorAll("input, button");
  controls?.forEach((element) => {
    element.disabled = !hasPassword;
  });
}

function resolveNickname(user, profileData) {
  return (
    profileData?.nickname ||
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "")
  );
}

function updateProfileAvatar(style) {
  if (!profileAvatar) {
    return;
  }
  profileAvatar.className = "avatar";
  if (style) {
    profileAvatar.classList.add(`character-${style}`);
  }
}

function getSelectedCharacterStyle() {
  const selected = characterOptions?.querySelector("input[name=\"character-style\"]:checked");
  return selected?.value || "classic";
}

function setSelectedCharacterStyle(value) {
  const option = characterOptions?.querySelector(
    `input[name="character-style"][value="${value}"]`
  );
  if (option) {
    option.checked = true;
  }
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function updateTopbarUser(text) {
  if (!topbarUser) {
    return;
  }
  topbarUser.textContent = text ? `${text} 님` : "";
}

function mapPasswordError(error) {
  switch (error?.code) {
    case "auth/wrong-password":
      return "현재 비밀번호가 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "auth/weak-password":
      return "새 비밀번호가 너무 약합니다.";
    case "auth/requires-recent-login":
      return "보안을 위해 다시 로그인 후 시도해 주세요.";
    default:
      return error?.message || "비밀번호 변경에 실패했습니다.";
  }
}
