chore: pin deps via .npmrc and add seeded Postgres 16 Docker image

Key decisions:
- .npmrc sets save-exact=true so future npm installs write exact versions
  instead of semver ranges; existing package-lock.json already pins the full
  tree and npm ci is the correct install command for reproducible builds
- Multi-stage Dockerfile (docker/db/Dockerfile): stage 1 uses node:22-alpine
  + postgresql16 (apk); starts a local Postgres instance, runs prisma migrate
  deploy then all 4 seed scripts in order (seed → seed-dev → seed-ads →
  seed-extended), and dumps the result with pg_dump
- Final image is postgres:16-alpine only — no Node.js runtime in the output
  layer; dump is placed in /docker-entrypoint-initdb.d/ and auto-restored on
  first container start
- Credentials baked into the final image: POSTGRES_USER/PASSWORD=postgres,
  POSTGRES_DB=peerconnect; DATABASE_URL for users of the image is
  postgresql://postgres:postgres@localhost:5432/peerconnect
- Trust auth used during the build stage (initdb --auth=trust) so no password
  is needed when the Node process connects to seed the database
- Postgres server binary location is resolved dynamically via
  `find /usr -name initdb -type f | head -1` so the Dockerfile works across
  Alpine versions regardless of where the package places the binaries

Files changed:
- .npmrc  (new — save-exact=true)
- docker/db/Dockerfile  (new — multi-stage seeded Postgres 16 image)
- .ai/issues/19-npmrc-exact-deps.md  (new — local issue mirror)
- .ai/issues/20-docker-seeded-db.md  (new — local issue mirror)

Blockers / notes for next iteration:
- Build: docker build -f docker/db/Dockerfile -t peerconnect-db .
- Run:   docker run -p 5432:5432 peerconnect-db
- If `find /usr -name initdb` returns multiple hits in a future Alpine
  version, the `head -1` pick may need to be made more specific

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
