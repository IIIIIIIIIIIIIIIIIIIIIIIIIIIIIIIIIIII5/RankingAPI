const axios = require("axios");

const RobloxCookies = process.env.ROBLOX_COOKIES ? process.env.ROBLOX_COOKIES.split(",").map(c => c.trim()) : [];
let CurrentCookieIndex = 0;

function GetCurrentCookie() {
    return RobloxCookies[CurrentCookieIndex];
}

function RotateCookie() {
    CurrentCookieIndex = (CurrentCookieIndex + 1) % RobloxCookies.length;
}

async function SafeRequest(fn, retries = RobloxCookies.length) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            const status = err.response?.status;
            if (status === 403 || status === 400 || status === 429) {
                RotateCookie();
                continue;
            }
            throw err;
        }
    }
    throw new Error("All Roblox accounts failed.");
}

async function Retry(fn, retries = 3, delay = 2000) {
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

async function GetXsrfToken() {
    try {
        const res = await SafeRequest(() =>
            Retry(() =>
                axios.post("https://auth.roblox.com/v2/logout", {}, {
                    headers: { Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}` },
                    timeout: 30000
                })
            )
        );
        return res.headers["x-csrf-token"];
    } catch (err) {
        return err.response?.headers["x-csrf-token"] || "";
    }
}

async function FetchRoles(groupId) {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`, { timeout: 30000 })
        )
    );
    return res.data.roles.sort((a, b) => a.rank - b.rank);
}

async function GetGroupMembers(groupId) {
    const members = [];
    let cursor = null;

    do {
        const url = cursor
            ? `https://groups.roblox.com/v1/groups/${groupId}/users?cursor=${cursor}&limit=100`
            : `https://groups.roblox.com/v1/groups/${groupId}/users?limit=100`;

        const res = await SafeRequest(() =>
            Retry(() =>
                axios.get(url, {
                    headers: { Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}` },
                    timeout: 30000
                })
            )
        );

        if (!res.data.data) break;

        for (const m of res.data.data) {
            members.push({
                userId: m.user.id,
                username: m.user.username,
                rankId: m.role.id,
                rankName: m.role.name,
                rankNumber: m.role.rank
            });
        }

        cursor = res.data.nextPageCursor || null;
    } while (cursor);

    return members;
}

async function GetCurrentRank(groupId, userId) {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, { timeout: 30000 })
        )
    );
    const groupData = res.data.data.find(g => g.group.id === groupId);
    if (!groupData) throw new Error("User not in group");
    return groupData.role.rank;
}

async function GetNextRank(groupId, currentRankNumber) {
    const roles = await FetchRoles(groupId);
    return roles.find(r => r.rank > currentRankNumber) || null;
}

async function GetPreviousRank(groupId, currentRankNumber) {
    const roles = await FetchRoles(groupId);
    const lowerRoles = roles.filter(r => r.rank < currentRankNumber);
    return lowerRoles.length ? lowerRoles[lowerRoles.length - 1] : null;
}

async function SetRank(groupId, userId, roleId, issuer, logFunction) {
    if (!roleId) throw new Error("Missing roleId");
    let xsrfToken = await GetXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;

    try {
        await SafeRequest(() =>
            Retry(() =>
                axios.patch(url, { roleId }, {
                    headers: {
                        Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": xsrfToken
                    },
                    timeout: 30000
                })
            )
        );
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await SafeRequest(() =>
                Retry(() =>
                    axios.patch(url, { roleId }, {
                        headers: {
                            Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                            "Content-Type": "application/json",
                            "X-CSRF-TOKEN": xsrfToken
                        },
                        timeout: 30000
                    })
                )
            );
        } else throw err;
    }

    if (typeof logFunction === "function") await logFunction(groupId, userId, { id: roleId }, issuer);
}

async function GetRobloxUserId(username) {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.get(`https://users.roblox.com/v1/users/search?keyword=${username}`, { timeout: 30000 })
        )
    );
    if (!res.data.data || !res.data.data[0]) throw new Error("Invalid username");
    return res.data.data[0].id;
}

async function GetRobloxDescription(userId) {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 30000 })
        )
    );
    return res.data.description || "";
}

async function ExileUser(groupId, userId) {
    let xsrfToken = await GetXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`;
    try {
        await SafeRequest(() =>
            Retry(() =>
                axios.delete(url, {
                    headers: {
                        Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                        "X-CSRF-TOKEN": xsrfToken,
                        "Content-Type": "application/json"
                    },
                    timeout: 30000
                })
            )
        );
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await SafeRequest(() =>
                Retry(() =>
                    axios.delete(url, {
                        headers: {
                            Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                            "X-CSRF-TOKEN": xsrfToken,
                            "Content-Type": "application/json"
                        },
                        timeout: 30000
                    })
                )
            );
        } else throw new Error(`Failed to exile user: ${err.response?.statusText || err.message}`);
    }
}

async function GetRankIdFromName(groupId, rankName) {
    const roles = await FetchRoles(groupId);
    const role = roles.find(r => r.name.toLowerCase() === rankName.trim().toLowerCase());
    if (!role) throw new Error(`Rank "${rankName}" not found in the group.`);
    return role.id;
}

async function SetGroupShout(groupId, message) {
    let xsrfToken = await GetXsrfToken();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/status`;

    try {
        await SafeRequest(() =>
            Retry(() =>
                axios.patch(url, { message }, {
                    headers: {
                        Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": xsrfToken
                    },
                    timeout: 30000
                })
            )
        );
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await SafeRequest(() =>
                Retry(() =>
                    axios.patch(url, { message }, {
                        headers: {
                            Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                            "Content-Type": "application/json",
                            "X-CSRF-TOKEN": xsrfToken
                        },
                        timeout: 30000
                    })
                )
            );
        } else throw new Error(`Failed to set shout: ${err.response?.statusText || err.message}`);
    }
}

async function GetUserIdFromUsername(username) {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.post("https://users.roblox.com/v1/usernames/users", {
                usernames: [username]
            }, {
                headers: { "Content-Type": "application/json" },
                timeout: 30000
            })
        )
    );
    if (res.data.data && res.data.data.length > 0) return res.data.data[0].id;
    throw new Error("User not found");
}

async function LeaveGroup(groupId) {
    let xsrfToken = await GetXsrfToken();
    const selfId = await GetSelfUserId();
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${selfId}`;

    try {
        await SafeRequest(() =>
            Retry(() =>
                axios.delete(url, {
                    headers: {
                        Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                        "X-CSRF-TOKEN": xsrfToken
                    },
                    timeout: 30000
                })
            )
        );
    } catch (err) {
        if (err.response?.status === 403 && err.response?.headers["x-csrf-token"]) {
            xsrfToken = err.response.headers["x-csrf-token"];
            await SafeRequest(() =>
                Retry(() =>
                    axios.delete(url, {
                        headers: {
                            Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}`,
                            "X-CSRF-TOKEN": xsrfToken
                        },
                        timeout: 30000
                    })
                )
            );
        } else throw new Error(`Failed to leave group: ${err.response?.statusText || err.message}`);
    }
}

async function GetSelfUserId() {
    const res = await SafeRequest(() =>
        Retry(() =>
            axios.get("https://users.roblox.com/v1/users/authenticated", {
                headers: { Cookie: `.ROBLOSECURITY=${GetCurrentCookie()}` },
                timeout: 30000
            })
        )
    );
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
    LeaveGroup,
    GetGroupMembers
};
