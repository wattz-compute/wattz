//! Dependency-free abuse throttling for the public `/v1` inference
//! routes.
//!
//! The gateway keeps inbound keys optional during the bootstrap phase,
//! so `api.wattz.fi` is directly reachable by non-browser clients (CORS
//! does not stop `curl`). Without a throttle a single caller could drive
//! the shared Groq relay and burn `GROQ_API_KEY` quota at will. Two
//! independent guards run here, both active even while keys are optional:
//!
//! 1. A per-client-IP token bucket capping anonymous request rate.
//! 2. A global in-flight concurrency cap as a second line of defense
//!    against a distributed drain of the upstream provider quota.
//!
//! The gateway runs behind Railway / Cloudflare, so the client IP is
//! taken from the forwarded headers (`X-Forwarded-For` / `X-Real-IP`)
//! and only falls back to the peer socket address when neither is
//! present -- otherwise every request would collapse onto the proxy IP.
//! This layer is orthogonal to node / KYC auth, which is unchanged.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use parking_lot::Mutex;
use serde_json::json;

/// Idle buckets older than this are garbage-collected so a spray of
/// unique source IPs cannot grow the map without bound. An idle bucket
/// has refilled to full capacity, so dropping and lazily recreating it
/// is behaviourally identical.
const GC_INTERVAL: Duration = Duration::from_secs(300);

/// Default sustained per-IP budget (requests/minute) and burst size.
const DEFAULT_PER_MINUTE: f64 = 120.0;
/// Default global concurrency ceiling across all callers.
const DEFAULT_MAX_INFLIGHT: usize = 256;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Inner>,
}

struct Inner {
    /// Bucket burst capacity (tokens).
    capacity: f64,
    /// Token refill rate per second.
    refill_per_sec: f64,
    /// Global concurrency ceiling.
    max_inflight: usize,
    buckets: Mutex<HashMap<IpAddr, Bucket>>,
    inflight: AtomicUsize,
    last_gc: Mutex<Instant>,
}

#[derive(Clone, Copy)]
struct Bucket {
    tokens: f64,
    last: Instant,
}

impl RateLimiter {
    /// Build from `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_MAX_INFLIGHT`
    /// with production-safe defaults.
    pub fn from_env() -> Self {
        let per_minute = std::env::var("RATE_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|s| s.parse::<f64>().ok())
            .filter(|v| *v > 0.0)
            .unwrap_or(DEFAULT_PER_MINUTE);
        let max_inflight = std::env::var("RATE_LIMIT_MAX_INFLIGHT")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .filter(|v| *v > 0)
            .unwrap_or(DEFAULT_MAX_INFLIGHT);
        Self::new(per_minute, max_inflight)
    }

    pub fn new(per_minute: f64, max_inflight: usize) -> Self {
        Self {
            inner: Arc::new(Inner {
                capacity: per_minute,
                refill_per_sec: per_minute / 60.0,
                max_inflight,
                buckets: Mutex::new(HashMap::new()),
                inflight: AtomicUsize::new(0),
                last_gc: Mutex::new(Instant::now()),
            }),
        }
    }

    /// Try to admit one request from `ip`. Returns `false` when the
    /// caller's bucket is empty.
    fn allow(&self, ip: IpAddr, now: Instant) -> bool {
        let mut buckets = self.inner.buckets.lock();
        let bucket = buckets.entry(ip).or_insert(Bucket {
            tokens: self.inner.capacity,
            last: now,
        });
        let elapsed = now.saturating_duration_since(bucket.last).as_secs_f64();
        bucket.tokens =
            (bucket.tokens + elapsed * self.inner.refill_per_sec).min(self.inner.capacity);
        bucket.last = now;
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Reserve a slot against the global concurrency ceiling. `None`
    /// when the gateway is already at capacity.
    fn try_acquire_inflight(&self) -> Option<InflightGuard> {
        let prev = self.inner.inflight.fetch_add(1, Ordering::AcqRel);
        if prev >= self.inner.max_inflight {
            self.inner.inflight.fetch_sub(1, Ordering::AcqRel);
            None
        } else {
            Some(InflightGuard {
                inner: self.inner.clone(),
            })
        }
    }

    fn maybe_gc(&self, now: Instant) {
        let mut last = self.inner.last_gc.lock();
        if now.saturating_duration_since(*last) < GC_INTERVAL {
            return;
        }
        *last = now;
        drop(last);
        self.inner
            .buckets
            .lock()
            .retain(|_, b| now.saturating_duration_since(b.last) < GC_INTERVAL);
    }
}

/// RAII permit that releases its global-concurrency slot on drop.
struct InflightGuard {
    inner: Arc<Inner>,
}

impl Drop for InflightGuard {
    fn drop(&mut self) {
        self.inner.inflight.fetch_sub(1, Ordering::AcqRel);
    }
}

/// axum middleware. Attach with `from_fn_with_state(limiter, throttle)`
/// on the inference routes only.
pub async fn throttle(State(limiter): State<RateLimiter>, req: Request, next: Next) -> Response {
    let now = Instant::now();
    let ip = client_ip(&req);

    if !limiter.allow(ip, now) {
        return error_response(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limit_error",
            "rate limit exceeded; reduce request rate and retry",
        );
    }
    limiter.maybe_gc(now);

    // Second line of defense. The permit is held for the duration of the
    // handler (through to the first response bytes for a stream), then
    // released on drop when this function returns.
    let Some(_permit) = limiter.try_acquire_inflight() else {
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "service_unavailable",
            "gateway at capacity; retry shortly",
        );
    };

    next.run(req).await
}

fn client_ip(req: &Request) -> IpAddr {
    if let Some(ip) = forwarded_ip(req.headers()) {
        return ip;
    }
    req.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip())
        .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED))
}

/// Extract the originating client IP from the proxy-set forwarded
/// headers. `X-Forwarded-For` may be a comma-separated chain; the
/// left-most entry is the original client as seen by the first proxy.
fn forwarded_ip(headers: &HeaderMap) -> Option<IpAddr> {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            if let Ok(ip) = first.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<IpAddr>().ok())
}

fn error_response(status: StatusCode, error_type: &str, message: &str) -> Response {
    (
        status,
        Json(json!({
            "error": {
                "message": message,
                "type": error_type,
                "code": null,
                "param": null,
            }
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_bucket_drains_and_blocks() {
        let limiter = RateLimiter::new(3.0, 100);
        let ip = IpAddr::V4(Ipv4Addr::new(203, 0, 113, 7));
        let now = Instant::now();
        // Burst capacity is 3, so the 4th immediate request is rejected.
        assert!(limiter.allow(ip, now));
        assert!(limiter.allow(ip, now));
        assert!(limiter.allow(ip, now));
        assert!(!limiter.allow(ip, now));
    }

    #[test]
    fn token_bucket_refills_over_time() {
        let limiter = RateLimiter::new(60.0, 100); // 1 token/sec
        let ip = IpAddr::V4(Ipv4Addr::new(203, 0, 113, 8));
        let start = Instant::now();
        // Drain the whole burst.
        for _ in 0..60 {
            assert!(limiter.allow(ip, start));
        }
        assert!(!limiter.allow(ip, start));
        // Two seconds later ~2 tokens have refilled.
        let later = start + Duration::from_secs(2);
        assert!(limiter.allow(ip, later));
        assert!(limiter.allow(ip, later));
        assert!(!limiter.allow(ip, later));
    }

    #[test]
    fn separate_ips_have_separate_buckets() {
        let limiter = RateLimiter::new(1.0, 100);
        let a = IpAddr::V4(Ipv4Addr::new(198, 51, 100, 1));
        let b = IpAddr::V4(Ipv4Addr::new(198, 51, 100, 2));
        let now = Instant::now();
        assert!(limiter.allow(a, now));
        assert!(!limiter.allow(a, now));
        // b is unaffected by a draining its bucket.
        assert!(limiter.allow(b, now));
    }

    #[test]
    fn inflight_cap_rejects_over_ceiling() {
        let limiter = RateLimiter::new(1000.0, 2);
        let g1 = limiter.try_acquire_inflight();
        let g2 = limiter.try_acquire_inflight();
        assert!(g1.is_some() && g2.is_some());
        assert!(limiter.try_acquire_inflight().is_none());
        // Releasing one frees a slot again.
        drop(g1);
        assert!(limiter.try_acquire_inflight().is_some());
    }

    #[test]
    fn xff_left_most_entry_wins() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "203.0.113.9, 10.0.0.1".parse().unwrap());
        assert_eq!(
            forwarded_ip(&headers),
            Some(IpAddr::V4(Ipv4Addr::new(203, 0, 113, 9)))
        );
    }

    #[test]
    fn x_real_ip_fallback() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", "198.51.100.42".parse().unwrap());
        assert_eq!(
            forwarded_ip(&headers),
            Some(IpAddr::V4(Ipv4Addr::new(198, 51, 100, 42)))
        );
    }
}
