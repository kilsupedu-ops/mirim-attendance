var firebaseConfig = {
  apiKey: "AIzaSyDPyQH-W3ElwMlEClRDqFvsaULw4RondHc",
  authDomain: "mirim-attendance.firebaseapp.com",
  projectId: "mirim-attendance",
  storageBucket: "mirim-attendance.firebasestorage.app",
  messagingSenderId: "740513337533",
  appId: "1:740513337533:web:48fbbb1a32d0b294a8a7d4"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('오프라인 캐시 사용 불가:', err.code);
  }
});
