/**
 * Normalize an Xbox image URL so it loads on an HTTPS page.
 *
 * OpenXBL returns many image URLs as http://, which is mixed content on our
 * HTTPS site. store-images.s-microsoft.com serves the same path over https, but
 * the legacy Xbox image host images-eds.xboxlive.com only serves TLS from a
 * different host (images-eds-ssl.xboxlive.com), so we rewrite that too.
 */
export function imageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url
    .replace("images-eds.xboxlive.com", "images-eds-ssl.xboxlive.com")
    .replace(/^http:\/\//, "https://");
}
