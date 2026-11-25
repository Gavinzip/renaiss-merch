export function validDrawIdentity(value) {
    return typeof value?.name === "string" && value.name.trim() === value.name && value.name.length > 0 && value.name.length <= 120 &&
        typeof value.xUsername === "string" && /^[a-z0-9_]{1,15}$/.test(value.xUsername) &&
        !["i", "home", "explore", "search", "intent", "settings", "messages", "notifications"].includes(value.xUsername);
}
