// js/dashboard.js
// Logika pemrosesan dan visualisasi dashboard keuangan

(function() {
  const select = (id) => document.getElementById(id);
  
  let categoriesList = [];
  let transactionsList = [];
  let balanceChartInstance = null;

  // Fungsi pemanggil awal yang dipicu oleh Auth Guard setelah user terverifikasi
  window.onPageLoad = async function(user) {
    await loadDashboardData(user);
    renderDashboard();
  };

  async function loadDashboardData(user) {
    try {
      // 1. Muat Kategori
      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Muat Transaksi
      const transSnapshot = await window.db.collection("transactions").where("userId", "==", user.uid).get();
      transactionsList = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    }
  }

  function renderDashboard() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let totalIncome = 0;
    let totalExpense = 0;
    let overallBalance = 0;
    
    const categoryExpenses = {};
    
    transactionsList.forEach(t => {
      const amount = Number(t.amount);
      
      // Hitung saldo akumulasi keseluruhan
      if (t.type === "income") {
        overallBalance += amount;
      } else {
        overallBalance -= amount;
      }
      
      // Hitung transaksi bulan berjalan saja
      if (t.date && t.date.startsWith(currentMonthStr)) {
        if (t.type === "income") {
          totalIncome += amount;
        } else {
          totalExpense += amount;
          
          if (!categoryExpenses[t.categoryId]) {
            categoryExpenses[t.categoryId] = 0;
          }
          categoryExpenses[t.categoryId] += amount;
        }
      }
    });

    // Render ke kartu stats
    select("dashboard-balance").textContent = window.formatRupiah(overallBalance);
    select("dashboard-income").textContent = window.formatRupiah(totalIncome);
    select("dashboard-expense").textContent = window.formatRupiah(totalExpense);
    
    select("dashboard-balance-desc").textContent = `Catatan dari total ${transactionsList.length} transaksi`;
    select("dashboard-income-desc").textContent = `Pemasukan periode ${window.getIndonesianMonthName(now.getMonth())} ${now.getFullYear()}`;
    select("dashboard-expense-desc").textContent = `Pengeluaran periode ${window.getIndonesianMonthName(now.getMonth())} ${now.getFullYear()}`;

    // Render progress bar anggaran
    renderBudgetProgress(totalIncome, categoryExpenses);

    // Jalankan saran keuangan
    runFinancialAdvisor(totalIncome, totalExpense);

    // Gambar grafik
    renderChart();
  }

  function renderBudgetProgress(totalIncome, categoryExpenses) {
    const container = select("dashboard-budget-progress-list");
    container.innerHTML = "";
    
    const expenseCategories = categoriesList.filter(c => c.type === "expense" && c.allocationPercentage > 0);
    
    if (expenseCategories.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px 0;">Belum ada anggaran kategori pengeluaran yang diatur. Silakan atur di halaman Kategori.</p>`;
      return;
    }
    
    expenseCategories.forEach(cat => {
      const spent = categoryExpenses[cat.id] || 0;
      const allocated = Math.round((cat.allocationPercentage / 100) * totalIncome);
      const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      
      let barColor = "var(--aqua-color)";
      if (percent >= 100) {
        barColor = "var(--danger-color)";
      } else if (percent >= 80) {
        barColor = "var(--warning-color)";
      }
      
      const itemHtml = `
        <div class="budget-progress-container" style="margin-bottom: 20px;">
          <div class="budget-progress-labels">
            <span style="font-weight: 600;">
              <i class="fa-solid ${cat.icon || 'fa-tag'}"></i> ${cat.name} 
              <span style="color: var(--text-secondary); font-size: 11px;">(${cat.allocationPercentage}% Alokasi)</span>
            </span>
            <span style="font-weight: 500;">
              ${window.formatRupiah(spent)} / <strong style="color: var(--aqua-color);">${window.formatRupiah(allocated)}</strong> 
              <span style="color: ${barColor}; font-weight: 700; margin-left: 5px;">(${percent}%)</span>
            </span>
          </div>
          <div class="budget-progress-bar-bg">
            <div class="budget-progress-bar-fill" style="width: ${Math.min(percent, 100)}%; background-color: ${barColor};"></div>
          </div>
        </div>
      `;
      container.innerHTML += itemHtml;
    });
  }

  function runFinancialAdvisor(income, expense) {
    const statusBox = select("advisor-status-box");
    const statusText = select("advisor-status-text");
    const statusIcon = select("advisor-icon");
    const recommendationsText = select("advisor-recommendations");
    
    if (income === 0) {
      statusBox.className = "advisor-status warning";
      statusText.textContent = "Data Masih Minim";
      statusIcon.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
      recommendationsText.innerHTML = "Kami belum mencatat pemasukan apa pun di bulan ini. Silakan catat pemasukan Anda terlebih dahulu untuk mengaktifkan analisa penasehat keuangan.";
      return;
    }
    
    const expenseRatio = (expense / income) * 100;
    
    let status = "";
    let statusClass = "";
    let iconHtml = "";
    let suggestion = "";
    
    if (expenseRatio <= 30) {
      status = "Sangat Baik (Keuangan Sehat)";
      statusClass = "excellent";
      iconHtml = `<i class="fa-solid fa-face-laugh-beam"></i>`;
      suggestion = `
        Luar biasa! Pengeluaran bulanan Anda hanya <strong>${Math.round(expenseRatio)}%</strong> dari total pemasukan. 
        Anda memiliki surplus dana yang melimpah bulan ini. 
        <br><br>
        <strong>Rekomendasi tindakan:</strong>
        <ol style="margin-left: 20px; margin-top: 8px; line-height: 1.6;">
          <li>Alokasikan sisa dana ke target tabungan (Goals) Anda agar lebih cepat tercapai.</li>
          <li>Pertimbangkan untuk menyisihkan ke instrumen investasi jangka panjang.</li>
          <li>Tetap pertahankan pola konsumsi hemat yang luar biasa ini!</li>
        </ol>
      `;
    } else if (expenseRatio <= 50) {
      status = "Bagus (Terkendali)";
      statusClass = "good";
      iconHtml = `<i class="fa-solid fa-face-smile"></i>`;
      suggestion = `
        Sangat bagus! Pengeluaran Anda berada di angka <strong>${Math.round(expenseRatio)}%</strong>. 
        Ini adalah rasio ideal dalam perencanaan keuangan modern (aturan 50/30/20).
        <br><br>
        <strong>Rekomendasi tindakan:</strong>
        <ol style="margin-left: 20px; margin-top: 8px; line-height: 1.6;">
          <li>Pastikan alokasi tabungan bulanan minimal 20% sudah terpenuhi.</li>
          <li>Anda masih memiliki ruang jika ingin mengalokasikan sedikit dana tambahan untuk hiburan (maksimal 10% lagi).</li>
        </ol>
      `;
    } else if (expenseRatio <= 70) {
      status = "Waspada (Batas Aman)";
      statusClass = "warning";
      iconHtml = `<i class="fa-solid fa-face-meh"></i>`;
      suggestion = `
        Perhatian. Pengeluaran bulanan Anda telah mencapai <strong>${Math.round(expenseRatio)}%</strong> dari total pemasukan. 
        Keuangan Anda mulai mendekati batas rawan.
        <br><br>
        <strong>Rekomendasi tindakan:</strong>
        <ol style="margin-left: 20px; margin-top: 8px; line-height: 1.6;">
          <li>Batasi pengeluaran non-esensial (seperti jajan berlebih, rekreasi, belanja barang diskon) untuk sisa bulan ini.</li>
          <li>Gunakan anggaran alokasi persentase kategori di bawah untuk melacak kategori pengeluaran mana yang membengkak.</li>
        </ol>
      `;
    } else {
      status = "Bahaya / Boros (Kritis)";
      statusClass = "danger";
      iconHtml = `<i class="fa-solid fa-face-frown-open"></i>`;
      suggestion = `
        Bahaya! Pengeluaran Anda sudah mencapai <strong>${Math.round(expenseRatio)}%</strong> dari total pemasukan. 
        Anda berada di ambang defisit anggaran dan berisiko berutang jika ini berlanjut.
        <br><br>
        <strong>Rekomendasi tindakan darurat:</strong>
        <ol style="margin-left: 20px; margin-top: 8px; line-height: 1.6;">
          <li>Hentikan seluruh transaksi belanja non-primer segera.</li>
          <li>Evaluasi pengeluaran bulanan Anda dan cari pos pengeluaran tetap yang bisa dipangkas (misal: langganan bulanan yang jarang dipakai).</li>
          <li>Fokuskan sisa keuangan untuk kebutuhan primer (makan dasar dan tagihan wajib) saja.</li>
        </ol>
      `;
    }
    
    statusBox.className = `advisor-status ${statusClass}`;
    statusText.textContent = status;
    statusIcon.innerHTML = iconHtml;
    recommendationsText.innerHTML = suggestion;
  }

  function renderChart() {
    const ctx = select("balanceChart").getContext("2d");
    
    if (balanceChartInstance) {
      balanceChartInstance.destroy();
    }
    
    const monthlyData = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = {
        label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
        income: 0,
        expense: 0
      };
    }
    
    transactionsList.forEach(t => {
      if (!t.date) return;
      const transMonthKey = t.date.substring(0, 7);
      
      if (monthlyData[transMonthKey]) {
        if (t.type === "income") {
          monthlyData[transMonthKey].income += Number(t.amount);
        } else {
          monthlyData[transMonthKey].expense += Number(t.amount);
        }
      }
    });
    
    const labels = [];
    const incomes = [];
    const expenses = [];
    
    Object.keys(monthlyData).sort().forEach(key => {
      labels.push(monthlyData[key].label);
      incomes.push(monthlyData[key].income);
      expenses.push(monthlyData[key].expense);
    });
    
    const isDark = document.body.classList.contains("dark-theme");
    const textColor = isDark ? "#adbac7" : "#0d47a1";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(13, 71, 161, 0.08)";
    const labelColor = isDark ? "#f8f9fa" : "#0d47a1";

    const incomeBg = isDark ? 'rgba(41, 182, 246, 0.4)' : 'rgba(13, 71, 161, 0.5)';
    const incomeBorder = isDark ? 'rgba(41, 182, 246, 1)' : 'rgba(13, 71, 161, 1)';
    const expenseBg = isDark ? 'rgba(255, 77, 109, 0.4)' : 'rgba(229, 57, 53, 0.4)';
    const expenseBorder = isDark ? 'rgba(255, 77, 109, 1)' : 'rgba(229, 57, 53, 1)';

    balanceChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomes,
            backgroundColor: incomeBg,
            borderColor: incomeBorder,
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Pengeluaran',
            data: expenses,
            backgroundColor: expenseBg,
            borderColor: expenseBorder,
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: labelColor,
              font: { family: 'Outfit', size: 12 }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Outfit' } }
          },
          y: {
            grid: { color: gridColor },
            ticks: { 
              color: textColor, 
              font: { family: 'Outfit' },
              callback: function(value) {
                if (value >= 1000000) return 'Rp ' + (value/1000000) + 'M';
                if (value >= 1000) return 'Rp ' + (value/1000) + 'k';
                return 'Rp ' + value;
              }
            }
          }
        }
      }
    });
  }

  // Dengarkan perubahan tema untuk menggambar ulang chart
  window.addEventListener("themechanged", () => {
    if (select("balanceChart")) {
      renderChart();
    }
  });

})();
