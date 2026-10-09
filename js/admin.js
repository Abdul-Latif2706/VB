document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =========================================================
        VELORIAN BANK — ADMIN DASHBOARD
        LOCAL STORAGE & OFFLINE-FIRST SYNC VERSION
        ========================================================= */

    // Ensure session recognizes admin credentials or local bypass
    const session = typeof vbGetSession === "function" ? vbGetSession() : { role: "admin" };

    if (!session || session.role !== "admin") {
        // Fallback check for local storage admin flag
        if (localStorage.getItem("velorian_admin_logged_in") !== "true") {
            window.location.href = "login.html";
            return;
        }
    }

    /* =========================================================
        HELPERS
        ========================================================= */

    const $ = (selector) => document.querySelector(selector);     const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const esc = (value) =>
        String(value ?? "").replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[char]));

    function getAdminToken() {
        return (
            sessionStorage.getItem("vb_api_admin_token") ||
            localStorage.getItem("vb_api_admin_token") ||
            sessionStorage.getItem("admin_token") ||
            localStorage.getItem("admin_token") ||
            sessionStorage.getItem("token") ||
            localStorage.getItem("token") ||
            ""
        );
    }

    function onlineMode() {
        return (
            typeof vbOnlineEnabled === "function" &&
            vbOnlineEnabled()
        );
    }

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
        if (typeof vbGetState === "function") {
            return vbGetState();
        }

        let state = {
            clients: [],
            transactions: [],
            audit: [],
            bank: {}
        };

        try {
            const raw = localStorage.getItem("velorian_state");
            if (raw) {
                state = JSON.parse(raw);
            }
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

    function findClient(id) {
        if (typeof vbFindClient === "function") {
            return vbFindClient(id);
        }
        return getState().clients.find((client) => client.id === id || client.accountNumber === id);
    }

    function transactionClient(transaction) {
        return getState().clients.find(
            (client) => client.id === transaction.clientId || client.accountNumber === transaction.accountNumber
        );
    }

    function statusClass(status) {
        if (status === "Active" || status === "Success") {
            return "badge-success";
        }
        if (status === "Frozen" || status === "Closed" || status === "Failed") {
            return "badge-danger";
        }
        return "badge-pending";
    }

    function transactionTypeLabel(type) {
        switch (type) {
            case "deposit": return "Deposit";
            case "withdrawal": return "Withdrawal";
            case "transfer_in": return "Transfer received";
            case "transfer_out": return "Transfer sent";
            default: return type || "Transaction";
        }
    }

    /* =========================================================
        ADMIN TRANSACTION SYNC & RECORDING (CRITICAL FOR CLIENT DASHBOARD PARITY)
        ========================================================= */

    window.recordAdminTransaction = function(clientId, type, amount, description) {
        const state = getState();
        const client = state.clients.find(c => c.id === clientId || c.accountNumber === clientId);
        if (!client) return;

        if (!Array.isArray(client.transactions)) {
            client.transactions = [];
        }

        const numericAmount = parseFloat(amount) || 0;
        const txId = 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const timestamp = new Date().toISOString();

        const newTransaction = {
            id: txId,
            clientId: client.id,
            accountNumber: client.accountNumber,
            type: type, 
            amount: numericAmount,
            currency: client.currency || 'USD',
            description: description || 'Admin Balance Adjustment',
            status: 'Success',
            timestamp: timestamp
        };

        // Update client balance securely
        if (type.toLowerCase() === 'deposit' || type.toLowerCase() === 'transfer_in' || type.toLowerCase() === 'credit') {
            client.balance = Number(client.balance || 0) + numericAmount;
        } else {
            client.balance = Number(client.balance || 0) - numericAmount;
        }

        // Push to client's personal transaction history so it renders on their dashboard
        client.transactions.unshift(newTransaction);

        // Push to global admin ledger
        state.transactions.unshift(newTransaction);

        saveState(state);
        renderAll();
        toast("Transaction recorded and synced to client dashboard successfully.");
    };

    /* =========================================================
        RENDER CONTROLLER
        ========================================================= */

    function renderAll() {
        renderStats();
        renderChart();
        renderStatus();
        renderRecent();
        renderTopClients();
        renderClients();
        renderTransactions();
    }

    /* =========================================================
        NAVIGATION
        ========================================================= */

    function switchSection(name) {
        $$(".dashboard-section").forEach((section) => {
            section.classList.remove("active");
        });

        const section = $(`#${name}Section`);
        if (section) {
            section.classList.add("active");
        }

        $$(".nav-item").forEach((button) => {
            button.classList.toggle("active", button.dataset.section === name);
        });

        const titles = {
            overview: "System Overview",
            clients: "Client Accounts",
            transactions: "System Transactions",
            audit: "Audit Trail",
            settings: "System Settings"
        };

        const title = $("#pageTitle");
        if (title) {
            title.textContent = titles[name] || "Velorian Bank";
        }

        $("#sidebar")?.classList.remove("open");
        $("#mobileOverlay")?.classList.remove("open");
    }

    $$("[data-section]").forEach((button) => {         button.addEventListener("click", () => {             switchSection(button.dataset.section);         });     });      $$
("[data-go]").forEach((button) => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.go);
        });
    });

    /* =========================================================
        MOBILE MENU
        ========================================================= */

    $("#menuBtn")?.addEventListener("click", () => {
        $("#sidebar")?.classList.toggle("open");
        $("#mobileOverlay")?.classList.toggle("open");
    });

    $("#mobileOverlay")?.addEventListener("click", () => {
        $("#sidebar")?.classList.remove("open");
        $("#mobileOverlay")?.classList.remove("open");
    });

    /* =========================================================
        MODALS
        ========================================================= */

    $$("[data-close]").forEach((button) => {         button.addEventListener("click", () => {             closeModal(button.dataset.close);         });     });      $$
(".modal-backdrop").forEach((backdrop) => {
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                backdrop.classList.remove("open");
            }
        });
    });

    /* =========================================================
        CURRENCY TOTALS
        ========================================================= */

    function totalsByCurrency(items) {
        const totals = { USD: 0, GBP: 0, EUR: 0 };

        items.forEach((item) => {
            const currency = item.currency || findClient(item.clientId || item.accountNumber)?.currency || "USD";
            totals[currency] = (totals[currency] || 0) + Number(item.amount || 0);
        });

        return (
            Object.entries(totals)
                .filter(([, value]) => value !== 0)
                .map(([currency, value]) => typeof vbFormatMoney === "function" ? vbFormatMoney(value, currency) : `${currency} ${value.toFixed(2)}`)
                .join(" • ") || "$0.00"
        );
    }

    /* =========================================================
        STATISTICS
        ========================================================= */

    function renderStats() {
        const state = getState();
        const deposits = state.transactions.filter((t) => t.type === "deposit");
        const withdrawals = state.transactions.filter((t) => t.type === "withdrawal");
        const transfers = state.transactions.filter((t) => t.type === "transfer_out");
        const element = $("#adminStats");

        if (!element) return;

        const stats = [
            ["Active clients", state.clients.filter((c) => c.status === "Active").length, "Registered accounts", "blue"],
            ["Total balances", totalsByCurrency(state.clients.map((c) => ({ amount: c.balance, currency: c.currency }))), "By account currency", "gold"],
            ["Deposits", totalsByCurrency(deposits), "All-time deposits", "green"],
            ["Withdrawals", totalsByCurrency(withdrawals), "All-time withdrawals", "red"],
            ["Transfers", totalsByCurrency(transfers), "Sender-side volume", "blue"],
            ["Transactions", state.transactions.length, "Ledger entries", "gold"]
        ];

        element.innerHTML = stats
            .map((item) => `
                <article class="stat-card glass">
                    <div class="stat-top">
                        <span>${esc(item[0])}</span>
                        <span class="stat-icon ${item[3]}">◈</span>
                    </div>
                    <strong>${esc(item[1])}</strong>
                    <small>${esc(item[2])}</small>
                </article>
            `)
            .join("");
    }

    /* =========================================================
        CHART
        ========================================================= */

    function renderChart() {
        const state = getState();
        const days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);
            const key = date.toISOString().slice(0, 10);

            const count = state.transactions.filter((t) => String(t.timestamp || "").slice(0, 10) === key).length;
            days.push({
                label: date.toLocaleDateString("en-US", { weekday: "short" }),
                count
            });
        }

        const chart = $("#volumeChart");
        if (!chart) return;

        const max = Math.max(...days.map((d) => d.count), 1);

        chart.innerHTML = days
            .map((day) => `
                <div class="bar-col">
                    <div class="bar-value">${day.count || ""}</div>
                    <div class="bar-track">
                        <i style="height:${Math.max(5, (day.count / max) * 100)}%"></i>
                    </div>
                    <span>${esc(day.label)}</span>
                </div>
            `)
            .join("");
    }

    /* =========================================================
        ACCOUNT STATUS
        ========================================================= */

    function renderStatus() {
        const state = getState();
        const total = Math.max(state.clients.length, 1);
        const statuses = [
            ["Active", "green"],
            ["Frozen", "red"],
            ["Suspended", "gold"],
            ["Closed", "blue"]
        ];

        const element = $("#statusBreakdown");
        if (!element) return;

        element.innerHTML = statuses
            .map(([status, color]) => {
                const count = state.clients.filter((c) => c.status === status).length;
                return `
                    <div class="status-line">
                        <div>
                            <span>${esc(status)}</span>
                            <strong>${count}</strong>
                        </div>
                        <div class="status-bar">
                            <i class="${color}" style="width:${(count / total) * 100}%"></i>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    /* =========================================================
        RECENT TRANSACTIONS
        ========================================================= */

    function renderRecent() {
        const state = getState();
        const element = $("#recentTransactions");
        if (!element) return;

        const rows = state.transactions
            .slice(0, 7)
            .map((transaction) => {
                const client = transactionClient(transaction);
                const positive = transaction.type === "deposit" || transaction.type === "transfer_in" || transaction.type === "credit";

                return `
                    <tr>
                        <td><strong>${esc(client?.name || "Unknown")}</strong></td>
                        <td>${esc(transactionTypeLabel(transaction.type))}</td>
                        <td class="${positive ? "amount-positive" : "amount-negative"}">
                            ${positive ? "+" : "-"} ${typeof vbFormatMoney === "function" ? vbFormatMoney(transaction.amount, client?.currency || transaction.currency || "USD") : transaction.amount}
                        </td>
                        <td><span class="badge ${statusClass(transaction.status)}">${esc(transaction.status)}</span></td>
                        <td>${transaction.timestamp ? new Date(transaction.timestamp).toLocaleDateString() : "Recent"}</td>
                    </tr>
                `;
            })
            .join("");

        element.innerHTML = rows || `<tr><td colspan="5"><div class="empty-state">No transactions yet.</div></td></tr>`;
    }

    /* =========================================================
        TOP CLIENTS
        ========================================================= */

    function renderTopClients() {
        const state = getState();
        const element = $("#topClients");
        if (!element) return;

        const clients = [...state.clients]
            .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
            .slice(0, 5);

        element.innerHTML = clients
            .map((client) => `
                <div class="client-row">
                    <div class="avatar">${esc(client.name ? client.name.split(" ").map(n => n[0]).join("").toUpperCase() : "VB")}</div>
                    <div>
                        <strong>${esc(client.name)}</strong>
                        <small>${esc(client.accountNumber)} • ${esc(client.accountType)}</small>
                    </div>
                    <span class="balance-mini">${typeof vbFormatMoney === "function" ? vbFormatMoney(client.balance, client.currency) : client.balance}</span>
                </div>
            `)
            .join("") || `<div class="empty-state">No client accounts yet.</div>`;
    }

    /* =========================================================
        CLIENT TABLE & MANAGEMENT
        ========================================================= */

    function renderClients() {
        const state = getState();
        const search = ($("#clientSearch")?.value || "").toLowerCase().trim();
        const filter = $("#clientStatusFilter")?.value || "all";

        const clients = state.clients.filter((client) => {
            const searchText = `${client.name || ""} ${client.email || ""} ${client.accountNumber || ""}`.toLowerCase();
            const matchesSearch = !search || searchText.includes(search);
            const matchesStatus = filter === "all" || client.status === filter;
            return matchesSearch && matchesStatus;
        });

        const count = $("#clientCount");
        if (count) {
            count.textContent = `${clients.length} of ${state.clients.length} clients`;
        }

        const table = $("#clientsTable");
        if (!table) return;

        table.innerHTML = clients
            .map((client) => {
                const activity = state.transactions.filter((t) => t.clientId === client.id || t.accountNumber === client.accountNumber).length;

                return `
                    <tr>
                        <td>
                            <div class="client-cell">
                                <div class="avatar small">${esc(client.name ? client.name.split(" ").map(n => n[0]).join("").toUpperCase() : "VB")}</div>
                                <div>
                                    <strong>${esc(client.name)}</strong>
                                    <small>${esc(client.email)}</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <strong>${esc(client.accountNumber)}</strong>
                            <small>${esc(client.accountType)}</small>
                        </td>
                        <td><strong>${typeof vbFormatMoney === "function" ? vbFormatMoney(client.balance, client.currency) : client.balance}</strong></td>
                        <td>${activity}</td>
                        <td><span class="badge ${statusClass(client.status)}">${esc(client.status)}</span></td>
                        <td>
                            <button type="button" class="action-btn" data-view-client="${esc(client.id)}">Manage</button>
                            <button type="button" class="action-btn danger-action" data-delete-client="${esc(client.id)}">Delete</button>
                        </td>
                    </tr>
                `;
            })
            .join("") || `<tr><td colspan="6"><div class="empty-state">No clients match your search.</div></td></tr>`;
    }

    /* =========================================================
        TRANSACTION TABLE
        ========================================================= */

    function renderTransactions() {
        const state = getState();
        const search = ($("#transactionSearch")?.value || "").toLowerCase().trim();
        const typeFilter = $("#transactionFilter")?.value || "all";
        const statusFilter = $("#transactionStatusFilter")?.value || "all";

        const transactions = state.transactions.filter((transaction) => {
            const client = transactionClient(transaction);
            const searchText = `${transaction.id || ""} ${client?.name || ""} ${client?.accountNumber || ""}`.toLowerCase();
            const matchesSearch = !search || searchText.includes(search);
            const matchesType = typeFilter === "all" || transaction.type === typeFilter;
            const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
            return matchesSearch && matchesType && matchesStatus;
        });

        const table = $("#transactionsTable");
        if (!table) return;

        table.innerHTML = transactions
            .map((transaction) => {
                const client = transactionClient(transaction);
                const positive = transaction.type === "deposit" || transaction.type === "transfer_in" || transaction.type === "credit";

                return `
                    <tr>
                        <td><strong>${esc(transaction.id)}</strong></td>
                        <td>${esc(client?.name || "Unknown")}</td>
                        <td>${esc(client?.accountNumber || "—")}</td>
                        <td>${esc(transactionTypeLabel(transaction.type))}</td>
                        <td class="${positive ? "amount-positive" : "amount-negative"}">
                            ${positive ? "+" : "-"} ${typeof vbFormatMoney === "function" ? vbFormatMoney(transaction.amount, client?.currency || transaction.currency || "USD") : transaction.amount}
                        </td>
                        <td><span class="badge ${statusClass(transaction.status)}">${esc(transaction.status)}</span></td>
                        <td>${transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : "Recent"}</td>
                    </tr>
                `;
            })
            .join("") || `<tr><td colspan="7"><div class="empty-state">No transactions found.</div></td></tr>`;
    }

    // Event delegation for actions (Manage / Delete clients)
    document.addEventListener("click", (e) => {
        const deleteBtn = e.target.closest("[data-delete-client]");
        if (deleteBtn) {
            const clientId = deleteBtn.dataset.deleteClient;
            if (confirm("Are you sure you want to delete this client account?")) {
                let state = getState();
                state.clients = state.clients.filter(c => c.id !== clientId);
                saveState(state);
                renderAll();
                toast("Client account deleted successfully.", "success");
            }
        }
    });

    // Initial render call
    renderAll();
});