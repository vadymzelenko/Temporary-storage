# Temporary Storage

A file sharing service with expiring links. Upload one or several files, choose how long the link should live, and share it. Recipients can download files one by one or as a single ZIP archive. Expired uploads are deleted automatically.

## Features

- Multi-file upload with drag and drop
- Link lifetime of 1, 12 or 24 hours (capped on the server)
- Download page with the file list, per-file downloads and "download all as ZIP"
- Files are streamed through the API, so storage URLs are never exposed to the client
- Background cleanup every 5 minutes removes expired files from storage and their records from the database
- Upload limits (file size and count) enforced on the server with clear error messages
- Correct download names for non-ASCII file names

## Architecture

```
React client ──▶ Express API ──▶ Supabase Storage (file contents, bucket "files")
                     │
                     └──▶ MongoDB (upload groups: names, storage paths, expiry)
```

| Endpoint | Description |
|---|---|
| `POST /api/files/upload` | Multipart upload (`files[]`, `ttl` in seconds), returns the share link |
| `GET /api/files/check/:id` | File names and expiry, or 404 / 410 |
| `GET /api/files/:id?index=N` | Download one file |
| `GET /api/files/:id/zip` | Download all files as a ZIP archive |

## Getting started

Requirements: Node.js 18+, MongoDB, a Supabase project with a storage bucket named `files`.

```bash
# API
cd server
cp .env.example .env        # MongoDB URI, Supabase URL and key, client URL
npm install
npm run dev                 # http://localhost:5000

# Client
cd ../client
cp .env.example .env        # REACT_APP_API_URL=http://localhost:5000
npm install
npm start                   # http://localhost:3000
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | API port | `5000` |
| `CLIENT_ORIGIN` | Allowed CORS origins, comma-separated | `http://localhost:3000` |
| `PUBLIC_URL` | Client URL used in share links | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection string | none |
| `SUPABASE_URL`, `SUPABASE_KEY` | Supabase project URL and server key | none |
| `TTL_IN_SECONDS` | Default link lifetime | `3600` |
| `MAX_TTL_IN_SECONDS` | Maximum link lifetime | `86400` |
| `MAX_FILE_SIZE_MB`, `MAX_FILES` | Upload limits | `50`, `20` |
| `REACT_APP_API_URL` | API URL for the client build | `http://localhost:5000` |

## Stack

React 18, Create React App, files-ui (drag and drop), Framer Motion; Node.js, Express, Multer, Archiver, Mongoose; Supabase Storage.

## License

[MIT](LICENSE) © Vadym Zelenko
