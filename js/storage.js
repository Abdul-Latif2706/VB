/*
    Velorian Bank — centralized browser state.
    Front-end prototype only.
    The PHP/MySQL backend is the source of truth when online mode is enabled.
    Do not use localStorage for real banking/security.
*/

const VB_STORAGE_KEY = "velorian_bank_state_v5";
const VB_SESSION_KEY = "velorian_bank_session_v2";

const ACCOUNT_PREFIX = "1092";
const CURRENCY = "USD";
const TRANSFER_DAILY_LIMIT = 25000;

const VB_CURRENCIES = {
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    locale: "en-US"
  },

  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    locale: "en-GB"
  },

  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    locale: "de-DE"
  }
};


/* ============================================================
   SEED STATE
============================================================ */

function vbSeedState() {
  return {
    version: 5,

    bank: {
      name: "Velorian Bank",
      currency: CURRENCY,
      accountPrefix: ACCOUNT_PREFIX,

      supportedCurrencies: [
        "USD",
        "GBP",
        "EUR"
      ],

      rates: {
        USD: {
          USD: 1,
          GBP: 0.78,
          EUR: 0.85
        },

        GBP: {
          USD: 1.28,
          GBP: 1,
          EUR: 1.09
        },

        EUR: {
          USD: 1.18,
          GBP: 0.92,
          EUR: 1
        }
      }
    },

    admin: {
      email: "admin@velorianbank.com",
      password: "Velorian@2026",
      name: "Hamza"
    },

    clients: [],
    transactions: [],
    audit: [],
    notifications: []
  };
}


/* ============================================================
   GET STATE
============================================================ */

function vbGetState() {
  let state;

  try {
    state = JSON.parse(
      localStorage.getItem(VB_STORAGE_KEY) || "null"
    );
  } catch (error) {
    state = null;
  }

  if (!state || typeof state !== "object") {
    state = vbSeedState();

    localStorage.setItem(
      VB_STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  state.bank ||= {
    name: "Velorian Bank",
    currency: CURRENCY,
    accountPrefix: ACCOUNT_PREFIX
  };

  state.admin ||= {
    email: "admin@velorianbank.com",
    password: "Velorian@2026",
    name: "Hamza"
  };

  // Ensure admin password is updated to Velorian@2026
  if (state.admin.password !== "Velorian@2026") {
    state.admin.password = "Velorian@2026";
  }

  state.clients ||= [];
  state.transactions ||= [];
  state.audit ||= [];
  state.notifications ||= [];

  state.bank.name ||= "Velorian Bank";
  state.bank.currency ||= CURRENCY;
  state.bank.accountPrefix ||= ACCOUNT_PREFIX;

  state.bank.supportedCurrencies ||= [
    "USD",
    "GBP",
    "EUR"
  ];

  state.bank.rates ||= {
    USD: {
      USD: 1,
      GBP: 0.78,
      EUR: 0.85
    },

    GBP: {
      USD: 1.28,
      GBP: 1,
      EUR: 1.09
    },

    EUR: {
      USD: 1.18,
      GBP: 0.92,
      EUR: 1
    }
  };


  /* ----------------------------------------------------------
     Normalize clients
  ---------------------------------------------------------- */

  state.clients.forEach(client => {

    client.currency ||= CURRENCY;

    client.forcePasswordChange =
      client.forcePasswordChange || false;

    client.status ||= "Active";

    client.accountType ||=
      "Savings Account";

    client.name ||= "Client";

    client.email ||= "";

    client.phone ||= "";

    client.country ||= "";

    client.dob ||= "";

    client.address ||= "";

    client.accountNumber ||= "";

    client.balance =
      Number(client.balance || 0);

    client.transactions ||= [];
  });


  /* ----------------------------------------------------------
     Normalize transactions
  ---------------------------------------------------------- */

  state.transactions.forEach(transaction => {

    const transactionClientId =
      String(
        transaction.clientId ||
        transaction.client_id ||
        ""
      ).trim();

    const transactionAccountNumber =
      String(
        transaction.clientAccountNumber ||
        transaction.client_account_number ||
        transaction.accountNumber ||
        transaction.account_number ||
        ""
      ).trim();

    const client =
      state.clients.find(client =>
        String(client.id || "").trim() ===
        transactionClientId
      )
      ||
      state.clients.find(client =>
        transactionAccountNumber &&
        String(client.accountNumber || "").trim() ===
        transactionAccountNumber
      );

    transaction.clientId =
      client?.id ||
      transaction.clientId ||
      transaction.client_id ||
      "";

    transaction.clientAccountNumber =
      transactionAccountNumber ||
      client?.accountNumber ||
      "";

    transaction.clientName =
      transaction.clientName ||
      transaction.client_name ||
      client?.name ||
      "";

    transaction.currency ||=
      client?.currency ||
      CURRENCY;

    transaction.amount =
      Number(transaction.amount || 0);

    transaction.status ||=
      "Success";

    transaction.description ||=
      "";

    transaction.timestamp ||=
      transaction.createdAt ||
      new Date().toISOString();
  });


  if (!VB_CURRENCIES[state.bank.currency]) {
    state.bank.currency = CURRENCY;
  }

  return state;
}


/* ============================================================
   SAVE STATE
============================================================ */

function vbSaveState(state) {

  localStorage.setItem(
    VB_STORAGE_KEY,
    JSON.stringify(state)
  );

  window.dispatchEvent(
    new CustomEvent("velorian:statechange")
  );

  return state;
}


/* ============================================================
   RESET LOCAL BANK DATA
============================================================ */

function vbResetBankData() {

  const state =
    vbSeedState();

  localStorage.setItem(
    VB_STORAGE_KEY,
    JSON.stringify(state)
  );

  window.dispatchEvent(
    new CustomEvent("velorian:statechange")
  );

  return state;
}


/* ============================================================
   SESSION
============================================================ */

function vbGetSession() {

  try {

    return JSON.parse(
      sessionStorage.getItem(
        VB_SESSION_KEY
      ) || "null"
    );

  } catch (error) {

    return null;
  }
}


function vbSetSession(
  role,
  clientId = null,
  accountNumber = null
) {

  sessionStorage.setItem(
    VB_SESSION_KEY,
    JSON.stringify({
      role,
      clientId,
      accountNumber,
      createdAt: Date.now()
    })
  );
}


function vbClearSession() {

  sessionStorage.removeItem(
    VB_SESSION_KEY
  );
}


/* ============================================================
   CLIENT LOOKUP
============================================================ */

function vbFindClient(
  id,
  accountNumber = null
) {

  const state =
    vbGetState();

  const normalizedId =
    String(id || "").trim();

  const normalizedAccount =
    String(accountNumber || "").trim();

  return (
    state.clients.find(
      client =>
        String(client.id || "").trim() ===
        normalizedId
    )
    ||
    (
      normalizedAccount
        ? state.clients.find(
            client =>
              String(
                client.accountNumber || ""
              ).trim() ===
              normalizedAccount
          )
        : null
    )
  );
}


/* ============================================================
   ID GENERATOR
============================================================ */

function vbMakeId(prefix) {

  return (
    `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`
  ).toUpperCase();
}


/* ============================================================
   ACCOUNT NUMBER
============================================================ */

function vbGenerateAccountNumber() {

  const state =
    vbGetState();

  let number;

  do {

    number =
      ACCOUNT_PREFIX +
      Math.floor(
        100000 +
        Math.random() * 900000
      );

  } while (
    state.clients.some(
      client =>
        String(client.accountNumber || "") ===
        String(number)
    )
  );

  return number;
}


/* ============================================================
   CURRENCY HELPERS
============================================================ */

function vbGetCurrency(code = CURRENCY) {

  return (
    VB_CURRENCIES[code] ||
    VB_CURRENCIES[CURRENCY]
  );
}


function vbGetClientCurrency(clientOrId) {

  const client =
    typeof clientOrId === "string"
      ? vbFindClient(clientOrId)
      : clientOrId;

  return vbGetCurrency(
    client?.currency || CURRENCY
  );
}


function vbCurrencySymbol(
  code = CURRENCY
) {

  return vbGetCurrency(code).symbol;
}


function vbFormatMoney(
  value,
  code = CURRENCY
) {

  const currency =
    vbGetCurrency(code);

  return new Intl.NumberFormat(
    currency.locale,
    {
      style: "currency",
      currency: currency.code
    }
  ).format(
    Number(value || 0)
  );
}


/* ============================================================
   BANK CURRENCY
============================================================ */

function vbSetCurrency(code) {

  if (!VB_CURRENCIES[code]) {
    throw new Error(
      "Unsupported currency."
    );
  }

  const state =
    vbGetState();

  state.bank.currency =
    code;

  vbSaveState(state);

  return state;
}


/* ============================================================
   EXCHANGE RATE
============================================================ */

function vbSetExchangeRate(
  from,
  to,
  rate
) {

  if (
    !VB_CURRENCIES[from] ||
    !VB_CURRENCIES[to]
  ) {
    throw new Error(
      "Unsupported currency."
    );
  }

  const value =
    Number(rate);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Exchange rate must be greater than zero."
    );
  }

  const state =
    vbGetState();

  state.bank.rates[from] ||= {};

  state.bank.rates[from][to] =
    from === to
      ? 1
      : value;

  state.audit.unshift({
    id: vbMakeId("AUD"),
    action: "Exchange rate updated",
    details:
      `${from} → ${to} = ${state.bank.rates[from][to]}`,
    actor:
      state.admin?.name ||
      "Administrator",
    timestamp:
      new Date().toISOString()
  });

  vbSaveState(state);

  return state;
}


function vbGetRate(
  from,
  to
) {

  if (from === to) {
    return 1;
  }

  return Number(
    vbGetState()
      .bank
      .rates?.[from]?.[to] || 0
  );
}


/* ============================================================
   CURRENCY UI
============================================================ */

function vbRenderCurrencyUI(
  root = document
) {

  const currency =
    vbGetCurrency();

  root
    .querySelectorAll(
      "[data-currency-symbol]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.symbol
    );

  root
    .querySelectorAll(
      "[data-currency-code]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.code
    );

  root
    .querySelectorAll(
      "[data-currency-name]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.name
    );
}


/* ============================================================
   DATE HELPERS
============================================================ */

function vbFormatDate(iso) {

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  ).format(
    new Date(iso)
  );
}


function vbShortDate(iso) {

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    new Date(iso)
  );
}


function vbRelativeDate(iso) {

  const difference =
    Date.now() -
    new Date(iso).getTime();

  const minutes =
    Math.floor(
      difference / 60000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d ago`;
}


function vbInitials(name) {

  return (
    String(name || "VB")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(value => value[0])
      .join("")
      .toUpperCase() ||
    "VB"
  );
}


/* ============================================================
   CLIENT TRANSACTIONS
============================================================ */

function vbClientTransactions(
  clientId,
  accountNumber = null
) {

  const state =
    vbGetState();

  const normalizedClientId =
    String(clientId || "").trim();

  const normalizedAccountNumber =
    String(accountNumber || "").trim();


  const client =
    state.clients.find(
      item =>
        String(item.id || "").trim() ===
        normalizedClientId
    )
    ||
    (
      normalizedAccountNumber
        ? state.clients.find(
            item =>
              String(
                item.accountNumber || ""
              ).trim() ===
              normalizedAccountNumber
          )
        : null
    );


  if (!client) {
    return [];
  }

  // Combine global state transactions with client-specific synced transactions for full parity
  const globalClientTx = state.transactions.filter(transaction => {
    const transactionClientId = String(transaction.clientId || transaction.client_id || "").trim();
    const transactionAccountNumber = String(transaction.clientAccountNumber || transaction.accountNumber || "").trim();
    return transactionClientId === String(client.id).trim() || (client.accountNumber && transactionAccountNumber === String(client.accountNumber).trim());
  });

  const personalTx = Array.isArray(client.transactions) ? client.transactions : [];
  const mergedMap = new Map();
  [...globalClientTx, ...personalTx].forEach(tx => {
    if (tx && tx.id) mergedMap.set(tx.id, tx);
  });

  return Array.from(mergedMap.values()).sort(
    (a, b) =>
      new Date(b.timestamp || b.createdAt || 0) -
      new Date(a.timestamp || a.createdAt || 0)
  );
}


/* ============================================================
   AUDIT
============================================================ */

function vbAddAudit(
  action,
  details = "",
  actor = "Administrator"
) {

  const state =
    vbGetState();

  const timestamp =
    new Date().toISOString();

  state.audit.unshift({
    id: vbMakeId("AUD"),
    action,
    details,
    actor,
    timestamp
  });

  state.audit =
    state.audit.slice(0, 1000);

  vbSaveState(state);
}


/* ============================================================
   NOTIFICATIONS
============================================================ */

function vbAddNotification(
  clientId,
  title,
  message,
  type = "info",
  state = null
) {

  const currentState =
    state || vbGetState();

  currentState.notifications.unshift({
    id: vbMakeId("NTF"),
    clientId,
    title,
    message,
    type,
    read: false,
    timestamp:
      new Date().toISOString()
  });

  currentState.notifications =
    currentState.notifications.slice(
      0,
      1000
    );
}


/* ============================================================
   DAILY TRANSFER TOTAL
============================================================ */

function vbDailyTransferTotal(
  clientId
) {

  const start =
    new Date();

  start.setHours(
    0,
    0,
    0,
    0
  );

  const normalizedClientId =
    String(clientId || "").trim();

  return vbGetState()
    .transactions
    .filter(
      transaction =>
        String(
          transaction.clientId ||
          transaction.client_id ||
          ""
        ).trim() ===
          normalizedClientId
        &&
        transaction.type ===
          "transfer_out"
        &&
        new Date(
          transaction.timestamp
        ) >= start
    )
    .reduce(
      (total, transaction) =>
        total +
        Number(transaction.amount || 0),
      0
    );
}


/* ============================================================
   CREATE TRANSACTION (AND SYNC TO CLIENT DASHBOARD)
============================================================ */

function vbCreateTransaction(
  clientId,
  type,
  amount,
  status = "Success",
  description = "",
  meta = {}
) {

  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        String(item.id || "") ===
        String(clientId || "") ||
        String(item.accountNumber || "") ===
        String(clientId || "")
    );

  if (!client) {
    throw new Error(
      "Client account not found."
    );
  }

  if (
    client.status !== "Active"
  ) {
    throw new Error(
      `This account is ${client.status.toLowerCase()}. Transactions are unavailable.`
    );
  }

  const value =
    Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Enter a valid amount."
    );
  }

  const normalizedType = type.toLowerCase();

  if (status === "Success") {
    client.balance =
      Number(
        (
          client.balance +
          (
            ["deposit", "transfer_in", "credit"].includes(normalizedType)
              ? value
              : -value
          )
        ).toFixed(2)
      );
  }

  const timestamp =
    new Date().toISOString();

  const transaction = {

    id:
      vbMakeId("TX"),

    clientId:
      client.id,

    clientAccountNumber:
      client.accountNumber,

    clientName:
      client.name,

    type: normalizedType,

    amount:
      Number(value.toFixed(2)),

    currency:
      client.currency,

    status,

    description:
      String(description || "")
        .trim()
        .slice(0, 120),

    timestamp,

    ...meta
  };


  state.transactions.unshift(
    transaction
  );

  if (!Array.isArray(client.transactions)) {
    client.transactions = [];
  }
  client.transactions.unshift(transaction);


  const label =
    ["deposit", "credit"].includes(normalizedType)
      ? "Deposit"
      : "Withdrawal / Debit";

  state.audit.unshift({
    id: vbMakeId("AUD"),
    action: `${label} recorded`,
    details: `${client.name} • ${vbFormatMoney(transaction.amount, client.currency)}`,
    actor: "Administrator",
    timestamp
  });

  vbAddNotification(
    client.id,
    `${label} ${status.toLowerCase()}`,
    `${vbFormatMoney(transaction.amount, client.currency)} was applied to your account.`,
    "success",
    state
  );

  vbSaveState(
    state
  );

  return transaction;
}


/* ============================================================
   ADMIN POST TRANSACTION
============================================================ */

function vbAdminPostTransaction(
  clientId,
  type,
  amount,
  status = "Success",
  description = "Administrator transaction"
) {

  return vbCreateTransaction(
    clientId,
    type,
    amount,
    status,
    description,
    {
      source: "Administrator"
    }
  );
}


/* ============================================================
   REMOTE CLIENT SYNCHRONIZATION
============================================================ */

function vbMergeRemoteClients(remoteClients) {

  const state = vbGetState();

  if (!Array.isArray(remoteClients)) {
    return false;
  }

  let changed = false;

  remoteClients.forEach(remoteClient => {

    if (
      !remoteClient ||
      !remoteClient.id
    ) {
      return;
    }

    const remoteClientId =
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
      ).trim()
      .toLowerCase();


    const localClient =
      state.clients.find(client =>
        String(
          client.id || ""
        ).trim() ===
        remoteClientId
      )
      ||
      state.clients.find(client =>
        remoteAccountNumber &&
        String(
          client.accountNumber || ""
        ).trim() ===
        remoteAccountNumber
      )
      ||
      state.clients.find(client =>
        remoteEmail &&
        String(
          client.email || ""
        ).trim().toLowerCase() ===
        remoteEmail
      );


    const normalizedClient = {

      ...remoteClient,

      id:
        localClient?.id ||
        remoteClientId,

      serverClientId:
        remoteClientId,

      name:
        remoteClient.name ||
        localClient?.name ||
        "Client",

      email:
        remoteClient.email ||
        localClient?.email ||
        "",

      phone:
        remoteClient.phone ||
        localClient?.phone ||
        "",

      country:
        remoteClient.country ||
        localClient?.country ||
        "",

      dob:
        remoteClient.dob ||
        localClient?.dob ||
        "",

      address:
        remoteClient.address ||
        localClient?.address ||
        "",

      accountType:
        remoteClient.accountType ||
        remoteClient.account_type ||
        localClient?.accountType ||
        "Savings Account",

      currency:
        remoteClient.currency ||
        localClient?.currency ||
        CURRENCY,

      accountNumber:
        remoteAccountNumber ||
        localClient?.accountNumber ||
        "",

      balance:
        Number(
          remoteClient.balance ??
          localClient?.balance ??
          0
        ),

      status:
        remoteClient.status ||
        localClient?.status ||
        "Active",

      forcePasswordChange:
        Boolean(
          remoteClient.forcePasswordChange ??
          remoteClient.force_password_change ??
          localClient?.forcePasswordChange ??
          false
        ),

      createdAt:
        remoteClient.createdAt ||
        remoteClient.created_at ||
        localClient?.createdAt ||
        new Date().toISOString(),

      updatedAt:
        remoteClient.updatedAt ||
        remoteClient.updated_at ||
        new Date().toISOString()
    };


    if (localClient) {
      Object.assign(
        localClient,
        normalizedClient,
        {
          id:
            localClient.id
        }
      );
      changed = true;
      return;
    }

    state.clients.push(
      normalizedClient
    );

    changed = true;
  });


  if (changed) {
    vbSaveState(
      state
    );
  }

  return changed;
}


/* ============================================================
   REMOTE TRANSACTION SYNCHRONIZATION
============================================================ */

function vbMergeRemoteTransactions(
  remoteTransactions
) {

  const state =
    vbGetState();

  if (
    !Array.isArray(
      remoteTransactions
    )
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


      const localClient =
        state.clients.find(
          client =>
            String(
              client.id || ""
            ).trim() ===
            remoteClientId
        )
        ||
        state.clients.find(
          client =>
            remoteAccountNumber &&
            String(
              client.accountNumber || ""
            ).trim() ===
            remoteAccountNumber
        );

      const normalizedTransaction = {
        ...remoteTransaction,
        clientId: localClient?.id || remoteClientId,
        clientAccountNumber: remoteAccountNumber || localClient?.accountNumber || "",
        amount: Number(remoteTransaction.amount || 0),
        status: remoteTransaction.status || "Success",
        timestamp: remoteTransaction.timestamp || remoteTransaction.createdAt || new Date().toISOString()
      };

      const existingIndex = state.transactions.findIndex(t => t.id === normalizedTransaction.id);
      if (existingIndex >= 0) {
        state.transactions[existingIndex] = { ...state.transactions[existingIndex], ...normalizedTransaction };
      } else {
        state.transactions.unshift(normalizedTransaction);
        changed = true;
      }

      if (localClient) {
        if (!Array.isArray(localClient.transactions)) {
          localClient.transactions = [];
        }
        const clientTxIndex = localClient.transactions.findIndex(t => t.id === normalizedTransaction.id);
        if (clientTxIndex >= 0) {
          localClient.transactions[clientTxIndex] = { ...localClient.transactions[clientTxIndex], ...normalizedTransaction };
        } else {
          localClient.transactions.unshift(normalizedTransaction);
          changed = true;
        }
      }
    }
  );

  if (changed) {
    vbSaveState(state);
  }

  return changed;
}