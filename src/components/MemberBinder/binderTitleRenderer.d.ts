export function createBinderTitle(
  container: HTMLElement,
  heading: HTMLElement,
): {
  setText(text: string): void;
  refresh(): void;
  destroy(): void;
} | null;
