# Personal site

A Quarto website for Matteo Gay, with research, writing and reading notes.

Preview locally:

```sh
quarto preview
```

Build the static site in `public/`:

```sh
quarto render --to html
```

Each item is an `index.qmd` file in its section. Add `draft: true` to keep a
page out of rendered listings. Shared navigation and deployment configuration
live in `_quarto.yml`; the visual design lives in `static/css/style.css`.

## Publish with GitHub Pages

Use the `imatgay.github.io` repository under the `Imatgay` GitHub account.
In **Settings → Pages**, select **GitHub Actions** as the source. The existing
workflow builds and publishes the site on pushes to `main`. For the album
slideshow, add the Last.fm API key as a repository Actions secret named
`LASTFM_API_KEY`. The build publishes the cover list and keeps the key in
GitHub Actions.

The `public/` build and `.local-backup/` are ignored by Git. Only commit the
site source and assets intended for publication.
