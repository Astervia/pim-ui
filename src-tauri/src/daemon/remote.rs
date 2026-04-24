//! Remote daemon connector (TCP + TLS + token) — v0.5 mobile scope.
//! Phase 1 ships the Unix-socket sidecar path only.

#![allow(dead_code)]

pub struct Remote;
impl Remote {
    pub async fn connect(_host: &str, _port: u16) -> anyhow::Result<Self> {
        anyhow::bail!("remote TCP daemon not supported in Phase 1 — see ROADMAP v0.5 MOBILE scope")
    }
}
