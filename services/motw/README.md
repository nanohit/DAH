Memory of the World (books.memoryoftheworld.org) quick notes

- Search endpoint: `https://books.memoryoftheworld.org/search/<field>/<term>`
  - Fields observed in the SPA: title, authors, publisher, series, tags, librarian.
  - JSON response includes `_items` with `formats`, `cover_url`, `library_url`, etc.
- File URLs:
  - `library_url` is like `//quintus.memoryoftheworld.org/`
  - `formats` entries have `dir_path` and `file_name`
  - Build download URL: `https:${library_url}<dir_path><file_name>` (URL-encode spaces)
- Cover URL: `https:${library_url}<cover_url>`
- Pagination: `_links.next.href` shows `?page=N`

We only implemented `search/title/<term>` by default; field can be set via query param `field`.














