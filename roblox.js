const axios = require("axios");

const RobloxCookie = process.env.ROBLOSECURITY;

async function retry(fn, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

async function getXsrfToken() {
    try {
        const res = await retry(() => axios.post("https://auth.roblox.com/v2/logout", {}, {
            headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` },
            timeout: 30000
        }));
        return res.headers["x-csrf-token"];
    } catch (err) {
        return err.response?.headers["x-csrf-token"] || "";
    }
}

async function fetchRoles(groupId) {
    const res = await retry(() => axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`, { timeout: 30000 }));
    return res.data.roles.sort((a, b) => a.rank - b.rank);
}

async function getCurrentRank(groupId, userId) {
    const res = await retry(() => axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, { timeout: 30000 }));
    const groupData = res.data.data.find(g => g.group.id === groupId);
    if (!groupData) throw new Error("User not in group");
    return groupData.role.rank;
}

async function getNextRank(groupId, currentRankNumber) {
    const roles = await fetchRoles(groupId);
    return roles.find(r => r.rank > currentRankNumber) || null;
}

async function getPreviousRank(groupId, currentRankNumber) {
    const roles = await fetchRoles(groupId);
    const lowerRoles = roles.filter(r => r.rank < currentRankNumber);
    return lowerRoles.length ? lowerRoles[lowerRoles.length - 1] : null;
}

async function setRank(groupId, userId, roleId, issuer, logFunction) {
    if (!roleId) throw new Error("Missing roleId");
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;

    try {
        await retry(() => axios.patch(url, { roleId }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": xsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await retry(() => axios.patch(url, { roleId }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": xsrfToken
                },
                timeout: 30000
            }));
        } else throw err;
    }

    if (typeof logFunction === "function") await logFunction(groupId, userId, { id: roleId }, issuer);
}

async function getRobloxUserId(username) {
    const res = await retry(() => axios.get(`https://users.roblox.com/v1/users/search?keyword=${username}`, { timeout: 30000 }));
    if (!res.data.data || !res.data.data[0]) throw new Error("Invalid username");
    return res.data.data[0].id;
}

async function getRobloxDescription(userId) {
    const res = await retry(() => axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 30000 }));
    return res.data.description || "";
}

async function exileUser(groupId, userId) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;
    try {
        await retry(() => axios.delete(url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": xsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await retry(() => axios.delete(url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": xsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to exile user: ${err.response?.statusText || err.message}`);
    }
}

async function getRankIdFromName(groupId, rankName) {
    const roles = await fetchRoles(groupId);
    const role = roles.find(r => r.name.toLowerCase() === rankName.trim().toLowerCase());
    if (!role) throw new Error(`Rank "${rankName}" not found in the group.`);
    return role.id;
}

async function setGroupShout(groupId, message) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/status`;
    try {
        await retry(() => axios.patch(url, { message }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": xsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await retry(() => axios.patch(url, { message }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": xsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to set shout: ${err.response?.statusText || err.message}`);
    }
}

async function getUserIdFromUsername(username) {
    const res = await retry(() => axios.post("https://users.roblox.com/v1/usernames/users", {
        usernames: [username]
    }, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
    }));
    if (res.data.data && res.data.data.length > 0) return res.data.data[0].id;
    throw new Error("User not found");
}

async function leaveGroup(groupId) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${await getSelfUserId()}`;
    try {
        await retry(() => axios.delete(url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": xsrfToken
            },
            timeout: 30000
        }));
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await retry(() => axios.delete(url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": xsrfToken
                },
                timeout: 30000
            }));
        } else throw new Error(`Failed to leave group: ${err.response?.statusText || err.message}`);
    }
}

async function getSelfUserId() {
    const res = await retry(() => axios.get("https://users.roblox.com/v1/users/authenticated", {
        headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` },
        timeout: 30000
    }));
    return res.data.id;
}

module.exports = {
    fetchRoles,
    getCurrentRank,
    getNextRank,
    getPreviousRank,
    setRank,
    getRobloxUserId,
    getRankIdFromName,
    getRobloxDescription,
    getUserIdFromUsername,
    exileUser,
    setGroupShout,
    leaveGroup
};
