const axios = require("axios");

const RobloxCookie = process.env.ROBLOSECURITY;

async function getXsrfToken() {
    try {
        const res = await axios.post("https://auth.roblox.com/v2/logout", {}, {
            headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` }
        });
        return res.headers["x-csrf-token"];
    } catch (err) {
        return err.response?.headers["x-csrf-token"] || "";
    }
}

async function fetchRoles(groupId) {
    const res = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
    const roles = {};
    res.data.roles.forEach(role => roles[role.rank] = { id: role.id, name: role.name });
    return roles;
}

async function getCurrentRank(groupId, userId) {
    const res = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const groupData = res.data.data.find(g => g.group.id === groupId);
    if (!groupData) throw new Error("User not in group");
    return groupData.role.rank;
}

async function setRank(groupId, userId, rankNumber, issuer, logFunction) {
    const roles = await fetchRoles(groupId);
    const roleInfo = roles[rankNumber];
    if (!roleInfo) throw new Error("Invalid rank number: " + rankNumber);

    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;

    try {
        await axios.patch(url, { roleId: roleInfo.id }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": xsrfToken
            }
        });
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await axios.patch(url, { roleId: roleInfo.id }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": xsrfToken
                }
            });
        } else throw err;
    }

    if (logFunction) await logFunction(groupId, userId, roleInfo, issuer);
}

async function getRobloxUserId(username) {
    const res = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${username}`);
    if (!res.data.data || !res.data.data[0]) throw new Error("Invalid username");
    return res.data.data[0].id;
}

async function getRobloxDescription(userId) {
    const res = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
    return res.data.description || "";
}

async function exileUser(groupId, userId) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;

    try {
        await axios.delete(url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": xsrfToken
            }
        });
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await axios.delete(url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": xsrfToken
                }
            });
        } else throw new Error(`Failed to exile user: ${err.response?.statusText || err.message}`);
    }
}

async function getRankIdFromName(groupId, rankName) {
    try {
        const res = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
        const normalized = rankName.trim().toLowerCase();
        const role = res.data.roles.find(r => r.name.toLowerCase() === normalized);

        if (!role) throw new Error(`Rank "${rankName}" not found in the group.`);
        return role.id;
    } catch (err) {
        throw new Error(`Failed to get rank ID: ${err.response?.statusText || err.message}`);
    }
}

async function setGroupShout(groupId, message) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/status`;

    try {
        await axios.patch(url, { message }, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": xsrfToken
            }
        });
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await axios.patch(url, { message }, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": xsrfToken
                }
            });
        } else throw new Error(`Failed to set shout: ${err.response?.statusText || err.message}`);
    }
}

async function getUserIdFromUsername(username) {
    try {
        const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
            usernames: [username]
        }, {
            headers: { "Content-Type": "application/json" }
        });

        if (res.data.data && res.data.data.length > 0) {
            return res.data.data[0].id;
        } else {
            throw new Error("User not found");
        }
    } catch (err) {
        throw new Error(`Failed to get user ID: ${err.response?.statusText || err.message}`);
    }
}

async function leaveGroup(groupId) {
    let xsrfToken = await getXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${await getSelfUserId()}`;

    try {
        await axios.delete(url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                "X-CSRF-TOKEN": xsrfToken
            }
        });
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await axios.delete(url, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
                    "X-CSRF-TOKEN": xsrfToken
                }
            });
        } else {
            throw new Error(`Failed to leave group: ${err.response?.statusText || err.message}`);
        }
    }
}

async function getSelfUserId() {
    const res = await axios.get("https://users.roblox.com/v1/users/authenticated", {
        headers: { Cookie: `.ROBLOSECURITY=${RobloxCookie}` }
    });
    return res.data.id;
}

module.exports = {
    fetchRoles,
    getCurrentRank,
    setRank,
    getRobloxUserId,
    getRankNameFromId,
    getRobloxDescription,
    getUserIdFromUsername,
    exileUser,
    setGroupShout,
    leaveGroup
};
