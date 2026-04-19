# Newapp Frontend (React + Vite)

`newapp` is the main frontend for the BCU Library Platform.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start Vite dev server:

```bash
npm run dev
```

By default, API requests to `/api` are proxied to `http://127.0.0.1:8080`.

## Production build

```bash
npm run build
```

The output is generated in `newapp/dist` and served by the backend at `/app`.
