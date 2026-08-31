import type { PreparedRevealMedia } from './revealMediaPreload';

export async function preparePrivateTicketRevealMedia(
  privateMediaRelease: string
): Promise<PreparedRevealMedia> {
  if (!privateMediaRelease.trim()) {
    throw new Error('Private media release is missing.');
  }

  const response = await fetch(
    '/api/merch-reveal-video?productId=ticket',
    {
      cache: 'no-store',
      credentials: 'same-origin'
    }
  );

  if (!response.ok) {
    throw new Error(`Private ticket reveal returned ${response.status}.`);
  }

  const blob = await response.blob();

  if (blob.size <= 0 || !blob.type.startsWith('video/')) {
    throw new Error('Private ticket reveal response was invalid.');
  }

  const objectUrl = URL.createObjectURL(blob);
  let released = false;

  return {
    forwardUrl: objectUrl,
    release() {
      if (released) {
        return;
      }

      released = true;
      URL.revokeObjectURL(objectUrl);
    },
    reverseUrl: objectUrl
  };
}
