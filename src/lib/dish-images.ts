/**
 * Dish slug -> photo. Single source for both the homepage's featured grid
 * and the full menu, so a new photo only needs adding in one place.
 *
 * These are royalty-free stock photos (Pexels) standing in until the
 * client's own food photography arrives — see public/images/CREDITS.md.
 * Dropping a real photo at the same path is the whole swap.
 *
 * Most dishes have no photo yet; the card falls back to a branded tile
 * rather than a broken/empty image box. Once the menu moves to Supabase
 * the image belongs on the menu item record itself and this file goes.
 */
export const dishImages: Record<string, string> = {
  "chicken-biryani": "/images/dishes/chicken-biryani.jpg",
  "chicken-chapli-kebab": "/images/dishes/chicken-chapli-kebab.jpg",
  "chicken-shoarma": "/images/dishes/chicken-shoarma.jpg",
  "zinger-burger": "/images/dishes/zinger-burger.jpg",
  "qeema-naan": "/images/dishes/qeema-naan.jpg",
  "milk-shake": "/images/dishes/milk-shake.jpg",
};

export function dishImage(slug: string): string | undefined {
  return dishImages[slug];
}
