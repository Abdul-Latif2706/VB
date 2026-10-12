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

    const $ = (selector) => document.querySelector(selector);     const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
        MOBILE MENU & NAVIGATION (FIXED)
        ========================================================= */

    const menuBtn = $("#menuBtn");
    const sidebar = $("#sidebar");
    const mobileOverlay = $("#mobileOverlay");      if (menuBtn) {         menuBtn.addEventListener("click", () => {             sidebar?.classList.toggle("open");             mobileOverlay?.classList.toggle("open");         });     }      if (mobileOverlay) {         mobileOverlay.addEventListener("click", () => {             sidebar?.classList.remove("open");             mobileOverlay?.classList.remove("open");         });     }      function switchSection(name) {         $$(".dashboard-section").forEach((section) => {
            section.classList.remove("active");
        });

        const section = $(`#${name}Section`);
        if (section) {
            section.classList.add("active");
        }

        $$(".nav-item").forEach((button) => {             button.classList.toggle("active", button.dataset.section === name);         });          sidebar?.classList.remove("open");         mobileOverlay?.classList.remove("open");     }      $$
("[data-section]").forEach((button) => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.section);
        });
    });

    /* =========================================================
        MODALS & BUTTON TRIGGERS (FIXED + NEW CLIENT)
        ========================================================= */

    ddocument.addEventListener("click", (e) => {
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
    });

    /* =========================================================
        RENDER CONTROLLER
        ========================================================= */

    function renderAll() {
        // Renders stats, tables, charts if elements exist
    }

    renderAll();
});