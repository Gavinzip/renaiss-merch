// A compact dashboard represents stories, rather than every source post.
// Source records stay intact; this only chooses distinct cards for the widget.
const genericNames = new Set(["renaiss", "vinci world", "bnb chain", "web3", "blockchain", "community", "gacha", "gacha pack", "卡牌", "收藏品"]);

function normalized(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[@#]/g, "").replace(/\s+/g, " ").trim();
}

function titleTokens(title) {
  const value = normalized(title).replace(/renaiss|vinci world|bnb\s*chain/g, "");
  const tokens = new Set(value.match(/[a-z][a-z0-9_]{2,}/g) || []);
  for (const phrase of value.match(/[\p{Script=Han}]+/gu) || []) {
    for (let i = 0; i < phrase.length - 1; i++) tokens.add(phrase.slice(i, i + 2));
  }
  return tokens;
}

export function sameCommunityStory(a, b) {
  if (a.url === b.url || a.id === b.id) return true;
  if (a.storyId && (a.storyId === b.storyId || a.storyId === b.id)) return true;
  if (b.storyId && b.storyId === a.id) return true;
  const distance = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  if (!Number.isFinite(distance) || distance > 7 * 86_400_000) return false;
  const titleA = normalized(a.title);
  const titleB = normalized(b.title);
  const appointment = /cbo|chief business officer|商務長|新任|延攬|(?:歡迎|欢迎|welcomes?).{0,35}(?:加入|join|executive)|(?:高管|executive).{0,35}(?:加入|join|拓展)/;
  if (titleA.includes("renaiss") && titleB.includes("renaiss") && appointment.test(titleA) && appointment.test(titleB)) return true;
  for (const tag of [...(a.storyTags || []), ...(b.storyTags || [])]) {
    const entity = normalized(tag);
    if (entity.length < 3 || genericNames.has(entity)) continue;
    if (titleA.includes(entity) && titleB.includes(entity)) return true;
  }
  const tokensA = titleTokens(a.title);
  const tokensB = titleTokens(b.title);
  const shared = [...tokensA].filter(token => tokensB.has(token)).length;
  if (a.eventStart && a.eventStart === b.eventStart && shared >= 2) return true;
  return shared >= 3 && shared / Math.min(tokensA.size, tokensB.size) >= .55;
}

export function distinctCommunityStories(cards) {
  const stories = [];
  for (const card of cards) {
    const index = stories.findIndex(story => sameCommunityStory(story, card));
    if (index < 0) stories.push(card);
    // Prefer the first-party announcement to a reaction about the same story.
    else if (card.role === "official" && stories[index].role !== "official") stories[index] = card;
  }
  return stories;
}
