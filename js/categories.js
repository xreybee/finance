// js/categories.js
// Penanganan manajemen kategori, alokasi anggaran, dan pencegahan duplikat

(function() {
  const select = (id) => document.getElementById(id);

  let categoriesList = [];
  let transactionsList = [];
  let editingCategoryId = null;

  // 1. INITIALIZATION
  window.onPageLoad = async function(user) {
    await loadCategoriesData(user);
    initCategoriesListeners();
    renderCategories();
  };

  async function loadCategoriesData(user) {
    try {
      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const transSnapshot = await window.db.collection("transactions").where("userId", "==", user.uid).get();
      transactionsList = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal memuat data kategori:", error);
    }
  }

  // 2. LISTENERS
  function initCategoriesListeners() {
    select("btn-add-category").addEventListener("click", () => openCategoryModal());
    select("close-modal-category").addEventListener("click", closeCategoryModal);
    select("btn-cancel-category").addEventListener("click", closeCategoryModal);

    // Event listener untuk radio button jenis kategori (pemasukan vs pengeluaran)
    document.querySelectorAll('input[name="cat-type"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        if (e.target.value === "income") {
          select("cat-allocation-group").style.display = "none";
        } else {
          select("cat-allocation-group").style.display = "block";
        }
      });
    });

    // Event listener range slider alokasi anggaran
    select("cat-allocation-range").addEventListener("input", (e) => {
      select("cat-allocation-val").textContent = `${e.target.value}%`;
    });

    // Submit Kategori
    select("category-form").addEventListener("submit", handleCategorySubmit);
  }

  // 3. LOGIKA CRUD KATEGORI
  function openCategoryModal(editId = null) {
    const form = select("category-form");
    form.reset();
    editingCategoryId = editId;
    select("category-alert").style.display = "none";
    
    // Set default form
    document.querySelector('input[name="cat-type"][value="expense"]').checked = true;
    select("cat-allocation-group").style.display = "block";
    select("cat-allocation-range").value = 0;
    select("cat-allocation-val").textContent = "0%";
    
    if (editId) {
      const cat = categoriesList.find(c => c.id === editId);
      if (cat) {
        select("cat-name").value = cat.name;
        select("cat-icon").value = cat.icon || "fa-tag";
        document.querySelector(`input[name="cat-type"][value="${cat.type}"]`).checked = true;
        
        if (cat.type === "income") {
          select("cat-allocation-group").style.display = "none";
        } else {
          select("cat-allocation-group").style.display = "block";
          select("cat-allocation-range").value = cat.allocationPercentage || 0;
          select("cat-allocation-val").textContent = `${cat.allocationPercentage || 0}%`;
        }
      }
    }
    
    select("modal-category").classList.add("active");
  }

  function closeCategoryModal() {
    select("modal-category").classList.remove("active");
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    select("category-alert").style.display = "none";

    const nameInput = select("cat-name").value.trim();
    const type = document.querySelector('input[name="cat-type"]:checked').value;
    const icon = select("cat-icon").value;
    const allocationPercentage = type === "income" ? 0 : Number(select("cat-allocation-range").value);

    // A. DETEKSI DOUBLE DATA (CASE-INSENSITIVE)
    const isDuplicate = categoriesList.some(cat => {
      if (editingCategoryId && cat.id === editingCategoryId) return false;
      return cat.name.toLowerCase() === nameInput.toLowerCase() && cat.type === type;
    });

    if (isDuplicate) {
      const existingCat = categoriesList.find(cat => cat.name.toLowerCase() === nameInput.toLowerCase() && cat.type === type);
      alert(`Kategori "${nameInput}" sudah terdaftar di database! Sistem akan mengalihkan Anda langsung untuk mencatat transaksi dengan kategori ini.`);
      closeCategoryModal();
      
      // Alihkan langsung ke halaman transaksi dengan query parameter otomatis
      window.location.href = `transactions.html?auto_add_cat=${existingCat.id}&type=${type}`;
      return;
    }

    // B. VALIDASI TOTAL PERSENTASE ANGGARAN (Maksimal 100%)
    let currentTotalPercentage = categoriesList
      .filter(c => c.type === "expense" && c.id !== editingCategoryId)
      .reduce((sum, c) => sum + (c.allocationPercentage || 0), 0);
      
    if (type === "expense" && (currentTotalPercentage + allocationPercentage) > 100) {
      if (!confirm(`Peringatan: Total alokasi anggaran belanja Anda melebihi 100% (saat ini ${currentTotalPercentage + allocationPercentage}%). Tetap simpan?`)) {
        return;
      }
    }

    const catData = {
      userId: window.currentUser.uid,
      name: nameInput,
      type,
      icon,
      allocationPercentage
    };

    try {
      if (editingCategoryId) {
        await window.db.collection("categories").doc(editingCategoryId).update(catData);
        window.showGlobalAlert("Kategori berhasil diperbarui!");
      } else {
        await window.db.collection("categories").add(catData);
        window.showGlobalAlert("Kategori baru berhasil ditambahkan!");
      }
      
      closeCategoryModal();
      await loadCategoriesData(window.currentUser);
      renderCategories();
    } catch (error) {
      console.error(error);
      const alertEl = select("category-alert");
      alertEl.querySelector(".alert-msg").innerHTML = `Gagal menyimpan: <strong>${error.message || error}</strong>. <br><small>Pastikan Aturan Keamanan (Firestore Rules) sudah diatur di Firebase Console Anda.</small>`;
      alertEl.style.display = "flex";
    }
  }

  // 4. RENDERING KARTU KATEGORI
  function renderCategories() {
    const gridContainer = select("categories-grid-list");
    gridContainer.innerHTML = "";

    // Hitung total anggaran belanja
    let totalExpensePercentage = 0;
    
    categoriesList.forEach(cat => {
      if (cat.type === "expense") {
        totalExpensePercentage += cat.allocationPercentage || 0;
      }

      // Hitung berapa kali kategori ini digunakan pada transaksi
      const usedCount = transactionsList.filter(t => t.categoryId === cat.id).length;
      
      const badgeClass = cat.type === "income" ? "badge badge-success" : "badge badge-danger";
      const badgeText = cat.type === "income" ? "Pemasukan" : "Pengeluaran";
      
      const card = document.createElement("div");
      card.className = "category-card glass-panel";
      card.innerHTML = `
        <div class="category-info">
          <div class="category-icon-wrapper" style="background-color: ${cat.type === 'income' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(255, 77, 109, 0.15)'}; color: ${cat.type === 'income' ? 'var(--aqua-color)' : 'var(--danger-color)'};">
            <i class="fa-solid ${cat.icon || 'fa-tag'}"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="category-name-text" style="font-weight: 700; color: white;">${cat.name}</div>
            <span class="${badgeClass}" style="margin-top: 4px; display: inline-block;">${badgeText}</span>
          </div>
        </div>
        
        <div style="margin-top: 15px; font-size: 13px; color: var(--text-secondary);">
          ${cat.type === "expense" ? `Anggaran Belanja: <strong style="color: var(--aqua-color);">${cat.allocationPercentage || 0}%</strong>` : "Kategori pemasukan bebas limit"}
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">Digunakan di ${usedCount} transaksi</div>
        </div>
        
        <div class="category-actions" style="margin-top: 15px; display: flex; gap: 10px; border-top: 1px solid var(--white-glass-border); padding-top: 12px;">
          <button class="btn btn-glass" style="flex: 1; padding: 6px; font-size: 12px; color: var(--aqua-color);" onclick="editCategory('${cat.id}')">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button class="btn btn-glass" style="flex: 1; padding: 6px; font-size: 12px; color: var(--danger-color);" onclick="deleteCategory('${cat.id}')">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </div>
      `;
      gridContainer.appendChild(card);
    });

    // Update kotak ringkasan anggaran
    select("cat-total-allocation").textContent = `${totalExpensePercentage}% / 100%`;
    const statusText = select("cat-allocation-status");
    if (totalExpensePercentage > 100) {
      statusText.textContent = "Anggaran berlebih! Harap kurangi alokasi persentase kategori.";
      statusText.style.color = "var(--danger-color)";
    } else if (totalExpensePercentage === 100) {
      statusText.textContent = "Alokasi anggaran pas 100%. Rencana keuangan terencana utuh.";
      statusText.style.color = "var(--aqua-color)";
    } else {
      statusText.textContent = `Masih tersisa ${100 - totalExpensePercentage}% pemasukan yang belum dialokasikan.`;
      statusText.style.color = "var(--text-muted)";
    }
  }

  // 5. EDIT & HAPUS AKSI (Expose ke window)
  window.editCategory = function(id) {
    openCategoryModal(id);
  };

  window.deleteCategory = async function(id) {
    const count = transactionsList.filter(t => t.categoryId === id).length;
    if (count > 0) {
      alert(`Gagal menghapus! Kategori ini masih digunakan oleh ${count} transaksi. Silakan ubah atau hapus transaksi tersebut terlebih dahulu.`);
      return;
    }

    if (confirm("Apakah Anda yakin ingin menghapus kategori ini?")) {
      try {
        await window.db.collection("categories").doc(id).delete();
        window.showGlobalAlert("Kategori berhasil dihapus!", "success");
        await loadCategoriesData(window.currentUser);
        renderCategories();
      } catch (error) {
        console.error("Gagal menghapus kategori:", error);
        window.showGlobalAlert("Gagal menghapus kategori.", "error");
      }
    }
  };

})();
