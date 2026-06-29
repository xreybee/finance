// js/transactions.js
// Penanganan pencatatan, pemfilteran, edit/hapus, ekspor CSV, dan upload struk transaksi

(function() {
  const select = (id) => document.getElementById(id);

  let categoriesList = [];
  let transactionsList = [];
  let compressedReceiptBase64 = "";

  window.onPageLoad = async function(user) {
    await loadTransactionsData(user);
    initTransactionsListeners();
    populateCategoryDropdowns();
    renderTransactionsTable();
    
    // Periksa jika dialihkan dari deteksi kategori ganda
    const params = new URLSearchParams(window.location.search);
    if (params.has("auto_add_cat")) {
      const autoCatId = params.get("auto_add_cat");
      const autoCatType = params.get("type") || "expense";
      
      openTransactionModal();
      document.querySelector(`input[name="trans-type"][value="${autoCatType}"]`).checked = true;
      populateTransactionModalCategories();
      select("trans-category").value = autoCatId;
      
      // Hapus parameter URL agar bersih setelah modal terbuka
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  async function loadTransactionsData(user) {
    try {
      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const transSnapshot = await window.db.collection("transactions").where("userId", "==", user.uid).get();
      transactionsList = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal memuat data transaksi:", error);
    }
  }

  // 2. DROPDOWN INITIALIZER
  function populateCategoryDropdowns() {
    const filterCat = select("filter-category");
    const modalCat = select("trans-category");

    if (filterCat) {
      filterCat.innerHTML = `<option value="all">Semua Kategori</option>`;
      categoriesList.forEach(cat => {
        filterCat.innerHTML += `<option value="${cat.id}">${cat.type === 'income' ? '📥' : '📤'} ${cat.name}</option>`;
      });
    }

    populateTransactionModalCategories();
  }

  function populateTransactionModalCategories() {
    const modalCat = select("trans-category");
    if (!modalCat) return;

    modalCat.innerHTML = "";
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    const filtered = categoriesList.filter(c => c.type === type);
    
    if (filtered.length === 0) {
      modalCat.innerHTML = `<option value="">-- Buat Kategori di Menu Kategori --</option>`;
    } else {
      filtered.forEach(cat => {
        modalCat.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      });
    }
  }

  // 3. EVENT LISTENERS
  function initTransactionsListeners() {
    // Tombol-tombol modal
    select("btn-quick-add-transaction").addEventListener("click", () => openTransactionModal());
    select("btn-add-transaction-main").addEventListener("click", () => openTransactionModal());
    select("close-modal-transaction").addEventListener("click", closeTransactionModal);
    select("btn-cancel-transaction").addEventListener("click", closeTransactionModal);

    // Filter perubahan
    select("filter-search").addEventListener("input", renderTransactionsTable);
    select("filter-type").addEventListener("change", renderTransactionsTable);
    select("filter-category").addEventListener("change", renderTransactionsTable);
    select("filter-start-date").addEventListener("change", renderTransactionsTable);
    select("filter-end-date").addEventListener("change", renderTransactionsTable);

    select("btn-clear-filters").addEventListener("click", () => {
      select("filter-search").value = "";
      select("filter-type").value = "all";
      select("filter-category").value = "all";
      select("filter-start-date").value = "";
      select("filter-end-date").value = "";
      renderTransactionsTable();
    });

    // Ekspor CSV
    select("btn-export-csv").addEventListener("click", exportTransactionsToCSV);

    // Penanganan modal tipe transaksi radio
    document.querySelectorAll('input[name="trans-type"]').forEach(radio => {
      radio.addEventListener("change", populateTransactionModalCategories);
    });

    // Upload struk belanja (Base64 + Kompres)
    select("trans-receipt").addEventListener("change", handleReceiptUpload);
    select("btn-remove-receipt").addEventListener("click", () => {
      compressedReceiptBase64 = "";
      select("trans-receipt").value = "";
      select("receipt-preview-container").style.display = "none";
    });

    // Submit Transaksi
    select("transaction-form").addEventListener("submit", handleTransactionSubmit);

    // Struk Viewer Modal
    select("close-modal-receipt-viewer").addEventListener("click", () => select("modal-receipt-viewer").classList.remove("active"));
    select("btn-close-receipt-viewer").addEventListener("click", () => select("modal-receipt-viewer").classList.remove("active"));
  }

  // 4. LOGIKA CRUD TRANSAKSI
  function openTransactionModal(editId = null) {
    const form = select("transaction-form");
    form.reset();
    select("receipt-preview-container").style.display = "none";
    compressedReceiptBase64 = "";
    select("transaction-alert").style.display = "none";
    
    // Set default date hari ini
    const today = new Date().toISOString().substring(0, 10);
    select("trans-date").value = today;
    
    if (editId) {
      // Mode Edit
      select("modal-transaction-title").textContent = "Edit Transaksi";
      const trans = transactionsList.find(t => t.id === editId);
      if (trans) {
        select("transaction-id").value = trans.id;
        document.querySelector(`input[name="trans-type"][value="${trans.type}"]`).checked = true;
        populateTransactionModalCategories();
        
        select("trans-amount").value = trans.amount;
        select("trans-category").value = trans.categoryId;
        select("trans-description").value = trans.description;
        select("trans-date").value = trans.date;
        select("trans-note").value = trans.note || "";
        
        if (trans.receiptImage) {
          compressedReceiptBase64 = trans.receiptImage;
          select("receipt-preview-img").src = trans.receiptImage;
          select("receipt-preview-container").style.display = "inline-block";
        }
      }
    } else {
      // Mode Tambah Baru
      select("modal-transaction-title").textContent = "Catat Transaksi Baru";
      select("transaction-id").value = "";
      document.querySelector('input[name="trans-type"][value="expense"]').checked = true;
      populateTransactionModalCategories();
    }
    
    select("modal-transaction").classList.add("active");
  }

  function closeTransactionModal() {
    select("modal-transaction").classList.remove("active");
  }

  async function handleTransactionSubmit(e) {
    e.preventDefault();
    select("transaction-alert").style.display = "none";

    const id = select("transaction-id").value;
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    const amount = Number(select("trans-amount").value);
    const categoryId = select("trans-category").value;
    const description = select("trans-description").value.trim();
    const date = select("trans-date").value;
    const note = select("trans-note").value.trim();

    if (!categoryId) {
      showModalError("Pilih kategori terlebih dahulu. Buat kategori jika belum tersedia.");
      return;
    }

    const categoryObj = categoriesList.find(c => c.id === categoryId);
    const categoryName = categoryObj ? categoryObj.name : "Kategori Lain";

    const transData = {
      userId: window.currentUser.uid,
      type,
      amount,
      categoryId,
      categoryName,
      description,
      date,
      note,
      receiptImage: compressedReceiptBase64
    };

    try {
      if (id) {
        await window.db.collection("transactions").doc(id).update(transData);
        window.showGlobalAlert("Transaksi berhasil diperbarui!");
      } else {
        transData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await window.db.collection("transactions").add(transData);
        window.showGlobalAlert("Transaksi baru berhasil dicatat!");
      }
      
      closeTransactionModal();
      await loadTransactionsData(window.currentUser);
      renderTransactionsTable();
    } catch (error) {
      console.error(error);
      showModalError(`Gagal menyimpan transaksi: <strong>${error.message || error}</strong>. <br><small>Pastikan Aturan Keamanan (Firestore Rules) sudah diatur di Firebase Console Anda.</small>`);
    }
  }

  function showModalError(msg) {
    const alertEl = select("transaction-alert");
    alertEl.querySelector(".alert-msg").innerHTML = msg;
    alertEl.style.display = "flex";
  }

  // 5. RENDER TABEL TRANSAKSI
  function renderTransactionsTable() {
    const listContainer = select("transactions-list");
    const emptyState = select("transactions-empty-state");
    listContainer.innerHTML = "";
    
    // Ambil nilai filter
    const query = select("filter-search").value.toLowerCase();
    const typeFilter = select("filter-type").value;
    const catFilter = select("filter-category").value;
    const start = select("filter-start-date").value;
    const end = select("filter-end-date").value;
    
    // Filter data transaksi
    let filteredList = transactionsList.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(query) || (t.note && t.note.toLowerCase().includes(query));
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchCat = catFilter === "all" || t.categoryId === catFilter;
      const matchStart = !start || t.date >= start;
      const matchEnd = !end || t.date <= end;
      
      return matchSearch && matchType && matchCat && matchStart && matchEnd;
    });
    
    // Urutkan transaksi berdasarkan tanggal terbaru
    filteredList.sort((a, b) => b.date.localeCompare(a.date));
    
    if (filteredList.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";
    
    filteredList.forEach(t => {
      const cat = categoriesList.find(c => c.id === t.categoryId);
      const icon = cat ? cat.icon : "fa-tag";
      const catName = cat ? cat.name : (t.categoryName || 'Kustom');
      
      const badgeClass = t.type === "income" ? "badge badge-success" : "badge badge-danger";
      const badgeText = t.type === "income" ? "Pemasukan" : "Pengeluaran";
      const amountSign = t.type === "income" ? "+" : "-";
      const amountClass = t.type === "income" ? "amount-income" : "amount-expense";
      
      // Tombol struk belanja (desktop)
      const receiptBtn = t.receiptImage 
        ? `<button class="btn btn-glass" style="padding: 5px 10px; font-size: 11px;" onclick="viewReceipt('${t.receiptImage}')"><i class="fa-solid fa-receipt"></i> Struk</button>` 
        : `<span style="color: var(--text-muted); font-size: 11px;">Tidak ada</span>`;
      
      const tr = document.createElement("tr");
      tr.className = "mobile-card";
      tr.dataset.id = t.id;

      tr.innerHTML = `
        <!-- MOBILE: Icon cell -->
        <td class="mc-icon"><i class="fa-solid ${icon}"></i></td>
        <!-- MOBILE: Main info cell -->
        <td class="mc-main">
          <span class="mc-desc">${t.description}</span>
          <span class="mc-meta">${catName} &bull; ${window.formatIndonesianDate(t.date)}</span>
        </td>
        <!-- MOBILE: Amount cell -->
        <td class="mc-amount">
          <span class="${amountClass}">${amountSign} ${window.formatRupiah(t.amount)}</span>
          <span class="${badgeClass}" style="font-size: 10px; padding: 3px 8px;">${badgeText}</span>
        </td>

        <!-- DESKTOP COLUMNS (hidden on mobile via CSS) -->
        <td data-label="Tanggal">${window.formatIndonesianDate(t.date)}</td>
        <td data-label="Deskripsi / Catatan">
          <div style="font-weight: 600;">${t.description}</div>
          ${t.note ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${t.note}</div>` : ""}
        </td>
        <td data-label="Kategori">
          <span><i class="fa-solid ${icon}"></i> ${catName}</span>
        </td>
        <td data-label="Jenis"><span class="${badgeClass}">${badgeText}</span></td>
        <td data-label="Nominal" class="${amountClass}" style="font-weight: 700;">${amountSign} ${window.formatRupiah(t.amount)}</td>
        <td data-label="Struk">${receiptBtn}</td>
        <td data-label="Aksi">
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-glass" style="padding: 6px 12px; font-size: 12px; color: var(--aqua-color);" onclick="editTransaction('${t.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-glass" style="padding: 6px 12px; font-size: 12px; color: var(--danger-color);" onclick="deleteTransaction('${t.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;

      // Mobile: klik card untuk lihat detail
      tr.addEventListener("click", (e) => {
        // Jangan buka detail kalau yang diklik adalah tombol aksi
        if (e.target.closest("button")) return;
        showTransactionDetail(t.id);
      });

      listContainer.appendChild(tr);
    });
  }

  // -------------------------------------------
  // DETAIL MODAL
  // -------------------------------------------
  let _activeDetailId = null;

  function showTransactionDetail(id) {
    const t = transactionsList.find(x => x.id === id);
    if (!t) return;
    _activeDetailId = id;

    const cat = categoriesList.find(c => c.id === t.categoryId);
    const catName = cat ? cat.name : (t.categoryName || 'Kustom');
    const icon = cat ? cat.icon : "fa-tag";
    const amountSign = t.type === "income" ? "+" : "-";
    const amountClass = t.type === "income" ? "detail-amount-income" : "detail-amount-expense";
    const badgeClass = t.type === "income" ? "badge badge-success" : "badge badge-danger";
    const badgeText = t.type === "income" ? "Pemasukan" : "Pengeluaran";

    const receiptSection = t.receiptImage
      ? `<div class="detail-row">
           <span class="detail-label">Struk</span>
           <button class="btn btn-glass" style="padding: 5px 14px; font-size: 12px;" onclick="viewReceipt('${t.receiptImage}')"><i class="fa-solid fa-receipt"></i> Lihat Struk</button>
         </div>`
      : "";

    const noteSection = t.note
      ? `<div class="detail-row"><span class="detail-label">Catatan</span><span class="detail-value">${t.note}</span></div>`
      : "";

    const body = select("transaction-detail-body");
    body.innerHTML = `
      <div style="text-align: center; padding: 10px 0 18px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(13,71,161,0.08); display: inline-flex; align-items: center; justify-content: center; font-size: 22px; color: var(--primary-color); margin-bottom: 10px;">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="${amountClass}">${amountSign} ${window.formatRupiah(t.amount)}</div>
        <span class="${badgeClass}" style="margin-top: 6px;">${badgeText}</span>
      </div>
      <div class="detail-row"><span class="detail-label">Deskripsi</span><span class="detail-value">${t.description}</span></div>
      <div class="detail-row"><span class="detail-label">Kategori</span><span class="detail-value"><i class="fa-solid ${icon}"></i> ${catName}</span></div>
      <div class="detail-row"><span class="detail-label">Tanggal</span><span class="detail-value">${window.formatIndonesianDate(t.date)}</span></div>
      ${noteSection}
      ${receiptSection}
    `;

    select("modal-transaction-detail").classList.add("active");
  }


  // 6. EDIT, HAPUS, & DETAIL RECEIPT GLOBAL ACTIONS (Expose ke window)
  window.editTransaction = function(id) {
    openTransactionModal(id);
  };

  window.deleteTransaction = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
      try {
        await window.db.collection("transactions").doc(id).delete();
        window.showGlobalAlert("Transaksi berhasil dihapus!", "success");
        await loadTransactionsData(window.currentUser);
        renderTransactionsTable();
      } catch (error) {
        console.error("Gagal menghapus transaksi:", error);
        window.showGlobalAlert("Gagal menghapus transaksi.", "error");
      }
    }
  };

  window.viewReceipt = function(base64Image) {
    select("receipt-full-img").src = base64Image;
    select("modal-receipt-viewer").classList.add("active");
  };

  // 7. KOMPRESI GAMBAR (Base64)
  function handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        // Kompresi menggunakan HTML5 Canvas
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // Atur dimensi max 800px lebar/tinggi
        const MAX_SIZE = 800;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // Ubah ke format DataURL JPEG berkualitas 0.7
        compressedReceiptBase64 = canvas.toDataURL("image/jpeg", 0.7);
        
        // Perbarui preview UI
        select("receipt-preview-img").src = compressedReceiptBase64;
        select("receipt-preview-container").style.display = "inline-block";
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 8. EKSPOR TRANSAKSI KE CSV
  function exportTransactionsToCSV() {
    if (transactionsList.length === 0) {
      alert("Tidak ada transaksi untuk diekspor.");
      return;
    }

    let csvLines = "Tanggal,Deskripsi,Kategori,Jenis,Nominal,Catatan\r\n";

    transactionsList.sort((a,b) => b.date.localeCompare(a.date)).forEach(t => {
      const formattedDate = t.date;
      const desc = `"${t.description.replace(/"/g, '""')}"`;
      
      // Ambil nama kategori dinamis dari categoriesList
      const cat = categoriesList.find(c => c.id === t.categoryId);
      const catName = cat ? `"${cat.name.replace(/"/g, '""')}"` : '"Kustom"';
      
      const type = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const amt = t.amount;
      const note = `"${(t.note || '').replace(/"/g, '""')}"`;
      
      csvLines += `${formattedDate},${desc},${catName},${type},${amt},${note}\r\n`;
    });

    // Gunakan data URI yang diencode penuh dengan encodeURIComponent + UTF-8 BOM
    // agar 100% kompatibel dan bisa didownload saat halaman dijalankan lewat protokol file://
    const csvContent = "\uFEFF" + csvLines;
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const formattedDate = new Date().toISOString().substring(0, 10);
    link.setAttribute("download", `riwayat_transaksi_${formattedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();
