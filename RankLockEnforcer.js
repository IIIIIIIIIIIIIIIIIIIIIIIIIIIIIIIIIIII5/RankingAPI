const { fetchRoles, GetGroupMembers, SetRank } = require("./roblox");
const { getJsonBin, saveJsonBin } = require("./utils");

const CheckInterval = 60 * 1000;

async function EnforceRankLocks() {
    const Db = await GetJsonBin();

    for (const GuildId in Db.ServerConfig) {
        const GroupId = Db.ServerConfig[GuildId]?.GroupId;
        if (!GroupId) continue;

        const RankLocks = Db.RankLocks?.[GuildId] || {};
        if (!RankLocks || Object.keys(RankLocks).length === 0) continue;

        const Members = await GetGroupMembers(GroupId);

        for (const Member of Members) {
            const LockedRank = RankLocks[Member.userId];
            if (!LockedRank) continue;

            if (Member.rankId !== LockedRank) {
                try {
                    await SetRank(GroupId, Member.userId, LockedRank, "RankLock Enforcer");
                    console.log(`Reset rank for ${Member.userId} to locked rank ${LockedRank}`);
                } catch (Err) {
                    console.error(`Failed to reset rank for ${Member.userId}: ${Err.message}`);
                }
            }
        }
    }
}

setInterval(() => {
    EnforceRankLocks().catch(console.error);
}, CheckInterval);
