// js/profile.js
// Penanganan pembaruan nama profil, unggahan & kompresi foto profil, serta cadangkan & pulihkan database

(function() {
  const select = (id) => document.getElementById(id);

  let categoriesList = [];
  let transactionsList = [];
  let goalsList = [];

  // 1. INITIALIZATION
  window.onPageLoad = async function(user) {
    let userData = null;
    try {
      const userDoc = await window.db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
      }
    } catch (e) {
      console.error("Gagal memuat profil kustom dari Firestore:", e);
    }
    renderProfileDetails(user, userData);
    initProfileListeners();
  };

  function renderProfileDetails(user, userData = null) {
    const name = (userData && userData.displayName) || user.displayName || "";
    const photo = (userData && userData.photoURL) || user.photoURL;
    
    select("profile-name").value = name;
    select("profile-email").value = user.email || "";

    // Tampilkan pratinjau avatar di halaman profil
    const avatarPreview = select("profile-avatar-preview");
    if (avatarPreview) {
      if (photo) {
        avatarPreview.innerHTML = `<img src="${photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
      } else {
        const letter = (name || user.email).charAt(0).toUpperCase();
        avatarPreview.innerHTML = letter;
      }
    }

    select("profile-alert").style.display = "none";
    select("profile-success").style.display = "none";
    select("backup-alert").style.display = "none";
    select("backup-success").style.display = "none";
  }

  // 2. LISTENERS
  function initProfileListeners() {
    // Perbarui profil submit
    select("profile-form").addEventListener("submit", handleProfileUpdate);

    // Unggah foto profil
    select("profile-photo-input").addEventListener("change", handleProfilePhotoUpload);

    // Ubah password
    select("password-form").addEventListener("submit", handlePasswordUpdate);

    // Cadangkan database (Backup)
    select("btn-backup-db").addEventListener("click", handleDatabaseBackup);

    // Pulihkan database (Restore)
    select("btn-restore-db-trigger").addEventListener("click", () => select("restore-db-file").click());
    select("restore-db-file").addEventListener("change", handleDatabaseRestore);

    // Tombol logout tambahan
    const logoutBtnTop = select("btn-profile-logout-top");
    if (logoutBtnTop) {
      logoutBtnTop.addEventListener("click", () => window.auth.signOut());
    }
  }

  // 3. LOGIKA UPDATE NAMA PROFIL
  async function handleProfileUpdate(e) {
    e.preventDefault();
    select("profile-alert").style.display = "none";
    select("profile-success").style.display = "none";

    const newName = select("profile-name").value.trim();
    try {
      // Simpan di Firestore (Sertakan userId agar lolos Firestore Rules!)
      await window.db.collection("users").doc(window.currentUser.uid).set({
        displayName: newName,
        userId: window.currentUser.uid
      }, { merge: true });

      // Simpan juga di Auth Profile secara lokal (sebagai cadangan opsional)
      try {
        await window.currentUser.updateProfile({ displayName: newName });
      } catch (authErr) {
        console.warn("Gagal update profil Auth, tapi berhasil disimpan di Firestore:", authErr);
      }
      
      window.location.reload();
    } catch (error) {
      console.error(error);
      select("profile-alert").querySelector(".alert-msg").textContent = "Gagal memperbarui profil: " + error.message;
      select("profile-alert").style.display = "flex";
    }
  }

  // 4. CROP & KOMPRESI FOTO PROFIL (Base64 100x100px)
  function handleProfilePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    select("profile-alert").style.display = "none";
    select("profile-success").style.display = "none";

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = async function() {
        try {
          const canvas = document.createElement("canvas");
          const size = 100; // Ukuran target 100x100px (sangat optimal & hemat kuota database)
          canvas.width = size;
          canvas.height = size;
          
          const ctx = canvas.getContext("2d");
          
          // Kalkulasi crop area center square (potong bagian tengah gambar)
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          
          if (img.width > img.height) {
            sourceWidth = img.height;
            sourceX = (img.width - img.height) / 2;
          } else {
            sourceHeight = img.width;
            sourceY = (img.height - img.width) / 2;
          }
          
          ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
          
          // Ubah ke format DataURL JPEG berkualitas 0.8
          const base64DataUrl = canvas.toDataURL("image/jpeg", 0.8);
          
          // Simpan foto profil base64 ke Firestore (Sertakan userId agar lolos Firestore Rules!)
          await window.db.collection("users").doc(window.currentUser.uid).set({
            photoURL: base64DataUrl,
            userId: window.currentUser.uid
          }, { merge: true });
          
          // Perbarui avatar di halaman profil saat ini
          select("profile-avatar-preview").innerHTML = `<img src="${base64DataUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
          
          // Tampilkan pesan sukses
          select("profile-success").querySelector(".alert-msg").textContent = "Foto profil berhasil diperbarui!";
          select("profile-success").style.display = "flex";
          
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          
        } catch (error) {
          console.error(error);
          select("profile-alert").querySelector(".alert-msg").textContent = "Gagal mengolah foto: " + error.message;
          select("profile-alert").style.display = "flex";
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 4.5. LOGIKA UPDATE PASSWORD
  async function handlePasswordUpdate(e) {
    e.preventDefault();
    select("password-alert").style.display = "none";
    select("password-success").style.display = "none";

    const newPass = select("profile-new-password").value;
    const confirmPass = select("profile-confirm-password").value;

    if (newPass.length < 6) {
      showPasswordError("Password minimal 6 karakter.");
      return;
    }
    if (newPass !== confirmPass) {
      showPasswordError("Konfirmasi password tidak cocok.");
      return;
    }

    try {
      await window.currentUser.updatePassword(newPass);
      select("profile-new-password").value = "";
      select("profile-confirm-password").value = "";
      
      select("password-success").querySelector(".alert-msg").textContent = "Password berhasil diperbarui!";
      select("password-success").style.display = "flex";
    } catch (error) {
      console.error(error);
      if (error.code === "auth/requires-recent-login") {
        showPasswordError("Aksi ini memerlukan login ulang demi keamanan. Silakan keluar lalu masuk kembali sebelum mengubah password.");
      } else {
        showPasswordError("Gagal memperbarui password: " + error.message);
      }
    }
  }

  function showPasswordError(msg) {
    const alertEl = select("password-alert");
    alertEl.querySelector(".alert-msg").textContent = msg;
    alertEl.style.display = "flex";
  }

  // 5. PENANGANAN BACKUP DATABASE (JSON)
  async function handleDatabaseBackup() {
    select("backup-alert").style.display = "none";
    select("backup-success").style.display = "none";

    try {
      // Ambil data terbaru dari Firestore
      const user = window.currentUser;
      
      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const transSnapshot = await window.db.collection("transactions").where("userId", "==", user.uid).get();
      transactionsList = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const goalsSnapshot = await window.db.collection("goals").where("userId", "==", user.uid).get();
      goalsList = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const backupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: user.uid,
        categories: categoriesList,
        transactions: transactionsList,
        goals: goalsList
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      
      const formattedDate = new Date().toISOString().substring(0, 10);
      downloadAnchor.setAttribute("download", `finance_backup_${formattedDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      select("backup-success").querySelector(".alert-msg").textContent = "Database berhasil dicadangkan dan berkas terunduh!";
      select("backup-success").style.display = "flex";
    } catch (error) {
      console.error(error);
      select("backup-alert").querySelector(".alert-msg").textContent = "Gagal mencadangkan database: " + error.message;
      select("backup-alert").style.display = "flex";
    }
  }

  // 6. PENANGANAN RESTORE DATABASE (JSON)
  function handleDatabaseRestore(e) {
    const file = e.target.files[0];
    if (!file) return;

    select("backup-alert").style.display = "none";
    select("backup-success").style.display = "none";

    if (!confirm("Apakah Anda yakin ingin memulihkan database? Ini akan memperbarui data Anda dengan berkas cadangan.")) {
      select("restore-db-file").value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
      try {
        const backup = JSON.parse(event.target.result);

        if (!backup || (!backup.categories && !backup.transactions && !backup.goals)) {
          throw new Error("Berkas JSON cadangan tidak valid atau kosong.");
        }

        let categoriesRestored = 0;
        let transactionsRestored = 0;
        let goalsRestored = 0;

        // A. Restore Categories
        if (backup.categories && Array.isArray(backup.categories)) {
          for (const cat of backup.categories) {
            const catData = {
              name: cat.name,
              type: cat.type,
              icon: cat.icon || "fa-tag",
              allocationPercentage: cat.allocationPercentage || 0,
              userId: window.currentUser.uid
            };
            if (cat.id) {
              await window.db.collection("categories").doc(cat.id).set(catData);
              categoriesRestored++;
            }
          }
        }

        // B. Restore Transactions
        if (backup.transactions && Array.isArray(backup.transactions)) {
          for (const t of backup.transactions) {
            const transData = {
              userId: window.currentUser.uid,
              type: t.type,
              amount: Number(t.amount),
              categoryId: t.categoryId,
              categoryName: t.categoryName,
              description: t.description,
              date: t.date,
              note: t.note || "",
              receiptImage: t.receiptImage || ""
            };
            if (t.id) {
              await window.db.collection("transactions").doc(t.id).set(transData);
              transactionsRestored++;
            }
          }
        }

        // C. Restore Goals
        if (backup.goals && Array.isArray(backup.goals)) {
          for (const g of backup.goals) {
            const goalData = {
              userId: window.currentUser.uid,
              name: g.name,
              targetAmount: Number(g.targetAmount),
              currentAmount: Number(g.currentAmount || 0),
              targetDate: g.targetDate
            };
            if (g.id) {
              await window.db.collection("goals").doc(g.id).set(goalData);
              goalsRestored++;
            }
          }
        }

        select("backup-success").querySelector(".alert-msg").innerHTML = `
          Pemulihan database berhasil!
          <br>• ${categoriesRestored} Kategori dipulihkan/diperbarui
          <br>• ${transactionsRestored} Transaksi dipulihkan/diperbarui
          <br>• ${goalsRestored} Target Tabungan dipulihkan/diperbarui
        `;
        select("backup-success").style.display = "flex";
        select("restore-db-file").value = "";
      } catch (error) {
        console.error(error);
        select("backup-alert").querySelector(".alert-msg").textContent = "Gagal memulihkan data: " + error.message;
        select("backup-alert").style.display = "flex";
        select("restore-db-file").value = "";
      }
    };
    reader.readAsText(file);
  }

})();
