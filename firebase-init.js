var firebaseConfig = {
  apiKey: "AIzaSyDPyQH-W3ElwMlEClRDqFvsaULw4RondHc",
  authDomain: "mirim-attendance.firebaseapp.com",
  projectId: "mirim-attendance",
  storageBucket: "mirim-attendance.firebasestorage.app",
  messagingSenderId: "740513337533",
  appId: "1:740513337533:web:48fbbb1a32d0b294a8a7d4"
};

firebase.initializeApp(firebaseConfig);
var db   = firebase.firestore();
var auth = firebase.auth();

// 인증 완료까지 기다리는 Promise (Firestore 요청 전에 await)
var authReady = new Promise(function(resolve) {
  var unsub = auth.onAuthStateChanged(function(user) {
    if (user) { unsub(); resolve(user); }
  });
});

// 익명 로그인 시작
auth.signInAnonymously().catch(function(err) {
  console.error('익명 로그인 실패 — Firebase 콘솔에서 Anonymous 인증을 활성화해 주세요:', err.code);
});

db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('오프라인 캐시 사용 불가:', err.code);
  }
});
