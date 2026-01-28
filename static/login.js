import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
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
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

const loginBtn = document.getElementById("login-btn");
const loginPopup = document.getElementById("login-popup");
const closeLoginPopup = document.getElementById("close-login-popup");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const googleLoginBtn = document.getElementById("google-login-btn");
const signupBtn = document.getElementById("signup-btn");
const findIdBtn = document.getElementById("find-id-btn");
const findPasswordBtn = document.getElementById("find-password-btn");

const signupPopup = document.getElementById("signup-popup");
const closeSignupPopup = document.getElementById("close-signup-popup");
const signupForm = document.getElementById("signup-form");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");
const signupSubmitBtn = document.getElementById("signup-submit-btn");
const googleSignupBtn = document.getElementById("google-signup-btn");
const googleSignupBtnOriginal = googleSignupBtn ? googleSignupBtn.innerHTML : "";

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    if (loginBtn.dataset.authenticated === "true") {
      handleLogout();
      return;
    }
    if (loginPopup) loginPopup.classList.add("active");
  });
}

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

if (closeLoginPopup) {
  closeLoginPopup.addEventListener("click", () => {
    if (loginPopup) loginPopup.classList.remove("active");
  });
}

if (loginPopup) {
  loginPopup.addEventListener("click", (e) => {
    if (e.target === loginPopup) {
      loginPopup.classList.remove("active");
    }
  });
}

if (signupBtn) {
  signupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loginPopup) loginPopup.classList.remove("active");
    if (signupPopup) signupPopup.classList.add("active");
    if (signupForm) signupForm.reset();
    if (signupError) signupError.style.display = "none";
    if (signupSuccess) signupSuccess.style.display = "none";
  });
}

if (closeSignupPopup) {
  closeSignupPopup.addEventListener("click", () => {
    if (signupPopup) signupPopup.classList.remove("active");
  });
}

if (signupPopup) {
  signupPopup.addEventListener("click", (e) => {
    if (e.target === signupPopup) {
      signupPopup.classList.remove("active");
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signup-email")?.value?.trim();
    const password = document.getElementById("signup-password")?.value || "";
    const passwordConfirm = document.getElementById("signup-password-confirm")?.value || "";

    if (signupError) signupError.style.display = "none";
    if (signupSuccess) signupSuccess.style.display = "none";

    if (!email || !password) {
      showSignupError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      showSignupError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      showSignupError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = true;
      signupSubmitBtn.textContent = "처리 중...";
    }
    if (signupForm) signupForm.classList.add("loading");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await ensureUserProfile(user, "password");
    if (signupSuccess) {
      signupSuccess.textContent = "회원가입이 완료되었습니다.";
      signupSuccess.style.display = "block";
    }
    setTimeout(() => {
      if (signupPopup) signupPopup.classList.remove("active");
      if (signupForm) signupForm.reset();
      if (signupSuccess) signupSuccess.style.display = "none";
    }, 1500);
      console.log("회원가입 성공:", user);
    } catch (error) {
      showSignupError(mapSignupError(error));
      console.error("회원가입 오류:", error);
    } finally {
      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = "회원가입";
      }
      if (signupForm) signupForm.classList.remove("loading");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-id")?.value?.trim();
    const password = document.getElementById("login-password")?.value || "";

    clearLoginError();

    if (!email || !password) {
      showLoginError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    setLoginLoading(true, "로그인 중...");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await ensureUserProfile(user, "password");
      if (loginPopup) loginPopup.classList.remove("active");
      if (loginForm) loginForm.reset();
      console.log("로그인 성공:", user);
    } catch (error) {
      showLoginError(mapLoginError(error));
      console.error("로그인 오류:", error);
    } finally {
      setLoginLoading(false, "로그인");
    }
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    clearLoginError();
    setLoginLoading(true, "로그인 중...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user, "google");
      if (loginPopup) loginPopup.classList.remove("active");
    } catch (error) {
      showLoginError(mapLoginError(error));
      console.error("구글 로그인 오류:", error);
    } finally {
      setLoginLoading(false, "로그인");
    }
  });
}

if (googleSignupBtn) {
  googleSignupBtn.addEventListener("click", async () => {
    try {
      googleSignupBtn.disabled = true;
      googleSignupBtn.textContent = "처리 중...";
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user, "google");
      if (signupPopup) signupPopup.classList.remove("active");
    } catch (error) {
      showSignupError(mapLoginError(error));
      console.error("구글 회원가입 오류:", error);
    } finally {
      googleSignupBtn.disabled = false;
      if (googleSignupBtnOriginal) {
        googleSignupBtn.innerHTML = googleSignupBtnOriginal;
      } else {
        googleSignupBtn.textContent = "구글로 회원가입";
      }
    }
  });
}

if (findIdBtn) {
  findIdBtn.addEventListener("click", () => {
    alert("Firebase는 이메일을 아이디로 사용합니다. 로그인에 사용한 이메일을 확인해 주세요.");
  });
}

if (findPasswordBtn) {
  findPasswordBtn.addEventListener("click", async () => {
    const email = document.getElementById("login-id")?.value?.trim();
    if (!email) {
      alert("비밀번호 재설정을 위해 이메일을 먼저 입력해 주세요.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("비밀번호 재설정 메일을 보냈습니다. 받은 편지함을 확인해 주세요.");
    } catch (error) {
      showLoginError(mapLoginError(error));
      console.error("비밀번호 재설정 오류:", error);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!loginBtn) return;
  if (user) {
    loginBtn.textContent = "로그아웃";
    loginBtn.dataset.authenticated = "true";
  } else {
    loginBtn.textContent = "로그인";
    loginBtn.dataset.authenticated = "false";
  }
});

async function ensureUserProfile(user, provider) {
  if (!user) {
    return;
  }
  const userRef = ref(database, `users/${user.uid}`);
  try {
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      const defaultNickname =
        user.displayName || (user.email ? user.email.split("@")[0] : "사용자");
      await set(userRef, {
        email: user.email ?? "",
        display_name: user.displayName ?? "",
        provider: provider || "unknown",
        profile: {
          nickname: defaultNickname,
          character_style: "classic",
          school: "",
          grade: "",
          gender: "",
        },
        created_at: serverTimestamp(),
        last_login_at: serverTimestamp(),
      });
    } else {
      await set(
        ref(database, `users/${user.uid}/last_login_at`),
        serverTimestamp()
      );
    }
  } catch (error) {
    console.error("사용자 프로필 저장 오류:", error);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("로그아웃 오류:", error);
    alert("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function setLoginLoading(isLoading, buttonText) {
  const submitBtn = loginForm?.querySelector("button[type=\"submit\"]");
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = buttonText;
  }
  if (loginForm) {
    loginForm.classList.toggle("loading", isLoading);
  }
  if (googleLoginBtn) {
    googleLoginBtn.disabled = isLoading;
  }
}

function clearLoginError() {
  if (loginError) {
    loginError.textContent = "";
    loginError.style.display = "none";
  }
}

function showLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
    loginError.style.display = "block";
  } else {
    alert(message);
  }
}

function showSignupError(message) {
  if (signupError) {
    signupError.textContent = message;
    signupError.style.display = "block";
  } else {
    alert(message);
  }
}

function mapSignupError(error) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "유효하지 않은 이메일 형식입니다.";
    case "auth/weak-password":
      return "비밀번호가 너무 약합니다.";
    case "auth/network-request-failed":
      return "네트워크 오류가 발생했습니다.";
    default:
      return error?.message || "회원가입에 실패했습니다.";
  }
}

function mapLoginError(error) {
  switch (error?.code) {
    case "auth/account-exists-with-different-credential":
      return "이미 다른 로그인 방식으로 가입된 계정입니다.";
    case "auth/popup-closed-by-user":
      return "로그인 팝업이 닫혔습니다. 다시 시도해 주세요.";
    case "auth/cancelled-popup-request":
      return "팝업 요청이 취소되었습니다. 다시 시도해 주세요.";
    case "auth/popup-blocked":
      return "브라우저 팝업이 차단되었습니다. 차단을 해제해 주세요.";
    case "auth/unauthorized-domain":
      return "인증되지 않은 도메인입니다. 관리자에게 문의해 주세요.";
    case "auth/too-many-requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "auth/user-not-found":
      return "해당 이메일로 가입된 계정이 없습니다.";
    case "auth/wrong-password":
      return "비밀번호가 올바르지 않습니다.";
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호를 다시 확인해 주세요.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/network-request-failed":
      return "네트워크 오류가 발생했습니다. 연결을 확인해 주세요.";
    default:
      return error?.message || "로그인에 실패했습니다.";
  }
}
