// Leave headroom for multipart boundaries and route metadata under Vercel's
// 4.5 MB function payload limit.
export const INLINE_UPLOAD_BUDGET = 3_800_000;

export function requiresDirectUpload(sizes: number[]) {
  return sizes.reduce((total, size) => total + size, 0) > INLINE_UPLOAD_BUDGET;
}
