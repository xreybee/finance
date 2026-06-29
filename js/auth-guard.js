// js/auth-guard.js
// Script bersama untuk memeriksa status login, mengelola layout sidebar, dan memperbarui identitas pengguna

(function() {
  // Terapkan tema gelap/terang secara instan untuk mencegah kedipan layar (flicker)
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
  }

  const select = (id) => document.getElementById(id);

  // 1. CEK AUTENTIKASI (AUTH OBSERVER)
  function initAuthGuard() {
    if (!window.auth) {
      console.error("Firebase Auth belum siap. Mengalihkan ke login...");
      redirectToLogin();
      return;
    }

    window.auth.onAuthStateChanged(async (user) => {
      if (user) {
        window.currentUser = user;
        
        let userData = null;
        if (window.db) {
          try {
            const userDoc = await window.db.collection("users").doc(user.uid).get();
            if (userDoc.exists) {
              userData = userDoc.data();
            }
          } catch (e) {
            console.error("Gagal memuat profil kustom dari Firestore:", e);
          }
        }
        
        updateUserProfileUI(user, userData);
        
        // Panggil callback inisialisasi halaman spesifik jika didefinisikan
        if (typeof window.onPageLoad === "function") {
          window.onPageLoad(user);
        }
      } else {
        window.currentUser = null;
        console.warn("Pengguna tidak terautentikasi. Mengalihkan ke login...");
        redirectToLogin();
      }
    });
  }

  function redirectToLogin() {
    // Hindari perulangan jika sudah di halaman login
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  }

  // 2. UPDATE PROFILE UI DI LAYOUT UTAMA (Sidebar & TopBar)
  function updateUserProfileUI(user, userData = null) {
    const name = (userData && userData.displayName) || user.displayName || user.email.split("@")[0];
    const photo = (userData && userData.photoURL) || user.photoURL;
    
    // Perbarui Teks Nama & Email
    const nameEl = select("user-display-name");
    const emailEl = select("user-display-email");
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email;

    // Perbarui Foto Avatar (Gunakan Foto Profil atau Huruf Inisial)
    const avatarEl = select("avatar-letter");
    if (avatarEl) {
      if (photo) {
        avatarEl.innerHTML = `<img src="${photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
      } else {
        const letter = name.charAt(0).toUpperCase();
        avatarEl.innerHTML = letter;
      }
    }
  }

  // 3. LAYOUT & SIDEBAR COLLAPSIBLE CONTROLLER
  function initLayoutHandlers() {
    const sidebar = select("app-sidebar");
    const mainContent = select("app-main-content");
    const toggleIcon = select("sidebar-toggle-icon");
    const toggleBtn = select("sidebar-toggle");

    // Terapkan preferensi kolaps sidebar dari localStorage
    if (sidebar && mainContent && toggleIcon) {
      if (localStorage.getItem("sidebar_collapsed") === "true") {
        sidebar.classList.add("collapsed");
        mainContent.classList.add("expanded");
        toggleIcon.className = "fa-solid fa-chevron-right";
      }

      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const isCollapsed = sidebar.classList.toggle("collapsed");
          mainContent.classList.toggle("expanded");
          
          if (isCollapsed) {
            toggleIcon.className = "fa-solid fa-chevron-right";
            localStorage.setItem("sidebar_collapsed", "true");
          } else {
            toggleIcon.className = "fa-solid fa-chevron-left";
            localStorage.setItem("sidebar_collapsed", "false");
          }
        });
      }
    }

    // Sorot menu navigasi aktif sesuai halaman saat ini
    highlightActiveMenu();

    // Suntik tombol toggle tema ke dalam header top-bar secara otomatis
    const topBarActions = document.querySelector(".top-bar-actions");
    if (topBarActions) {
      const themeBtn = document.createElement("button");
      themeBtn.id = "btn-theme-toggle";
      themeBtn.className = "btn btn-glass";
      // Remove inline style so CSS controls sizing (cleaner responsive)
      themeBtn.style.marginRight = "";
      themeBtn.style.padding = "";
      themeBtn.style.fontSize = "";
      
      const currentTheme = localStorage.getItem("theme") || "light";
      themeBtn.innerHTML = currentTheme === "dark" 
        ? '<i class="fa-solid fa-sun"></i><span class="btn-label-text"> Mode Terang</span>' 
        : '<i class="fa-solid fa-moon"></i><span class="btn-label-text"> Mode Gelap</span>';
        
      topBarActions.prepend(themeBtn);
      
      themeBtn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-theme");
        if (isDark) {
          localStorage.setItem("theme", "dark");
          themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i><span class="btn-label-text"> Mode Terang</span>';
        } else {
          localStorage.setItem("theme", "light");
          themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i><span class="btn-label-text"> Mode Gelap</span>';
        }
        
        // Pemicu event custom jika Chart.js ingin menggambar ulang warnanya
        window.dispatchEvent(new Event("themechanged"));
      });
    }

    // Hubungkan tombol logout
    const logoutBtn = select("btn-logout");
    const profileLogoutBtn = select("btn-profile-logout");
    
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.auth.signOut();
      });
    }
    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.auth.signOut();
      });
    }
  }

  function highlightActiveMenu() {
    const path = window.location.pathname;
    let page = "dashboard"; // Default

    // Mendukung URL dengan ekstensi .html (file://) maupun tanpa ekstensi (Vercel/hosting)
    const segments = path.split("/").filter(Boolean);
    const lastSegment = (segments[segments.length - 1] || "").replace(".html", "");

    const pageMap = {
      "transactions": "transactions",
      "categories": "categories",
      "goals": "goals",
      "evaluation": "evaluation",
      "profile": "profile",
      "dashboard": "dashboard",
      "login": "login"
    };

    if (pageMap[lastSegment]) {
      page = pageMap[lastSegment];
    } else if (path.includes("transactions")) page = "transactions";
    else if (path.includes("categories")) page = "categories";
    else if (path.includes("goals")) page = "goals";
    else if (path.includes("evaluation")) page = "evaluation";
    else if (path.includes("profile")) page = "profile";

    // Set class aktif ke menu sidebar & mobile nav
    document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
      const viewAttr = link.getAttribute("data-view");
      if (viewAttr === page) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // 4. BANNER NOTIFIKASI GLOBAL
  window.showGlobalAlert = function(message, type = "success") {
    const alertBanner = select("global-alert");
    const alertMsg = select("global-alert-message");
    if (!alertBanner || !alertMsg) return;

    alertMsg.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.style.display = "flex";
    
    setTimeout(() => {
      alertBanner.style.display = "none";
    }, 5000);
  };

  // 5. UTILITY FORMATTING FUNCTIONS (Di-expose secara global)
  window.formatRupiah = function(angka) {
    const number = Number(angka);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  };

  window.formatIndonesianDate = function(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  window.getIndonesianMonthName = function(monthIndex) {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[monthIndex] || "";
  };

  // Tunggu hingga Firebase terinisialisasi
  const checkFirebaseInterval = setInterval(() => {
    if (window.isFirebaseInitialized) {
      clearInterval(checkFirebaseInterval);
      initAuthGuard();
      initLayoutHandlers();
    }
  }, 50);

  // Set timeout jika Firebase gagal diinisialisasi dalam 3 detik
  setTimeout(() => {
    clearInterval(checkFirebaseInterval);
    if (!window.isFirebaseInitialized && !window.location.pathname.includes("login.html")) {
      console.error("Gagal mendeteksi inisialisasi Firebase.");
      window.location.href = "login.html#setup";
    }
  }, 3000);

})();
