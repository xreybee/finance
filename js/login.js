// js/login.js
// Penanganan login, registrasi, dan setup konfigurasi Firebase

(function() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
  }

  const select = (id) => document.getElementById(id);

  function initLogin() {
    // 1. CEK KONFIGURASI FIREBASE
    if (!window.isFirebaseInitialized) {
      // Tampilkan setup screen jika belum terhubung
      select("setup-screen").style.display = "flex";
      select("auth-screen").style.display = "none";
      
      // Auto-fill placeholders
      select("setup-project-id").value = window.firebaseDefaultConfig.projectId;
      select("setup-auth-domain").value = window.firebaseDefaultConfig.authDomain;
      select("setup-storage-bucket").value = window.firebaseDefaultConfig.storageBucket;
      select("setup-sender-id").value = window.firebaseDefaultConfig.messagingSenderId;
      
      select("setup-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const config = {
          apiKey: select("setup-api-key").value.trim(),
          authDomain: select("setup-auth-domain").value.trim(),
          projectId: select("setup-project-id").value.trim(),
          storageBucket: select("setup-storage-bucket").value.trim(),
          messagingSenderId: select("setup-sender-id").value.trim(),
          appId: select("setup-app-id").value.trim()
        };
        
        // Simpan ke localStorage
        localStorage.setItem("firebase_config", JSON.stringify(config));
        alert("Konfigurasi disimpan! Halaman akan dimuat ulang.");
        window.location.reload();
      });
      return;
    }

    // 2. JALANKAN OBSERVER LOGIN (Jika sudah login, lempar langsung ke Dashboard)
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.replace("dashboard.html");
      } else {
        select("setup-screen").style.display = "none";
        select("auth-screen").style.display = "flex";
      }
    });

    // 3. LISTENERS FORM LOGIN & DAFTAR
    
    // Login form
    select("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = select("login-email").value.trim();
      const password = select("login-password").value.trim();
      hideAuthAlert();
      
      try {
        await window.auth.signInWithEmailAndPassword(email, password);
        window.location.replace("dashboard.html");
      } catch (error) {
        showAuthAlert("Email atau password Anda salah. Silakan coba lagi.");
      }
    });

    // Register form
    select("register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = select("register-name").value.trim();
      const email = select("register-email").value.trim();
      const password = select("register-password").value.trim();
      hideAuthAlert();
      
      if (password.length < 6) {
        showAuthAlert("Password minimal 6 karakter.");
        return;
      }
      
      try {
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        
        // Pemicu inisialisasi kategori default bagi user baru
        await checkAndCreateDefaultCategories(userCredential.user.uid);
        
        alert("Registrasi berhasil! Selamat datang.");
        window.location.replace("dashboard.html");
      } catch (error) {
        showAuthAlert("Gagal mendaftar: " + error.message);
      }
    });

    // Reset firebase config
    select("reset-firebase-config").addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Apakah Anda yakin ingin menghapus konfigurasi Firebase saat ini?")) {
        localStorage.removeItem("firebase_config");
        window.location.reload();
      }
    });

    // Toggle navigasi form
    select("go-to-register").addEventListener("click", (e) => {
      e.preventDefault();
      select("login-form").style.display = "none";
      select("register-form").style.display = "block";
      select("auth-form-title").textContent = "Buat Akun Baru";
      select("auth-form-subtitle").textContent = "Mulai kelola keuangan secara terorganisir";
      hideAuthAlert();
    });
    select("go-to-login").addEventListener("click", (e) => {
      e.preventDefault();
      select("login-form").style.display = "block";
      select("register-form").style.display = "none";
      select("auth-form-title").textContent = "Selamat Datang di Finance";
      select("auth-form-subtitle").textContent = "Kelola keuangan Anda dengan bijak dan modern";
      hideAuthAlert();
    });
  }

  // Buat kategori default jika data kosong (pengguna baru)
  async function checkAndCreateDefaultCategories(userId) {
    try {
      const snapshot = await window.db.collection("categories").where("userId", "==", userId).get();
      
      if (snapshot.empty) {
        console.log("Inisialisasi kategori bawaan...");
        const defaults = [
          { name: "Gaji", type: "income", icon: "fa-arrow-trend-up", allocationPercentage: 0 },
          { name: "Bonus", type: "income", icon: "fa-gift", allocationPercentage: 0 },
          { name: "Makan", type: "expense", icon: "fa-utensils", allocationPercentage: 30 },
          { name: "Transportasi", type: "expense", icon: "fa-bus", allocationPercentage: 10 },
          { name: "Belanja", type: "expense", icon: "fa-cart-shopping", allocationPercentage: 20 },
          { name: "Tagihan", type: "expense", icon: "fa-bolt", allocationPercentage: 15 },
          { name: "Kesehatan", type: "expense", icon: "fa-heart-pulse", allocationPercentage: 10 },
          { name: "Hiburan", type: "expense", icon: "fa-gamepad", allocationPercentage: 10 },
          { name: "Lain-lain", type: "expense", icon: "fa-question", allocationPercentage: 5 }
        ];
        
        for (const cat of defaults) {
          await window.db.collection("categories").add({
            ...cat,
            userId: userId
          });
        }
      }
    } catch (error) {
      console.error("Gagal memeriksa kategori default:", error);
    }
  }

  function showAuthAlert(msg) {
    const alertEl = select("auth-alert");
    alertEl.querySelector(".alert-msg").textContent = msg;
    alertEl.style.display = "flex";
  }
  function hideAuthAlert() {
    select("auth-alert").style.display = "none";
  }

  // Bootstrapping login
  const checkFirebaseInterval = setInterval(() => {
    // Kita jalankan login inisialisasi baik terhubung maupun tidak (karena setup form butuh isFirebaseInitialized = false)
    if (typeof window.isFirebaseInitialized !== "undefined") {
      clearInterval(checkFirebaseInterval);
      initLogin();
    }
  }, 50);

})();
