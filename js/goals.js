// js/goals.js
// Penanganan target keuangan (goals), kalkulasi tabungan berkala, dan penambahan tabungan otomatis

(function() {
  const select = (id) => document.getElementById(id);

  let goalsList = [];
  let categoriesList = [];

  // 1. INITIALIZATION
  window.onPageLoad = async function(user) {
    await loadGoalsData(user);
    initGoalsListeners();
    renderGoals();
  };

  async function loadGoalsData(user) {
    try {
      const goalsSnapshot = await window.db.collection("goals").where("userId", "==", user.uid).get();
      goalsList = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const catSnapshot = await window.db.collection("categories").where("userId", "==", user.uid).get();
      categoriesList = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal memuat data target keuangan:", error);
    }
  }

  // 2. LISTENERS
  function initGoalsListeners() {
    select("btn-add-goal").addEventListener("click", () => openGoalModal());
    select("btn-add-goal-empty").addEventListener("click", () => openGoalModal());
    select("close-modal-goal").addEventListener("click", closeGoalModal);
    select("btn-cancel-goal").addEventListener("click", closeGoalModal);

    // Submit Goal
    select("goal-form").addEventListener("submit", handleGoalSubmit);

    // Savings Form
    select("close-modal-savings").addEventListener("click", () => select("modal-add-savings").classList.remove("active"));
    select("btn-cancel-savings").addEventListener("click", () => select("modal-add-savings").classList.remove("active"));
    select("savings-form").addEventListener("submit", handleSavingsSubmit);
  }

  // 3. LOGIKA CRUD GOALS
  function openGoalModal(editId = null) {
    const form = select("goal-form");
    form.reset();
    select("goal-alert").style.display = "none";
    
    if (editId) {
      const goal = goalsList.find(g => g.id === editId);
      if (goal) {
        select("modal-goal-title").textContent = "Edit Target Tabungan";
        select("goal-id").value = goal.id;
        select("goal-name").value = goal.name;
        select("goal-target").value = goal.targetAmount;
        select("goal-current").value = goal.currentAmount || 0;
        select("goal-date").value = goal.targetDate;
      }
    } else {
      select("modal-goal-title").textContent = "Buat Target Tabungan";
      select("goal-id").value = "";
    }
    
    select("modal-goal").classList.add("active");
  }

  function closeGoalModal() {
    select("modal-goal").classList.remove("active");
  }

  async function handleGoalSubmit(e) {
    e.preventDefault();
    select("goal-alert").style.display = "none";

    const id = select("goal-id").value;
    const name = select("goal-name").value.trim();
    const targetAmount = Number(select("goal-target").value);
    const currentAmount = Number(select("goal-current").value || 0);
    const targetDate = select("goal-date").value;

    const goalData = {
      userId: window.currentUser.uid,
      name,
      targetAmount,
      currentAmount,
      targetDate
    };

    try {
      if (id) {
        await window.db.collection("goals").doc(id).update(goalData);
        window.showGlobalAlert("Target tabungan berhasil diperbarui!");
      } else {
        goalData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await window.db.collection("goals").add(goalData);
        window.showGlobalAlert("Target tabungan baru berhasil dibuat!");
      }
      
      closeGoalModal();
      await loadGoalsData(window.currentUser);
      renderGoals();
    } catch (error) {
      console.error(error);
      const alertEl = select("goal-alert");
      alertEl.querySelector(".alert-msg").innerHTML = `Gagal menyimpan: <strong>${error.message || error}</strong>. <br><small>Pastikan Aturan Keamanan (Firestore Rules) sudah diatur di Firebase Console Anda.</small>`;
      alertEl.style.display = "flex";
    }
  }

  // 4. RENDERING GOALS CARDS & BREAKDOWN CALCULATION
  function renderGoals() {
    const gridContainer = select("goals-grid-list");
    const emptyState = select("goals-empty-state");
    gridContainer.innerHTML = "";

    if (goalsList.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    goalsList.forEach(goal => {
      const target = Number(goal.targetAmount);
      const current = Number(goal.currentAmount || 0);
      const remaining = Math.max(0, target - current);
      const percent = target > 0 ? Math.round((current / target) * 100) : 0;

      // Hitung sisa tenggang waktu (hari)
      const now = new Date();
      now.setHours(0,0,0,0);
      const deadline = new Date(goal.targetDate);
      deadline.setHours(0,0,0,0);
      
      const timeDiff = deadline.getTime() - now.getTime();
      const daysDiff = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));

      // Hitung breakdown wajib menabung berkala
      const savePerDay = remaining > 0 ? Math.ceil(remaining / daysDiff) : 0;
      const savePerWeek = remaining > 0 ? Math.ceil(remaining / (daysDiff / 7)) : 0;
      const savePerMonth = remaining > 0 ? Math.ceil(remaining / (daysDiff / 30)) : 0;

      // Status pencapaian target
      let statusBadge = `<span class="badge badge-primary" style="margin-left:auto;"><i class="fa-solid fa-hourglass-half"></i> Berjalan</span>`;
      if (percent >= 100) {
        statusBadge = `<span class="badge badge-success" style="margin-left:auto;"><i class="fa-solid fa-circle-check"></i> Tercapai</span>`;
      }

      const card = document.createElement("div");
      card.className = "goal-card glass-panel";
      card.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <h4 style="font-weight: 700; color: white; margin: 0;">${goal.name}</h4>
          ${statusBadge}
        </div>
        
        <div class="goal-target-date" style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 15px;">
          <span>Target Dana: <strong>${window.formatRupiah(target)}</strong></span>
          <span>Tenggat: <strong>${window.formatIndonesianDate(goal.targetDate)}</strong> (${daysDiff} Hari Lagi)</span>
        </div>
        
        <!-- Progress Bar -->
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
            <span>Terisi: <strong style="color: var(--aqua-color);">${window.formatRupiah(current)}</strong></span>
            <span>${percent}%</span>
          </div>
          <div class="budget-progress-bar-bg" style="height: 10px;">
            <div class="budget-progress-bar-fill" style="width: ${Math.min(percent, 100)}%; background-color: var(--aqua-color);"></div>
          </div>
        </div>
        
        <!-- Tabungan Breakdown -->
        ${percent < 100 ? `
        <div class="goal-breakdown" style="border-top: 1px dashed var(--white-glass-border); padding-top: 12px; margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 8px;">
          <div>
            <div class="breakdown-title" style="font-size: 9px; text-transform: uppercase; color: var(--text-muted);">Per Hari</div>
            <div class="breakdown-value" style="font-weight: 700; color: white; font-size: 12px; margin-top: 3px;">${window.formatRupiah(savePerDay)}</div>
          </div>
          <div>
            <div class="breakdown-title" style="font-size: 9px; text-transform: uppercase; color: var(--text-muted);">Per Minggu</div>
            <div class="breakdown-value" style="font-weight: 700; color: white; font-size: 12px; margin-top: 3px;">${window.formatRupiah(savePerWeek)}</div>
          </div>
          <div>
            <div class="breakdown-title" style="font-size: 9px; text-transform: uppercase; color: var(--text-muted);">Per Bulan</div>
            <div class="breakdown-value" style="font-weight: 700; color: var(--aqua-color); font-size: 12px; margin-top: 3px;">${window.formatRupiah(savePerMonth)}</div>
          </div>
        </div>
        ` : `<div style="text-align: center; color: var(--aqua-color); font-weight: 700; font-size: 14px; padding: 10px 0;"><i class="fa-solid fa-party-horn"></i> Hore! Target ini telah tercapai sepenuhnya!</div>`}
        
        <!-- Actions -->
        <div style="display: flex; gap: 10px; margin-top: 20px; border-top: 1px solid var(--white-glass-border); padding-top: 15px;">
          ${percent < 100 ? `
            <button class="btn btn-aqua" style="font-size: 12px; padding: 6px 12px;" onclick="openAddSavingsModal('${goal.id}')">
              <i class="fa-solid fa-piggy-bank"></i> Menabung
            </button>
          ` : ""}
          <button class="btn btn-glass" style="font-size: 12px; padding: 6px 12px; color: var(--text-secondary);" onclick="editGoal('${goal.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-glass" style="font-size: 12px; padding: 6px 12px; color: var(--danger-color); margin-left: auto;" onclick="deleteGoal('${goal.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      gridContainer.appendChild(card);
    });
  }

  // 5. PENAMBAHAN TABUNGAN (SAVINGS)
  window.openAddSavingsModal = function(goalId) {
    const goal = goalsList.find(g => g.id === goalId);
    if (!goal) return;
    
    select("savings-goal-id").value = goal.id;
    select("savings-goal-name").textContent = `Menabung untuk: ${goal.name}`;
    
    const remaining = Number(goal.targetAmount) - Number(goal.currentAmount || 0);
    select("savings-goal-remaining").textContent = `Kurang ${window.formatRupiah(remaining)} lagi untuk mencapai target.`;
    
    select("savings-amount").value = "";
    select("savings-alert").style.display = "none";
    select("modal-add-savings").classList.add("active");
  };

  async function handleSavingsSubmit(e) {
    e.preventDefault();
    select("savings-alert").style.display = "none";

    const id = select("savings-goal-id").value;
    const savingVal = Number(select("savings-amount").value);

    const goal = goalsList.find(g => g.id === id);
    if (!goal) return;

    const newCurrent = Number(goal.currentAmount || 0) + savingVal;

    try {
      // A. Update tabungan di target (goals)
      await window.db.collection("goals").doc(id).update({
        currentAmount: newCurrent
      });
      
      // B. Otomatis buat transaksi pengeluaran (kategori Tabungan/Investasi jika ada)
      const tabunganCat = categoriesList.find(c => c.name.toLowerCase() === "investasi" || c.name.toLowerCase() === "tabungan");
      const today = new Date().toISOString().substring(0, 10);
      
      await window.db.collection("transactions").add({
        userId: window.currentUser.uid,
        type: "expense",
        amount: savingVal,
        categoryId: tabunganCat ? tabunganCat.id : "savings_auto",
        categoryName: tabunganCat ? tabunganCat.name : "Tabungan Target",
        description: `Alokasi Tabungan: ${goal.name}`,
        date: today,
        note: `Autogenerasi dari menabung target "${goal.name}"`,
        receiptImage: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      select("modal-add-savings").classList.remove("active");
      window.showGlobalAlert(`Berhasil menabung ${window.formatRupiah(savingVal)} untuk "${goal.name}"!`);
      
      await loadGoalsData(window.currentUser);
      renderGoals();
    } catch (error) {
      console.error(error);
      const alertEl = select("savings-alert");
      alertEl.querySelector(".alert-msg").innerHTML = `Gagal menyimpan: <strong>${error.message || error}</strong>. <br><small>Pastikan Aturan Keamanan (Firestore Rules) sudah diatur di Firebase Console Anda.</small>`;
      alertEl.style.display = "flex";
    }
  }

  // 6. EDIT & DELETE ACTION GLOBALS (Expose ke window)
  window.editGoal = function(id) {
    openGoalModal(id);
  };

  window.deleteGoal = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus target tabungan ini?")) {
      try {
        await window.db.collection("goals").doc(id).delete();
        window.showGlobalAlert("Target tabungan berhasil dihapus!", "success");
        await loadGoalsData(window.currentUser);
        renderGoals();
      } catch (error) {
        console.error("Gagal menghapus target tabungan:", error);
        window.showGlobalAlert("Gagal menghapus target tabungan.", "error");
      }
    }
  };

})();
