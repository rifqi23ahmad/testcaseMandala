// Self-executing function to encapsulate the application
(() => {
    'use strict';

    // --- STATE MANAGEMENT ---
    let state = {
        userStories: [],
        testScripts: [],
        testRuns: [],
        testStepTemplates: [],
        recentActivities: [],
        activeTab: 'dashboard',
        activeTestRunId: null,
        dashboardSelectedRunId: null,
        activeTestRunFilter: 'All'
    };

    // --- LOCAL STORAGE & DEFAULTS ---
    const APP_VERSION = 'v15'; // Updated version
    const defaultData = {
        userStories: [
            { id: 1, feature: 'Autentikasi', title: '#2110 Menu Login', asA: 'Pengguna', iWantTo: 'Masuk ke dalam sistem.', soThat: 'Saya bisa mengakses fitur-fitur.', acceptanceCriteria: '1. Pengguna bisa login dengan email dan password valid.\n2. Muncul pesan error jika login gagal.' },
            { id: 2, feature: 'Manajemen Profil', title: '#3150 Ubah Profil Pengguna', asA: 'Pengguna', iWantTo: 'Mengubah data profil saya.', soThat: 'Informasi saya selalu terbaru.', acceptanceCriteria: '1. Pengguna bisa mengubah nama.\n2. Pengguna bisa mengubah foto profil.' }
        ],
        testScripts: [
            { id: 1, userStoryId: 1, phase: 'System Testing', scriptId: 'TS-AUTH-001', scenario: 'Login Pengguna', testCase: 'Login dengan kredensial valid', priority: 'High', assignee: 'Rifqi', precondition: 'User berada di halaman login', testData: 'user: test@example.com\npass: 123456', steps: '1. Buka halaman login.\n2. Masukkan email valid.\n3. Masukkan password valid.\n4. Klik "Login".', expected: '- Pengguna berhasil login.\n- Pengguna diarahkan ke dashboard.' },
            { id: 2, userStoryId: 2, phase: 'System Testing', scriptId: 'TS-PROF-001', scenario: 'Ubah Nama Profil', testCase: 'Mengubah nama dengan karakter valid', priority: 'Medium', assignee: 'Andi', precondition: 'User sudah login', testData: 'Nama baru: John Doe Smith', steps: '1. Masuk ke halaman profil.\n2. Klik tombol "Edit Profil".\n3. Ubah field nama.\n4. Klik "Simpan".', expected: '- Nama berhasil diubah.\n- Notifikasi sukses muncul.' }
        ],
        testRuns: [],
        testStepTemplates: [{ id: 1, name: 'Login Standard', steps: '1. Buka halaman login.\n2. Masukkan username valid.\n3. Masukkan password valid.\n4. Klik "Login".' }],
        recentActivities: []
    };

    function saveData() {
        localStorage.setItem(`testcase_app_state_${APP_VERSION}`, JSON.stringify(state));
    }

    function loadData() {
        const savedState = localStorage.getItem(`testcase_app_state_${APP_VERSION}`);
        if (savedState) {
            state = JSON.parse(savedState);
        } else {
            state = defaultData;
        }
        state.dashboardSelectedRunId = state.dashboardSelectedRunId || (state.testRuns.length > 0 ? state.testRuns[state.testRuns.length - 1].id : null);
    }

    // --- UTILITY & HELPER FUNCTIONS ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    const openModal = (id) => $(`#${id}`).classList.add('show');
    const closeModal = (id) => $(`#${id}`).classList.remove('show');
    
    function addActivity(text, type = 'info') {
        const iconMap = { create: 'plus-circle', update: 'edit-2', delete: 'trash-2', run: 'play-circle', info: 'info' };
        state.recentActivities.unshift({ text, type, icon: iconMap[type] || 'info', timestamp: new Date() });
        if (state.recentActivities.length > 10) state.recentActivities.pop();
    }

    function showToast(message, type = 'success') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i data-feather="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i><span>${message}</span>`;
        container.appendChild(toast);
        feather.replace();
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 3000);
            }, 3000);
        }, 10);
    }

    function showPrompt({ title, message, defaultValue = '' }, callback) {
        $('#prompt-title').textContent = title;
        $('#prompt-message').textContent = message;
        const input = $('#prompt-input');
        input.value = defaultValue;
        openModal('prompt-modal');
        
        $('#prompt-ok').onclick = () => {
            if (input.value.trim()) {
                closeModal('prompt-modal');
                callback(input.value.trim());
            }
        };
        $('#prompt-cancel').onclick = () => closeModal('prompt-modal');
    }
    
    function showConfirm({ message }, callback) {
        $('#confirm-message').textContent = message;
        openModal('confirm-modal');
        $('#confirm-ok').onclick = () => {
            closeModal('confirm-modal');
            callback();
        };
        $('#confirm-cancel').onclick = () => closeModal('confirm-modal');
    }

    function generateNextScriptId() {
        if (state.testScripts.length === 0) return 'TS-001';
        const lastId = state.testScripts.slice().sort((a, b) => a.scriptId.localeCompare(b.scriptId, undefined, { numeric: true })).pop().scriptId;
        const match = lastId.match(/^(.*?)(\d+)$/);
        if (match) {
            const prefix = match[1];
            const numStr = match[2];
            return prefix + String(parseInt(numStr, 10) + 1).padStart(numStr.length, '0');
        }
        return lastId + '-1';
    }
    
    function createActionButtons(type, id) {
        let buttons = `
            <button class="edit-${type} text-gray-500 hover:text-indigo-600" data-id="${id}"><i data-feather="edit" class="w-4 h-4"></i></button>
            <button class="delete-${type} text-gray-500 hover:text-red-600" data-id="${id}"><i data-feather="trash-2" class="w-4 h-4"></i></button>
        `;
        if (type === 'ts') {
            buttons = `<button class="duplicate-ts text-gray-500 hover:text-blue-600" data-id="${id}"><i data-feather="copy" class="w-4 h-4"></i></button>` + buttons;
        }
        if (type === 'run') {
             buttons = `<button class="delete-run text-gray-500 hover:text-red-600" data-id="${id}"><i data-feather="trash-2" class="w-4 h-4"></i></button>`;
        }
        return buttons;
    }

    // --- RENDER FUNCTIONS ---
    function renderAll(searchTerm = '') {
        switch(state.activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'user-story': renderUserStories(searchTerm); break;
            case 'test-script': renderTestScripts(searchTerm); break;
            case 'test-runs': renderTestRuns(searchTerm); break;
            case 'test-run-detail': renderTestRunDetail(state.activeTestRunId, searchTerm, state.activeTestRunFilter); break;
        }
        saveData();
        feather.replace();
    }
    
    function renderDashboard() {
        const runSelector = $('#dashboard-run-select');
        runSelector.innerHTML = state.testRuns.map(run => `<option value="${run.id}">${run.name}</option>`).join('');
        if (state.dashboardSelectedRunId) {
            runSelector.value = state.dashboardSelectedRunId;
        }

        const progressContainer = $('#dashboard-feature-progress');
        const selectedRun = state.testRuns.find(run => run.id == state.dashboardSelectedRunId);

        if (!selectedRun) {
            progressContainer.innerHTML = `<div class="text-center text-gray-500 p-8 border rounded-lg">Pilih Test Run untuk melihat progress, atau buat Test Run baru.</div>`;
            $('#recent-activity-list').innerHTML = '<li class="text-sm text-gray-400">Belum ada aktivitas.</li>';
            return;
        }

        const scriptsInRun = selectedRun.scriptIds.map(id => state.testScripts.find(ts => ts.id == id)).filter(Boolean);
        const groups = scriptsInRun.reduce((acc, script) => {
            const us = state.userStories.find(u => u.id == script.userStoryId);
            const feature = us ? us.feature : 'Tanpa Fitur';
            if (!acc[feature]) acc[feature] = [];
            acc[feature].push(script);
            return acc;
        }, {});

        progressContainer.innerHTML = Object.keys(groups).sort().map(feature => {
            const featureScripts = groups[feature];
            const total = featureScripts.length;
            const results = (selectedRun.results || []);
            const passed = featureScripts.filter(ts => results.find(r => r.scriptId == ts.id)?.status === 'Pass').length;
            const failed = featureScripts.filter(ts => results.find(r => r.scriptId == ts.id)?.status === 'Fail').length;
            const blocked = featureScripts.filter(ts => results.find(r => r.scriptId == ts.id)?.status === 'Blocked').length;
            const executed = passed + failed + blocked;
            const passRate = total > 0 ? (passed / total) * 100 : 0;

            return `
                <div class="p-4 border rounded-lg bg-white">
                    <h4 class="font-bold text-gray-800">${feature}</h4>
                    <div class="mt-2">
                        <div class="flex justify-between mb-1">
                            <span class="text-base font-medium text-green-700">Pass Rate</span>
                            <span class="text-sm font-medium text-green-700">${passRate.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div class="bg-green-600 h-2.5 rounded-full" style="width: ${passRate}%"></div>
                        </div>
                    </div>
                    <div class="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                        <div title="Pass"><i data-feather="check-circle" class="w-4 h-4 mx-auto text-green-500"></i> ${passed}</div>
                        <div title="Fail"><i data-feather="x-circle" class="w-4 h-4 mx-auto text-red-500"></i> ${failed}</div>
                        <div title="Blocked"><i data-feather="slash" class="w-4 h-4 mx-auto text-orange-500"></i> ${blocked}</div>
                        <div title="Untested"><i data-feather="circle" class="w-4 h-4 mx-auto text-gray-400"></i> ${total - executed}</div>
                    </div>
                </div>
            `;
        }).join('');

        $('#recent-activity-list').innerHTML = state.recentActivities.map(act => `
            <li class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-1 p-1.5 bg-gray-100 rounded-full"><i data-feather="${act.icon}" class="w-4 h-4 text-gray-500"></i></div>
                <div>
                    <p class="text-sm text-gray-700">${act.text}</p>
                    <p class="text-xs text-gray-400">${new Date(act.timestamp).toLocaleString('id-ID')}</p>
                </div>
            </li>
        `).join('') || '<li class="text-sm text-gray-400">Belum ada aktivitas.</li>';
    }
    
    function renderUserStories(searchTerm = '') {
        const container = $('#user-story-groups-container');
        const filtered = state.userStories.filter(us => us.title.toLowerCase().includes(searchTerm.toLowerCase()) || us.feature.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const groups = filtered.reduce((acc, story) => {
            const feature = story.feature || 'Tanpa Fitur';
            if (!acc[feature]) acc[feature] = [];
            acc[feature].push(story);
            return acc;
        }, {});

        container.innerHTML = Object.keys(groups).sort().map(feature => `
            <div class="feature-group">
                <h2 class="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">${feature}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${groups[feature].map(us => `
                        <div class="user-story-card flex flex-col justify-between" data-id="${us.id}">
                            <div>
                                <h3 class="font-bold text-lg text-gray-900 mb-2">${us.title}</h3>
                                <p class="text-sm text-gray-600 mb-4">
                                    Sebagai <strong class="font-semibold">${us.asA}</strong>, saya ingin <strong class="font-semibold">${us.iWantTo}</strong>, sehingga saya bisa <strong class="font-semibold">${us.soThat}</strong>.
                                </p>
                                <div>
                                    <h4 class="font-semibold text-sm mb-1">Acceptance Criteria:</h4>
                                    <ul class="list-disc list-inside text-sm text-gray-500 space-y-1" style="white-space: pre-wrap;">${us.acceptanceCriteria.split('\n').map(line => `<li>${line}</li>`).join('')}</ul>
                                </div>
                            </div>
                            <div class="flex justify-end gap-2 mt-4 pt-4 border-t">
                                ${createActionButtons('us', us.id)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    function renderTestScripts(searchTerm = '') {
        const container = $('#test-script-groups-container');
        const filtered = state.testScripts.filter(ts => ts.testCase.toLowerCase().includes(searchTerm.toLowerCase()) || ts.scriptId.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const groups = filtered.reduce((acc, script) => {
            const userStory = state.userStories.find(us => us.id == script.userStoryId);
            const feature = userStory ? userStory.feature : 'Tanpa Fitur';
            if (!acc[feature]) acc[feature] = [];
            acc[feature].push(script);
            return acc;
        }, {});

        container.innerHTML = Object.keys(groups).sort().map(feature => `
            <details class="feature-group drop-zone" data-feature="${feature}" open>
                <summary class="text-xl font-bold text-gray-800 mb-4 pb-2 border-b cursor-pointer list-none flex justify-between items-center">
                    <span>${feature}</span>
                    <i data-feather="chevron-down" class="transition-transform group-open:rotate-180"></i>
                </summary>
                <div class="table-container border rounded-lg mt-2">
                    <table class="min-w-full divide-y">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="text-left text-xs font-semibold text-gray-600 uppercase">Script ID</th>
                                <th class="text-left text-xs font-semibold text-gray-600 uppercase">Test Case</th>
                                <th class="text-left text-xs font-semibold text-gray-600 uppercase">Prioritas</th>
                                <th class="text-left text-xs font-semibold text-gray-600 uppercase">Assignee</th>
                                <th class="text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y text-sm">
                            ${groups[feature].map(ts => `
                                <tr data-id="${ts.id}" draggable="true">
                                    <td class="font-medium text-gray-900">${ts.scriptId}</td>
                                    <td><div class="font-semibold">${ts.testCase}</div><div class="text-xs text-gray-500">${ts.scenario}</div></td>
                                    <td><span class="status-badge priority-${ts.priority.toLowerCase()}">${ts.priority}</span></td>
                                    <td>${ts.assignee || '-'}</td>
                                    <td><div class="flex gap-3">${createActionButtons('ts', ts.id)}</div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        `).join('');
    }

    function renderTestRuns(searchTerm = '') {
        const filtered = state.testRuns.filter(run => run.name.toLowerCase().includes(searchTerm.toLowerCase()));
        $('#test-runs-table-body').innerHTML = filtered.map(run => {
            const total = run.scriptIds.length;
            const executed = (run.results || []).length;
            const progress = total > 0 ? (executed / total) * 100 : 0;
            return `
            <tr data-id="${run.id}" class="cursor-pointer hover:bg-indigo-50 view-run">
                <td class="font-medium text-indigo-700">${run.name}</td>
                <td>
                    <div class="w-full bg-gray-200 rounded-full h-2.5"><div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${progress}%"></div></div>
                    <span class="text-xs text-gray-500">${executed} / ${total} dieksekusi</span>
                </td>
                <td><div class="flex gap-2">${createActionButtons('run', run.id)}</div></td>
            </tr>`;
        }).join('');
    }

    function renderTestRunDetail(runId, searchTerm = '', statusFilter = 'All') {
        const run = state.testRuns.find(r => r.id == runId);
        if (!run) return;

        state.activeTestRunId = runId;
        state.activeTestRunFilter = statusFilter;
        $('#test-run-detail-title').textContent = run.name;

        $$('#test-run-detail-content .filter-btn-status').forEach(btn => {
            btn.classList.toggle('bg-indigo-500', btn.dataset.status === statusFilter);
            btn.classList.toggle('text-white', btn.dataset.status === statusFilter);
            btn.classList.toggle('bg-gray-200', btn.dataset.status !== statusFilter);
            btn.classList.toggle('text-gray-700', btn.dataset.status !== statusFilter);
        });

        const scriptsInRun = run.scriptIds.map(scriptId => state.testScripts.find(ts => ts.id == scriptId)).filter(Boolean);
        
        const filteredScripts = scriptsInRun.filter(ts => {
            const result = (run.results || []).find(r => r.scriptId == ts.id);
            const status = result ? result.status : 'Untested';
            const searchMatch = ts.testCase.toLowerCase().includes(searchTerm.toLowerCase()) || ts.scriptId.toLowerCase().includes(searchTerm.toLowerCase());
            const statusMatch = statusFilter === 'All' || status === statusFilter;
            return searchMatch && statusMatch;
        });

        $('#test-run-detail-table-body').innerHTML = filteredScripts.map(ts => {
            const result = (run.results || []).find(r => r.scriptId == ts.id);
            const status = result ? result.status : 'Untested';
            const statusClass = result ? `status-${result.status.toLowerCase()}` : 'bg-gray-100 text-gray-500';
            return `
            <tr data-run-id="${run.id}" data-script-id="${ts.id}">
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="font-medium">${ts.scriptId}</td>
                <td>${ts.testCase}</td>
                <td>${result?.assignee || ts.assignee || '-'}</td>
                <td><button class="add-result-btn text-indigo-600 hover:underline">Update Hasil</button></td>
            </tr>`;
        }).join('');
    }
    
    function renderTestStepTemplatesDropdown() {
        const select = $('#ts-step-template-select');
        select.innerHTML = '<option value="">-- Pilih Template --</option>';
        state.testStepTemplates.forEach(template => {
            select.innerHTML += `<option value="${template.id}">${template.name}</option>`;
        });
    }

    function updateUserStoryLinkDropdown() {
        const select = $('#ts-user-story-link');
        select.innerHTML = '<option value="">Pilih User Story (opsional)</option>';
        state.userStories.forEach(us => {
            select.innerHTML += `<option value="${us.id}">${us.title}</option>`;
        });
    }

    // --- EVENT LISTENERS & INITIALIZATION ---
    function init() {
        loadData();
        $$('.tab-button').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
        $('#user-story-search').addEventListener('keyup', (e) => renderAll(e.target.value));
        $('#test-script-search').addEventListener('keyup', (e) => renderAll(e.target.value));
        $('#test-runs-search').addEventListener('keyup', (e) => renderAll(e.target.value));
        $('#test-run-detail-search').addEventListener('keyup', (e) => renderAll(e.target.value));
        $('#tab-content').addEventListener('click', handleActionClick);
        
        $('#user-story-form').addEventListener('submit', handleUserStorySubmit);
        $('#test-script-form').addEventListener('submit', handleTestScriptSubmit);
        $('#test-run-form').addEventListener('submit', handleTestRunSubmit);
        $('#add-result-form').addEventListener('submit', handleAddResultSubmit);
        $('#export-options-form').addEventListener('submit', handleSelectiveExport);
        $('#import-form').addEventListener('submit', handleImport);


        $('#evidence-paste-area').addEventListener('paste', handleEvidencePaste);
        setupDragAndDrop();
        setupModalButtons();
        renderAll();
    }
    
    function switchTab(tabName) {
        state.activeTab = tabName;
        $$('.tab-button').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        $$('.tab-pane').forEach(p => p.classList.add('hidden'));
        $(`#${tabName}-content`).classList.remove('hidden');
        if(tabName !== 'test-run-detail') {
            $('#test-run-detail-content').classList.add('hidden');
        }
        renderAll();
    }

    function handleActionClick(e) {
        const button = e.target.closest('button, tr');
        if (!button) return;
        
        const id = button.dataset.id;
        const classList = button.classList;

        const actionMap = {
            'edit-us': () => openEditModal('us', id), 'delete-us': () => deleteItem('us', id),
            'edit-ts': () => openEditModal('ts', id), 'delete-ts': () => deleteItem('ts', id), 'duplicate-ts': () => duplicateTestScript(id),
            'delete-run': () => deleteItem('run', id),
            'view-run': () => viewTestRunDetail(id),
            'add-result-btn': () => {
                const runId = button.closest('tr').dataset.runId;
                const scriptId = button.closest('tr').dataset.scriptId;
                openAddResultModal(runId, scriptId);
            }
        };

        for (const actionClass in actionMap) {
            if (classList.contains(actionClass)) {
                actionMap[actionClass]();
                return;
            }
        }
    }
    
    function openEditModal(type, id) {
        if (type === 'us') {
            const us = state.userStories.find(i => i.id == id);
            if (!us) return;
            $('#user-story-id').value = us.id;
            $('#us-feature').value = us.feature;
            $('#us-title').value = us.title;
            $('#us-as-a').value = us.asA;
            $('#us-i-want-to').value = us.iWantTo;
            $('#us-so-that').value = us.soThat;
            $('#us-acceptance-criteria').value = us.acceptanceCriteria;
            openModal('user-story-modal');
        } else if (type === 'ts') {
            const ts = state.testScripts.find(i => i.id == id);
            if (!ts) return;
            updateUserStoryLinkDropdown(); 
            renderTestStepTemplatesDropdown();
            $('#test-script-id-form').value = ts.id;
            $('#ts-user-story-link').value = ts.userStoryId || '';
            $('#ts-phase').value = ts.phase;
            $('#ts-script-id').value = ts.scriptId;
            $('#ts-scenario').value = ts.scenario;
            $('#ts-case').value = ts.testCase;
            $('#ts-priority').value = ts.priority;
            $('#ts-assignee').value = ts.assignee;
            $('#ts-precondition').value = ts.precondition;
            $('#ts-data').value = ts.testData;
            $('#ts-steps').value = ts.steps;
            $('#ts-expected').value = ts.expected;
            openModal('test-script-modal');
        }
    }

    function deleteItem(type, id) {
        showConfirm({ message: `Anda yakin ingin menghapus item ini?` }, () => {
            if (type === 'us') state.userStories = state.userStories.filter(i => i.id != id);
            if (type === 'ts') state.testScripts = state.testScripts.filter(i => i.id != id);
            if (type === 'run') state.testRuns = state.testRuns.filter(i => i.id != id);
            addActivity(`Item #${id} dihapus.`, 'delete');
            renderAll();
            showToast('Item berhasil dihapus.');
        });
    }

    function duplicateTestScript(id) {
        const original = state.testScripts.find(ts => ts.id == id);
        if (original) {
            const newScript = { ...original, id: Date.now(), scriptId: generateNextScriptId() };
            state.testScripts.push(newScript);
            addActivity(`Test Script ${original.scriptId} diduplikasi menjadi ${newScript.scriptId}.`, 'create');
            renderAll();
            showToast('Test script berhasil diduplikasi.');
        }
    }

    function viewTestRunDetail(runId) {
        switchTab('test-run-detail');
        state.activeTestRunId = runId;
        renderAll();
    }

    function openAddResultModal(runId, scriptId) {
        const run = state.testRuns.find(r => r.id == runId);
        const script = state.testScripts.find(ts => ts.id == scriptId);
        if (!run || !script) return;

        const form = $('#add-result-form');
        form.reset();
        $('#add-result-run-id').value = runId;
        $('#add-result-script-id').value = scriptId;
        $('#add-result-case-title').textContent = `${script.scriptId}: ${script.testCase}`;

        const existingResult = (run.results || []).find(r => r.scriptId == scriptId);
        if (existingResult) {
            $('#add-result-status').value = existingResult.status;
            $('#add-result-assignee').value = existingResult.assignee || '';
            $('#add-result-actual').value = existingResult.actual || '';
        }
        
        openModal('add-result-modal');
    }
    
    function handleUserStorySubmit(e) {
        e.preventDefault();
        const id = $('#user-story-id').value;
        const data = {
            feature: $('#us-feature').value, title: $('#us-title').value,
            asA: $('#us-as-a').value, iWantTo: $('#us-i-want-to').value,
            soThat: $('#us-so-that').value, acceptanceCriteria: $('#us-acceptance-criteria').value
        };
        if (id) {
            const index = state.userStories.findIndex(i => i.id == id);
            state.userStories[index] = { ...state.userStories[index], ...data };
            addActivity(`User Story "${data.title}" diupdate.`, 'update');
        } else {
            data.id = Date.now();
            state.userStories.push(data);
            addActivity(`User Story "${data.title}" dibuat.`, 'create');
        }
        closeModal('user-story-modal');
        renderAll();
        showToast('User Story berhasil disimpan.');
    }

    function handleTestScriptSubmit(e) {
        e.preventDefault();
        const id = $('#test-script-id-form').value;
        const data = {
            userStoryId: $('#ts-user-story-link').value, phase: $('#ts-phase').value,
            scriptId: $('#ts-script-id').value, scenario: $('#ts-scenario').value,
            testCase: $('#ts-case').value, priority: $('#ts-priority').value,
            assignee: $('#ts-assignee').value, precondition: $('#ts-precondition').value,
            testData: $('#ts-data').value, steps: $('#ts-steps').value,
            expected: $('#ts-expected').value
        };
         if (id) {
            const index = state.testScripts.findIndex(i => i.id == id);
            state.testScripts[index] = { ...state.testScripts[index], ...data };
            addActivity(`Test Script ${data.scriptId} diupdate.`, 'update');
        } else {
            data.id = Date.now();
            state.testScripts.push(data);
            addActivity(`Test Script ${data.scriptId} dibuat.`, 'create');
        }
        closeModal('test-script-modal');
        renderAll();
        showToast('Test Script berhasil disimpan.');
    }

    function handleTestRunSubmit(e) {
        e.preventDefault();
        const name = $('#test-run-name').value;
        const selectedScriptIds = Array.from($$('[name="test-run-script"]:checked')).map(cb => cb.value);
        
        if (name && selectedScriptIds.length > 0) {
            state.testRuns.push({ id: Date.now(), name, scriptIds: selectedScriptIds, results: [] });
            addActivity(`Test Run "${name}" dibuat.`, 'create');
            closeModal('test-run-modal');
            switchTab('test-runs');
            showToast('Test Run berhasil dibuat.');
        }
    }
    
    function handleAddResultSubmit(e) {
        e.preventDefault();
        const runId = $('#add-result-run-id').value;
        const scriptId = $('#add-result-script-id').value;
        const run = state.testRuns.find(r => r.id == runId);
        if (!run) return;

        const resultData = {
            scriptId: scriptId, status: $('#add-result-status').value,
            assignee: $('#add-result-assignee').value, actual: $('#add-result-actual').value,
            evidence: $('#add-result-evidence-data').value, comments: []
        };
        
        const resultIndex = (run.results || []).findIndex(r => r.scriptId == scriptId);
        if (resultIndex > -1) {
            run.results[resultIndex] = { ...run.results[resultIndex], ...resultData };
        } else {
            if (!run.results) run.results = [];
            run.results.push(resultData);
        }
        
        addActivity(`Hasil untuk ${$('#add-result-case-title').textContent} diupdate menjadi ${resultData.status}.`, 'run');
        closeModal('add-result-modal');
        renderAll();
        showToast('Hasil berhasil disimpan.');
    }
    
    function handleEvidencePaste(e) {
        e.preventDefault();
        const file = e.clipboardData.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target.result;
                $('#evidence-preview').src = base64String;
                $('#evidence-preview').classList.remove('hidden');
                $('#evidence-placeholder').classList.add('hidden');
                $('#add-result-evidence-data').value = base64String;
            };
            reader.readAsDataURL(file);
        }
    }
    
    function setupDragAndDrop() {
        const container = $('#test-script-groups-container');
        container.addEventListener('dragstart', e => {
            if (e.target.tagName === 'TR') {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            }
        });

        container.addEventListener('dragend', e => {
            if (e.target.tagName === 'TR') {
                e.target.classList.remove('dragging');
            }
        });

        container.addEventListener('dragover', e => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            }
        });
        
        container.addEventListener('dragleave', e => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                dropZone.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', e => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone) {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const draggedScriptId = e.dataTransfer.getData('text/plain');
                const targetFeature = dropZone.dataset.feature;
                
                const originalScript = state.testScripts.find(ts => ts.id == draggedScriptId);
                const targetUserStory = state.userStories.find(us => us.feature === targetFeature);

                if (originalScript && targetUserStory) {
                    const newScript = { ...originalScript, id: Date.now(), scriptId: generateNextScriptId(), userStoryId: targetUserStory.id };
                    state.testScripts.push(newScript);
                    addActivity(`Test Script ${originalScript.scriptId} diduplikasi ke fitur ${targetFeature}.`, 'create');
                    renderAll();
                    showToast('Test script berhasil diduplikasi.');
                } else {
                    showToast('Gagal menduplikasi: Fitur tujuan tidak valid.', 'error');
                }
            }
        });
    }

    function setupModalButtons() {
        $$('.btn-cancel').forEach(btn => btn.addEventListener('click', () => btn.closest('.modal').classList.remove('show')));
        
        $('#show-user-story-modal').addEventListener('click', () => {
            $('#user-story-form').reset();
            $('#user-story-id').value = '';
            openModal('user-story-modal');
        });
        $('#show-test-script-modal').addEventListener('click', () => {
            $('#test-script-form').reset();
            $('#test-script-id-form').value = '';
            $('#ts-script-id').value = generateNextScriptId();
            updateUserStoryLinkDropdown();
            renderTestStepTemplatesDropdown();
            openModal('test-script-modal');
        });
        $('#show-test-run-modal').addEventListener('click', () => {
            $('#test-run-name').value = '';
            const container = $('#test-run-scripts-selection');
            const groups = state.testScripts.reduce((acc, script) => {
                const us = state.userStories.find(u => u.id == script.userStoryId);
                const feature = us ? us.feature : 'Tanpa Fitur';
                if (!acc[feature]) acc[feature] = [];
                acc[feature].push(script);
                return acc;
            }, {});

            container.innerHTML = Object.keys(groups).sort().map(feature => `
                <details class="group" open>
                    <summary class="font-semibold cursor-pointer list-none flex items-center justify-between p-2 rounded-lg hover:bg-gray-100">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" class="select-all-feature-scripts h-4 w-4 rounded" data-feature="${feature}">
                            <span>${feature}</span>
                        </label>
                        <i data-feather="chevron-down" class="group-open:rotate-180 transition-transform"></i>
                    </summary>
                    <div class="pl-8 pt-2 space-y-2">
                        ${groups[feature].map(ts => `
                        <label class="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-50">
                            <input type="checkbox" name="test-run-script" value="${ts.id}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" data-feature="${feature}">
                            <span>${ts.scriptId}: ${ts.testCase}</span>
                        </label>`).join('')}
                    </div>
                </details>
            `).join('');
            feather.replace();
            openModal('test-run-modal');
        });
        
        $('#back-to-test-runs').addEventListener('click', () => switchTab('test-runs'));

        $('#test-run-detail-content').addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn-status')) {
                state.activeTestRunFilter = e.target.dataset.status;
                renderAll($('#test-run-detail-search').value);
            }
        });

        $('#save-steps-as-template-btn').addEventListener('click', () => {
            const stepsText = $('#ts-steps').value;
            if (!stepsText.trim()) {
                showToast('Tidak ada test step untuk disimpan.', 'error');
                return;
            }
            showPrompt({
                title: 'Simpan Template',
                message: 'Masukkan nama untuk template test step ini:'
            }, (templateName) => {
                state.testStepTemplates.push({ id: Date.now(), name: templateName, steps: stepsText });
                addActivity(`Template step "${templateName}" dibuat.`, 'create');
                saveData();
                renderTestStepTemplatesDropdown();
                showToast(`Template "${templateName}" berhasil disimpan.`);
            });
        });

        $('#ts-step-template-select').addEventListener('change', (e) => {
            const templateId = e.target.value;
            if (templateId) {
                const template = state.testStepTemplates.find(t => t.id == templateId);
                if (template) $('#ts-steps').value = template.steps;
            }
        });

        $('#show-export-modal-btn').addEventListener('click', () => {
            const featureList = $('#export-feature-list');
            const uniqueFeatures = [...new Set(state.userStories.map(us => us.feature || 'Tanpa Fitur'))];
            featureList.innerHTML = uniqueFeatures.map(feature => `
                <label class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" name="export-feature" value="${feature}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <span>${feature}</span>
                </label>
            `).join('');
            openModal('export-options-modal');
        });

        $('#show-import-modal-btn').addEventListener('click', () => {
            const featureSelect = $('#import-feature-select');
            const uniqueFeatures = [...new Set(state.userStories.map(us => us.feature || 'Tanpa Fitur'))];
            featureSelect.innerHTML = '<option value="">-- Pilih Fitur --</option>';
            featureSelect.innerHTML += uniqueFeatures.map(f => `<option value="${f}">${f}</option>`).join('');
            openModal('import-modal');
        });
        
        $('#export-select-all-features').addEventListener('change', (e) => {
            $$('input[name="export-feature"]').forEach(cb => cb.checked = e.target.checked);
        });

        $('#test-run-scripts-selection').addEventListener('change', e => {
            if (e.target.classList.contains('select-all-feature-scripts')) {
                const feature = e.target.dataset.feature;
                $$(`input[name="test-run-script"][data-feature="${feature}"]`).forEach(cb => cb.checked = e.target.checked);
            }
        });

        $('#dashboard-run-select').addEventListener('change', (e) => {
            state.dashboardSelectedRunId = e.target.value;
            renderAll();
        });
    }

    // FIXED EXPORT FUNCTION - Sesuai dengan format gambar yang diberikan
    function handleSelectiveExport(e) {
        e.preventDefault();
        const selectedFeatures = Array.from($$('input[name="export-feature"]:checked')).map(cb => cb.value);
        if (selectedFeatures.length === 0) {
            showToast('Pilih setidaknya satu fitur untuk diekspor.', 'error');
            return;
        }

        const filteredUserStories = state.userStories.filter(us => selectedFeatures.includes(us.feature || 'Tanpa Fitur'));
        const filteredUserStoryIds = new Set(filteredUserStories.map(us => us.id));
        const filteredTestScripts = state.testScripts.filter(ts => filteredUserStoryIds.has(parseInt(ts.userStoryId)));

        const wb = XLSX.utils.book_new();
        
        // Export Test Scripts dengan format yang sesuai dengan gambar
        const wsTestScript = XLSX.utils.json_to_sheet(filteredTestScripts.map(ts => ({
            'Test Phase/ Type': ts.phase || 'System Testing',
            'Script ID (TS- 2219)': ts.scriptId,
            'Test Scenario': ts.scenario,
            'Test Case': ts.testCase,
            'Pre-Condition': ts.precondition,
            'Test Data': ts.testData,
            'Test Steps': ts.steps,
            'Expected Result': ts.expected
        })));
        XLSX.utils.book_append_sheet(wb, wsTestScript, 'TEST SCRIPT');
        
        XLSX.writeFile(wb, `TestCase_Export_${selectedFeatures.join('_')}.xlsx`);
        showToast('Data berhasil diekspor ke Excel.');
        closeModal('export-options-modal');
    }

    function handleImport(e) {
        e.preventDefault();
        const file = $('#import-file-input').files[0];
        const selectedFeatureName = $('#import-feature-select').value; // Get selected feature
        
        if (!file) {
            showToast('Mohon pilih file terlebih dahulu.', 'error');
            return;
        }

        if (!selectedFeatureName) {
            showToast('Mohon pilih fitur tujuan terlebih dahulu.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Find target User Story based on selected feature
                let targetUserStory = state.userStories.find(us => us.feature === selectedFeatureName);

                // If feature doesn't exist, create a placeholder User Story for it
                if (!targetUserStory) {
                    targetUserStory = {
                        id: Date.now() + Math.random(),
                        feature: selectedFeatureName,
                        title: `User Story untuk ${selectedFeatureName}`,
                        asA: '', iWantTo: '', soThat: '', acceptanceCriteria: ''
                    };
                    state.userStories.push(targetUserStory);
                }

                const tsSheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('test script'));
                if (!tsSheetName) {
                    showToast('Sheet "Test Script" tidak ditemukan di dalam file.', 'error');
                    return;
                }

                const worksheet = workbook.Sheets[tsSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                let headerRowIndex = -1;
                let headers = [];

                for (let i = 0; i < json.length; i++) {
                    const row = json[i].map(cell => String(cell).toLowerCase().trim());
                    const hasScriptId = row.some(cell => cell.includes('script id') || cell.includes('scriptid'));
                    const hasTestCase = row.some(cell => cell.includes('test case') || cell.includes('testcase'));
                    const hasSteps = row.some(cell => cell.includes('steps') || cell.includes('test steps'));
                    const hasExpected = row.some(cell => cell.includes('expected') || cell.includes('expected result'));

                    if (hasScriptId && hasTestCase && hasSteps && hasExpected) {
                        headerRowIndex = i;
                        headers = json[i].map(cell => String(cell).trim());
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    showToast('Header table (Script ID, Test Case, Steps, Expected Result) tidak ditemukan di sheet.', 'error');
                    return;
                }
                
                const findKeyIndex = (searchTerms) => {
                    for (const term of searchTerms) {
                        const index = headers.findIndex(h => h.toLowerCase().replace(/\s+/g, ' ').includes(term));
                        if (index !== -1) return index;
                    }
                    return -1;
                };

                const scriptIdIndex = findKeyIndex(['script id', 'scriptid', 'script']);
                const testCaseIndex = findKeyIndex(['test case', 'testcase', 'case']);
                const scenarioIndex = findKeyIndex(['test scenario', 'scenario']);
                const phaseIndex = findKeyIndex(['test phase/ type', 'test phase', 'phase', 'type']);
                const preconditionIndex = findKeyIndex(['pre-condition', 'precondition']);
                const testDataIndex = findKeyIndex(['test data', 'testdata', 'data']);
                const stepsIndex = findKeyIndex(['test steps', 'steps']);
                const expectedIndex = findKeyIndex(['expected result', 'expected', 'expected outcome']);
                const priorityIndex = findKeyIndex(['priority']);
                const assigneeIndex = findKeyIndex(['assignee']);

                let importedCount = 0;
                let skippedCount = 0;

                for (let i = headerRowIndex + 1; i < json.length; i++) {
                    const row = json[i];
                    const scriptId = row[scriptIdIndex];
                    
                    if (!scriptId || String(scriptId).trim() === '') {
                        continue; 
                    }

                    if (state.testScripts.some(ts => ts.scriptId === String(scriptId))) {
                        skippedCount++;
                        continue;
                    }

                    const newScript = {
                        id: (Date.now() + importedCount),
                        userStoryId: targetUserStory.id, // Assign to the selected feature's user story
                        scriptId: String(scriptId),
                        testCase: row[testCaseIndex] || '',
                        scenario: row[scenarioIndex] || '',
                        phase: row[phaseIndex] || 'System Testing',
                        precondition: row[preconditionIndex] || '',
                        testData: row[testDataIndex] || '',
                        steps: row[stepsIndex] || '',
                        expected: row[expectedIndex] || '',
                        priority: row[priorityIndex] || 'Medium',
                        assignee: row[assigneeIndex] || ''
                    };
                    state.testScripts.push(newScript);
                    importedCount++;
                }

                addActivity(`${importedCount} test script diimpor ke fitur "${selectedFeatureName}".`, 'create');
                renderAll();
                closeModal('import-modal');
                showToast(`Impor Selesai: ${importedCount} berhasil, ${skippedCount} dilewati.`);

            } catch (error) {
                showToast('Gagal memproses file. Pastikan format benar.', 'error');
                console.error("Import error:", error);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    // --- INITIALIZATION ---
    init();

})();

