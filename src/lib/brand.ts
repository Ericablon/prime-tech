export const brandLogo = `${import.meta.env.BASE_URL}brand/prime-tech-logo.jpeg`;

export function resolveLogo(url?: string | null) {
  return !url || url === "/brand/prime-tech-logo.jpeg" ? brandLogo : url;
}
