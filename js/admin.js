document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =========================================================
       VELORIAN BANK — ADMIN DASHBOARD
       Client application approval workflow
       ========================================================= */

    const session =
        typeof vbGetSession === "function"
            ? vbGetSession()
            : null;

    if (!session || session.role !== "admin") {
        window.location.href = "login.html";
        return;
    }

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(
        document.querySelectorAll(selector)
    );

    const esc = (value) =>
        String(value ?? "").replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[char]));

    /* =========================================================
       TOAST NOTIFICATIONS
       ========================================================= */

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

    /* =========================================================
       MODALS
       ========================================================= */

    function modal(id, open = true) {
        const element = document.getElementById(id);

        if (element) {
            element.classList.toggle("open", open);
        }
    }

    function closeModal(id) {
        modal(id, false);
    }

    /* =========================================================
       STATE MANAGEMENT
       ========================================================= */

    function getState() {
        let state = {
            clients: [],
            transactions: [],
            audit: [],
            bank: {}
        };

        try {
            if (typeof vbGetState === "function") {
                state = vbGetState() || state;
            } else {
                const raw = localStorage.getItem("velorian_state");

                if (raw) {
                    state = JSON.parse(raw);
                }
            }
        } catch (error) {
            console.error("Unable to read Velorian Bank state:", error);
        }

        if (!Array.isArray(state.clients)) {
            state.clients = [];
        }

        if (!Array.isArray(state.transactions)) {
            state.transactions = [];
        }

        if (!Array.isArray(state.audit)) {
            state.audit = [];
        }

        return state;
    }

    function saveState(state) {
        try {
            if (typeof vbSaveState === "function") {
                vbSaveState(state);
            } else {
                localStorage.setItem(
                    "velorian_state",
                    JSON.stringify(state)
                );
            }

            window.dispatchEvent(
                new CustomEvent("velorian:statechange")
            );

            return true;
        } catch (error) {
            console.error("Unable to save Velorian Bank state:", error);
            toast("Unable to save the application update.", "error");
            return false;
        }
    }

    function normaliseStatus(status) {
        return String(status || "").trim().toLowerCase();
    }

    function getPendingClients(state = getState()) {
        return state.clients.filter(
            client => normaliseStatus(client.status) === "pending"
        );
    }

    /* =========================================================
       AUDIT LOG
       ========================================================= */

    function addAuditEntry(state, action, client) {
        state.audit.unshift({
            id: `AUD-${Date.now()}-${Math.random()
                .toString(36).slice(2, 8)}`,
            action,
            clientId: String(client.id ?? ""),
            clientName: String(client.name ?? ""),
            timestamp: new Date().toISOString(),
            performedBy: String(session.email || session.name || "Administrator")
        });

        // Keep the latest 500 entries.
        state.audit = state.audit.slice(0, 500);
    }

    /* =========================================================
       NAVIGATION AND MOBILE MENU
       ========================================================= */

    const menuBtn = $("#menuBtn");
    const sidebar = $("#sidebar");
    const mobileOverlay = $("#mobileOverlay");

    function closeMobileMenu() {
        sidebar?.classList.remove("open");
        mobileOverlay?.classList.remove("open");
    }

    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            sidebar?.classList.toggle("open");
            mobileOverlay?.classList.toggle("open");
        });
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener("click", closeMobileMenu);
    }

    function switchSection(name) {
        $$(".dashboard-section").forEach(section => {
            section.classList.remove("active");
        });

        const section = document.getElementById(`${name}Section`);

        if (section) {
            section.classList.add("active");
        }

        $$(".nav-item").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.section === name
            );
        });

        closeMobileMenu();

        if (name === "pending" || name === "applications") {
            renderPendingClients();
        }
    }

    $$("[data-section]").forEach(button => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.section);
        });
    });

    /* =========================================================
       PENDING APPLICATION NOTIFICATION COUNTS
       ========================================================= */

    function renderPendingCount() {
        const count = getPendingClients().length;

        // Add any of these IDs to your HTML if needed.
        [
            "#pendingApplicationsCount",
            "#pendingClientsCount",
            "#pendingCount",
            "#pendingBadge"
        ].forEach(selector => {
            const element = $(selector);

            if (element) {
                element.textContent = count;
                element.hidden = count === 0;
            }
        });

        // Or use data-pending-count on any badge.
        $$("[data-pending-count]").forEach(element => {
            element.textContent = count;
            element.hidden = count === 0;
        });

        // Update navigation labels if the matching element exists.
        const pendingNav = $('[data-section="pending"]');
        if (pendingNav) {
            pendingNav.setAttribute(
                "aria-label",
                `Pending applications: ${count}`
            );
        }

        return count;
    }

    /* =========================================================
       PENDING APPLICATION TABLE
       ========================================================= */

    function formatDate(value) {
        if (!value) return "Not available";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function renderPendingClients() {
        const state = getState();
        const pendingClients = getPendingClients(state);

        const table = $("#pendingClientsTable");
        const emptyMessage = $("#pendingClientsEmpty");

        renderPendingCount();

        if (emptyMessage) {
            emptyMessage.hidden = pendingClients.length > 0;
        }

        if (!table) {
            console.warn(
                "Add a table with id='pendingClientsTable' to the admin HTML."
            );
            return;
        }

        table.innerHTML = pendingClients.map(client => {
            const clientId = String(client.id ?? "");
            const createdAt =
                client.createdAt ||
                client.created_at ||
                client.registeredAt ||
                client.registered_at;

            return `
                <tr>
                    <td>
                        <strong>${esc(client.name || "Unnamed applicant")}</strong>
                        <br>
                        <small>${esc(client.email || "No email provided")}</small>
                    </td>

                    <td>${esc(client.phone || client.phoneNumber || "—")}</td>

                    <td>${esc(client.country || "—")}</td>

                    <td>${esc(client.accountType || client.account_type || "Savings Account")}</td>

                    <td>${esc(client.currency || "USD")}</td>

                    <td>${esc(formatDate(createdAt))}</td>

                    <td>
                        <div class="application-actions">
                            <button
                                type="button"
                                class="action-btn success-action"
                                data-approve-client="${esc(clientId)}"
                            >
                                Accept
                            </button>

                            <button
                                type="button"
                                class="action-btn danger-action"
                                data-reject-client="${esc(clientId)}"
                            >
                                Reject
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        if (pendingClients.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            No pending client applications.
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    /* =========================================================
       ACCEPT APPLICATION
       LOCAL-STATE DEMO ONLY — NOT LIVE DATABASE APPROVAL
       ========================================================= */

    function approveClient(clientId) {
        const state = getState();

        const client = state.clients.find(
            item => String(item.id) === String(clientId)
        );

        if (!client) {
            toast("Application not found. Refresh and try again.", "error");
            return;
        }

        if (normaliseStatus(client.status) !== "pending") {
            toast("This application is no longer pending.", "warning");
            renderAll();
            return;
        }

        const confirmed = window.confirm(
            `Accept the application from ${client.name || "this applicant"}?`
        );

        if (!confirmed) return;

        /*
         * IMPORTANT:
         * This changes local application state only.
         * A live PHP/MySQL system must perform approval on the server,
         * generate the account number there, and send the confirmation
         * email only after the server successfully approves the application.
         */

        client.status = "Active";
        client.approvedAt = new Date().toISOString();
        client.approvedBy = String(
            session.email || session.name || "Administrator"
        );

        addAuditEntry(state, "CLIENT_APPLICATION_APPROVED", client);

        if (!saveState(state)) return;

        renderAll();

        toast(
            `Application for ${client.name || "the client"} accepted.`,
            "success"
        );
    }

    /* =========================================================
       REJECT APPLICATION
       KEEP THE APPLICATION FOR AUDIT HISTORY
       ========================================================= */

    function rejectClient(clientId) {
        const state = getState();

        const client = state.clients.find(
            item => String(item.id) === String(clientId)
        );

        if (!client) {
            toast("Application not found. Refresh and try again.", "error");
            return;
        }

        if (normaliseStatus(client.status) !== "pending") {
            toast("This application is no longer pending.", "warning");
            renderAll();
            return;
        }

        const confirmed = window.confirm(
            `Reject the application from ${client.name || "this applicant"}?`
        );

        if (!confirmed) return;

        // Do not delete the record; retain it for audit/history.
        client.status = "Rejected";
        client.rejectedAt = new Date().toISOString();
        client.rejectedBy = String(
            session.email || session.name || "Administrator"
        );

        addAuditEntry(state, "CLIENT_APPLICATION_REJECTED", client);

        if (!saveState(state)) return;

        renderAll();

        toast(
            `Application for ${client.name || "the client"} rejected.`,
            "warning"
        );
    }

    /* =========================================================
       CLICK HANDLERS
       ========================================================= */

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        // Modal close buttons.
        const closeButton = target.closest(".modal-close, [data-close]");

        if (closeButton) {
            event.preventDefault();

            const targetId = closeButton.getAttribute("data-close");

            if (targetId) {
                closeModal(targetId);
            } else {
                closeButton.closest(".modal-backdrop")
                    ?.classList.remove("open");
            }

            return;
        }

        // Close modal when clicking the backdrop.
        const backdrop = target.closest(".modal-backdrop");

        if (backdrop && target === backdrop) {
            backdrop.classList.remove("open");
            return;
        }

        // Accept application.
        const approveButton = target.closest("[data-approve-client]");

        if (approveButton) {
            event.preventDefault();

            const clientId = approveButton.dataset.approveClient;

            if (clientId) {
                approveClient(clientId);
            }

            return;
        }

        // Reject application.
        const rejectButton = target.closest("[data-reject-client]");

        if (rejectButton) {
            event.preventDefault();

            const clientId = rejectButton.dataset.rejectClient;

            if (clientId) {
                rejectClient(clientId);
            }
        }
    });

    /* =========================================================
       RENDER CONTROLLER
       ========================================================= */

    function renderAll() {
        renderPendingClients();

        /*
         * If your existing admin.js has other rendering functions,
         * keep those functions and call them here as well.
         *
         * For example:
         * renderStats();
         * renderClients();
         * renderTransactions();
         *
         * Do not call a function unless it exists in your actual file.
         */
    }

    /* =========================================================
       REFRESH WHEN STATE CHANGES
       ========================================================= */

    window.addEventListener("velorian:statechange", () => {
        renderAll();
    });

    window.addEventListener("storage", () => {
        renderAll();
    });

    // Initial render.
    renderAll();
});