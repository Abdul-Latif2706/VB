document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);

    const session =
        typeof vbGetSession === "function"
            ? vbGetSession()
            : null;

    if (!session || session.role !== "client") {
        return;
    }

    if (
        typeof vbOnlineEnabled !== "function" ||
        !vbOnlineEnabled()
    ) {
        return;
    }

    const token =
        sessionStorage.getItem("vb_api_client_token");

    if (!token) {
        return;
    }

    let activeReference = "";
    let otpTimer = null;


    /* ============================================================
       TOAST
    ============================================================ */

    function showToast(message, type = "success") {

        const toast = $("#toast");

        if (!toast) {
            return;
        }

        clearTimeout(
            window.velorianToastTimer
        );

        toast.textContent = message;

        toast.className =
            `toast show ${type}`;

        window.velorianToastTimer =
            setTimeout(() => {

                toast.className = "toast";

            }, 4000);
    }


    /* ============================================================
       MODALS
    ============================================================ */

    function openModal(id) {

        const modal =
            document.getElementById(id);

        if (modal) {
            modal.classList.add("open");
        }
    }


    function closeModal(id) {

        const modal =
            document.getElementById(id);

        if (modal) {
            modal.classList.remove("open");
        }
    }


    /* ============================================================
       FORM MESSAGES
    ============================================================ */

    function showMessage(
        element,
        text,
        type = "error"
    ) {

        if (!element) {
            return;
        }

        element.textContent = text;

        element.className =
            `form-error full-field ${type} show`;
    }


    function clearMessage(element) {

        if (!element) {
            return;
        }

        element.textContent = "";

        element.className =
            "form-error full-field";
    }


    /* ============================================================
       CURRENT CLIENT
    ============================================================ */

    function getCurrentClient() {

        if (
            typeof vbGetState !==
            "function"
        ) {
            return null;
        }

        const state =
            vbGetState();

        if (
            !state ||
            !Array.isArray(state.clients)
        ) {
            return null;
        }

        return (
            state.clients.find(
                client =>
                    String(client.id || "") ===
                    String(session.clientId || "")
            )
            ||
            state.clients.find(
                client =>
                    String(
                        client.accountNumber || ""
                    ) ===
                    String(
                        session.accountNumber || ""
                    )
            )
            ||
            null
        );
    }


    /* ============================================================
       REMOTE CLIENT SYNCHRONIZATION
    ============================================================ */

    function mergeRemoteClient(remoteClient) {

        if (
            !remoteClient ||
            typeof vbGetState !== "function" ||
            typeof vbSaveState !== "function"
        ) {
            return false;
        }

        const state =
            vbGetState();

        if (
            !state ||
            !Array.isArray(state.clients)
        ) {
            return false;
        }

        const remoteId =
            String(
                remoteClient.id ||
                remoteClient.clientId ||
                remoteClient.client_id ||
                ""
            ).trim();

        const remoteAccountNumber =
            String(
                remoteClient.accountNumber ||
                remoteClient.account_number ||
                ""
            ).trim();

        const remoteEmail =
            String(
                remoteClient.email ||
                ""
            )
                .trim()
                .toLowerCase();


        let localClient =
            state.clients.find(
                client =>
                    remoteId &&
                    String(
                        client.id || ""
                    ).trim() === remoteId
            );


        if (!localClient && remoteAccountNumber) {

            localClient =
                state.clients.find(
                    client =>
                        String(
                            client.accountNumber || ""
                        ).trim() ===
                        remoteAccountNumber
                );
        }


        if (!localClient && remoteEmail) {

            localClient =
                state.clients.find(
                    client =>
                        String(
                            client.email || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        remoteEmail
                );
        }


        if (localClient) {

            const localId =
                localClient.id;

            Object.assign(
                localClient,
                remoteClient
            );

            /*
             * Always preserve the local ID used by
             * the browser session.
             */
            localClient.id =
                localId;

            /*
             * Keep the server ID separately.
             */
            if (remoteId) {
                localClient.serverClientId =
                    remoteId;
            }

            vbSaveState(state);

            return true;
        }


        /*
         * If the client does not exist locally,
         * create it from the server response.
         */
        const newClient = {
            ...remoteClient,

            id:
                remoteId ||
                remoteAccountNumber ||
                crypto.randomUUID(),

            serverClientId:
                remoteId,

            accountNumber:
                remoteAccountNumber,

            email:
                remoteClient.email || "",

            name:
                remoteClient.name || "Client",

            currency:
                remoteClient.currency || "USD",

            balance:
                Number(
                    remoteClient.balance || 0
                ),

            status:
                remoteClient.status || "Active"
        };


        state.clients.push(
            newClient
        );

        vbSaveState(state);

        return true;
    }


    /* ============================================================
       REMOTE TRANSACTION SYNCHRONIZATION
       
       This is the important part.

       Admin transactions are stored in MySQL.
       We download them through:

       GET client/transactions

       and then save them into the browser state so
       client.js can display them.
    ============================================================ */

    function mergeRemoteTransactions(
        remoteTransactions
    ) {

        if (
            !Array.isArray(remoteTransactions) ||
            typeof vbGetState !== "function" ||
            typeof vbSaveState !== "function"
        ) {
            return false;
        }

        const state =
            vbGetState();

        if (
            !state ||
            !Array.isArray(state.transactions)
        ) {
            return false;
        }

        let changed = false;


        remoteTransactions.forEach(
            remoteTransaction => {

                if (
                    !remoteTransaction ||
                    !remoteTransaction.id
                ) {
                    return;
                }


                const remoteClientId =
                    String(
                        remoteTransaction.clientId ||
                        remoteTransaction.client_id ||
                        ""
                    ).trim();


                const remoteAccountNumber =
                    String(
                        remoteTransaction.clientAccountNumber ||
                        remoteTransaction.client_account_number ||
                        remoteTransaction.accountNumber ||
                        remoteTransaction.account_number ||
                        ""
                    ).trim();


                /*
                 * Make sure this transaction belongs
                 * to the currently logged-in client.
                 */
                const currentClient =
                    getCurrentClient();


                if (!currentClient) {
                    return;
                }


                const currentClientId =
                    String(
                        currentClient.id || ""
                    ).trim();


                const currentAccountNumber =
                    String(
                        currentClient.accountNumber || ""
                    ).trim();


                const belongsToClient =
                    (
                        remoteClientId &&
                        remoteClientId ===
                        currentClientId
                    )
                    ||
                    (
                        remoteAccountNumber &&
                        remoteAccountNumber ===
                        currentAccountNumber
                    );


                if (!belongsToClient) {
                    return;
                }


                /*
                 * Normalize the transaction so the
                 * existing client dashboard can use it.
                 */
                const normalizedTransaction = {

                    ...remoteTransaction,

                    id:
                        String(
                            remoteTransaction.id
                        ),

                    clientId:
                        currentClientId,

                    serverClientId:
                        remoteClientId,

                    clientAccountNumber:
                        remoteAccountNumber ||
                        currentAccountNumber,

                    clientName:
                        remoteTransaction.clientName ||
                        remoteTransaction.client_name ||
                        currentClient.name,

                    type:
                        String(
                            remoteTransaction.type ||
                            ""
                        ).toLowerCase(),

                    amount:
                        Number(
                            remoteTransaction.amount ||
                            0
                        ),

                    currency:
                        remoteTransaction.currency ||
                        currentClient.currency ||
                        "USD",

                    status:
                        remoteTransaction.status ||
                        "Success",

                    description:
                        remoteTransaction.description ||
                        "Bank transaction",

                    timestamp:
                        remoteTransaction.timestamp ||
                        remoteTransaction.createdAt ||
                        remoteTransaction.created_at ||
                        new Date().toISOString(),

                    reference:
                        remoteTransaction.reference ||
                        remoteTransaction.id,

                    remoteOnly:
                        true
                };


                const existingIndex =
                    state.transactions.findIndex(
                        transaction =>
                            String(
                                transaction.id || ""
                            ) ===
                            String(
                                normalizedTransaction.id
                            )
                    );


                /*
                 * New transaction.
                 */
                if (
                    existingIndex === -1
                ) {

                    state.transactions.push(
                        normalizedTransaction
                    );

                    changed = true;

                    return;
                }


                /*
                 * Existing transaction.
                 */
                const existing =
                    state.transactions[
                        existingIndex
                    ];


                const before =
                    JSON.stringify(existing);


                state.transactions[
                    existingIndex
                ] = {
                    ...existing,
                    ...normalizedTransaction
                };


                const after =
                    JSON.stringify(
                        state.transactions[
                            existingIndex
                        ]
                    );


                if (
                    before !== after
                ) {
                    changed = true;
                }

            }
        );


        if (changed) {

            state.transactions.sort(
                (a, b) =>
                    new Date(
                        b.timestamp || 0
                    ) -
                    new Date(
                        a.timestamp || 0
                    )
            );

            vbSaveState(state);
        }


        return changed;
    }


    /* ============================================================
       FULL ONLINE CLIENT SYNCHRONIZATION
    ============================================================ */

    async function syncClient() {

        try {

            /*
             * STEP 1
             *
             * Get the latest client account information
             * and balance from MySQL.
             */

            const meResponse =
                await vbOnlineClientMe(
                    token
                );


            if (
                meResponse &&
                meResponse.client
            ) {

                mergeRemoteClient(
                    meResponse.client
                );

                /*
                 * Also use the existing storage
                 * synchronization if available.
                 */
                if (
                    typeof vbMergeRemoteClients ===
                    "function"
                ) {

                    try {

                        vbMergeRemoteClients([
                            meResponse.client
                        ]);

                    } catch (error) {

                        console.warn(
                            "Existing client merge failed:",
                            error
                        );
                    }
                }
            }


            /*
             * STEP 2
             *
             * Get transaction history directly
             * from the PHP/MySQL API.
             */

            const transactionResponse =
                await vbOnlineClientTransactions(
                    token
                );


            const remoteTransactions =
                Array.isArray(
                    transactionResponse?.transactions
                )
                    ? transactionResponse.transactions
                    : [];


            console.log(
                "Velorian Bank: transactions received from server:",
                remoteTransactions
            );


            /*
             * STEP 3
             *
             * Merge transactions into local
             * browser state.
             */

            mergeRemoteTransactions(
                remoteTransactions
            );


            /*
             * Also call the storage.js merge
             * function if it exists.
             */
            if (
                typeof vbMergeRemoteTransactions ===
                "function"
            ) {

                try {

                    vbMergeRemoteTransactions(
                        remoteTransactions
                    );

                } catch (error) {

                    console.warn(
                        "Existing transaction merge failed:",
                        error
                    );
                }
            }


            /*
             * STEP 4
             *
             * Tell client.js to redraw the
             * transaction history immediately.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "velorian:statechange"
                )
            );


            return {
                client:
                    transactionResponse?.client ||
                    meResponse?.client ||
                    null,

                transactions:
                    remoteTransactions
            };

        } catch (error) {

            console.error(
                "Velorian Bank client synchronization failed:",
                error
            );


            const errorMessage =
                String(
                    error?.message || ""
                ).toLowerCase();


            if (
                errorMessage.includes("authorization") ||
                errorMessage.includes("unauthorized") ||
                errorMessage.includes("session") ||
                errorMessage.includes("token") ||
                errorMessage.includes("401")
            ) {

                sessionStorage.removeItem(
                    "vb_api_client_token"
                );

                showToast(
                    "Your session has expired. Please log in again.",
                    "error"
                );
            }


            return null;
        }
    }


    /* ============================================================
       EXTERNAL TRANSFER
    ============================================================ */

    const transferButton =
        $("#openTransfer");


    if (transferButton) {

        transferButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const client =
                    getCurrentClient();


                if (!client) {

                    showToast(
                        "Unable to load your account information.",
                        "error"
                    );

                    return;
                }


                const form =
                    $("#externalTransferForm");


                const currency =
                    client.currency ||
                    "USD";


                if (form) {
                    form.reset();
                }


                if ($("#transferCurrency")) {

                    $("#transferCurrency").value =
                        currency;
                }


                if ($("#transferBalanceHint")) {

                    $("#transferBalanceHint")
                        .textContent =
                        `Available balance: ${vbFormatMoney(
                            Number(
                                client.balance || 0
                            ),
                            currency
                        )} • Daily limit: ${vbFormatMoney(
                            25000,
                            currency
                        )}`;
                }


                clearMessage(
                    $("#transferMessage")
                );


                openModal(
                    "transferModal"
                );
            }
        );
    }


    /* ============================================================
       EXTERNAL TRANSFER FORM
    ============================================================ */

    const transferForm =
        $("#externalTransferForm");


    if (transferForm) {

        transferForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const client =
                    getCurrentClient();


                const messageBox =
                    $("#transferMessage");


                if (!client) {

                    return showMessage(
                        messageBox,
                        "Unable to load your account information."
                    );
                }


                clearMessage(
                    messageBox
                );


                const recipientName =
                    $("#transferRecipientName")
                        ?.value
                        .trim() || "";


                const country =
                    $("#transferCountry")
                        ?.value
                        .trim() || "";


                const bankName =
                    $("#transferBankName")
                        ?.value
                        .trim() || "";


                const recipientAccount =
                    $("#transferRecipientAccount")
                        ?.value
                        .trim() || "";


                const iban =
                    $("#transferIban")
                        ?.value
                        .trim() || "";


                const swift =
                    $("#transferSwift")
                        ?.value
                        .trim() || "";


                const amount =
                    Number(
                        $("#transferAmount")
                            ?.value || 0
                    );


                const currency =
                    $("#transferCurrency")
                        ?.value || "";


                const description =
                    $("#transferDescription")
                        ?.value
                        .trim() || "";


                if (!recipientName) {

                    return showMessage(
                        messageBox,
                        "Please enter the recipient's name."
                    );
                }


                if (!country) {

                    return showMessage(
                        messageBox,
                        "Please enter the destination country."
                    );
                }


                if (!bankName) {

                    return showMessage(
                        messageBox,
                        "Please enter the recipient bank name."
                    );
                }


                if (!recipientAccount) {

                    return showMessage(
                        messageBox,
                        "Please enter the recipient account number."
                    );
                }


                if (
                    !Number.isFinite(amount) ||
                    amount <= 0
                ) {

                    return showMessage(
                        messageBox,
                        "Please enter a valid transfer amount."
                    );
                }


                if (amount > 25000) {

                    return showMessage(
                        messageBox,
                        "The maximum transfer amount is 25,000 per transaction."
                    );
                }


                const clientCurrency =
                    client.currency ||
                    "USD";


                if (
                    currency !==
                    clientCurrency
                ) {

                    return showMessage(
                        messageBox,
                        `For this demonstration, the transfer currency must match your account currency (${clientCurrency}).`
                    );
                }


                const balance =
                    Number(
                        client.balance || 0
                    );


                if (
                    amount > balance
                ) {

                    return showMessage(
                        messageBox,
                        `Insufficient available balance. Your current balance is ${vbFormatMoney(
                            balance,
                            clientCurrency
                        )}.`
                    );
                }


                const submitButton =
                    transferForm.querySelector(
                        'button[type="submit"]'
                    );


                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.dataset.originalText =
                        submitButton.textContent;

                    submitButton.textContent =
                        "Securing transfer…";
                }


                try {

                    const response =
                        await vbOnlineTransferRequest(
                            token,
                            {
                                recipientName,
                                country,
                                bankName,
                                recipientAccount,
                                iban,
                                swift,
                                amount,
                                currency,
                                description
                            }
                        );


                    if (
                        !response ||
                        !response.reference
                    ) {

                        throw new Error(
                            "The transfer request could not be created."
                        );
                    }


                    activeReference =
                        response.reference;


                    closeModal(
                        "transferModal"
                    );


                    if ($("#otpIntro")) {

                        $("#otpIntro")
                            .textContent =
                            response.emailSent
                                ? "A 6-digit verification code has been sent to your registered email address."
                                : (
                                    response.emailNotice ||
                                    "OTP delivery is not currently configured."
                                );
                    }


                    if ($("#transferOtp")) {

                        $("#transferOtp").value =
                            "";
                    }


                    clearMessage(
                        $("#otpMessage")
                    );


                    openModal(
                        "otpModal"
                    );


                    startOtpTimer(
                        response.expiresInSeconds ||
                        300
                    );

                } catch (error) {

                    console.error(
                        "Transfer request failed:",
                        error
                    );


                    showMessage(
                        messageBox,
                        error.message ||
                        "Unable to create the transfer request."
                    );

                } finally {

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            submitButton.dataset.originalText ||
                            "Continue to OTP verification →";
                    }
                }
            }
        );
    }


    /* ============================================================
       OTP FORM
    ============================================================ */

    const otpForm =
        $("#otpForm");


    if (otpForm) {

        otpForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const messageBox =
                    $("#otpMessage");


                clearMessage(
                    messageBox
                );


                const otp =
                    $("#transferOtp")
                        ?.value
                        .trim() || "";


                if (
                    !/^\d{6}$/.test(otp)
                ) {

                    return showMessage(
                        messageBox,
                        "Please enter the 6-digit OTP."
                    );
                }


                if (!activeReference) {

                    return showMessage(
                        messageBox,
                        "The transfer verification session is missing. Please start the transfer again."
                    );
                }


                const verifyButton =
                    otpForm.querySelector(
                        'button[type="submit"]'
                    );


                if (verifyButton) {

                    verifyButton.disabled =
                        true;

                    verifyButton.dataset.originalText =
                        verifyButton.textContent;

                    verifyButton.textContent =
                        "Verifying…";
                }


                try {

                    const response =
                        await vbOnlineTransferVerify(
                            token,
                            {
                                reference:
                                    activeReference,

                                otp
                            }
                        );


                    clearInterval(
                        otpTimer
                    );

                    otpTimer = null;


                    closeModal(
                        "otpModal"
                    );


                    /*
                     * Refresh account balance and
                     * transaction history immediately.
                     */
                    await syncClient();


                    showToast(
                        `Transfer ${
                            response.reference ||
                            activeReference
                        } verified successfully and is now processing.`,
                        "success"
                    );


                    activeReference =
                        "";

                } catch (error) {

                    console.error(
                        "OTP verification failed:",
                        error
                    );


                    showMessage(
                        messageBox,
                        error.message ||
                        "OTP verification failed."
                    );

                } finally {

                    if (verifyButton) {

                        verifyButton.disabled =
                            false;

                        verifyButton.textContent =
                            verifyButton.dataset.originalText ||
                            "Verify & process transfer →";
                    }
                }
            }
        );
    }


    /* ============================================================
       OTP TIMER
    ============================================================ */

    function startOtpTimer(seconds) {

        clearInterval(
            otpTimer
        );


        let remaining =
            Number(seconds) || 300;


        const timerElement =
            $("#otpTimer");


        const verifyButton =
            otpForm?.querySelector(
                'button[type="submit"]'
            );


        function updateTimer() {

            const minutes =
                String(
                    Math.floor(
                        remaining / 60
                    )
                ).padStart(2, "0");


            const secs =
                String(
                    remaining % 60
                ).padStart(2, "0");


            if (timerElement) {

                timerElement.textContent =
                    remaining > 0
                        ? `Expires in ${minutes}:${secs}`
                        : "OTP expired";
            }


            if (remaining <= 0) {

                clearInterval(
                    otpTimer
                );

                otpTimer = null;


                if (verifyButton) {

                    verifyButton.disabled =
                        true;
                }

                return;
            }


            remaining--;
        }


        if (verifyButton) {

            verifyButton.disabled =
                false;
        }


        updateTimer();


        otpTimer =
            setInterval(
                updateTimer,
                1000
            );
    }


    /* ============================================================
       OTP INPUT
    ============================================================ */

    const otpInput =
        $("#transferOtp");


    if (otpInput) {

        otpInput.addEventListener(
            "input",
            () => {

                otpInput.value =
                    otpInput.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
            }
        );
    }


    /* ============================================================
       TRANSFER AMOUNT
    ============================================================ */

    const amountInput =
        $("#transferAmount");


    if (amountInput) {

        amountInput.addEventListener(
            "input",
            () => {

                const value =
                    Number(
                        amountInput.value
                    );


                if (value > 25000) {

                    amountInput.value =
                        "25000";
                }


                if (value < 0) {

                    amountInput.value =
                        "0";
                }
            }
        );
    }


    /* ============================================================
       CLOSE BUTTONS
    ============================================================ */

    document
        .querySelectorAll(
            "[data-close], [data-close-modal]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.getAttribute(
                            "data-close"
                        )
                        ||
                        button.getAttribute(
                            "data-close-modal"
                        );


                    if (id) {

                        closeModal(id);
                    }
                }
            );
        });


    /* ============================================================
       MODAL BACKDROPS
    ============================================================ */

    document
        .querySelectorAll(".modal")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "open"
                        );
                    }
                }
            );
        });


    /* ============================================================
       INITIAL SYNCHRONIZATION
    ============================================================ */

    syncClient();


    /*
     * Keep the dashboard synchronized with MySQL.
     *
     * If the administrator deposits or withdraws money
     * while the client dashboard is open, the transaction
     * should appear within 10 seconds.
     */
    setInterval(
        syncClient,
        10000
    );

});