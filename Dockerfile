# ==========================================
# Stage 1: Build the SolidJS Frontend
# ==========================================
FROM --platform=$BUILDPLATFORM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies first (caches this layer)
COPY package.json bun.lock ./
RUN bun ci

# Copy the rest of the code
COPY . .

# Build the frontend (outputs to /app/dist)
RUN bun run build

# ==========================================
# Stage 2: Compile PocketBase from source
# ==========================================
# Runs on the build machine and cross-compiles (pure Go, no CGO),
# so multi-arch builds don't need slow QEMU emulation
FROM --platform=$BUILDPLATFORM golang:1-alpine AS pb-builder

# Set automatically by buildx
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

# Download modules first (caches this layer until go.mod/go.sum change)
COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath -ldflags "-s -w" -o /out/pocketbase .

# ==========================================
# Stage 3: Setup PocketBase & Serve
# ==========================================
FROM alpine:latest

# Install required tools
RUN apk add --no-cache ca-certificates

# Compiled PocketBase binary
COPY --from=pb-builder /out/pocketbase /pb/pocketbase

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