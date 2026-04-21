// === ФАЙЛ: module_tests.js ===

// === УТИЛІТИ ===

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function copyInviteLinkToClipboard(url) {
  const t = String(url || "").trim();
  if (!t) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (_) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }
}

function setOpenInviteLinkElement(outEl, url, msgEl) {
  if (!outEl) return;
  const u = String(url || "").trim();
  outEl.innerHTML = "";
  if (!u) return;
  const a = document.createElement("a");
  a.href = u;
  a.textContent = u;
  a.style.cssText = "color:var(--accent);cursor:pointer;word-break:break-all;";
  a.title = "Натисніть, щоб скопіювати посилання";
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = await copyInviteLinkToClipboard(u);
    if (msgEl) {
      msgEl.textContent = ok ? "Посилання скопійовано в буфер обміну." : "Не вдалося скопіювати.";
      msgEl.style.color = ok ? "var(--grade-10)" : "var(--danger)";
    }
  });
  outEl.appendChild(a);
}

// === 1. ГОЛОВНА СТОРІНКА (СПИСОК ТЕСТІВ + РЕЗУЛЬТАТИ) ===

let currentTestsView = 'tests';

export function renderTests() {
  currentTestsView = 'tests';
  renderTestsPage();
}

export function renderTestResults() {
  currentTestsView = 'results';
  renderTestsPage();
}

export function renderTestsTelegramTab() {
  currentTestsView = 'telegram';
  renderTestsPage();
}

function renderTestsPage() {
  window.areaEl.innerHTML = `
    <h2>Керування тестами</h2>

    <div class="tests-tab-toggle">
      <button id="tests-tab-tests" class="${currentTestsView === 'tests' ? 'active' : ''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Тести
      </button>
      <button id="tests-tab-results" class="${currentTestsView === 'results' ? 'active' : ''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
        Результати
      </button>
      <button id="tests-tab-telegram" class="${currentTestsView === 'telegram' ? 'active' : ''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21.5 2L2 12l5.5 2L19 6l-8.5 6v6l3-4"/></svg>
        Telegram
      </button>
    </div>

    <div id="tests-view-container"></div>
  `;

  window.$("#tests-tab-tests").onclick = () => { currentTestsView = 'tests'; renderTestsPage(); };
  window.$("#tests-tab-results").onclick = () => { currentTestsView = 'results'; renderTestsPage(); };
  window.$("#tests-tab-telegram").onclick = () => { currentTestsView = 'telegram'; renderTestsPage(); };

  const container = window.$("#tests-view-container");
  if (currentTestsView === 'tests') {
    renderTestsListView(container);
  } else if (currentTestsView === 'results') {
    renderResultsView(container);
  } else {
    renderTelegramTestsView(container);
  }
}

async function pushTestToCloud(test) {
  await window.callCloudApi("PUT", `tests/${encodeURIComponent(test.id)}`, {
    title: test.title,
    payloadJson: test,
    publishedTelegram: test.availableInTelegram !== false,
  });
}

/** Питання з відкритою текстовою відповіддю (для оцінювання вчителем). */
function isTextQuestionType(q) {
  const t = String(q && q.type != null ? q.type : "").toLowerCase().trim();
  return t === "text" || t === "textarea" || t === "open";
}

async function postAssignmentWithAutoPushTest(body, testExternalId) {
  try {
    await window.callCloudApi("POST", "assignments", body);
  } catch (e) {
    const msg = e.message || String(e);
    const notOnCloud = /тест не знайдено|not found|404/i.test(msg);
    if (!notOnCloud) throw e;
    const test = (window.state.tests || []).find((t) => t.id === testExternalId);
    if (!test) throw e;
    await pushTestToCloud(test);
    await window.callCloudApi("POST", "assignments", body);
  }
}

async function refreshCloudRosterMapFromServer() {
  const data = await window.callCloudApi("GET", "roster");
  const byClassName = {};
  for (const c of data.classes || []) {
    const map = {};
    for (const st of c.students || []) {
      const name = st.full_name != null ? String(st.full_name).trim() : "";
      if (name) map[name] = st.id;
    }
    byClassName[c.name] = { classId: c.id, studentsByName: map };
  }
  const roster = {};
  for (const cname of window.state.classOrder || []) {
    const srv = byClassName[cname];
    if (!srv) continue;
    roster[cname] = { classId: srv.classId, students: {} };
    for (const entry of window.state.students[cname] || []) {
      const fn =
        typeof entry === "string"
          ? entry
          : entry && entry.fullName != null
            ? String(entry.fullName)
            : "";
      const key = String(fn).trim();
      if (!key) continue;
      const sid = srv.studentsByName[key];
      if (sid) roster[cname].students[key] = sid;
    }
  }
  window.state.settings.cloudRosterMap = roster;
  window.saveSettings();
  return roster;
}

async function syncRosterToCloud() {
  const classes = window.state.classOrder.map((name, idx) => ({
    name,
    sortOrder: idx,
    students: (window.state.students[name] || []).map((fullName, si) => ({
      fullName: typeof fullName === "string" ? fullName : String(fullName && fullName.fullName != null ? fullName.fullName : ""),
      sortOrder: si,
    })).filter((x) => x.fullName.trim()),
  }));
  const data = await window.callCloudApi("POST", "roster/sync", { classes });
  try {
    return await refreshCloudRosterMapFromServer();
  } catch (e) {
    window.state.settings.cloudRosterMap = data.roster;
    window.saveSettings();
    return data.roster;
  }
}

export async function syncAttemptsFromCloud() {
  const since = window.state.settings.cloudLastAttemptSync || null;
  const q = since ? `attempts?since=${encodeURIComponent(since)}` : "attempts";
  const data = await window.callCloudApi("GET", q);
  const rows = data.attempts || [];
  const existing = new Set(
    (window.state.attempts || []).filter((a) => a.cloudAttemptId).map((a) => a.cloudAttemptId)
  );
  let added = 0;
  for (const row of rows) {
    if (existing.has(row.id)) continue;
    const payload = typeof row.payload_json === "object" && row.payload_json !== null ? row.payload_json : JSON.parse(row.payload_json || "{}");
    payload.cloudAttemptId = row.id;
    payload.source = "telegram";
    if (row.test_external_id && !payload.testId) payload.testId = row.test_external_id;
    if (row.created_at) {
      const ca = new Date(row.created_at);
      if (!Number.isNaN(ca.getTime())) {
        payload.completedAtIso = ca.toISOString();
        payload.date = ca.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "medium" });
      }
    }
    window.state.attempts.push(payload);
    added++;
  }
  window.state.settings.cloudLastAttemptSync = new Date().toISOString();
  window.saveSettings();
  window.saveAttempts();
  return added;
}

function renderTelegramTestsView(container) {
  const baseUrl =
    typeof window.getCloudBaseUrl === "function" ? window.getCloudBaseUrl() : (window.state.settings?.cloudApiBaseUrl || "").trim();
  const cloudOk = !!baseUrl && (window.state.settings?.cloudApiKey || "").trim().length > 0;
  const localOn =
    window.state.settings?.telegramLocalBotEnabled &&
    (window.state.settings?.telegramBotToken || "").trim().length > 0;
  const tests = window.state.tests || [];

  container.innerHTML = `
    <div class="config-box" style="flex-direction:column;align-items:stretch;gap:8px;">
      <div style="padding:10px 12px;border-radius:var(--radius-md);background:var(--bg-light);border:1px solid var(--border-color);font-size:13px;">
        Хмара: ${cloudOk
          ? '<span style="color:var(--grade-10);font-weight:600;">налаштована</span>'
          : '<span style="color:var(--muted);">не налаштована</span>'} ·
        Локальний бот: ${localOn
          ? '<span style="color:var(--grade-10);font-weight:600;">увімкнено</span>'
          : '<span style="color:var(--muted);">вимкнено</span>'}
      </div>
      <p id="tg-sync-msg" style="margin:0;font-size:13px;color:var(--text-secondary);"></p>
    </div>

    <div class="output-box" style="margin-top:16px;">
      <div class="output-box-header">
        <h3>Призначення доступу до тесту</h3>
        <button type="button" class="btn ghost" id="tg-roster-sync-btn" ${cloudOk ? "" : "disabled"} style="min-height:36px;font-size:13px;">
          Синхронізувати класи з журналу
        </button>
      </div>
      <p id="tg-roster-hint" style="margin:0 12px 10px;font-size:13px;color:var(--text-secondary);"></p>
      <div style="padding:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div class="form-group" style="min-width:220px;">
          <label for="tg-pick-test">Тест</label>
          <select id="tg-pick-test" class="input"></select>
        </div>
        <div class="form-group" style="min-width:200px;">
          <label for="tg-pick-class">Додати клас</label>
          <select id="tg-pick-class" class="input"></select>
        </div>
        <button type="button" class="btn" id="tg-add-class-assign" ${cloudOk ? "" : "disabled"}>Додати клас</button>
        <div class="form-group" style="min-width:200px;">
          <label for="tg-pick-student">Додати учня</label>
          <select id="tg-pick-student" class="input"></select>
        </div>
        <button type="button" class="btn" id="tg-add-student-assign" ${cloudOk ? "" : "disabled"}>Додати учня</button>
      </div>
      <div id="tg-assign-list" style="padding:0 12px 12px;font-size:13px;"></div>
    </div>

    <div class="output-box" style="margin-top:16px;">
      <div class="output-box-header">
        <h3>Відкрите посилання</h3>
      </div>
      <p style="margin:0 12px 8px;font-size:13px;color:var(--text-secondary);">
        ПІБ, вік, клас учень вводить у чаті бота — без прив’язки до журналу. Оберіть тест і створіть посилання.
      </p>
      <div style="padding:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div class="form-group" style="min-width:220px;">
          <label for="tg-open-inv-test">Тест</label>
          <select id="tg-open-inv-test" class="input" style="min-width:220px;"></select>
        </div>
        <button type="button" class="btn" id="tg-open-inv-create" ${cloudOk ? "" : "disabled"}>Створити посилання</button>
      </div>
      <p id="tg-open-inv-out" style="margin:0 12px 12px;font-size:13px;word-break:break-all;color:var(--accent);"></p>
    </div>

    <div class="output-box" style="margin-top:16px;">
      <div class="output-box-header">
        <h3>Опублікувати тести в боті</h3>
      </div>
      <p style="margin:0 12px 10px;font-size:13px;color:var(--text-secondary);">
        Позначте тести та натисніть «Синхронізувати з ботом», щоб опублікувати їх у Telegram.
        Якщо зняти всі позначки і натиснути ту саму кнопку — усі тести зникнуть з бота для учнів.
      </p>
      <div style="padding:0 12px 12px;">
        <button type="button" class="btn" id="tg-bulk-push" ${cloudOk ? "" : "disabled"}>Синхронізувати з ботом</button>
      </div>
      <table class="table" id="tg-tests-table">
        <thead>
          <tr>
            <th style="width:44px;text-align:center;"><input type="checkbox" id="tg-check-all" title="Усі"></th>
            <th>Назва</th>
            <th>Клас</th>
            <th>Питань</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const msgEl = window.$("#tg-sync-msg");
  const rosterSelects = () => {
    const roster = window.state.settings.cloudRosterMap || {};
    const classSel = window.$("#tg-pick-class");
    const studSel = window.$("#tg-pick-student");
    if (classSel) classSel.innerHTML = '<option value="">— оберіть клас —</option>';
    if (studSel) studSel.innerHTML = '<option value="">— спочатку клас у «Додати клас» —</option>';
    Object.keys(roster).sort().forEach((cname) => {
      const cid = roster[cname].classId;
      if (classSel) {
        const o = document.createElement("option");
        o.value = cid;
        o.textContent = cname;
        classSel.appendChild(o);
      }
    });
  };

  const fillStudentsForClass = (classId, targetStudSel, roster) => {
    if (!targetStudSel) return;
    targetStudSel.innerHTML = '<option value="">— оберіть учня —</option>';
    const cname = Object.keys(roster).find((k) => roster[k].classId === classId);
    if (!cname || !roster[cname].students) return;
    Object.entries(roster[cname].students).forEach(([name, sid]) => {
      const o = document.createElement("option");
      o.value = sid;
      o.textContent = name;
      targetStudSel.appendChild(o);
    });
  };

  const refreshAssignmentList = async () => {
    const sel = window.$("#tg-pick-test");
    const testId = sel && sel.value;
    const box = window.$("#tg-assign-list");
    if (!testId || !box) return;
    if (!cloudOk) {
      box.textContent = "";
      return;
    }
    try {
      const data = await window.callCloudApi("GET", `assignments?testExternalId=${encodeURIComponent(testId)}`);
      const list = data.assignments || [];
      if (list.length === 0) {
        box.innerHTML = '<span style="color:var(--muted);">Немає призначень — додайте клас або учня.</span>';
        return;
      }
      box.innerHTML = list
        .map((a) => {
          const label =
            a.target_type === "class"
              ? `Клас: ${window.esc(a.class_name || "")}`
              : `Учень: ${window.esc(a.student_name || "")}`;
          return `<span style="display:inline-flex;align-items:center;gap:6px;margin:4px 8px 4px 0;padding:4px 8px;background:var(--bg-light);border-radius:var(--radius-md);">${label}
            <button type="button" class="btn" style="min-height:28px;padding:2px 8px;font-size:12px;" data-del-assign="${a.id}">×</button></span>`;
        })
        .join("");
      window.$$("[data-del-assign]", box).forEach((btn) => {
        btn.onclick = async () => {
          try {
            await window.callCloudApi("DELETE", `assignments/${btn.dataset.delAssign}`);
            await refreshAssignmentList();
          } catch (e) {
            await window.showCustomAlert("Помилка", e.message || String(e));
          }
        };
      });
    } catch (e) {
      box.textContent = "Не вдалося завантажити призначення: " + (e.message || e);
    }
  };

  const testPick = window.$("#tg-pick-test");
  if (testPick) {
    testPick.innerHTML = '<option value="">— оберіть тест —</option>';
    tests.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.title || t.id;
      testPick.appendChild(o);
    });
    testPick.onchange = () => {
      const cl = window.$("#tg-pick-class");
      if (cl && cl.value) fillStudentsForClass(cl.value, window.$("#tg-pick-student"), window.state.settings.cloudRosterMap || {});
      refreshAssignmentList();
    };
  }

  rosterSelects();
  const rosterHint = window.$("#tg-roster-hint");
  const updateRosterHint = () => {
    if (!rosterHint) return;
    const map = window.state.settings.cloudRosterMap || {};
    const n = Object.keys(map).length;
    if (!cloudOk) rosterHint.textContent = "";
    else if (n === 0) {
      rosterHint.innerHTML =
        "У хмарі ще немає списку класів. Натисніть <b>«Синхронізувати класи з журналу»</b> — інакше не вдасться обрати клас або учня для призначення.";
    } else {
      rosterHint.textContent =
        "Після змін у журналі знову натисніть «Синхронізувати класи з журналу». Тест має бути опублікований у боті (галочки нижче), інакше учні не побачать його в списку.";
    }
  };
  updateRosterHint();

  const rosterSyncBtn = window.$("#tg-roster-sync-btn");
  if (rosterSyncBtn) {
    rosterSyncBtn.onclick = async () => {
      if (!cloudOk) return;
      rosterSyncBtn.disabled = true;
      if (msgEl) {
        msgEl.textContent = "Синхронізація журналу…";
        msgEl.style.color = "var(--text-secondary)";
      }
      try {
        await syncRosterToCloud();
        rosterSelects();
        const pc2 = window.$("#tg-pick-class");
        const stud2 = window.$("#tg-pick-student");
        if (pc2 && pc2.value) fillStudentsForClass(pc2.value, stud2, window.state.settings.cloudRosterMap || {});
        updateRosterHint();
        if (msgEl) {
          msgEl.textContent = "Журнал синхронізовано з хмарою.";
          msgEl.style.color = "var(--grade-10)";
        }
      } catch (e) {
        if (msgEl) {
          msgEl.textContent = e.message || String(e);
          msgEl.style.color = "var(--danger)";
        }
        await window.showCustomAlert("Помилка", e.message || String(e));
      } finally {
        rosterSyncBtn.disabled = false;
      }
    };
  }

  const pc = window.$("#tg-pick-class");
  if (pc) {
    pc.onchange = () =>
      fillStudentsForClass(pc.value, window.$("#tg-pick-student"), window.state.settings.cloudRosterMap || {});
  }

  window.$("#tg-add-class-assign").onclick = async () => {
    const tid = testPick && testPick.value;
    const cid = pc && pc.value;
    if (!tid || !cid) {
      await window.showCustomAlert("Призначення", "Оберіть тест і клас.");
      return;
    }
    try {
      await postAssignmentWithAutoPushTest(
        {
          testExternalId: tid,
          targetType: "class",
          classId: cid,
        },
        tid
      );
      await refreshAssignmentList();
    } catch (e) {
      await window.showCustomAlert("Помилка", e.message || String(e));
    }
  };

  window.$("#tg-add-student-assign").onclick = async () => {
    const tid = testPick && testPick.value;
    const sid = window.$("#tg-pick-student") && window.$("#tg-pick-student").value;
    if (!tid || !sid) {
      await window.showCustomAlert("Призначення", "Оберіть тест, клас і учня.");
      return;
    }
    try {
      await postAssignmentWithAutoPushTest(
        {
          testExternalId: tid,
          targetType: "user",
          studentId: sid,
        },
        tid
      );
      await refreshAssignmentList();
    } catch (e) {
      await window.showCustomAlert("Помилка", e.message || String(e));
    }
  };

  if (testPick && testPick.value) refreshAssignmentList();

  const openInvSel = window.$("#tg-open-inv-test");
  if (openInvSel) {
    openInvSel.innerHTML = '<option value="">— оберіть тест —</option>';
    tests.forEach((t) => {
      const n = (t.questions || []).length;
      if (n === 0) return;
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.title || t.id;
      openInvSel.appendChild(o);
    });
  }
  const openInvBtn = window.$("#tg-open-inv-create");
  if (openInvBtn) {
    openInvBtn.onclick = async () => {
      const tid = openInvSel && openInvSel.value;
      const out = window.$("#tg-open-inv-out");
      if (!tid) {
        await window.showCustomAlert("Посилання", "Оберіть тест.");
        return;
      }
      try {
        const data = await window.callCloudApi("POST", "invites", { testExternalId: tid });
        const link = data.link || "";
        setOpenInviteLinkElement(out, link, msgEl);
        const copied = await copyInviteLinkToClipboard(link);
        if (msgEl) {
          msgEl.textContent = copied
            ? "Посилання створено та скопійовано в буфер обміну."
            : "Посилання створено. Натисніть на посилання нижче, щоб скопіювати.";
          msgEl.style.color = "var(--grade-10)";
        }
      } catch (e) {
        await window.showCustomAlert("Помилка", e.message || String(e));
      }
    };
  }

  const tbody = window.$("#tg-tests-table tbody");
  if (tests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Немає збережених тестів.</td></tr>`;
    return;
  }

  tests.forEach((t, idx) => {
    const n = (t.questions || []).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" class="tg-bulk-cb" data-test-idx="${idx}" ${n === 0 ? "disabled title=\"Додайте питання\"" : ""}>
      </td>
      <td>${window.esc(t.title)}</td>
      <td>${window.esc(t.className || "—")}</td>
      <td>${n}</td>
    `;
    tbody.appendChild(tr);
  });

  const checkAll = window.$("#tg-check-all");
  if (checkAll) {
    checkAll.onchange = () => {
      window.$$(".tg-bulk-cb:not(:disabled)", tbody).forEach((cb) => {
        cb.checked = checkAll.checked;
      });
    };
  }

  const bulkPush = window.$("#tg-bulk-push");
  if (bulkPush) {
    bulkPush.onclick = async () => {
      const selected = window.$$(".tg-bulk-cb:checked", tbody);
      if (selected.length === 0) {
        if (!cloudOk) {
          await window.showCustomAlert("Хмара", "Налаштуйте хмару в Налаштуваннях.");
          return;
        }
        const okUnpublish = await window.showCustomConfirm(
          "Синхронізація з ботом",
          "Зняти з публікації в Telegram усі тести зі списку? Учні більше не бачитимуть їх у боті.",
          "Зняти з бота",
          "Скасувати",
          true
        );
        if (!okUnpublish) return;
        msgEl.textContent = "Оновлення…";
        msgEl.style.color = "var(--text-secondary)";
        let n = 0;
        for (const test of window.state.tests) {
          if ((test.questions || []).length === 0) continue;
          try {
            test.availableInTelegram = false;
            await pushTestToCloud(test);
            n++;
          } catch (e) {
            msgEl.textContent = e.message || String(e);
            msgEl.style.color = "var(--danger)";
            window.saveTests();
            return;
          }
        }
        window.saveTests();
        window.$$(".tg-bulk-cb", tbody).forEach((cb) => {
          cb.checked = false;
        });
        if (checkAll) checkAll.checked = false;
        msgEl.textContent =
          n > 0 ? `Усі тести знято з бота (${n}).` : "Немає тестів з питаннями для оновлення.";
        msgEl.style.color = "var(--grade-10)";
        return;
      }
      msgEl.textContent = "Відправка…";
      msgEl.style.color = "var(--text-secondary)";
      let ok = 0;
      for (const cb of selected) {
        const idx = parseInt(cb.dataset.testIdx, 10);
        const test = window.state.tests[idx];
        if (!test || (test.questions || []).length === 0) continue;
        try {
          test.availableInTelegram = true;
          await pushTestToCloud(test);
          ok++;
        } catch (e) {
          msgEl.textContent = e.message || String(e);
          msgEl.style.color = "var(--danger)";
          window.saveTests();
          return;
        }
      }
      window.saveTests();
      msgEl.textContent = `Опубліковано в боті тестів: ${ok}.`;
      msgEl.style.color = "var(--grade-10)";
    };
  }
}

function renderTestsListView(container) {
  container.innerHTML = `
    <div class="config-box">
      <div class="form-group" style="min-width: 200px;">
        <label for="t-new-class-select">Клас</label>
        <select id="t-new-class-select" class="input"></select>
      </div>
      <div class="form-group" style="min-width: 200px;">
        <label for="t-new-subject-select">Предмет</label>
        <select id="t-new-subject-select" class="input"></select>
      </div>
      <div class="form-buttons-group">
        <button class="btn" id="t-create-new-btn" style="height: 38px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Створити новий тест</button>
        <button class="btn ghost" id="t-create-ai-btn" style="height: 38px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg> AI-генерація тесту</button>
      </div>
    </div>

    <div class="output-box" id="t-saved-output">
      <div class="output-box-header">
        <h3>Збережені тести</h3>
        <div class="form-group" style="min-width: 250px;">
          <label for="t-filter-input">Фільтр за назвою</label>
          <input class="input" id="t-filter-input" placeholder="Почніть вводити назву...">
        </div>
      </div>
      <table class="table" id="t-saved-table">
        <thead>
          <tr>
            <th>Назва тесту</th>
            <th>Клас</th>
            <th>Предмет</th>
            <th>Питань</th>
            <th style="width: 340px;">Дії</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  populateTestFilters(window.$("#t-new-class-select"), window.$("#t-new-subject-select"), true);
  populateSavedTestsList();

  window.$("#t-create-new-btn").onclick = () => {
    const classSel = window.$("#t-new-class-select");
    const subjectSel = window.$("#t-new-subject-select");

    const newTest = {
      id: "test_" + Date.now(),
      title: "Новий тест (без назви)",
      className: classSel.value || "",
      subjectName: subjectSel.value || "",
      shuffle: false,
      questions: [],
      availableInTelegram: true
    };

    window.state.tests.push(newTest);
    window.saveTests();
    openTestEditorTab(newTest.id);
  };

  window.$("#t-create-ai-btn").onclick = () => {
    const classSel = window.$("#t-new-class-select");
    const subjectSel = window.$("#t-new-subject-select");
    openAiTestGenerationTab({
      className: classSel?.value || "",
      subjectName: subjectSel?.value || "",
    });
  };
}

function openAiTestGenerationTab(initial = {}) {
  const tabId = "test-ai-generation";
  const tabTitle = "AI: Генерація тесту";
  window.openTab(tabId, tabTitle, () => {
    const className = initial.className || "";
    const subjectName = initial.subjectName || "";

    window.areaEl.innerHTML = `
      <div class="settings-page" style="max-width:980px;margin:0 auto;">
        <div class="export-page-header">
          <div>
            <h2 style="margin-bottom:4px;">AI-генерація тесту</h2>
            <p style="color:var(--text-secondary); margin:0;">Введіть тему, кількість питань і опції — тест буде створено у вашому стандартному форматі.</p>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-body">
            <div class="settings-form-grid" style="grid-template-columns:1fr 1fr;">
              <div class="form-group">
                <label for="ai-test-title">Назва тесту (опціонально)</label>
                <input class="input" id="ai-test-title" placeholder="Наприклад: Контрольна з теми..." value="">
              </div>
              <div class="form-group">
                <label for="ai-q-count">Кількість питань</label>
                <input class="input" id="ai-q-count" type="number" min="1" max="50" value="10">
              </div>

              <div class="form-group">
                <label for="ai-class">Клас</label>
                <select id="ai-class" class="input"></select>
              </div>
              <div class="form-group">
                <label for="ai-subject">Предмет</label>
                <select id="ai-subject" class="input"></select>
              </div>

              <div class="form-group" style="grid-column:1 / -1;">
                <label for="ai-prompt">Промпт / тема</label>
                <textarea class="input" id="ai-prompt" placeholder="Наприклад: Трикутники, теорема Піфагора, 8 клас. Додай 2 задачі на обчислення та 2 на вибір правильної відповіді." style="min-height:120px;"></textarea>
              </div>

              <div class="form-group" style="grid-column:1 / -1; margin:0;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                  <input type="checkbox" id="ai-want-images">
                  <span>Потрібні зображення (будуть додані як плейсхолдери, їх можна замінити вручну)</span>
                </label>
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center;">
              <button type="button" class="btn" id="ai-generate-btn">Згенерувати</button>
              <button type="button" class="btn ghost" id="ai-close-btn">Закрити</button>
              <span id="ai-status" style="font-size:13px;color:var(--text-secondary);"></span>
            </div>
          </div>
        </div>
      </div>
    `;

    const classSel = window.$("#ai-class");
    const subjectSel = window.$("#ai-subject");
    populateTestFilters(classSel, subjectSel, true);
    if (classSel) classSel.value = className;
    if (subjectSel) subjectSel.value = subjectName;

    const statusEl = window.$("#ai-status");
    const setStatus = (txt, ok) => {
      if (!statusEl) return;
      statusEl.textContent = txt || "";
      statusEl.style.color = ok === false ? "var(--danger)" : ok === true ? "var(--grade-10)" : "var(--text-secondary)";
    };

    window.$("#ai-close-btn").onclick = () => window.closeTab(tabId);

    window.$("#ai-generate-btn").onclick = async () => {
      const genBtn = window.$("#ai-generate-btn");
      const prompt = (window.$("#ai-prompt").value || "").trim();
      const questionCount = parseInt(window.$("#ai-q-count").value, 10) || 10;
      const wantImages = !!window.$("#ai-want-images").checked;
      const overrideTitle = (window.$("#ai-test-title").value || "").trim();

      if (!prompt) {
        await window.showCustomAlert("AI", "Введіть промпт/тему для генерації.");
        return;
      }

      setStatus("Генерація…", null);
      if (genBtn) genBtn.disabled = true;

      try {
        const res = await window.tj.aiGenerateTest({ prompt, questionCount, wantImages });
        if (res && res.error) throw new Error(res.error);
        const t = res && res.data ? res.data : null;
        if (!t || !Array.isArray(t.questions) || t.questions.length === 0) {
          throw new Error("Порожній результат генерації.");
        }

        const newTest = {
          id: "test_" + Date.now(),
          title: overrideTitle || t.title || "AI тест",
          className: classSel?.value || "",
          subjectName: subjectSel?.value || "",
          shuffle: !!t.shuffle,
          questions: t.questions,
          availableInTelegram: true
        };

        window.state.tests.push(newTest);
        window.saveTests();
        setStatus("Готово. Відкриваю редактор для перевірки…", true);
        openTestEditorTab(newTest.id);
        window.closeTab(tabId);
      } catch (e) {
        console.error("AI generation failed:", e);
        setStatus(e.message || String(e), false);
        await window.showCustomAlert("Помилка AI", e.message || String(e));
      } finally {
        if (genBtn) genBtn.disabled = false;
      }
    };
  });
}

// === РЕЗУЛЬТАТИ ТЕСТІВ ===

function attemptTimeMs(a) {
  if (a.completedAtIso) {
    const t = new Date(a.completedAtIso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function formatAttemptDisplayDate(attempt) {
  if (attempt.completedAtIso) {
    try {
      return new Date(attempt.completedAtIso).toLocaleString("uk-UA", {
        dateStyle: "short",
        timeStyle: "medium",
      });
    } catch (_) {}
  }
  return attempt.date || "—";
}

function showAttemptsChartModal(attempts, mode, title) {
  const ordered = [...attempts].sort((a, b) => attemptTimeMs(a) - attemptTimeMs(b));
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;";
  const box = document.createElement("div");
  box.style.cssText =
    "background:var(--bg-panel, #1e1e2e);border-radius:12px;padding:16px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.4);";
  const w = Math.min(720, window.innerWidth - 48);
  const h = 260;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const pad = 36;
  const pcts = ordered.map((a) =>
    a.score && a.score.maxPoints > 0 ? Math.round((a.score.earnedPoints / a.score.maxPoints) * 100) : 0
  );

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() || "#e4e4e7";
  ctx.font = "14px system-ui,sans-serif";
  ctx.fillText(title, pad, 22);

  if (pcts.length === 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("Немає даних для діаграми.", pad, 60);
  } else if (mode === "count") {
    ctx.fillStyle = ctx.fillStyle;
    ctx.font = "20px system-ui,sans-serif";
    ctx.fillText(`Усього спроб: ${pcts.length}`, pad, 80);
  } else {
    ctx.strokeStyle = "rgba(128,128,128,0.4)";
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.stroke();
    ctx.fillStyle = "#888";
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillText("0", 12, h - pad + 4);
    ctx.fillText("100", 12, pad + 4);

    const innerW = w - 2 * pad;
    const innerH = h - 2 * pad;
    let runBest = 0;
    let runWorst = 100;

    if (mode === "avg") {
      const n = pcts.length;
      const bw = Math.max(4, innerW / n - 3);
      pcts.forEach((p, i) => {
        const x = pad + (i * innerW) / n + 2;
        const bh = (p / 100) * innerH;
        ctx.fillStyle = "rgba(99,102,241,0.75)";
        ctx.fillRect(x, h - pad - bh, bw, bh);
      });
    } else if (mode === "best") {
      ctx.strokeStyle = "rgba(74,222,128,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      pcts.forEach((p, i) => {
        runBest = Math.max(runBest, p);
        const x = pad + (i / Math.max(pcts.length - 1, 1)) * innerW;
        const y = h - pad - (runBest / 100) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (mode === "worst") {
      ctx.strokeStyle = "rgba(248,113,113,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      pcts.forEach((p, i) => {
        runWorst = i === 0 ? p : Math.min(runWorst, p);
        const x = pad + (i / Math.max(pcts.length - 1, 1)) * innerW;
        const y = h - pad - (runWorst / 100) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn";
  close.textContent = "Закрити";
  close.style.marginTop = "12px";
  close.onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  box.appendChild(canvas);
  box.appendChild(close);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function renderResultsView(container) {
  const attempts = window.state.attempts || [];

  const computeStats = (list) => {
    const totalAttempts = list.length;
    let avgPercent = 0;
    let bestPercent = 0;
    let worstPercent = totalAttempts > 0 ? 100 : 0;
    list.forEach((a) => {
      const pct = a.score.maxPoints > 0 ? Math.round((a.score.earnedPoints / a.score.maxPoints) * 100) : 0;
      avgPercent += pct;
      if (pct > bestPercent) bestPercent = pct;
      if (pct < worstPercent) worstPercent = pct;
    });
    if (totalAttempts > 0) avgPercent = Math.round(avgPercent / totalAttempts);
    return { totalAttempts, avgPercent, bestPercent, worstPercent };
  };

  const initial = computeStats(attempts);
  const totalAttempts = initial.totalAttempts;
  let avgPercent = initial.avgPercent;
  let bestPercent = initial.bestPercent;
  let worstPercent = initial.worstPercent;

  container.innerHTML = `
    <div class="test-results-stats">
      <div class="test-stat-card test-stat-chart-trigger" data-res-chart="count" title="Діаграма: кількість спроб" style="cursor:pointer;">
        <div class="test-stat-icon" style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05));color:var(--accent);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>
        </div>
        <div><div class="test-stat-value" id="res-stat-count-val">${totalAttempts}</div><div class="test-stat-label">Спроб</div></div>
      </div>
      <div class="test-stat-card test-stat-chart-trigger" data-res-chart="avg" title="Діаграма: розподіл %" style="cursor:pointer;">
        <div class="test-stat-icon" style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));color:#3b82f6;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
        </div>
        <div><div class="test-stat-value" id="res-stat-avg-val">${avgPercent}%</div><div class="test-stat-label">Середній бал</div></div>
      </div>
      <div class="test-stat-card test-stat-chart-trigger" data-res-chart="best" title="Діаграма: найкращий результат у часі" style="cursor:pointer;">
        <div class="test-stat-icon" style="background:linear-gradient(135deg,rgba(74,222,128,0.15),rgba(74,222,128,0.05));color:var(--grade-10);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
        </div>
        <div><div class="test-stat-value" id="res-stat-best-val">${bestPercent}%</div><div class="test-stat-label">Найкращий</div></div>
      </div>
      <div class="test-stat-card test-stat-chart-trigger" data-res-chart="worst" title="Діаграма: найнижчий результат у часі" style="cursor:pointer;">
        <div class="test-stat-icon" style="background:linear-gradient(135deg,rgba(248,113,113,0.15),rgba(248,113,113,0.05));color:var(--grade-1);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>
        </div>
        <div><div class="test-stat-value" id="res-stat-worst-val">${worstPercent}%</div><div class="test-stat-label">Найнижчий</div></div>
      </div>
    </div>

    <p style="margin:0 0 10px;font-size:13px;color:var(--text-secondary);max-width:920px;">
      Спроби з текстовими відповідями потребують оцінювання: відкрийте рядок через «Оцінити» / «Переглянути», поставте оцінки за текст, збережіть і за потреби надішліть результат учню в Telegram.
    </p>

    <div class="config-box" style="gap: 12px;">
      <div class="form-group" style="min-width: 180px;">
        <label for="res-filter-test">Тест</label>
        <select id="res-filter-test" class="input"><option value="">-- Всі --</option></select>
      </div>
      <div class="form-group" style="min-width: 180px;">
        <label for="res-filter-student">Учень</label>
        <input id="res-filter-student" class="input" placeholder="Прізвище...">
      </div>
    </div>

    <div class="output-box">
      <table class="table" id="res-table">
        <thead>
          <tr>
            <th>Тест</th>
            <th>Учень</th>
            <th>Дата</th>
            <th class="test-stat-chart-trigger" data-res-chart="avg" title="Діаграма" style="cursor:pointer;">Бали</th>
            <th class="test-stat-chart-trigger" data-res-chart="avg" title="Діаграма %" style="cursor:pointer;">%</th>
            <th style="width: 160px;">Дії</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const testNames = [...new Set(attempts.map(a => a.testTitle))].sort();
  const filterTestSel = window.$("#res-filter-test");
  testNames.forEach(name => {
    filterTestSel.innerHTML += `<option value="${window.esc(name)}">${window.esc(name)}</option>`;
  });

  const renderResultsTable = () => {
    const tbody = window.$("#res-table tbody");
    tbody.innerHTML = "";
    const filterTest = filterTestSel.value;
    const filterStudent = (window.$("#res-filter-student").value || "").toLowerCase();

    let filtered = [...attempts];
    if (filterTest) filtered = filtered.filter(a => a.testTitle === filterTest);
    if (filterStudent) filtered = filtered.filter(a => (a.studentName || "").toLowerCase().includes(filterStudent));

    filtered.sort((a, b) => attemptTimeMs(b) - attemptTimeMs(a));

    const st = computeStats(filtered);
    const setStat = (id, v) => {
      const el = window.$(id);
      if (el) el.textContent = v;
    };
    setStat("#res-stat-count-val", String(st.totalAttempts));
    setStat("#res-stat-avg-val", st.totalAttempts ? `${st.avgPercent}%` : "0%");
    setStat("#res-stat-best-val", st.totalAttempts ? `${st.bestPercent}%` : "0%");
    setStat("#res-stat-worst-val", st.totalAttempts ? `${st.worstPercent}%` : "0%");

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);">Результатів не знайдено.</td></tr>`;
      return;
    }

    filtered.forEach((attempt, idx) => {
      const pct = attempt.score.maxPoints > 0 ? Math.round((attempt.score.earnedPoints / attempt.score.maxPoints) * 100) : 0;
      const pctColor = pct >= 75 ? 'var(--grade-10)' : pct >= 50 ? 'var(--grade-7)' : 'var(--grade-1)';
      const hasText = attemptHasTextQuestions(attempt);
      const fullyGraded = attemptIsFullyGraded(attempt);
      const needsGrading = hasText && !fullyGraded;
      const tr = document.createElement("tr");
      const dispDate = formatAttemptDisplayDate(attempt);

      const statusBadge = needsGrading
        ? '<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.15);color:#d97706;font-size:11px;font-weight:600;margin-left:4px;">Очікує оцінки</span>'
        : (hasText && fullyGraded ? '<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,0.15);color:var(--grade-10);font-size:11px;font-weight:600;margin-left:4px;">Оцінено</span>' : '');

      tr.innerHTML = `
        <td>${window.esc(attempt.testTitle)}</td>
        <td>${window.esc(attempt.studentName)}</td>
        <td style="font-size:13px;">${window.esc(dispDate)}</td>
        <td>${attempt.score.earnedPoints} / ${attempt.score.maxPoints}${statusBadge}</td>
        <td style="font-weight:700;color:${pctColor};">${pct}%</td>
        <td>
          <div class="form-buttons-group" style="gap:5px;">
            <button class="btn ${needsGrading ? '' : 'ghost'} btn-review-attempt" style="padding:6px 10px;font-size:13px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${needsGrading ? 'Оцінити' : 'Переглянути'}
            </button>
            <button class="btn danger ghost btn-del-attempt" style="padding:6px 10px;font-size:13px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Видалити
            </button>
          </div>
        </td>
      `;

      const originalIndex = attempts.indexOf(attempt);

      window.$(".btn-review-attempt", tr).onclick = () => {
        openTestReviewTab(attempt);
      };

      window.$(".btn-del-attempt", tr).onclick = async () => {
        if (await window.showCustomConfirm("Видалення", `Видалити результат "${attempt.testTitle}" для ${attempt.studentName}?`, "Видалити", "Скасувати", true)) {
          window.state.attempts.splice(originalIndex, 1);
          window.saveAttempts();
          renderTestsPage();
        }
      };

      tbody.appendChild(tr);
    });

    const chartTitles = {
      count: "Кількість спроб (з урахуванням фільтра)",
      avg: "Відсотки за спробами (фільтр)",
      best: "Найкращий результат у часі (фільтр)",
      worst: "Найнижчий результат у часі (фільтр)",
    };
    window.$$(".test-stat-chart-trigger", container).forEach((el) => {
      el.onclick = (ev) => {
        ev.stopPropagation();
        const mode = el.dataset.resChart || "avg";
        showAttemptsChartModal(filtered, mode, chartTitles[mode] || chartTitles.avg);
      };
    });
  };

  filterTestSel.onchange = renderResultsTable;
  window.$("#res-filter-student").oninput = window.debounce(renderResultsTable, 300);
  renderResultsTable();
}


// === СПИСОК ТЕСТІВ ===

function openTestStudentPreview(test) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.55);overflow:auto;padding:20px;";
  const box = document.createElement("div");
  box.style.cssText =
    "max-width:720px;margin:0 auto;background:var(--bg-panel, #1e1e2e);border-radius:12px;padding:20px;border:1px solid var(--border-color);";
  const title = window.esc(test.title || "Тест");
  const qs = test.questions || [];
  let blocks = "";
  qs.forEach((q, qi) => {
    const typ =
      q.type === "radio"
        ? "Один варіант"
        : q.type === "check"
          ? "Декілька варіантів"
          : q.type === "text"
            ? "Текст"
            : q.type === "matching"
              ? "Відповідність"
              : window.esc(q.type || "");
    blocks += `<div style="margin:14px 0;padding:12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-light);">`;
    blocks += `<div style="font-weight:600;margin-bottom:8px;">Питання ${qi + 1} · ${typ}</div>`;
    blocks += `<div style="margin-bottom:8px;line-height:1.4;">${window.esc(q.text || "")}</div>`;
    if (q.image) {
      blocks += `<img src="${q.image}" alt="" style="max-width:100%;max-height:220px;border-radius:6px;margin-bottom:8px;">`;
    }
    if (q.type === "radio" || q.type === "check") {
      (q.options || []).forEach((o, oi) => {
        blocks += `<div style="padding:6px 10px;margin:4px 0;border-radius:6px;background:var(--bg-panel);font-size:14px;">${oi + 1}. ${window.esc((o && o.text) || "—")}</div>`;
      });
    } else if (q.type === "text") {
      blocks += `<p style="margin:0;font-size:13px;color:var(--muted);">У боті учень надсилає відповідь текстом.</p>`;
    } else if (q.type === "matching") {
      (q.pairs || []).forEach((p) => {
        blocks += `<div style="margin:6px 0;font-size:14px;">${window.esc(p.left || "")} → <span style="color:var(--muted);">…</span></div>`;
      });
    }
    blocks += `</div>`;
  });
  box.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:18px;">${title}</h2>
    <p style="margin:0 0 16px;font-size:13px;color:var(--muted);">Перегляд як у учня в Telegram (без перемішування та без оцінювання).</p>
    ${blocks || '<p style="color:var(--muted);">Немає питань.</p>'}
    <button type="button" class="btn" id="test-student-preview-close" style="margin-top:16px;">Закрити</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  window.$("#test-student-preview-close", overlay).onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}

function populateSavedTestsList() {
  const tbody = window.$("#t-saved-table tbody");
  const filterInput = window.$("#t-filter-input");
  if (!tbody) return;

  const render = () => {
    const filterText = (filterInput?.value || "").toLowerCase();
    tbody.innerHTML = "";
    const sortedTests = [...window.state.tests].sort((a, b) => (b.title || "").localeCompare(a.title));
    let itemsRendered = 0;

    sortedTests.forEach(test => {
      if (filterText && !(test.title || "").toLowerCase().includes(filterText)) return;

      itemsRendered++;
      const tr = document.createElement("tr");
      tr.dataset.id = test.id;
      tr.innerHTML = `
        <td>${window.esc(test.title)}</td>
        <td>${window.esc(test.className) || "<i>(всі)</i>"}</td>
        <td>${window.esc(test.subjectName) || "<i>(всі)</i>"}</td>
        <td>${(test.questions || []).length}</td>
        <td>
          <div class="form-buttons-group" style="gap: 5px; flex-wrap: wrap;">
            <button class="btn ghost btn-preview-test" style="padding: 6px 10px; font-size: 13px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Перегляд</button>
            <button class="btn ghost btn-edit-test" style="padding: 6px 10px; font-size: 13px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Редагувати</button>
            <button class="btn ghost btn-dup-test" style="padding: 6px 10px; font-size: 13px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Дублювати</button>
            <button class="btn danger btn-del-test" style="padding: 6px 10px; font-size: 13px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Видалити</button>
          </div>
        </td>
      `;

      window.$(".btn-preview-test", tr).onclick = () => openTestStudentPreview(test);

      window.$(".btn-edit-test", tr).onclick = () => openTestEditorTab(test.id);

      window.$(".btn-dup-test", tr).onclick = () => {
        const copy = JSON.parse(JSON.stringify(test));
        copy.id = "test_" + Date.now();
        copy.title = (test.title || "Тест") + " (копія)";
        window.state.tests.push(copy);
        window.saveTests();
        render();
      };

      window.$(".btn-del-test", tr).onclick = async () => {
        if (await window.showCustomConfirm("Видалення", `Видалити тест "${test.title}"?`, "Видалити", "Скасувати", true)) {
          window.state.tests = window.state.tests.filter(t => t.id !== test.id);
          window.saveTests();
          render();
        }
      };

      tbody.appendChild(tr);
    });

    if (itemsRendered === 0) {
      const filterText = (filterInput?.value || "").toLowerCase();
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted);">
        ${filterText ? 'Тестів за фільтром не знайдено.' : 'Збережених тестів немає.'}
      </td></tr>`;
    }
  };

  if (filterInput) filterInput.oninput = window.debounce(render, 300);
  render();
}

function populateTestFilters(classSelect, subjectSelect, allowAll = false) {
  if (classSelect) {
    classSelect.innerHTML = allowAll ? "<option value=''>-- Всі класи --</option>" : "";
    Object.keys(window.state.students).sort().forEach(className => {
      classSelect.innerHTML += `<option value="${window.esc(className)}">${window.esc(className)}</option>`;
    });
  }
  if (subjectSelect) {
    subjectSelect.innerHTML = allowAll ? "<option value=''>-- Всі предмети --</option>" : "";
    window.state.subjects.sort().forEach(subjectName => {
      subjectSelect.innerHTML += `<option value="${window.esc(subjectName)}">${window.esc(subjectName)}</option>`;
    });
  }
}


// === 2. РЕДАКТОР ТЕСТУ ===

export function openTestEditorTab(testId) {
  const testIndex = window.state.tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    window.showCustomAlert("Помилка", "Тест не знайдено.");
    return;
  }

  let testDraft = JSON.parse(JSON.stringify(window.state.tests[testIndex]));
  if (testDraft.shuffle === undefined) testDraft.shuffle = false;

  const tabId = "test-edit-" + testId;
  const tabTitle = `Тест: ${testDraft.title.substring(0, 20)}...`;

  window.openTab(tabId, tabTitle, () => {
    window.areaEl.innerHTML = `
      <div class="config-box tests-config-box">
        <div class="form-group" style="flex: 1; min-width: 300px;">
          <label for="t-title">Назва тесту</label>
          <input class="input" id="t-title" placeholder="Введіть назву тесту..." value="${window.esc(testDraft.title === 'Новий тест (без назви)' ? '' : testDraft.title)}">
        </div>
        <div class="form-group">
          <label for="t-class-select">Клас</label>
          <select id="t-class-select" class="input" style="width: 200px;"></select>
        </div>
        <div class="form-group">
          <label for="t-subject-select">Предмет</label>
          <select id="t-subject-select" class="input" style="width: 200px;"></select>
        </div>
        <label class="toggle-switch" style="align-self:flex-end;margin-bottom:6px;">
          <input type="checkbox" id="t-shuffle" ${testDraft.shuffle ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span class="toggle-label">Перемішувати</span>
        </label>
        <div class="form-buttons-group" id="t-form-buttons">
          <button class="btn" id="t-addq"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Питання</button>
          <button class="btn" id="t-save"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти і Закрити</button>
        </div>
      </div>

      <div class="test-creator-box" id="t-questions-box"
           style="max-height: none; height: calc(100% - 120px); background: var(--bg);">
      </div>
    `;

    const titleInput = window.$("#t-title");
    const classSel = window.$("#t-class-select");
    const subjectSel = window.$("#t-subject-select");
    const shuffleCheck = window.$("#t-shuffle");
    const questionsBox = window.$("#t-questions-box");

    populateTestFilters(classSel, subjectSel, true);
    classSel.value = testDraft.className || "";
    subjectSel.value = testDraft.subjectName || "";

    renderTestCreatorQuestions(testDraft, questionsBox);

    titleInput.oninput = () => {
      let val = titleInput.value.trim();
      testDraft.title = val === "" ? "Новий тест (без назви)" : val;
    };
    classSel.onchange = () => testDraft.className = classSel.value;
    subjectSel.onchange = () => testDraft.subjectName = subjectSel.value;
    shuffleCheck.onchange = () => testDraft.shuffle = shuffleCheck.checked;

    window.$("#t-addq").onclick = () => {
      testDraft.questions.push({
        type: 'radio',
        text: '',
        image: null,
        options: [
          { text: '', correct: true },
          { text: '', correct: false }
        ],
        points: 1
      });
      renderTestCreatorQuestions(testDraft, questionsBox);
      questionsBox.scrollTop = questionsBox.scrollHeight;
    };

    window.$("#t-save").onclick = async () => {
      const originalTestIndex = window.state.tests.findIndex(t => t.id === testId);
      if (originalTestIndex > -1) {
        window.state.tests[originalTestIndex] = testDraft;
      } else {
        window.state.tests.push(testDraft);
      }

      await window.saveTests();
      await window.showCustomAlert("Збережено", `Тест "${testDraft.title}" оновлено.`);

      window.closeTab(tabId);

      if (window.active === 'tests') {
        window.renderTests();
      }
    };
  });
}

function renderTestCreatorQuestions(testDraft, questionsBox) {
  questionsBox.innerHTML = "";

  if (testDraft.questions.length === 0) {
    questionsBox.innerHTML = `<p style="text-align: center; color: var(--muted); padding-top: 20px;">Натисніть "+ Питання", щоб додати перше питання.</p>`;
    return;
  }

  testDraft.questions.forEach((q, qi) => {
    const qBlock = document.createElement("div");
    qBlock.className = "question-block";
    qBlock.style.background = "var(--bg-light)";

    let optionsHTML = "";
    const types = [
      { val: 'radio', label: 'Один варіант' },
      ...(q.type === 'check' ? [{ val: 'check', label: 'Декілька варіантів (застаріле)' }] : []),
      { val: 'text', label: 'Текстова відповідь' },
      { val: 'matching', label: 'Відповідність' }
    ];

    types.forEach(t => {
      optionsHTML += `<option value="${t.val}" ${q.type === t.val ? 'selected' : ''}>${t.label}</option>`;
    });

    const imagePreviewHTML = q.image ? `
      <div style="position: relative; margin-top: 8px;">
        <img src="${q.image}" style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid var(--border-color); cursor: zoom-in;">
        <button class="btn danger" data-action="delete-image" style="position: absolute; top: 4px; right: 4px; padding: 2px 6px;">✕</button>
      </div>
    ` : '';

    const showOptions = q.type === 'radio' || q.type === 'check';
    const showMatching = q.type === 'matching';

    qBlock.innerHTML = `
      <div class="question-header">
        <h4 style="margin: 0; min-width: 90px;">Питання #${qi + 1}</h4>

        <textarea class="input q-text-input" placeholder="Введіть текст питання сюди..."
                  style="width: 250px; min-width: 250px; height: 36px;">${window.esc(q.text || "")}</textarea>

        <div class="form-group" style="max-width: 180px;">
          <label>Тип питання</label>
          <select class="input q-type-select">${optionsHTML}</select>
        </div>

        <div class="form-group" style="width: 70px;">
          <label for="q-points-${qi}">Бали</label>
          <input type="number" id="q-points-${qi}" min="1" class="input points-input q-points-input" value="${q.points || 1}" style="padding: 8px 4px; text-align: center;">
        </div>

        <button class="btn ghost" data-action="add-image" title="Додати зображення">🖼️</button>
        <button class="btn danger" data-action="delete-q" title="Видалити питання">Видалити</button>
      </div>

      ${imagePreviewHTML}

      <div class="options-list" style="display: ${showOptions ? 'block' : 'none'};"></div>
      <button class="btn ghost" data-action="add-option" style="margin-left: 28px; margin-top: 8px; display: ${showOptions ? 'block' : 'none'};">
        + Додати варіант
      </button>

      <div class="matching-editor-area" style="display: ${showMatching ? 'block' : 'none'}; margin-top: 8px;"></div>
      <button class="btn ghost" data-action="add-pair" style="margin-left: 28px; margin-top: 8px; display: ${showMatching ? 'block' : 'none'};">
        + Додати пару
      </button>
    `;

    // Render radio/check options
    const optionsList = window.$(".options-list", qBlock);
    if (showOptions) {
      (q.options || []).forEach((opt, opti) => {
        const optRow = document.createElement("div");
        optRow.className = "option-row";
        optRow.style.display = "flex";
        optRow.style.gap = "6px";
        optRow.style.alignItems = "center";

        const inputType = q.type === 'radio' ? 'radio' : 'checkbox';

        optRow.innerHTML = `
          <label style="display: flex; flex: 1; align-items: center; gap: 4px;">
            <input type="${inputType}" name="q-correct-${qi}" ${opt.correct ? 'checked' : ''} data-opt-index="${opti}">
            <input type="text" class="input opt-text-input" placeholder="Введіть текст варіанту..." value="${window.esc(opt.text || "")}" style="width: 100%;">
          </label>
          <button class="btn danger ghost" data-action="delete-opt" data-opt-index="${opti}" style="min-width: 32px; padding: 4px 8px;">✕</button>
        `;

        window.$(".opt-text-input", optRow).oninput = (e) => {
          testDraft.questions[qi].options[opti].text = e.target.value;
        };
        window.$(`input[type="${inputType}"]`, optRow).onchange = () => {
          if (q.type === 'radio') {
            testDraft.questions[qi].options.forEach((o, i) => o.correct = (i === opti));
          } else {
            testDraft.questions[qi].options[opti].correct = !testDraft.questions[qi].options[opti].correct;
          }
        };

        optionsList.appendChild(optRow);
      });
    }

    // Render matching pairs
    if (showMatching) {
      const matchArea = window.$(".matching-editor-area", qBlock);
      if (!q.pairs) q.pairs = [];
      q.pairs.forEach((pair, pi) => {
        const pairRow = document.createElement("div");
        pairRow.className = "matching-pair-editor";
        pairRow.innerHTML = `
          <input type="text" class="input pair-left" placeholder="Ліва частина..." value="${window.esc(pair.left || "")}">
          <span style="color:var(--muted);font-size:18px;">↔</span>
          <input type="text" class="input pair-right" placeholder="Права частина..." value="${window.esc(pair.right || "")}">
          <button class="btn danger ghost" data-action="delete-pair" data-pair-index="${pi}" style="min-width:32px;padding:4px 8px;">✕</button>
        `;
        window.$(".pair-left", pairRow).oninput = (e) => { testDraft.questions[qi].pairs[pi].left = e.target.value; };
        window.$(".pair-right", pairRow).oninput = (e) => { testDraft.questions[qi].pairs[pi].right = e.target.value; };
        window.$('[data-action="delete-pair"]', pairRow).onclick = () => {
          testDraft.questions[qi].pairs.splice(pi, 1);
          renderTestCreatorQuestions(testDraft, questionsBox);
        };
        matchArea.appendChild(pairRow);
      });
    }

    // Question-level event handlers
    window.$(".q-type-select", qBlock).onchange = (e) => {
      const newType = e.target.value;
      testDraft.questions[qi].type = newType;
      if (newType === 'matching' && !testDraft.questions[qi].pairs) {
        testDraft.questions[qi].pairs = [{ left: '', right: '' }, { left: '', right: '' }];
      }
      if (newType === 'radio' && (testDraft.questions[qi].options || []).length > 0) {
        testDraft.questions[qi].options.forEach((o, i) => o.correct = (i === 0));
      } else if (newType === 'check') {
        (testDraft.questions[qi].options || []).forEach(o => o.correct = false);
      }
      renderTestCreatorQuestions(testDraft, questionsBox);
    };

    window.$(".q-text-input", qBlock).oninput = (e) => { testDraft.questions[qi].text = e.target.value; };
    window.$(".q-points-input", qBlock).oninput = (e) => { testDraft.questions[qi].points = parseInt(e.target.value, 10) || 1; };

    window.$('[data-action="add-image"]', qBlock).onclick = async () => {
      const dataUrl = await window.tj.readFileAsDataUrl();
      if (dataUrl && dataUrl.error) { window.showCustomAlert("Помилка", dataUrl.error); return; }
      if (dataUrl) {
        testDraft.questions[qi].image = dataUrl;
        renderTestCreatorQuestions(testDraft, questionsBox);
      }
    };

    const delImgBtn = window.$('[data-action="delete-image"]', qBlock);
    if (delImgBtn) {
      delImgBtn.onclick = () => { testDraft.questions[qi].image = null; renderTestCreatorQuestions(testDraft, questionsBox); };
      window.$('img', qBlock).onclick = () => { window.previewImage(q.image); };
    }

    window.$('[data-action="delete-q"]', qBlock).onclick = () => {
      testDraft.questions.splice(qi, 1);
      renderTestCreatorQuestions(testDraft, questionsBox);
    };

    const addOptBtn = window.$('[data-action="add-option"]', qBlock);
    if (addOptBtn) {
      addOptBtn.onclick = () => {
        if (!testDraft.questions[qi].options) testDraft.questions[qi].options = [];
        testDraft.questions[qi].options.push({ text: '', correct: false });
        renderTestCreatorQuestions(testDraft, questionsBox);
      };
    }

    const addPairBtn = window.$('[data-action="add-pair"]', qBlock);
    if (addPairBtn) {
      addPairBtn.onclick = () => {
        if (!testDraft.questions[qi].pairs) testDraft.questions[qi].pairs = [];
        testDraft.questions[qi].pairs.push({ left: '', right: '' });
        renderTestCreatorQuestions(testDraft, questionsBox);
      };
    }

    qBlock.onclick = (e) => {
      if (e.target.dataset.action === 'delete-opt') {
        const optIndex = parseInt(e.target.dataset.optIndex, 10);
        testDraft.questions[qi].options.splice(optIndex, 1);
        renderTestCreatorQuestions(testDraft, questionsBox);
      }
    };

    questionsBox.appendChild(qBlock);
  });
}


// === 3. ЗАПУСК ТЕСТУ ===

export function renderRunTest(testId, studentName, timeLimitInMinutes = 0) {
  const originalTest = window.state.tests.find(t => t.id === testId);
  if (!originalTest) return;

  const test = JSON.parse(JSON.stringify(originalTest));

  let questionMap = test.questions.map((_, i) => i);
  let optionMaps = {};

  if (test.shuffle) {
    questionMap = shuffleArray(questionMap);
    const shuffledQuestions = questionMap.map(i => {
      const q = JSON.parse(JSON.stringify(test.questions[i]));
      if (q.type === 'radio' || q.type === 'check') {
        const optMap = shuffleArray(q.options.map((_, oi) => oi));
        optionMaps[i] = optMap;
        q.options = optMap.map(oi => test.questions[i].options[oi]);
      }
      if (q.type === 'matching') {
        // pairs stay, right side is always shuffled during rendering
      }
      return q;
    });
    test.questions = shuffledQuestions;
  }

  const tabId = `test-run-${testId}-${studentName.replace(/ /g, '_')}`;
  const tabTitle = `Тест: ${studentName.split(' ')[0]}...`;

  const timerDuration = (timeLimitInMinutes || 0) * 60;

  let timerState = window.activeTimers[tabId];
  if (!timerState && timerDuration > 0) {
    timerState = { intervalId: null, timeLeft: timerDuration, timerDuration: timerDuration };
    window.activeTimers[tabId] = timerState;
  }

  window.openTab(tabId, tabTitle, () => {
    let timerState = window.activeTimers[tabId];
    if (timerState && timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }

    const totalQ = test.questions.length;

    // Build questions HTML
    let questionsHTML = "";
    test.questions.forEach((q, qi) => {
      questionsHTML += `<div class="question-block" id="run-q-${qi}" style="background: var(--bg-light); margin-bottom: 16px; padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">`;
      questionsHTML += `<div class="question-text" style="font-size: 1.1em; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">`;
      questionsHTML += `<b>Питання ${qi + 1}:</b> ${window.esc(q.text)}`;
      questionsHTML += `</div>`;

      if (q.image) {
        questionsHTML += `<img src="${q.image}" data-preview-image="${qi}" style="max-width: 400px; max-height: 300px; border-radius: 4px; margin-bottom: 12px; cursor: zoom-in; border: 1px solid var(--border-color);">`;
      }

      questionsHTML += `<div class="options-list" style="display: flex; flex-direction: column; gap: 8px;">`;
      if (q.type === 'radio' || q.type === 'check') {
        q.options.forEach((opt, opti) => {
          const inputType = q.type === 'radio' ? 'radio' : 'checkbox';
          questionsHTML += `
            <label class="test-option-label">
              <input type="${inputType}" name="q-${qi}" value="${opti}" data-q-index="${qi}">
              <span>${window.esc(opt.text)}</span>
            </label>
          `;
        });
      } else if (q.type === 'text') {
        questionsHTML += `<textarea class="input" data-q-index="${qi}" placeholder="Введіть вашу відповідь..." style="min-height: 100px;"></textarea>`;
      } else if (q.type === 'matching') {
        const pairs = q.pairs || [];
        const rightShuffled = shuffleArray(pairs.map(p => p.right));
        questionsHTML += `<div class="matching-grid">`;
        pairs.forEach((pair, pi) => {
          questionsHTML += `
            <div class="matching-pair">
              <div class="matching-left">${window.esc(pair.left)}</div>
              <span class="matching-arrow">→</span>
              <div class="matching-right">
                <select class="input" data-q-index="${qi}" data-pair-index="${pi}">
                  <option value="">-- Оберіть --</option>
                  ${rightShuffled.map(r => `<option value="${window.esc(r)}">${window.esc(r)}</option>`).join('')}
                </select>
              </div>
            </div>
          `;
        });
        questionsHTML += `</div>`;
      }
      questionsHTML += `</div></div>`;
    });

    // Build question navigation
    let navHTML = "";
    for (let i = 0; i < totalQ; i++) {
      navHTML += `<button class="question-nav-item" data-nav-q="${i}">${i + 1}</button>`;
    }

    window.areaEl.innerHTML = `
      <style>
        .test-run-layout { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
        .test-run-content { flex: 1; overflow-y: auto; padding: 16px; }
        .test-run-header, .test-run-footer { flex-shrink: 0; background: var(--panel); padding: 12px 16px; }
        .test-run-header { border-bottom: 1px solid var(--border-color); }
        .test-run-footer { border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .test-option-label { display: flex; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: background-color 0.1s, border-color 0.1s; }
        .test-option-label:hover { background: var(--bg); border-color: var(--accent); }
        .test-option-label input { margin-right: 12px; transform: scale(1.2); accent-color: var(--accent); }
        .test-option-label input:checked + span { color: var(--accent); font-weight: 600; }
      </style>

      <div class="test-run-layout">
        <div class="test-run-header">
          <h3>Тест: ${window.esc(test.title)}</h3>
          <p style="margin: 0; color: var(--muted);"><b>Учень:</b> ${window.esc(studentName)}</p>
        </div>

        ${timerDuration > 0 ? `
          <div class="test-timer-bar">
            <div class="test-timer-progress g-100" id="test-timer-progress"></div>
            <div class="test-timer-text" id="test-timer-text">Завантаження...</div>
          </div>
        ` : ''}

        <div class="question-nav" id="question-nav-bar">${navHTML}</div>

        <div class="test-run-content" id="test-questions-area">
          ${questionsHTML}
        </div>

        <div class="test-run-footer" id="test-run-footer-area">
          <div class="test-progress-text" id="test-progress-text">Відповіли на <strong>0</strong> з ${totalQ} питань</div>
          <button class="btn" id="test-finish-btn" style="min-width: 200px; height: 40px;">Завершити тест</button>
        </div>
      </div>
    `;

    const questionsArea = window.$("#test-questions-area");
    const footerArea = window.$("#test-run-footer-area");
    const progressText = window.$("#test-progress-text");
    const navBar = window.$("#question-nav-bar");

    // Progress & Nav update
    const updateProgressAndNav = () => {
      let answered = 0;
      test.questions.forEach((q, qi) => {
        const navItem = window.$(`.question-nav-item[data-nav-q="${qi}"]`, navBar);
        let hasAnswer = false;

        if (q.type === 'radio') {
          hasAnswer = !!window.$(`input[name="q-${qi}"]:checked`, questionsArea);
        } else if (q.type === 'check') {
          hasAnswer = window.$$(`input[name="q-${qi}"]:checked`, questionsArea).length > 0;
        } else if (q.type === 'text') {
          const ta = window.$(`textarea[data-q-index="${qi}"]`, questionsArea);
          hasAnswer = ta && ta.value.trim().length > 0;
        } else if (q.type === 'matching') {
          const selects = window.$$(`select[data-q-index="${qi}"]`, questionsArea);
          hasAnswer = selects.length > 0 && selects.every(s => s.value !== '');
        }

        if (hasAnswer) {
          answered++;
          if (navItem) navItem.classList.add('answered');
        } else {
          if (navItem) navItem.classList.remove('answered');
        }
      });
      if (progressText) progressText.innerHTML = `Відповіли на <strong>${answered}</strong> з ${totalQ} питань`;
    };

    // Event delegation for answers
    questionsArea.addEventListener("change", updateProgressAndNav);
    questionsArea.addEventListener("input", updateProgressAndNav);
    updateProgressAndNav();

    // Navigation clicks
    navBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".question-nav-item");
      if (!btn) return;
      const qi = parseInt(btn.dataset.navQ, 10);
      const target = window.$(`#run-q-${qi}`, questionsArea);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Scroll observer for current question highlight
    const observeScroll = () => {
      const blocks = window.$$(".question-block", questionsArea);
      let currentIdx = 0;
      const scrollTop = questionsArea.scrollTop;
      blocks.forEach((block, idx) => {
        if (block.offsetTop - questionsArea.offsetTop <= scrollTop + 60) currentIdx = idx;
      });
      window.$$(".question-nav-item", navBar).forEach((item, idx) => {
        item.classList.toggle('current', idx === currentIdx);
      });
    };
    questionsArea.addEventListener("scroll", observeScroll);
    observeScroll();

    // Image preview delegation
    questionsArea.addEventListener("click", (e) => {
      const img = e.target.closest("[data-preview-image]");
      if (img) {
        const qi = parseInt(img.dataset.previewImage, 10);
        if (test.questions[qi]?.image) window.previewImage(test.questions[qi].image);
      }
    });

    // Timer logic
    let updateTimer = null;
    if (timerDuration > 0) {
      const timerTextEl = window.$("#test-timer-text");
      const timerProgressEl = window.$("#test-timer-progress");

      let localIntervalId = null;

      updateTimer = async () => {
        let currentState = window.activeTimers[tabId];
        if (!currentState) { clearInterval(localIntervalId); return; }

        currentState.timeLeft--;

        if (currentState.timeLeft < 0) {
          clearInterval(localIntervalId);
          currentState.intervalId = null;

          timerTextEl.textContent = "Час вийшов!";
          timerProgressEl.style.width = `0%`;
          timerProgressEl.className = "test-timer-progress g-25";

          window.$$("input, textarea, select", questionsArea).forEach(inp => inp.disabled = true);

          if (footerArea && !window.$("#add-time-btn")) {
            const addTimeBtn = document.createElement("button");
            addTimeBtn.className = "btn ghost";
            addTimeBtn.id = "add-time-btn";
            addTimeBtn.textContent = "Дати більше часу";
            footerArea.prepend(addTimeBtn);

            addTimeBtn.onclick = async () => {
              const password = window.state.settings?.teacherPassword;
              if (!password) {
                await window.showCustomAlert("Помилка", "Пароль вчителя не встановлено в Налаштуваннях.");
                return;
              }
              const success = await window.showPasswordPrompt("Підтвердження", password);
              if (success) {
                window.$$("input, textarea, select", questionsArea).forEach(inp => inp.disabled = false);
                const timerBar = window.$(".test-timer-bar");
                if (timerBar) timerBar.remove();
                addTimeBtn.remove();
                delete window.activeTimers[tabId];
                await window.showCustomAlert("Тест розблоковано", "Тест розблоковано. Таймер вимкнено.");
              }
            };
          }
          return;
        }

        const minutes = Math.floor(currentState.timeLeft / 60);
        const seconds = currentState.timeLeft % 60;
        timerTextEl.textContent = `Залишилось часу: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const percent = (currentState.timeLeft / currentState.timerDuration) * 100;
        timerProgressEl.style.width = `${percent}%`;
        timerProgressEl.className = "test-timer-progress " + (percent > 75 ? 'g-100' : percent > 50 ? 'g-75' : percent > 25 ? 'g-50' : 'g-25');
      };

      const minutes = Math.floor(timerState.timeLeft / 60);
      const seconds = timerState.timeLeft % 60;
      timerTextEl.textContent = `Залишилось часу: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const percent = (timerState.timeLeft / timerState.timerDuration) * 100;
      timerProgressEl.style.width = `${percent}%`;
      timerProgressEl.className = "test-timer-progress " + (percent > 75 ? 'g-100' : percent > 50 ? 'g-75' : percent > 25 ? 'g-50' : 'g-25');

      if (timerState.timeLeft > 0) {
        localIntervalId = setInterval(updateTimer, 1000);
        timerState.intervalId = localIntervalId;
      } else {
        updateTimer();
      }
    } else {
      const header = window.$(".test-run-header");
      if (header) header.style.marginBottom = "0";
    }

    // Finish button
    window.$("#test-finish-btn").onclick = async () => {
      let timerState = window.activeTimers[tabId];
      if (timerState && timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
      }

      const confirmed = await window.showCustomConfirm("Завершення", "Ви впевнені, що хочете завершити тест?", "Завершити", "Ні", false);
      if (!confirmed) {
        if (timerState && timerState.timeLeft > 0 && updateTimer) {
          const newIntervalId = setInterval(updateTimer, 1000);
          timerState.intervalId = newIntervalId;
        }
        return;
      }

      // Collect answers
      const answers = {};
      test.questions.forEach((q, qi) => {
        if (q.type === 'radio') {
          const checked = window.$(`input[name="q-${qi}"]:checked`, questionsArea);
          answers[qi] = checked ? parseInt(checked.value, 10) : null;
        } else if (q.type === 'check') {
          answers[qi] = [];
          window.$$(`input[name="q-${qi}"]:checked`, questionsArea).forEach(chk => {
            answers[qi].push(parseInt(chk.value, 10));
          });
        } else if (q.type === 'text') {
          const textarea = window.$(`textarea[data-q-index="${qi}"]`, questionsArea);
          answers[qi] = textarea ? textarea.value : "";
        } else if (q.type === 'matching') {
          const selects = window.$$(`select[data-q-index="${qi}"]`, questionsArea);
          answers[qi] = selects.map(s => s.value);
        }
      });

      processTestResults(test, originalTest, studentName, answers, tabId, questionMap, optionMaps);
    };
  });
}


// === 4. ОБРОБКА РЕЗУЛЬТАТІВ ===

async function processTestResults(runTest, originalTest, studentName, answers, tabId, questionMap, optionMaps) {
  const score = calcScore(runTest, answers, {});
  const completedAt = new Date();

  const attempt = {
    testId: originalTest.id,
    testTitle: originalTest.title,
    studentName: studentName,
    date: completedAt.toLocaleString("uk-UA"),
    completedAtIso: completedAt.toISOString(),
    score,
    answers,
    questions: runTest.questions,
    questionMap,
    optionMaps
  };

  window.state.attempts.push(attempt);
  window.saveAttempts();

  if (window.activeTimers[tabId]) {
    clearInterval(window.activeTimers[tabId].intervalId);
    delete window.activeTimers[tabId];
  }

  window.closeTab(tabId);
  openTestReviewTab(attempt);
}


// === 5. ПЕРЕГЛЯД РЕЗУЛЬТАТІВ ===

function attemptHasTextQuestions(attempt) {
  return (attempt.questions || []).some((q) => isTextQuestionType(q));
}

function attemptIsFullyGraded(attempt) {
  if (!attemptHasTextQuestions(attempt)) return true;
  const tg = attempt.textGrades || {};
  return (attempt.questions || []).every((q, qi) => !isTextQuestionType(q) || tg[qi] != null);
}

function recalcScoreWithGrades(attempt) {
  const questions = attempt.questions || [];
  const answers = attempt.answers || {};
  const textGrades = attempt.textGrades || {};
  return calcScore({ questions }, answers, textGrades);
}

async function sendGradingResultToTelegram(attempt) {
  const chatId = attempt.telegramChatId;
  if (!chatId) {
    await window.showCustomAlert("Помилка", "У цього результату немає прив'язки до Telegram чату.");
    return false;
  }

  const score = attempt.score || {};
  const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;
  const tg = attempt.textGrades || {};
  const teacherComment = attempt.teacherComment || "";

  let textQComments = "";
  (attempt.questions || []).forEach((q, qi) => {
    if (!isTextQuestionType(q) || !tg[qi]) return;
    const grade = tg[qi];
    const mark = grade.correct ? "✅" : "❌";
    textQComments += `\n${mark} П.${qi + 1}: ${grade.comment || (grade.correct ? "Правильно" : "Неправильно")}`;
  });

  const msg =
    `📊 <b>Результат тесту: «${escHtmlFrontend(attempt.testTitle)}»</b>\n\n` +
    `Учень: ${escHtmlFrontend(attempt.studentName)}\n` +
    `Бали: ${score.earnedPoints} з ${score.maxPoints} (${pct}%)\n` +
    `Правильних: ${score.correctCount} з ${score.totalQuestions}` +
    (textQComments ? `\n\n<b>Оцінки за текстові відповіді:</b>${textQComments}` : "") +
    (teacherComment ? `\n\n<b>Коментар вчителя:</b> ${escHtmlFrontend(teacherComment)}` : "");

  try {
    await window.callCloudApi("POST", "notify", { chatId, message: msg });
    return true;
  } catch (e) {
    console.error("sendGradingResult failed:", e);
    await window.showCustomAlert("Помилка", "Не вдалося надіслати повідомлення: " + (e.message || e));
    return false;
  }
}

function escHtmlFrontend(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function openTestReviewTab(attempt) {
  const tabId = `test-review-${attempt.testId}-${Date.now()}`;
  const tabTitle = `Результат: ${(attempt.studentName || '').split(' ')[0]}`;

  const questions = attempt.questions || [];
  const answers = attempt.answers || {};
  const hasText = attemptHasTextQuestions(attempt);
  const textGrades = attempt.textGrades ? { ...attempt.textGrades } : {};

  const recalcAndDisplay = () => {
    const score = hasText ? recalcScoreWithGrades({ ...attempt, textGrades }) : (attempt.score || { correctCount: 0, totalQuestions: 0, earnedPoints: 0, maxPoints: 0 });
    const pct = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;
    const circleClass = pct >= 75 ? 'good' : pct >= 50 ? 'ok' : 'bad';
    return { score, pct, circleClass };
  };

  const initialCalc = recalcAndDisplay();
  let currentScore = initialCalc.score;

  window.openTab(tabId, tabTitle, () => {
    const renderReview = () => {
      const calc = recalcAndDisplay();
      currentScore = calc.score;
      const { score, pct, circleClass } = calc;
      const isGraded = attemptIsFullyGraded({ ...attempt, textGrades });

      let questionsHTML = "";

      questions.forEach((q, qi) => {
        const pts = q.points || 1;
        let isCorrect = false;
        let detailHTML = "";

        if (q.type === 'radio' || q.type === 'check') {
          const right = new Set((q.options || []).map((o, i) => o.correct ? i : null).filter(x => x !== null));
          const given = new Set(Array.isArray(answers[qi]) ? answers[qi] : (answers[qi] != null ? [answers[qi]] : []));
          isCorrect = right.size === given.size && [...right].every(i => given.has(i));

          (q.options || []).forEach((opt, oi) => {
            const picked = given.has(oi);
            const correct = right.has(oi);
            let cls = '';
            let icon = '';
            if (picked && correct) { cls = 'review-option correct-answer student-pick'; icon = '✓'; }
            else if (picked && !correct) { cls = 'review-option wrong-answer student-pick'; icon = '✕'; }
            else if (!picked && correct) { cls = 'review-option correct-answer'; icon = '✓ (правильна)'; }
            else { cls = 'review-option'; icon = ''; }
            detailHTML += `<div class="${cls}"><span>${icon ? icon + ' ' : ''}${window.esc(opt.text)}</span></div>`;
          });

        } else if (isTextQuestionType(q)) {
          const grade = textGrades[qi];
          const graded = grade != null;
          isCorrect = graded && grade.correct;

          detailHTML = `
            <div class="review-option student-pick" style="margin-bottom:8px;">
              <span>Відповідь: ${window.esc(String(answers[qi] || '(порожньо)'))}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;">
              <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">Оцінка:</span>
              <button class="btn ${graded && grade.correct ? '' : 'ghost'} btn-grade-correct" data-qi="${qi}"
                style="padding:4px 12px;font-size:13px;min-height:30px;${graded && grade.correct ? 'background:var(--grade-10);color:#fff;border-color:var(--grade-10);' : ''}">
                ✓ Правильно
              </button>
              <button class="btn ${graded && !grade.correct ? 'danger' : 'ghost'} btn-grade-wrong" data-qi="${qi}"
                style="padding:4px 12px;font-size:13px;min-height:30px;">
                ✕ Неправильно
              </button>
            </div>
            <div class="form-group" style="margin-top:8px;">
              <input class="input grade-comment-input" data-qi="${qi}" placeholder="Коментар до оцінки (необов'язково)..."
                value="${window.esc(grade?.comment || '')}" style="font-size:13px;">
            </div>
          `;

        } else if (q.type === 'matching') {
          const pairs = q.pairs || [];
          const givenArr = answers[qi] || [];
          let allCorrect = true;
          pairs.forEach((pair, pi) => {
            const studentAnswer = givenArr[pi] || '';
            const correct = studentAnswer === pair.right;
            if (!correct) allCorrect = false;
            detailHTML += `
              <div class="matching-pair" style="margin:4px 0;">
                <div class="matching-left">${window.esc(pair.left)}</div>
                <span class="matching-arrow">→</span>
                <div style="flex:1;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid ${correct ? 'var(--grade-10)' : 'var(--grade-1)'};background:${correct ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'};">
                  ${window.esc(studentAnswer || '(не обрано)')}
                  ${!correct ? `<span style="color:var(--grade-10);margin-left:8px;font-size:12px;">→ ${window.esc(pair.right)}</span>` : ''}
                </div>
              </div>`;
          });
          isCorrect = allCorrect;
        }

        const badgeClass = isTextQuestionType(q) && textGrades[qi] == null ? 'pending' : (isCorrect ? 'correct' : 'wrong');
        const badgeText = isTextQuestionType(q) && textGrades[qi] == null
          ? 'Очікує оцінки'
          : (isCorrect ? `+${pts} бал.` : '0 бал.');

        questionsHTML += `
          <div class="review-question ${badgeClass}">
            <div class="review-question-header">
              <div><b>Питання ${qi + 1}:</b> ${window.esc(q.text)}</div>
              <span class="review-badge ${badgeClass}">${badgeText}</span>
            </div>
            ${q.image ? `<img src="${q.image}" style="max-width:300px;max-height:200px;border-radius:4px;margin-bottom:8px;border:1px solid var(--border-color);">` : ''}
            ${detailHTML}
          </div>
        `;
      });

      const hasTelegramChat = !!attempt.telegramChatId;

      window.areaEl.innerHTML = `
        <div style="max-width:800px;margin:0 auto;">
          <div class="review-summary">
            <div class="review-score-circle ${circleClass}">
              ${pct}%
              <span>${score.earnedPoints}/${score.maxPoints}</span>
            </div>
            <div class="review-meta">
              <h3>${window.esc(attempt.testTitle)}</h3>
              <p><b>Учень:</b> ${window.esc(attempt.studentName)}</p>
              ${attempt.guestAge != null ? `<p><b>Вік:</b> ${window.esc(String(attempt.guestAge))}</p>` : ""}
              ${attempt.guestGrade ? `<p><b>Клас/курс:</b> ${window.esc(attempt.guestGrade)}</p>` : ""}
              <p><b>Дата:</b> ${window.esc(formatAttemptDisplayDate(attempt))}</p>
              <p>Правильних: ${score.correctCount} з ${score.totalQuestions}${hasText && !isGraded ? ' (текстові очікують оцінки)' : ''}</p>
              ${attempt.gradedAt ? `<p style="color:var(--grade-10);">Оцінено: ${new Date(attempt.gradedAt).toLocaleString("uk-UA")}</p>` : ''}
            </div>
            <button class="btn ghost" id="review-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Закрити
            </button>
          </div>

          ${questionsHTML}

          ${hasText ? `
            <div style="margin-top:20px;padding:16px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-light);">
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <button class="btn" id="review-save-grades-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Зберегти оцінки
                </button>
                ${hasTelegramChat ? `
                  <button class="btn ghost" id="review-send-result-btn" ${isGraded ? '' : 'disabled title="Спочатку оцініть усі текстові відповіді"'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2L2 12l5.5 2L19 6l-8.5 6v6l3-4"/></svg>
                    Надіслати результат учню
                  </button>
                ` : ''}
                <span id="review-grade-status" style="font-size:13px;color:var(--text-secondary);"></span>
              </div>
              ${hasTelegramChat && isGraded ? `
                <div class="form-group" style="margin-top:12px;">
                  <label for="review-teacher-comment">Загальний коментар (необов'язково)</label>
                  <textarea class="input" id="review-teacher-comment" placeholder="Додайте коментар для учня..."
                    style="min-height:60px;font-size:13px;">${window.esc(attempt.teacherComment || '')}</textarea>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;

      window.$("#review-close-btn").onclick = () => window.closeTab(tabId);

      window.$$(".btn-grade-correct").forEach(btn => {
        btn.onclick = () => {
          const qi = parseInt(btn.dataset.qi, 10);
          const commentInput = window.$(`.grade-comment-input[data-qi="${qi}"]`);
          textGrades[qi] = { correct: true, comment: commentInput?.value || '' };
          renderReview();
        };
      });

      window.$$(".btn-grade-wrong").forEach(btn => {
        btn.onclick = () => {
          const qi = parseInt(btn.dataset.qi, 10);
          const commentInput = window.$(`.grade-comment-input[data-qi="${qi}"]`);
          textGrades[qi] = { correct: false, comment: commentInput?.value || '' };
          renderReview();
        };
      });

      window.$$(".grade-comment-input").forEach(inp => {
        inp.oninput = () => {
          const qi = parseInt(inp.dataset.qi, 10);
          if (textGrades[qi]) {
            textGrades[qi].comment = inp.value;
          }
        };
      });

      const saveBtn = window.$("#review-save-grades-btn");
      if (saveBtn) {
        saveBtn.onclick = async () => {
          window.$$(".grade-comment-input").forEach(inp => {
            const qi = parseInt(inp.dataset.qi, 10);
            if (textGrades[qi]) textGrades[qi].comment = inp.value;
          });

          attempt.textGrades = { ...textGrades };
          attempt.score = recalcScoreWithGrades(attempt);
          attempt.gradedAt = new Date().toISOString();
          const commentEl = window.$("#review-teacher-comment");
          if (commentEl) attempt.teacherComment = commentEl.value.trim();

          window.saveAttempts();
          const statusEl = window.$("#review-grade-status");
          if (statusEl) {
            statusEl.textContent = "Оцінки збережено.";
            statusEl.style.color = "var(--grade-10)";
          }
          renderReview();
        };
      }

      const sendBtn = window.$("#review-send-result-btn");
      if (sendBtn) {
        sendBtn.onclick = async () => {
          const commentEl = window.$("#review-teacher-comment");
          if (commentEl) attempt.teacherComment = commentEl.value.trim();

          const statusEl = window.$("#review-grade-status");
          if (statusEl) {
            statusEl.textContent = "Надсилання…";
            statusEl.style.color = "var(--text-secondary)";
          }
          sendBtn.disabled = true;

          const ok = await sendGradingResultToTelegram(attempt);
          if (ok && statusEl) {
            statusEl.textContent = "Результат надіслано учню в Telegram.";
            statusEl.style.color = "var(--grade-10)";
          }
          sendBtn.disabled = false;
        };
      }
    };

    renderReview();
  });
}


// === 6. ПІДРАХУНОК БАЛІВ ===

export function calcScore(test, answers, textGrades) {
  let correctCount = 0;
  let totalQuestions = 0;
  let earnedPoints = 0;
  let maxPoints = 0;
  let hasTextQuestions = false;
  let pendingTextCount = 0;

  test.questions.forEach((q, qi) => {
    totalQuestions++;
    const points = q.points || 1;
    maxPoints += points;
    let isCorrect = false;

    if (isTextQuestionType(q)) {
      hasTextQuestions = true;
      if (textGrades && textGrades[qi] != null) {
        isCorrect = !!textGrades[qi].correct;
      } else {
        pendingTextCount++;
      }
    } else if (q.type === "matching") {
      const pairs = q.pairs || [];
      const givenArr = answers[qi] || [];
      isCorrect = pairs.length > 0 && pairs.every((pair, pi) => givenArr[pi] === pair.right);
    } else {
      const right = new Set((q.options || []).map((o, i) => o.correct ? i : null).filter(x => x !== null));
      const given = new Set(Array.isArray(answers[qi]) ? answers[qi] : (answers[qi] != null ? [answers[qi]] : []));

      if (right.size === given.size && [...right].every(i => given.has(i))) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      correctCount++;
      earnedPoints += points;
    }
  });

  return { correctCount, totalQuestions, earnedPoints, maxPoints, hasTextQuestions, pendingTextCount };
}


// === 7. ПЕРЕГЛЯД ЗОБРАЖЕНЬ ===

export function refreshTestsIfOpen() {
  if (window.active === "tests") renderTestsPage();
}

export function previewImage(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    console.warn("Invalid dataUrl for previewImage:", dataUrl);
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cursor = "zoom-out";
  overlay.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 20px;">
      <img src="${dataUrl}" style="max-width: 90vw; max-height: 90vh; object-fit: contain; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    </div>
  `;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}
