FROM oven/bun:1.3.14 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_SITE_URL=https://apostolos-saint-irenee.duckdns.org
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN bun --bun next build --webpack

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
RUN mkdir -p /app/avatars && chown bun:bun /app/avatars
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 CMD bun -e 'const r=await fetch("http://127.0.0.1:3000/");process.exit(r.ok?0:1)'
CMD ["bun", "server.js"]
