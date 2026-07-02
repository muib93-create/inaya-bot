const TIME_ZONE = "Asia/Seoul";

function now() {
    return new Date();
}

function getTodayKST(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function formatTimeKST(date) {
    return new Intl.DateTimeFormat("ko-KR", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

function formatDateTimeKST(date) {
    return new Intl.DateTimeFormat("ko-KR", {
        timeZone: TIME_ZONE,
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
}

function addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
}

function diffMinutes(from, to) {
    return Math.floor((to - from) / 1000 / 60);
}

function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
        return `${minutes}분`;
    }

    return `${hours}시간 ${minutes}분`;
}

module.exports = {
    now,
    getTodayKST,
    formatTimeKST,
    formatDateTimeKST,
    addHours,
    diffMinutes,
    formatMinutes,
};