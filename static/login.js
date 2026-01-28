// Firebase 설정 및 초기화
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

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
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 로그인 팝업 관련 JavaScript
const loginBtn = document.getElementById("login-btn");
const loginPopup = document.getElementById("login-popup");
const closeLoginPopup = document.getElementById("close-login-popup");
const loginForm = document.getElementById("login-form");
const signupBtn = document.getElementById("signup-btn");
const findIdBtn = document.getElementById("find-id-btn");
const findPasswordBtn = document.getElementById("find-password-btn");

// 회원가입 팝업 관련 JavaScript
const signupPopup = document.getElementById("signup-popup");
const closeSignupPopup = document.getElementById("close-signup-popup");
const signupForm = document.getElementById("signup-form");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");
const signupSubmitBtn = document.getElementById("signup-submit-btn");

// 로그인 버튼 클릭 시 팝업 열기
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    loginPopup.classList.add("active");
  });
}

// 닫기 버튼 클릭 시 팝업 닫기
if (closeLoginPopup) {
  closeLoginPopup.addEventListener("click", () => {
    loginPopup.classList.remove("active");
  });
}

// 팝업 배경 클릭 시 닫기
if (loginPopup) {
  loginPopup.addEventListener("click", (e) => {
    if (e.target === loginPopup) {
      loginPopup.classList.remove("active");
    }
  });
}

// 회원가입 버튼 클릭 시 회원가입 팝업 열기
if (signupBtn) {
  signupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loginPopup) loginPopup.classList.remove("active");
    if (signupPopup) signupPopup.classList.add("active");
    // 폼 초기화
    if (signupForm) signupForm.reset();
    if (signupError) signupError.style.display = "none";
    if (signupSuccess) signupSuccess.style.display = "none";
  });
}

// 회원가입 팝업 닫기
if (closeSignupPopup) {
  closeSignupPopup.addEventListener("click", () => {
    signupPopup.classList.remove("active");
  });
}

// 회원가입 팝업 배경 클릭 시 닫기
if (signupPopup) {
  signupPopup.addEventListener("click", (e) => {
    if (e.target === signupPopup) {
      signupPopup.classList.remove("active");
    }
  });
}

// 회원가입 폼 제출
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const passwordConfirm = document.getElementById("signup-password-confirm").value;

    // 에러 메시지 초기화
    if (signupError) signupError.style.display = "none";
    if (signupSuccess) signupSuccess.style.display = "none";

    // 비밀번호 확인 검증
    if (password !== passwordConfirm) {
      if (signupError) {
        signupError.textContent = "비밀번호가 일치하지 않습니다.";
        signupError.style.display = "block";
      }
      return;
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      if (signupError) {
        signupError.textContent = "비밀번호는 최소 6자 이상이어야 합니다.";
        signupError.style.display = "block";
      }
      return;
    }

    // 로딩 상태
    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = true;
      signupSubmitBtn.textContent = "처리 중...";
    }
    if (signupForm) signupForm.classList.add("loading");

    try {
      // Firebase Authentication을 사용한 회원가입
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 성공 메시지 표시
      if (signupSuccess) {
        signupSuccess.textContent = "회원가입이 완료되었습니다!";
        signupSuccess.style.display = "block";
      }
      
      // 2초 후 팝업 닫기
      setTimeout(() => {
        if (signupPopup) signupPopup.classList.remove("active");
        if (loginPopup) loginPopup.classList.add("active");
        if (signupForm) signupForm.reset();
        if (signupSuccess) signupSuccess.style.display = "none";
      }, 2000);

      console.log("회원가입 성공:", user);
    } catch (error) {
      // 에러 처리
      let errorMessage = "회원가입에 실패했습니다.";
      
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "이미 사용 중인 이메일입니다.";
          break;
        case "auth/invalid-email":
          errorMessage = "유효하지 않은 이메일 형식입니다.";
          break;
        case "auth/weak-password":
          errorMessage = "비밀번호가 너무 약합니다.";
          break;
        case "auth/network-request-failed":
          errorMessage = "네트워크 오류가 발생했습니다.";
          break;
        default:
          errorMessage = error.message || "회원가입에 실패했습니다.";
      }
      
      if (signupError) {
        signupError.textContent = errorMessage;
        signupError.style.display = "block";
      }
      console.error("회원가입 오류:", error);
    } finally {
      // 로딩 상태 해제
      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = "회원가입";
      }
      if (signupForm) signupForm.classList.remove("loading");
    }
  });
}

// 로그인 폼 제출 (기본 구현)
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-id").value;
    const password = document.getElementById("login-password").value;
    console.log("로그인 시도:", { email, password });
    // 여기에 실제 로그인 로직을 추가할 수 있습니다
    alert("로그인 기능은 아직 구현되지 않았습니다.");
  });
}

// 아이디 찾기 버튼
if (findIdBtn) {
  findIdBtn.addEventListener("click", () => {
    alert("아이디 찾기 기능은 아직 구현되지 않았습니다.");
  });
}

// 비밀번호 찾기 버튼
if (findPasswordBtn) {
  findPasswordBtn.addEventListener("click", () => {
    alert("비밀번호 찾기 기능은 아직 구현되지 않았습니다.");
  });
}

// 구글 회원가입 버튼
const googleSignupBtn = document.getElementById("google-signup-btn");
if (googleSignupBtn) {
  googleSignupBtn.addEventListener("click", async () => {
    try {
      // 로딩 상태
      googleSignupBtn.disabled = true;
      googleSignupBtn.textContent = "처리 중...";
      
      // 구글 로그인 팝업으로 회원가입/로그인
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // 성공 메시지 표시
      if (signupSuccess) {
        signupSuccess.textContent = "구글 계정으로 회원가입이 완료되었습니다!";
        signupSuccess.style.display = "block";
      }
      
      // 에러 메시지 숨기기
      if (signupError) signupError.style.display = "none";
      
      // 2초 후 팝업 닫기
      setTimeout(() => {
        if (signupPopup) signupPopup.classList.remove("active");
        if (signupForm) signupForm.reset();
        if (signupSuccess) signupSuccess.style.display = "none";
        // 페이지 새로고침 또는 로그인 상태로 전환
        window.location.reload();
      }, 2000);
      
      console.log("구글 회원가입 성공:", user);
    } catch (error) {
      // 에러 처리
      let errorMessage = "구글 회원가입에 실패했습니다.";
      
      switch (error.code) {
        case "auth/popup-closed-by-user":
          errorMessage = "팝업이 사용자에 의해 닫혔습니다.";
          break;
        case "auth/cancelled-popup-request":
          errorMessage = "팝업 요청이 취소되었습니다.";
          break;
        case "auth/popup-blocked":
          errorMessage = "팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.";
          break;
        case "auth/network-request-failed":
          errorMessage = "네트워크 오류가 발생했습니다.";
          break;
        default:
          errorMessage = error.message || "구글 회원가입에 실패했습니다.";
      }
      
      if (signupError) {
        signupError.textContent = errorMessage;
        signupError.style.display = "block";
      }
      console.error("구글 회원가입 오류:", error);
    } finally {
      // 로딩 상태 해제
      if (googleSignupBtn) {
        googleSignupBtn.disabled = false;
        googleSignupBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          구글로 회원가입
        `;
      }
    }
  });
}
