document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =========================================================
        VELORIAN BANK — ADMIN DASHBOARD
        ========================================================= */

    const session = typeof vbGetSession === "function" ? vbGetSession() : { role: "admin" };

    if (!session || session.role !== "admin") {
        if (localStorage.getItem("velorian_admin_logged_in") !== "true") {
            window.location.href = "login.html";
            return;
        }
    }

    const $ = (selector) => document.querySelector(selector); const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const esc = (value) =>
        String(value ?? "").replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[char]));

    function toast(message, type = "success") {
        const element = $("#toast");
        if (!element) {
            console.log(message);
            return;
        }
        element.textContent = message;
        element.className = `toast show ${type}`;
        clearTimeout(window.velorianToastTimer);
        window.velorianToastTimer = setTimeout(() => {
            element.className = "toast";
        }, 3500);
    }

    function modal(id, open = true) {
        const element = $(`#${id}`);
        if (!element) return;
        element.classList.toggle("open", open);
    }

    function closeModal(id) {
        modal(id, false);
    }

    function getState() {
        if (typeof vbGetState === "function") return vbGetState();
        let state = { clients: [], transactions: [], audit: [], bank: {} };
        try {
            const raw = localStorage.getItem("velorian_state");
            if (raw) state = JSON.parse(raw);
        } catch (e) {}
        if (!Array.isArray(state.clients)) state.clients = [];
        if (!Array.isArray(state.transactions)) state.transactions = [];
        return state;
    }

    function saveState(state) {
        if (typeof vbSaveState === "function") {
            vbSaveState(state);
            return;
        }
        localStorage.setItem("velorian_state", JSON.stringify(state));
    }

    /* =========================================================
        MOBILE MENU & NAVIGATION
        ========================================================= */

    const menuBtn = $("#menuBtn");
    const sidebar = $("#sidebar");
    const mobileOverlay = $("#mobileOverlay");      if (menuBtn) { menuBtn.addEventListener("click", () => { sidebar?.classList.toggle("open"); mobileOverlay?.classList.toggle("open"); }); }      if (mobileOverlay) { mobileOverlay.addEventListener("click", () => { sidebar?.classList.remove("open"); mobileOverlay?.classList.remove("open"); }); }      function switchSection(name) { $$(".dashboard-section").forEach((section) => {
            section.classList.remove("active");
        });

        const section = $(`#${name}Section`);
        if (section) {
            section.classList.add("active");
        }

        $$(".nav-item").forEach((button) => { button.classList.toggle("active", button.dataset.section === name); });          sidebar?.classList.remove("open"); mobileOverlay?.classList.remove("open"); }      $$
("[data-section]").forEach((button) => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.section);
        });
    });

    /* =========================================================
        MODAL & BUTTON TRIGGERS (FIXED)
        ========================================================= */

    document.addEventListener("click", (e) => {
        // 1. Open New Client Modal
        if (e.target.closest("#quickAddClient") || e.target.closest("#addClientBtn")) {
            e.preventDefault();
            modal("clientModal", true);
        }

        // 2. Open Post Transaction Modal
        if (e.target.closest("#openPostTransaction")) {
            e.preventDefault();
            modal("postTransactionModal", true);
        }

        // 3. Admin Sign Out
        if (e.target.closest("#adminLogout")) {
            e.preventDefault();
            localStorage.removeItem("velorian_admin_logged_in");
            if (typeof vbLogout === "function") vbLogout();
            window.location.href = "login.html";
        }

        // 4. Modal Close Handling (× or background backdrop)
        const closeBtn = e.target.closest(".modal-close, [data-close]");
        if (closeBtn) {
            e.preventDefault();
            const targetId = closeBtn.getAttribute("data-close");
            if (targetId) {
                closeModal(targetId);
            } else {
                const backdrop = closeBtn.closest(".modal-backdrop");
                if (backdrop) {
                    backdrop.classList.remove("open");
                }
            }
        }

        const backdrop = e.target.closest(".modal-backdrop");
        if (backdrop && e.target === backdrop) {
            backdrop.classList.remove("open");
        }

        // 5. Handle Approve / Accept Client Action
        const approveBtn = e.target.closest("[data-approve-client]");
        if (approveBtn) {
            const clientId = approveBtn.dataset.approveClient;
            let state = getState();
            const client = state.clients.find(c => c.id === clientId);
            if (client) {
                client.status = "Active";
                saveState(state);
                renderAll();
                toast(`Client account for ${client.name} has been approved and activated.`, "success");
            }
        }

        // 6. Handle Reject Client Action
        const rejectBtn = e.target.closest("[data-reject-client]");
        if (rejectBtn) {
            const clientId = rejectBtn.dataset.rejectClient;
            if (confirm("Are you sure you want to reject this account application?")) {
                let state = getState();
                state.clients = state.clients.filter(c => c.id !== clientId);
                saveState(state);
                renderAll();
                toast("Client application rejected and removed.", "warning");
            }
        }
    });

    /* =========================================================
        PENDING CLIENT APPROVAL WORKFLOW
        ========================================================= */

    function renderPendingClients() {
        const state = getState();
        const pendingClients = state.clients.filter(c => c.status === "Pending");

        const pendingTable = $("#pendingClientsTable");
        if (pendingTable) {
            pendingTable.innerHTML = pendingClients.map(client => `
                <tr>
                    <td><strong>${esc(client.name)}</strong><br><small>${esc(client.email)}</small></td>
                    <td>${esc(client.accountType)} — ${esc(client.currency)}</td>
                    <td>${new Date(client.createdAt).toLocaleDateString()}</td>
                    <td>
                        <button type="button" class="action-btn success-action" data-approve-client="${esc(client.id)}">Accept</button>
                        <button type="button" class="action-btn danger-action" data-reject-client="${esc(client.id)}">Reject</button>
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="4"><div class="empty-state">No pending client requests.</div></td></tr>`;
        }
    }

    /* =========================================================
        RENDER CONTROLLER
        ========================================================= */

    function renderAll() {
        renderPendingClients();
    }

    renderAll();
});