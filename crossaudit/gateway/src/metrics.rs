use once_cell::sync::Lazy;
use prometheus_client::{metrics::{counter::Counter, histogram::Histogram}, registry::Registry};

pub static REQUEST_COUNTER: Lazy<Counter<u64>> = Lazy::new(Counter::default);
pub static RESPONSE_TIME: Lazy<Histogram> = Lazy::new(|| Histogram::new(vec![0.1, 0.5, 1.0, 5.0]));

pub fn register(registry: &mut Registry) {
    registry.register("requests_total", "Number of requests", REQUEST_COUNTER.clone());
    registry.register("response_seconds", "Response times", RESPONSE_TIME.clone());
}
