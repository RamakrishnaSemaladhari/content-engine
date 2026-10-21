# Insights API source

This folder contains the source for the existing authenticated editorial API Worker, reconstructed from its deployed source map and extended to import private research drafts from the content-engine D1 database.

## Bindings

- DB: FiveCheckMate Insights editorial D1 database.
- CONTENT_DB: content-engine D1 database, read-only in application logic for import.
- Existing BOOTSTRAP_TOKEN and SESSION_SECRET must remain configured as Cloudflare Worker secrets.

## Migration and deployment

1. Apply migrations/0002_engine_draft_import.sql to the Insights editorial D1 database.
2. Configure CONTENT_DB as a D1 binding to the content-engine database.
3. Preserve the existing BOOTSTRAP_TOKEN and SESSION_SECRET secrets.
4. Deploy this Worker only to the staging Insights API after reviewing the diff and validating the bindings. Do not deploy to the public website Worker.
5. The preview admin UI adds an Import research drafts action. It requires an authenticated user with create permission and copies a selected engine draft as an unpublished editorial draft. Import is idempotent by engine draft ID.
6. The normal editor workflow still controls submit, approve, publish, unpublish and delete. Public article routes select published articles only.

Do not run this deployment until the staging D1 migration and Worker bindings are confirmed. The production website Worker and DNS are not part of this deployment.
