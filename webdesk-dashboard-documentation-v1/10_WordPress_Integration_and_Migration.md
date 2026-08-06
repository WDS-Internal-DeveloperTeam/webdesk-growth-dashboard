# WordPress Integration and Migration

## 1. Current environment reported by WebDesk

- Production: `https://webdesksolution.com/`
- Staging: `https://staging-7a61-wdsstage2.wpcomstaging.com/`
- WordPress version reported: 7.0.2
- PHP version reported: 8.4
- Hosting: WordPress.com Business Plan
- GA4, GTM, Microsoft Clarity, and Podio are in use

Current-state values must be verified during implementation and must not be silently treated as independently confirmed.

## 2. Approved target architecture

- New custom theme: **WebDesk Custom Theme**
- Initial version: `1.0.0`
- Separate private GitHub repository
- Native WordPress/PHP architecture
- No Elementor
- No ACF
- No ACF Local JSON
- No third-party custom-field framework
- No direct core/plugin/vendor modifications

## 3. Theme structure

```text
webdesk-custom-theme/
  style.css
  functions.php
  index.php
  front-page.php
  home.php
  page.php
  single.php
  archive.php
  search.php
  404.php
  header.php
  footer.php
  screenshot.png
  theme.json
  assets/
    src/
      scss/
        abstracts/
        base/
        layout/
        components/
        sections/
        templates/
        utilities/
        pages-exceptions/
        main.scss
      js/
        main.js
        modules/
      images/
      fonts/
    dist/
      css/main.min.css
      js/main.min.js
      images/
      fonts/
  templates/page-templates/
  parts/
    header/
    footer/
    navigation/
    content/
    sections/
    components/
  inc/
    theme-setup.php
    enqueue.php
    post-types.php
    taxonomies.php
    meta-schema.php
    meta-boxes.php
    admin-fields.php
    rest-api.php
    migrations.php
    security.php
    helpers.php
  languages/
  tests/
  package.json
  package-lock.json
  vite.config.js
  postcss.config.js
  .browserslistrc
  .stylelintrc.json
  .editorconfig
  .gitignore
  README.md
```

Compiled files are never edited manually.

## 4. Native structured-content architecture

Use:

- `register_post_meta()`;
- native meta boxes;
- custom administrative interfaces;
- WordPress attachment IDs;
- custom REST fields/endpoints;
- custom taxonomies;
- native post relationships;
- custom database tables only when post meta is unsuitable for volume, querying, relational complexity, or performance.

Every metadata field defines:

- key;
- data type;
- default;
- single/multiple behavior;
- sanitization;
- validation;
- authorization callback;
- REST visibility;
- confidentiality;
- version;
- migration;
- retention/deletion behavior.

## 5. Existing CaseStudy plugin

### Post type

- slug: `casestudy`
- supports: title, editor, thumbnail, excerpt, comments
- archive: disabled
- URL: flat `/{post-slug}/`

### Taxonomy

- slug: `casestudy_category`
- hierarchical: yes
- rewrite: `casestudy_category`
- term meta: `casestudy_cat_sort`

### Existing post meta

| Field | Meta key | Existing type |
|---|---|---|
| Logo | `casestudy_logo_meta_key_cs` | upload-result array |
| Delivery Date | `delivery_date_meta_key` | date string |
| Sort Order | `cs_sort_order` | number |
| Technologies | `casestudy_tech_meta_key_cs` | checkbox array |
| Content Title | `content_title_cs` | serialized array |
| Content Description | `content_desc_cs` | array |
| Content Image | `content_image_cs` | upload-result array |
| Gallery | `img_gallery_cs` | gallery metadata |

## 6. Existing Portfolio plugin

### Post type

- slug: `portfolio`
- supports: title, editor, thumbnail, excerpt
- archive: disabled
- URL: `/portfolio/{post-slug}/`

### Taxonomy

- slug: `portfolio-category`
- hierarchical: yes
- rewrite: `portfolio-category`
- extra classification: `category_type`, stored through options `category_industry` and `category_technology`

### Existing post meta

| Field | Meta key | Existing type |
|---|---|---|
| Logo | `portfolio_logo_meta_key` | upload-result array |
| Delivery Date | `delivery_date_meta_key` | date string |
| Technologies | `portfolio_tech_meta_key` | checkbox array |
| Gallery | `img_gallery` | gallery metadata |

## 7. Migration decision

Option A is approved: register required post types and taxonomies in the WebDesk Custom Theme.

Existing plugins remain active until:

1. inventory is complete;
2. staging migration succeeds;
3. counts and URLs are verified;
4. templates render correctly;
5. rollback is documented;
6. migration is approved;
7. production cutover is scheduled.

Old and new registrations must not compete in production.

## 8. Migration requirements

The version-controlled migration command must:

- support dry run;
- back up database and uploads;
- preserve IDs, slugs, dates, statuses, authors, URLs;
- preserve terms and relationships;
- map all meta keys;
- convert upload arrays to attachment IDs;
- preserve gallery order;
- map technologies to the approved taxonomy or structured metadata;
- preserve repeatable Case Study content order;
- log exceptions;
- report before/after counts;
- be idempotent where possible;
- provide rollback instructions.

## 9. Theme Migration and Reconciliation Report

Custom-theme development must not begin until the current site is audited for:

- templates;
- page-builder content;
- shortcodes;
- custom CSS/JavaScript;
- header/footer;
- menus/widgets;
- reusable blocks;
- theme options;
- hardcoded content;
- page-specific templates;
- structured data;
- forms;
- redirects;
- tracking scripts.

Each item is classified:

- Migrate
- Rebuild
- Replace
- Retain
- Retire

## 10. Build process

- Dart Sass, Vite, PostCSS
- Node.js 22 LTS for WordPress theme build
- npm and committed `package-lock.json`
- `npm run dev`
- `npm run build`
- main SCSS entry: `assets/src/scss/main.scss`
- main JS entry: `assets/src/js/main.js`

Dashboard and WordPress build systems remain fully isolated.

## 11. Deployment

```text
feature branch
→ Pull Request
→ automated PHP/JS/SCSS/security/build checks
→ staging branch/deployment
→ QA and stakeholder approval
→ exact approved commit to production
→ smoke tests
```

Direct SFTP deployment and manual production editing are prohibited.

## 12. Integration verification still required at implementation

- REST API availability/restrictions;
- Application Password support;
- WP-CLI/SSH limitations;
- current active theme and repository;
- existing forms/Podio mapping and retries;
- analytics IDs, consent, and event ownership;
- installed vs active plugin inventory;
- security-tool configuration;
- modified core/plugin/vendor files;
- current technical debt.
