// js/firebase-init.js
// Inisialisasi Firebase global (menggunakan SDK Compat) untuk menghindari CORS pada protokol file://

(function() {
  // Kredensial Firebase yang telah diberikan oleh pengguna
  const defaultConfig = {
    apiKey: "AIzaSyCcYOXET_dmYYyAjgsJIkrs3UAStjfNqao",
    authDomain: "finance-91add.firebaseapp.com",
    projectId: "finance-91add",
    storageBucket: "finance-91add.firebasestorage.app",
    messagingSenderId: "315459011151",
    appId: "1:315459011151:web:6c7eb46aaacb2d3bbca03a",
    measurementId: "G-NJCB6W0BMR"
  };

  // Ambil dari localStorage jika ada konfigurasi khusus, jika tidak gunakan default
  let firebaseConfig = defaultConfig;
  try {
    const savedConfig = localStorage.getItem("firebase_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (parsed && parsed.apiKey) {
        firebaseConfig = parsed;
      }
    }
  } catch (e) {
    console.error("Gagal membaca firebase_config dari localStorage:", e);
  }

  // Tembus variabel ke window agar bisa diakses oleh file JS lainnya
  window.firebaseDefaultConfig = defaultConfig;
  window.auth = null;
  window.db = null;
  window.isFirebaseInitialized = false;

  if (firebaseConfig && firebaseConfig.apiKey) {
    try {
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      window.isFirebaseInitialized = true;
      console.log("Firebase berhasil terinisialisasi secara global.");
    } catch (error) {
      console.error("Gagal menginisialisasi Firebase:", error);
    }
  } else {
    console.warn("Firebase belum terkonfigurasi. Kunci API diperlukan.");
  }
})();
