const runtimeBase = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export const brandLogo = `${runtimeBase}brand/prime-tech-logo.jpeg`;
export const brandMark = `${runtimeBase}brand/cronos-mark.svg`;

export function resolveLogo(url?: string | null) {
  return !url || url === '/brand/prime-tech-logo.jpeg' ? brandLogo : url;
}
