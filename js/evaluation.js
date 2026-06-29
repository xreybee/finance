// js/evaluation.js
// Logika untuk menghitung skor kesehatan, rata-rata bulanan, proporsi alokasi, dan rekomendasi refleksi diri

(function() {
  const select = (id) => document.getElementById(id);

  let categoriesList = [];
  let transactionsList = [];

  // Inisialisasi Firebase Auth Listener
  window.auth.onAuthStateChanged(async (user) => {
    if (user) {
      await loadFinancialData(user);
      calculateAndRenderEvaluation();
    } else {
      window.location.replace("login.html");
    }
  });

  async function loadFinancialData(user) {
    try {
      // 1. Ambil data kategori
      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Ambil data transaksi
      const transSnapshot = await window.db.collection("transactions").where("userId", "==", user.uid).get();
      transactionsList = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal mengambil data finansial:", error);
    }
  }

  // Helper untuk memetakan kategori ke grup 50/30/20 berdasarkan nama
  function mapCategoryToGroup(catId) {
    const cat = categoriesList.find(c => c.id === catId);
    if (!cat) return "needs"; // Default jika kategori tidak ditemukan

    const name = cat.name.toLowerCase();

    // Kata kunci Tabungan (20%)
    if (name.includes("tabung") || name.includes("invest") || name.includes("emas") || 
        name.includes("saham") || name.includes("reksa") || name.includes("darurat") || 
        name.includes("goals") || name.includes("target") || name.includes("dana darurat") ||
        name.includes("menabung")) {
      return "savings";
    }

    // Kata kunci Keinginan (30%)
    if (name.includes("hibur") || name.includes("hobi") || name.includes("jajan") || 
        name.includes("kopi") || name.includes("cafe") || name.includes("nonton") || 
        name.includes("bioskop") || name.includes("libur") || name.includes("jalan") || 
        name.includes("shop") || name.includes("baju") || name.includes("pakaian") || 
        name.includes("gaya") || name.includes("gadget") || name.includes("hadiah") ||
        name.includes("gift") || name.includes("sedekah") || name.includes("donasi")) {
      return "wants";
    }

    // Default adalah Kebutuhan Pokok (50%)
    return "needs";
  }

  function calculateAndRenderEvaluation() {
    if (transactionsList.length === 0) {
      renderEmptyState();
      return;
    }

    let totalIncome = 0;
    let totalExpense = 0;

    let needsAmount = 0;
    let wantsAmount = 0;
    let savingsExpenseAmount = 0; // Transaksi pengeluaran yang masuk ke tabungan/investasi

    // Temukan bulan aktif unik dalam transaksi
    const activeMonths = new Set();

    transactionsList.forEach(t => {
      if (!t.date) return;
      const monthKey = t.date.substring(0, 7); // Format: YYYY-MM
      activeMonths.add(monthKey);

      const amount = Number(t.amount) || 0;
      if (t.type === "income") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        
        // Klasifikasikan pengeluaran berdasarkan nama kategorinya
        const group = mapCategoryToGroup(t.category);
        if (group === "needs") {
          needsAmount += amount;
        } else if (group === "wants") {
          wantsAmount += amount;
        } else if (group === "savings") {
          savingsExpenseAmount += amount;
        }
      }
    });

    const monthCount = activeMonths.size || 1;

    // Rata-rata per bulan
    const avgIncome = totalIncome / monthCount;
    const avgExpense = totalExpense / monthCount;

    // Sisa pendapatan bersih
    const netSavings = Math.max(0, totalIncome - totalExpense);
    // Total Tabungan = Sisa pendapatan + Pengeluaran bermotif tabungan/investasi
    const totalSavings = netSavings + savingsExpenseAmount;

    // Persentase alokasi riil terhadap Total Pemasukan
    const divisor = totalIncome || 1; // Cegah pembagian dengan nol
    const needsPct = Math.round((needsAmount / divisor) * 100);
    const wantsPct = Math.round((wantsAmount / divisor) * 100);
    const savingsPct = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    // Render Rata-rata Finansial
    select("avg-income").textContent = window.formatRupiah ? window.formatRupiah(Math.round(avgIncome)) : `Rp ${Math.round(avgIncome).toLocaleString("id-ID")}`;
    select("avg-expense").textContent = window.formatRupiah ? window.formatRupiah(Math.round(avgExpense)) : `Rp ${Math.round(avgExpense).toLocaleString("id-ID")}`;
    select("avg-savings-rate").textContent = `${savingsPct}%`;
    
    // Deskripsi Rasio Sisa Uang
    const savingsRateDescEl = select("savings-rate-desc");
    if (savingsPct >= 20) {
      savingsRateDescEl.innerHTML = `<span style="color: var(--success-color); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Rasio Bagus (Min 20%)</span>`;
    } else {
      savingsRateDescEl.innerHTML = `<span style="color: var(--danger-color); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Terlalu Rendah (Min 20%)</span>`;
    }

    // Render Progress Bar Alokasi
    select("real-needs-pct").textContent = `${needsPct}%`;
    select("real-needs-bar").style.width = `${Math.min(100, needsPct)}%`;
    if (needsPct > 50) {
      select("real-needs-bar").style.background = "linear-gradient(90deg, #ff4d6d, #c91a37)"; // Berwarna merah jika melebihi target
    } else {
      select("real-needs-bar").style.background = "linear-gradient(90deg, #1565c0, #0d47a1)";
    }

    select("real-wants-pct").textContent = `${wantsPct}%`;
    select("real-wants-bar").style.width = `${Math.min(100, wantsPct)}%`;
    if (wantsPct > 30) {
      select("real-wants-bar").style.background = "linear-gradient(90deg, #ff4d6d, #c91a37)"; // Merah jika boros hiburan
    } else {
      select("real-wants-bar").style.background = "linear-gradient(90deg, #29b6f6, #0288d1)";
    }

    select("real-savings-pct").textContent = `${savingsPct}%`;
    select("real-savings-bar").style.width = `${Math.min(100, savingsPct)}%`;
    if (savingsPct < 20) {
      select("real-savings-bar").style.background = "linear-gradient(90deg, #ffb703, #ff8f00)"; // Kuning/Oranye jika kurang menabung
    } else {
      select("real-savings-bar").style.background = "linear-gradient(90deg, #38b000, #007200)";
    }

    // -------------------------------------------------------------
    // RATA-RATA TRANSAKSI PER KATEGORI
    // -------------------------------------------------------------
    const categoryStats = {};
    transactionsList.forEach(t => {
      if (!t.category) return;
      if (!categoryStats[t.category]) {
        categoryStats[t.category] = { total: 0, count: 0 };
      }
      categoryStats[t.category].total += Number(t.amount) || 0;
      categoryStats[t.category].count += 1;
    });

    const categoryAverages = [];
    categoriesList.forEach(cat => {
      const stats = categoryStats[cat.id];
      if (stats && stats.count > 0) {
        const average = stats.total / stats.count;
        categoryAverages.push({
          ...cat,
          average,
          count: stats.count
        });
      }
    });

    // Urutkan berdasarkan tipe (Pemasukan dahulu, lalu Pengeluaran), lalu berdasarkan nominal terbesar
    categoryAverages.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "income" ? -1 : 1;
      }
      return b.average - a.average;
    });

    const catAvgListEl = select("category-average-list");
    if (catAvgListEl) {
      catAvgListEl.innerHTML = "";
      if (categoryAverages.length === 0) {
        catAvgListEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); font-size: 13.5px; padding: 20px;">Tidak ada riwayat transaksi per kategori.</div>`;
      } else {
        categoryAverages.forEach(item => {
          const formattedAvg = window.formatRupiah ? window.formatRupiah(Math.round(item.average)) : `Rp ${Math.round(item.average).toLocaleString("id-ID")}`;
          const typeLabel = item.type === "income" ? "Rata-rata Masuk" : "Rata-rata Keluar";
          
          catAvgListEl.innerHTML += `
            <div class="category-avg-item">
              <div class="cat-avg-meta">
                <span style="font-size: 22px;">${item.icon || '📁'}</span>
                <div class="cat-avg-info">
                  <div class="category-name-text cat-avg-name">${item.name}</div>
                  <div class="cat-avg-count">${item.count} transaksi</div>
                </div>
              </div>
              <div class="cat-avg-amount-box">
                <div class="stat-value cat-avg-amount" style="color: ${item.type === 'income' ? 'var(--success-color)' : 'var(--text-primary)'};">
                  ${formattedAvg}
                </div>
                <div class="cat-avg-type">${typeLabel}</div>
              </div>
            </div>
          `;
        });
      }
    }

    // HITUNG SKOR KESEHATAN KEUANGAN
    let healthScore = 100;
    
    // Indikator 1: Defisit (Pengeluaran melebihi pemasukan)
    if (totalExpense > totalIncome) {
      healthScore -= 40;
    } else if (totalIncome > 0) {
      const expenseRatio = totalExpense / totalIncome;
      if (expenseRatio > 0.8) {
        healthScore -= 20; // Sisa kurang dari 20%
      }
    }

    // Indikator 2: Kebutuhan Pokok melebihi 50%
    if (needsPct > 50) {
      const diff = needsPct - 50;
      healthScore -= Math.min(20, Math.round(diff * 0.8));
    }

    // Indikator 3: Keinginan melebihi 30%
    if (wantsPct > 30) {
      const diff = wantsPct - 30;
      healthScore -= Math.min(20, Math.round(diff * 0.8));
    }

    // Indikator 4: Tabungan kurang dari 20%
    if (savingsPct < 20) {
      const diff = 20 - savingsPct;
      healthScore -= Math.min(30, Math.round(diff * 1.5));
    }

    // Batasi skor antara 0 - 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Render Skor ke Circle SVG
    select("score-text").textContent = healthScore;
    const strokeDashOffset = 364.4 - (364.4 * healthScore) / 100;
    select("score-ring").style.strokeDashoffset = strokeDashOffset;

    // Tentukan badge status & saran refleksi
    let statusText = "MEMUAT";
    let statusClass = "badge-success";
    let statusDesc = "";
    const advices = [];

    if (healthScore >= 80) {
      statusText = "SANGAT SEHAT";
      statusClass = "badge-success";
      statusDesc = "Keuangan Anda dalam kondisi luar biasa! Anda sangat disiplin dalam membatasi pengeluaran non-pokok dan menyisihkan dana tabungan di atas standar minimal.";
      
      advices.push({
        icon: "fa-solid fa-circle-check",
        color: "var(--success-color)",
        title: "Pertahankan Performa Bagus Ini",
        text: "Anda telah mengalokasikan anggaran dengan rasio ideal. Lanjutkan kedisiplinan ini dan pertimbangkan untuk memindahkan dana tabungan ke instrumen investasi jangka panjang agar tumbuh maksimal."
      });
    } else if (healthScore >= 60) {
      statusText = "CUKUP SEHAT";
      statusClass = "badge-primary";
      statusDesc = "Keuangan Anda stabil, namun ada beberapa pos pengeluaran yang masih bisa dioptimalkan untuk memperbesar porsi tabungan.";
      
      advices.push({
        icon: "fa-solid fa-circle-exclamation",
        color: "var(--primary-color)",
        title: "Optimalkan Pos Sisa Pendapatan",
        text: "Cobalah untuk menyisihkan dana di awal bulan secara otomatis minimal 20% langsung ke rekening khusus tabungan agar tidak terpakai secara tidak sengaja."
      });
    } else if (healthScore >= 40) {
      statusText = "KURANG SEHAT";
      statusClass = "badge-warning";
      statusDesc = "Keuangan Anda kurang sehat. Kebutuhan pokok atau pengeluaran gaya hidup Anda terlalu tinggi, sehingga porsi menabung Anda sangat minim.";
      
      advices.push({
        icon: "fa-solid fa-triangle-exclamation",
        color: "var(--warning-color)",
        title: "Evaluasi Pengeluaran Tersier (Keinginan)",
        text: `Pengeluaran hiburan/gaya hidup Anda mencapai ${wantsPct}% dari pendapatan (rekomendasi: maks 30%). Batasi frekuensi makan di luar atau belanja impulsif untuk bulan depan.`
      });
    } else {
      statusText = "KRITIS / DEFISIT";
      statusClass = "badge-danger";
      statusDesc = "Keuangan Anda kritis! Pengeluaran Anda melebihi pemasukan atau tabungan Anda berada di tingkat yang sangat membahayakan stabilitas jangka pendek.";
      
      advices.push({
        icon: "fa-solid fa-circle-xmark",
        color: "var(--danger-color)",
        title: "Kurangi Pengeluaran Non-Pokok Segera",
        text: "Anda mengalami defisit anggaran. Hentikan seluruh pengeluaran keinginan (hiburan/lifestyle) untuk sementara waktu, dan prioritaskan pemenuhan kebutuhan pokok serta pengisian dana darurat."
      });
    }

    // Tambahkan saran spesifik berdasarkan data riil
    if (totalExpense > totalIncome) {
      advices.push({
        icon: "fa-solid fa-circle-dollar-to-slot",
        color: "var(--danger-color)",
        title: "Bahaya Defisit Anggaran",
        text: `Total pengeluaran Anda (${window.formatRupiah ? window.formatRupiah(totalExpense) : totalExpense}) lebih besar dari pemasukan (${window.formatRupiah ? window.formatRupiah(totalIncome) : totalIncome}). Anda perlu berhemat secara agresif atau mencari pemasukan tambahan.`
      });
    }

    if (needsPct > 50) {
      advices.push({
        icon: "fa-solid fa-house-circle-exclamation",
        color: "var(--warning-color)",
        title: "Kebutuhan Pokok Melebihi Batas 50%",
        text: `Pos kebutuhan pokok Anda memakan ${needsPct}% dari pendapatan. Evaluasi kembali biaya langganan, belanja bulanan rutin, atau carilah alternatif penyedia layanan yang lebih ekonomis.`
      });
    }

    if (savingsPct < 20) {
      advices.push({
        icon: "fa-solid fa-piggy-bank",
        color: "var(--warning-color)",
        title: "Rasio Tabungan Terlalu Rendah",
        text: `Tabungan & investasi Anda saat ini hanya sebesar ${savingsPct}% (target sehat: minimal 20%). Sisihkan sisa uang belanja secara disiplin setiap kali menerima pemasukan.`
      });
    }

    // Pasang badge & deskripsi
    const badgeEl = select("health-status-badge");
    badgeEl.textContent = statusText;
    badgeEl.className = `badge ${statusClass}`;
    
    // Set warna stroke ring SVG
    const ringEl = select("score-ring");
    if (healthScore >= 80) ringEl.setAttribute("stroke", "var(--success-color)");
    else if (healthScore >= 60) ringEl.setAttribute("stroke", "var(--primary-color)");
    else if (healthScore >= 40) ringEl.setAttribute("stroke", "var(--warning-color)");
    else ringEl.setAttribute("stroke", "var(--danger-color)");

    select("health-description").textContent = statusDesc;

    // Render daftar saran
    const adviceListEl = select("advice-list");
    adviceListEl.innerHTML = "";

    advices.forEach(adv => {
      adviceListEl.innerHTML += `
        <div class="advice-card">
          <div class="advice-icon-box" style="color: ${adv.color};"><i class="${adv.icon}"></i></div>
          <div class="advice-info">
            <h4 class="advice-title">${adv.title}</h4>
            <p class="advice-text">${adv.text}</p>
          </div>
        </div>
      `;
    });
  }

  function renderEmptyState() {
    select("score-text").textContent = "0";
    select("score-ring").style.strokeDashoffset = "364.4";

    const badgeEl = select("health-status-badge");
    badgeEl.textContent = "TIDAK ADA DATA";
    badgeEl.className = "badge";

    select("health-description").textContent = "Belum ada transaksi yang tercatat di akun Anda. Mulailah mencatat pemasukan dan pengeluaran Anda di menu Transaksi untuk melihat evaluasi kesehatan finansial Anda.";

    select("advice-list").innerHTML = `
      <div class="advice-card">
        <div class="advice-icon-box" style="color: var(--primary-color);"><i class="fa-solid fa-circle-info"></i></div>
        <div class="advice-info">
          <h4 class="advice-title">Catat Transaksi Pertama Anda</h4>
          <p class="advice-text">Evaluasi kesehatan finansial ini dihitung otomatis berdasarkan perbandingan seluruh pemasukan dan pengeluaran bulanan Anda.</p>
        </div>
      </div>
    `;
  }

})();
