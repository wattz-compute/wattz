FROM rust:1.85-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      pkg-config libssl-dev protobuf-compiler cmake \
    && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml ./
COPY packages/inference-gateway ./packages/inference-gateway
COPY packages/node-runtime ./packages/node-runtime
COPY packages/compute-verifier ./packages/compute-verifier
RUN cargo build --release --package wattz-inference-gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/wattz-inference-gateway /usr/local/bin/wattz-gateway
ENV RUST_LOG=info
ENV LISTEN=0.0.0.0:8080
EXPOSE 8080
CMD ["/usr/local/bin/wattz-gateway"]
