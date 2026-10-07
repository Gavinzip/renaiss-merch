export type CommunityStory = {
  id: string; url: string; title: string; summary: string; publishedAt: string; role: string;
  storyId?: string; storyTags?: string[];
  eventStart?: string;
};
export function sameCommunityStory(a: CommunityStory, b: CommunityStory): boolean;
export function distinctCommunityStories<T extends CommunityStory>(cards: T[]): T[];
