const axios = require("axios");

const RobloxCookie = process.env.ROBLOSECURITY;

async function Retry(fn, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.response?.status === 429) {
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

async function GetXsrfToken() {
    try {
        const res = await Retry(() => axios.post("https://auth.roblox.com/v2/logout", {}, {
            headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` },
            timeout: 30000
        }));
        return res.headers["x-csrf-token"];
    } catch (err) {
        return err.response?.headers["x-csrf-token"] || "";
    }
}

async function FetchRoles(GroupId) {
    const res = await Retry(() => axios.get(`https://groups.roblox.com/v1/groups/${GroupId}/roles`, { timeout: 30000 }));
    return res.data.roles.sort((a, b) => a.rank - b.rank);
}

async function GetCurrentRank(GroupId, UserId) {
    const res = await Retry(() => axios.get(`https://groups.roblox.com/v2/users/${UserId}/groups/roles`, { timeout: 30000 }));
    const GroupData = res.data.data.find(g => g.group.id === GroupId);
    if (!GroupData) throw new Error("User not in group");
    return GroupData.role.rank;
}

async function GetNextRank(GroupId, CurrentRankNumber) {
    const Roles = await FetchRoles(GroupId);
    return Roles.find(r => r.rank > CurrentRankNumber) || null;
}

async function GetPreviousRank(GroupId, CurrentRankNumber) {
    const Roles = await FetchRoles(GroupId);
    const LowerRoles = Roles.filter(r => r.rank < CurrentRankNumber);
    return LowerRoles.length ? LowerRoles[LowerRoles.length - 1] : null;
}

async function SetRank(GroupId, UserId, RoleId, Issuer, LogFunction) {
    if (!RoleId) throw new Error("Missing RoleId");
    let XsrfToken = await GetXsrfToken();
    const Url = `https://groups.roblox.com/v1/groups/${GroupId}/users/${UserId}`;

    try {
        await Retry(() => axios.patch(Url, { roleId: RoleId }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": XsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            XsrfToken = err.response.headers["x-csrf-token"];
            await Retry(() => axios.patch(Url, { roleId: RoleId }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": XsrfToken
                },
                timeout: 30000
            }));
        } else throw err;
    }

    if (typeof LogFunction === "function") await LogFunction(GroupId, UserId, { id: RoleId }, Issuer);
}

async function GetRobloxUserId(Username) {
    const res = await Retry(() => axios.get(`https://users.roblox.com/v1/users/search?keyword=${Username}`, { timeout: 30000 }));
    if (!res.data.data || !res.data.data[0]) throw new Error("Invalid Username");
    return res.data.data[0].id;
}

async function GetRobloxDescription(UserId) {
    const res = await Retry(() => axios.get(`https://users.roblox.com/v1/users/${UserId}`, { timeout: 30000 }));
    return res.data.description || "";
}

async function ExileUser(GroupId, UserId) {
    let XsrfToken = await GetXsrfToken();
    const Url = `https://groups.roblox.com/v1/groups/${GroupId}/users/${UserId}`;
    try {
        await Retry(() => axios.delete(Url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": XsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            XsrfToken = err.response.headers["x-csrf-token"];
            await Retry(() => axios.delete(Url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": XsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to exile user: ${err.response?.statusText || err.message}`);
    }
}

async function GetRankIdFromName(GroupId, RankName) {
    const Roles = await FetchRoles(GroupId);
    const Role = Roles.find(r => r.name.toLowerCase() === RankName.trim().toLowerCase());
    if (!Role) throw new Error(`Rank "${RankName}" not found in the group.`);
    return Role.id;
}

async function SetGroupShout(GroupId, Message) {
    let XsrfToken = await GetXsrfToken();
    const Url = `https://groups.roblox.com/v1/groups/${GroupId}/status`;
    try {
        await Retry(() => axios.patch(Url, { message: Message }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": XsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            XsrfToken = err.response.headers["x-csrf-token"];
            await Retry(() => axios.patch(Url, { message: Message }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": XsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to set shout: ${err.response?.statusText || err.message}`);
    }
}

async function GetUserIdFromUsername(Username) {
    const res = await Retry(() => axios.post("https://users.roblox.com/v1/usernames/users", {
        usernames: [Username]
    }, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
    }));
    if (res.data.data && res.data.data.length > 0) return res.data.data[0].id;
    throw new Error("User not found");
}

async function LeaveGroup(GroupId) {
    let XsrfToken = await GetXsrfToken();
    const Url = `https://groups.roblox.com/v1/groups/${GroupId}/users/${await GetSelfUserId()}`;
    try {
        await Retry(() => axios.delete(Url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": XsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            XsrfToken = err.response.headers["x-csrf-token"];
            await Retry(() => axios.delete(Url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": XsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to leave group: ${err.response?.statusText || err.message}`);
    }
}

async function GetSelfUserId() {
    const res = await Retry(() => axios.get("https://users.roblox.com/v1/users/authenticated", {
        headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` },
        timeout: 30000
    }));
    return res.data.id;
}

module.exports = {
    FetchRoles,
    GetCurrentRank,
    GetNextRank,
    GetPreviousRank,
    SetRank,
    GetRobloxUserId,
    GetRankIdFromName,
    GetRobloxDescription,
    GetUserIdFromUsername,
    ExileUser,
    SetGroupShout,
    LeaveGroup
};
