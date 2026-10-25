# ==========================================
# Stage 1: Build the SolidJS Frontend
# ==========================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies first (caches this layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Build the frontend (outputs to /app/dist)
RUN bun run build

# ==========================================
# Stage 2: Setup PocketBase & Serve
# ==========================================
FROM alpine:latest

# You can update this to the latest PocketBase version
ARG PB_VERSION=0.40.5
# Set automatically by buildx (amd64, arm64...), matches PocketBase's release names
ARG TARGETARCH

# Install required tools
RUN apk add --no-cache unzip ca-certificates curl

# Download and unzip PocketBase (-f makes curl fail on HTTP errors instead of saving the 404 page)
RUN curl -fL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH:-amd64}.zip" -o /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

# Ship the schema so a fresh pb_data gets its collections automatically.
# (Remove these lines if you don't have the folders.)
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks

# Copy the compiled SolidJS frontend into PocketBase's public directory
COPY --from=builder /app/dist /pb/pb_public

# Entrypoint that creates the superuser from env vars before starting PocketBase
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Run as a non-root user with a fixed uid/gid (easy to chown bind mounts)
RUN addgroup -g 1000 pocketbase \
    && adduser -D -u 1000 -G pocketbase pocketbase \
    && mkdir -p /pb/pb_data \
    && chown -R pocketbase:pocketbase /pb
USER pocketbase

# Expose the default PocketBase port
EXPOSE 8090

# Define where the database lives so Compose can map a volume to it
VOLUME /pb/pb_data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

# Start PocketBase via the entrypoint (0.0.0.0 ensures it accepts connections from outside the container)
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]