//! Model registry helpers.
//!
//! The node runtime keeps a local cache of the models it has been asked to
//! serve. The list is a merge of the configured `WATTZ_MODELS_FILE` and
//! the runtime-detected list returned by the backend (`ollama list` etc.).

pub mod loader;

pub use loader::ModelLoader;
