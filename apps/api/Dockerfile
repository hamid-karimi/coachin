# syntax=docker/dockerfile:1

# ---- build: one static binary, cross-compiled for the target platform -------
FROM --platform=$BUILDPLATFORM golang:1.27.1-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# ---- runtime: no shell, no package manager, non-root ------------------------
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/api /api
ENV TZ=UTC
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/api"]
CMD ["serve"]
