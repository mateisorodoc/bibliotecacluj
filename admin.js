const usersBody = document.getElementById("usersBody");
const userForm = document.getElementById("userForm");
const userIdInput = document.getElementById("userId");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const roleInput = document.getElementById("role");
const isActiveInput = document.getElementById("isActive");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const refreshBtn = document.getElementById("refreshBtn");
const formMessage = document.getElementById("formMessage");
const adminIdentity = document.getElementById("adminIdentity");
const logoutBtn = document.getElementById("logoutBtn");
const searchUsersInput = document.getElementById("searchUsers");
const filterRoleSelect = document.getElementById("filterRole");
const filterStatusSelect = document.getElementById("filterStatus");
const sortUsersSelect = document.getElementById("sortUsers");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const filteredCount = document.getElementById("filteredCount");
const metricTotal = document.getElementById("metricTotal");
const metricAdmins = document.getElementById("metricAdmins");
const metricActive = document.getElementById("metricActive");
const metricRecent = document.getElementById("metricRecent");

let usersCache = [];
let currentAdminId = 0;

function setMessage(text, type = "error") {
    formMessage.textContent = text;
    formMessage.classList.toggle("success", type === "success");
}

function clearForm() {
    userIdInput.value = "";
    usernameInput.value = "";
    passwordInput.value = "";
    roleInput.value = "user";
    isActiveInput.checked = true;
    saveBtn.textContent = "Salveaza";
    setMessage("");
}

function fillForm(user) {
    userIdInput.value = String(user.id);
    usernameInput.value = user.username;
    passwordInput.value = "";
    roleInput.value = user.role;
    isActiveInput.checked = user.isActive;
    saveBtn.textContent = "Actualizeaza";
    setMessage(`Editezi utilizatorul #${user.id}`, "success");
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const timestamp = Date.parse(value.replace(" ", "T") + "Z");
    if (Number.isNaN(timestamp)) {
        return value;
    }

    return new Intl.DateTimeFormat("ro-RO", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(timestamp));
}

function getFilteredUsers() {
    const term = (searchUsersInput?.value || "").trim().toLowerCase();
    const roleFilter = filterRoleSelect?.value || "all";
    const statusFilter = filterStatusSelect?.value || "all";

    return usersCache.filter((user) => {
        const matchesTerm = !term || user.username.toLowerCase().includes(term);
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && user.isActive) ||
            (statusFilter === "inactive" && !user.isActive);

        return matchesTerm && matchesRole && matchesStatus;
    });
}

function getSortedUsers(users) {
    const mode = sortUsersSelect?.value || "created_desc";
    const list = [...users];

    if (mode === "username_asc") {
        list.sort((a, b) => a.username.localeCompare(b.username, "ro"));
        return list;
    }

    if (mode === "username_desc") {
        list.sort((a, b) => b.username.localeCompare(a.username, "ro"));
        return list;
    }

    if (mode === "created_asc") {
        list.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
        return list;
    }

    if (mode === "last_login_desc") {
        list.sort((a, b) => String(b.lastLoginAt || "").localeCompare(String(a.lastLoginAt || "")));
        return list;
    }

    list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return list;
}

function renderMetrics(users) {
    const total = users.length;
    const active = users.filter((user) => user.isActive).length;
    const admins = users.filter((user) => user.isActive && user.role === "admin").length;
    const recent = users.filter((user) => Boolean(user.lastLoginAt)).length;

    metricTotal.textContent = String(total);
    metricAdmins.textContent = String(admins);
    metricActive.textContent = String(active);
    metricRecent.textContent = String(recent);
}

function renderRows(users) {
    if (!users.length) {
        usersBody.innerHTML = "<tr><td colspan=\"7\">Nu exista utilizatori.</td></tr>";
        return;
    }

    usersBody.innerHTML = users.map((user) => {
        const activeText = user.isActive ? "Da" : "Nu";
        const lastLogin = user.lastLoginAt || "-";
        const isCurrentAdmin = user.id === currentAdminId;
        const disableToggle = isCurrentAdmin && user.isActive;
        const disableDelete = isCurrentAdmin;
        return `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${activeText}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${formatDate(lastLogin)}</td>
                <td>
                    <button class="small-btn" data-action="edit" data-id="${user.id}">Edit</button>
                    <button class="small-btn toggle" data-action="toggle" data-id="${user.id}" ${disableToggle ? "disabled title=\"Nu poti dezactiva contul curent\"" : ""}>${user.isActive ? "Dezactiveaza" : "Activeaza"}</button>
                    <button class="small-btn delete" data-action="delete" data-id="${user.id}" ${disableDelete ? "disabled title=\"Nu poti sterge contul curent\"" : ""}>Delete</button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderAll() {
    renderMetrics(usersCache);
    const filtered = getFilteredUsers();
    const sorted = getSortedUsers(filtered);
    if (filteredCount) {
        filteredCount.textContent = String(sorted.length);
    }
    renderRows(sorted);
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || "Request failed");
    }
    return payload;
}

async function loadSession() {
    try {
        const payload = await api("/api/auth/me", { method: "GET" });
        if (!payload.authenticated || payload.user?.role !== "admin") {
            window.location.assign("/app");
            return false;
        }
        currentAdminId = Number(payload.user.id || 0);
        adminIdentity.textContent = `Conectat ca ${payload.user.username} (admin)`;
        return true;
    } catch {
        window.location.assign("/login");
        return false;
    }
}

async function loadUsers() {
    const payload = await api("/api/admin/users", { method: "GET" });
    usersCache = payload.users || [];
    renderAll();
}

async function createUser() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const role = roleInput.value;
    const isActive = isActiveInput.checked;

    if (!username || password.length < 8) {
        throw new Error("Username valid si parola de minim 8 caractere sunt obligatorii.");
    }

    await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role, isActive })
    });
}

async function deleteUser(userId) {
    await api(`/api/admin/users/${userId}`, {
        method: "DELETE"
    });
}

userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;

    try {
        const userId = Number(userIdInput.value || 0);
        if (userId > 0) {
            await updateUser(userId);
            setMessage("Utilizator actualizat.", "success");
        } else {
            await createUser();
            setMessage("Utilizator creat.", "success");
        }

        clearForm();
        await loadUsers();
    } catch (error) {
        setMessage(error.message || "Operatie esuata.");
    } finally {
        saveBtn.disabled = false;
    }
});

usersBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const userId = Number(button.dataset.id || 0);
    if (!userId) {
        return;
    }

    const action = button.dataset.action;
    if (action === "edit") {
        const user = usersCache.find((entry) => entry.id === userId);
        if (user) {
            fillForm(user);
        }
        return;
    }

    if (action === "delete") {
        const targetUser = usersCache.find((entry) => entry.id === userId);
        if (targetUser?.id === currentAdminId) {
            setMessage("Nu poti sterge contul administratorului curent.");
            return;
        }

        const confirmed = window.confirm("Sigur doresti sa stergi acest utilizator?");
        if (!confirmed) {
            return;
        }

        try {
            await deleteUser(userId);
            setMessage("Utilizator sters.", "success");
            await loadUsers();
        } catch (error) {
            setMessage(error.message || "Stergere esuata.");
        }
    }

    if (action === "toggle") {
        const user = usersCache.find((entry) => entry.id === userId);
        if (!user) {
            return;
        }

        if (user.id === currentAdminId && user.isActive) {
            setMessage("Nu poti dezactiva contul administratorului curent.");
            return;
        }

        try {
            await updateUser(userId, {
                username: user.username,
                role: user.role,
                isActive: !user.isActive
            });
            setMessage(user.isActive ? "Utilizator dezactivat." : "Utilizator activat.", "success");
            await loadUsers();
        } catch (error) {
            setMessage(error.message || "Actualizare status esuata.");
        }
    }
});

async function updateUser(userId, customBody) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const role = roleInput.value;
    const isActive = isActiveInput.checked;

    if (!customBody && !username) {
        throw new Error("Username-ul este obligatoriu.");
    }

    const body = customBody || { username, role, isActive };
    if (!customBody && password) {
        if (password.length < 8) {
            throw new Error("Parola trebuie sa aiba minim 8 caractere.");
        }
        body.password = password;
    }

    await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
    });
}

resetBtn.addEventListener("click", clearForm);
refreshBtn.addEventListener("click", () => {
    loadUsers().catch((error) => {
        setMessage(error.message || "Nu am putut reincarca utilizatorii.");
    });
});

clearFiltersBtn.addEventListener("click", () => {
    searchUsersInput.value = "";
    filterRoleSelect.value = "all";
    filterStatusSelect.value = "all";
    sortUsersSelect.value = "created_desc";
    renderAll();
});

searchUsersInput.addEventListener("input", renderAll);
filterRoleSelect.addEventListener("change", renderAll);
filterStatusSelect.addEventListener("change", renderAll);
sortUsersSelect.addEventListener("change", renderAll);

logoutBtn.addEventListener("click", async () => {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch {
        // Ignore.
    }
    window.location.assign("/login");
});

(async () => {
    const ok = await loadSession();
    if (!ok) {
        return;
    }

    clearForm();
    await loadUsers();
})();
