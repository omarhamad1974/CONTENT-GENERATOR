# Content Studio — Gemini + GitHub Pages

A lightweight, mobile-friendly content generator for the **supplied KHIP import formats**. The frontend is static HTML/CSS/JavaScript hosted on GitHub Pages. It uses JSON for local projects, and a protected Supabase Edge Function for Gemini calls. The Gemini API key is never exposed in the browser.

## Features

- Brief: content type, quantity (1–20 topics), length (30–2,000 words), audience, tone, keywords and English / Arabic / bilingual.
- Generate an **editable outline first**, then full items one at a time. Each completed item is saved locally; failed batches can be recovered from saved items.
- Edit, delete or regenerate items; save/load projects in browser; import/export JSON project backups.
- Four exact KHIP content formats: articles/news, slider, service pages, homepage services.
- Export Markdown, slider CSV, project JSON, Word DOCX (combined or separate), or a ZIP containing individual Markdown and Word documents.
- Optional Word branding: standard cover/header, or upload a custom branded DOCX template containing placeholders. Arabic right-to-left paragraphs in standard Word exports.
- Arabic interface option (main navigation and headings); content editor fields retain English labels for consistency with the KHIP templates.

## 1. Deploy the static website to GitHub Pages

1. Create a GitHub repository (e.g. `content-studio`) and upload **all files** in this package.
2. Repository **Settings → Pages → Deploy from a branch → main → / (root)**.
3. Note the published HTTPS URL, e.g. `https://YOURNAME.github.io/content-studio/`.
4. Open that URL. The UI works immediately, but **AI generation requires the next steps**.

For local preview: run `python3 -m http.server 8000` in the project directory and open `http://localhost:8000` (do not open index.html with `file://`).

## 2. Set up Supabase authentication

1. Create a free Supabase project. In **Authentication → Providers → Email**, enable email/password sign-in.
2. Create an account for yourself in **Authentication → Users** (or enable sign-ups temporarily and register through Supabase); use a verified email if email confirmation is required.
3. In **Project Settings → API**, copy the project URL and **public anon/publishable key**. Never use the service-role or secret key in the browser.
4. In Content Studio, click **Settings** and enter your Supabase project URL, public key, login email and password. Your password is used only for sign-in and is not saved. The session token is stored in browser session storage. The public project URL/key are saved locally.

**Important:** Supabase authentication alone is not enough. The Edge Function additionally checks an **email allowlist** to prevent other authenticated users from consuming your Gemini credits. For a stronger deployment, add rate limiting and monitoring as your usage grows.

## 3. Create your Gemini API key

1. Visit **https://aistudio.google.com/apikey** and create a Gemini API key.
2. Do **not** paste this key into GitHub files, browser settings, or client-side JSON.
3. Keep it as a Supabase Edge Function secret named `GEMINI_API_KEY`.

Gemini API free-tier quotas and model availability can change. The default model is `gemini-2.5-flash` and can be overridden with `GEMINI_MODEL` if supported by your API key.

## 4. Deploy the Edge Function

Install the Supabase CLI. From this repository's root, run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY="YOUR_PRIVATE_GEMINI_KEY"
supabase secrets set ALLOWED_EMAILS="your-email@example.com"
supabase secrets set ALLOWED_ORIGINS="https://YOURNAME.github.io,http://localhost:8000"
supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
supabase functions deploy generate --no-verify-jwt
```

**CORS origin is the scheme and host only** (for GitHub Pages, `https://YOURNAME.github.io`, without the repository path or trailing slash). For a custom domain use its exact HTTPS origin. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` in its Edge Function environment.

The function uses `supabase.auth.getUser()` to verify each access token, checks `ALLOWED_EMAILS`, validates request size and content, and sends the prompt to Gemini server-side. The function is deployed with `--no-verify-jwt` **only because it performs its own authenticated-user verification**. Do not remove that check.

If you use the newer Supabase publishable-key model, verify that the project also exposes the legacy anon key required by the Edge Function's `SUPABASE_ANON_KEY` environment variable, or adapt the server-side auth client accordingly.

## 5. Generate content

1. Enter the brief and select a content type.
2. Click **Generate outline**; review and edit each title and description.
3. Click **Generate full content**. Each topic is processed sequentially to limit simultaneous API requests.
4. Review generated items. Edit or regenerate individual items as needed.
5. Go to **Export center**, select a format, then download.

For **Bilingual**, each approved topic produces **two items**, one English and one Arabic (so 5 topics = 10 items). For service-page imports, the `Language:` line is exactly `English` or `Arabic`, never `Bilingual`.

The image field is a **suggested filename**, not an image. Add real image files with matching names before importing into the KHIP admin. No external image API is required or included in this version.

## 6. KHIP import formats (preserved)

| Type | Template | Fields |
|---|---|---|
| Articles / News | `templates/1-articles-template.md` | Heading 1 title, Subtitle, Date, Category, Image, Excerpt, Markdown body |
| Slider | `templates/2-slides-template.md` or `.csv` | Title, Subtitle, Tag, Image |
| Service pages | `templates/3-service-pages-template.md` | Heading 1 title, Service, Language, Subtitle, intro, `##` cards |
| Homepage services | `templates/4-services-section-template.md` | Heading 1 title, Service, Language, Brief, Icon, Page file, Hidden, popup, `## Page content` and card headings |

The original supplied templates and README are included in `templates/` unchanged. **CSV is intentionally available for slides only**, matching the supplied CSV template.

## 7. Word export and custom branded templates

**Standard Word:** Each item title uses Word **Heading 1**, and `##` subheadings use **Heading 2**. Metadata is emitted as plain `Label: value` lines, as required by the KHIP importer. Word documents can be downloaded individually or combined. Optional cover page, brand header and page numbers are included.

**Branded Word:** Upload a DOCX containing placeholders. The branded document retains its existing page layout, headers, logos, footers and styles, while replacing tokens in `word/document.xml`. Example templates for all four content types are in `examples/`.

Supported placeholders: `{{TITLE}}`, `{{SUBTITLE}}`, `{{DATE}}`, `{{CATEGORY}}`, `{{IMAGE}}`, `{{EXCERPT}}`, `{{TAG}}`, `{{SERVICE}}`, `{{LANGUAGE}}`, `{{BRIEF}}`, `{{ICON}}`, `{{PAGE_FILE}}`, `{{HIDDEN}}`, `{{BODY}}`.

- `{{TITLE}}` should be in a paragraph styled **Heading 1** if you intend to import the Word document into KHIP.
- `{{BODY}}` **must be the only text in its paragraph**, and the placeholder must be in **one Word text run**. Type it once in Word, without applying mixed formatting inside the token.
- For import-ready branded Word, include the relevant `Label: {{TOKEN}}` lines as shown in the example templates.
- Branded exports are **one document per item**. When there are multiple items, the download is a ZIP of DOCX files.
- Complex Word content controls, repeating tables and placeholders split across runs are **not supported** in this first version. It is a simple placeholder-based template engine, not a full DOCX mail-merge system.
- DOCX and ZIP exports load the open-source `docx` and `JSZip` browser libraries from jsDelivr. The first load requires an internet connection.

## 8. Storage, privacy, costs and limitations

- Projects are saved in **localStorage on the current device/browser**. They are **not** automatically committed to GitHub or synchronized across devices. Use **Download project JSON** for backups and **Import project JSON** to restore them.
- Browser storage can be cleared; always export important projects. Avoid entering confidential data into a third-party AI API unless approved for that use.
- GitHub Pages hosting can be free; Gemini API usage is subject to Google's current limits and billing; Supabase usage is subject to its plan quotas.
- No AI output is fact-checked automatically. Review legal, technical, medical and numerical claims before publishing.
- Content length is an approximate prompt target; Gemini can return shorter results or fail on large requests. Retry individual items or request shorter content.
- This package does **not** include image downloads, server-side storage, a full Word layout designer, or a deployed live site. It provides the complete deployable source and setup instructions.

## Testing

Run `npm test` (Node 20+). Tests verify the exact import conventions for Markdown/CSV and basic sanitization. A browser smoke test and a real Supabase/Gemini connection test are still required after deployment.
