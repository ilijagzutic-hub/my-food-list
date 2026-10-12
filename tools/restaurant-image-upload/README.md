# Restaurant image upload (trusted tool)

Adds **one approved image** to **one restaurant**. Run it on your own machine. It is not part of the website and
nothing in this folder is shipped to the browser.

What it does: reads your photo → fixes orientation → **strips all metadata (EXIF, GPS, XMP, IPTC, ICC)** → makes two
WebP variants (hero 1200×800 ≈ ≤220 KB, thumb 480×360 ≈ ≤60 KB) → hashes the content → uploads both to the public
Supabase Storage bucket `restaurant-images` → records the image and its provenance via the trusted
`add_restaurant_image` function. The website picks it up on the next page load — **no redeploy**.

## One-time setup

```bash
cd tools/restaurant-image-upload
npm install
npm run selftest        # offline checks, no keys needed
```

## Use

```bash
# 1. look first (no key needed, nothing uploaded; previews land in ./preview)
node upload.mjs --restaurant 42 --file ~/Pictures/dinner.jpg --source-kind own_photo --dry-run

# 2. for real — the service-role key comes from the environment ONLY
export SUPABASE_SERVICE_ROLE_KEY='…'      # Supabase dashboard → Project Settings → API keys → secret / service_role
node upload.mjs --restaurant 42 --file ~/Pictures/dinner.jpg --source-kind own_photo
```

It asks you to confirm the restaurant name before uploading (`--yes` skips the prompt).

### Approved sources only

| `--source-kind` | When | Also required |
|---|---|---|
| `own_photo` | A photo taken by Ilija or Yarra | nothing (optional `--credit`) |
| `owner_permission` | Supplied by the restaurant, with permission | `--credit`, `--license-note` (say how/when permission was given) |
| `open_license` | Public-domain / openly licensed (e.g. Wikimedia Commons) | `--credit`, `--license-note` (e.g. "CC BY-SA 4.0"), `--source-url` |

Never use: Google Maps / Instagram / Tripadvisor / random website photos, `og:image` hotlinks, stock photos presented
as a specific restaurant, or AI-generated food images. Screenshots sent during intake are research evidence only.

Non-owned images show a small credit line on the restaurant's detail page.

### Other options

* `--no-primary` – store and record it without replacing the restaurant's current primary image.
* A replacement becomes the new primary; the old files stay in Storage (non-primary) until removed (see below).
* HEIC photos: convert first, e.g. `sips -s format jpeg IMG_1234.HEIC --out IMG_1234.jpg`.

### Removing / replacing an image

Delete the rows, then the files, from the Supabase dashboard (SQL editor + Storage). Example:

```sql
delete from restaurant_images where restaurant_id = 42;   -- the app falls back to the placeholder immediately
```

then delete `restaurants/42/…` in Storage → `restaurant-images`.

## Security notes

* The service-role key bypasses all access rules. Keep it in your shell environment or a password manager —
  **never** commit it, paste it into the website code, or put it in a `NEXT_PUBLIC_*` variable.
* The bucket allows public **read** only. Anonymous visitors cannot upload, overwrite, delete or list files, and
  `add_restaurant_image` can only be executed with the service-role key.
* Because the site has no login, anything stored here is public — only upload images you are happy to publish
  (and avoid photos with identifiable people).
