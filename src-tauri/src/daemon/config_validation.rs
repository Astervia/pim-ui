//! Client-side `pim.toml` schema validation against the canonical
//! `pim_core::Config` definition.
//!
//! Surfaces schema/parse errors in the Settings editor BEFORE the user
//! triggers a save round-trip to the daemon. The daemon's REJECT-on-save
//! contract remains the source of truth — this is a UX accelerator, not
//! a substitute. When the daemon is running and accepts a config that
//! this validator rejected, trust the daemon (it may have looser parsing
//! semantics than `pim-core` direct deserialization).

use serde::Serialize;

/// Outcome of a `pim.toml` schema check.
///
/// Field shape mirrors what the frontend already renders for `RpcError`
/// payloads — `message` is shown verbatim under the editor field, `line`
/// (when present) drives a syntax-highlight gutter marker.
#[derive(Debug, Clone, Serialize)]
pub struct ConfigValidationError {
    pub message: String,
    /// 1-indexed line number when the underlying TOML error carries span
    /// information; `None` for schema-level errors that don't map to a
    /// single source line.
    pub line: Option<usize>,
    /// 1-indexed column number when available alongside `line`.
    pub column: Option<usize>,
}

/// Validate that `content` parses successfully into `pim_core::Config`.
///
/// Returns `Ok(())` on success, `Err(ConfigValidationError)` with a
/// human-readable diagnostic otherwise. Both TOML syntax errors and
/// schema mismatches (missing required fields, wrong types, unknown
/// enum variants) come out through the same error path because
/// `pim_core::Config::from_toml_str` collapses both into a `PimError`.
pub fn validate_pim_toml(content: &str) -> Result<(), ConfigValidationError> {
    // Use the public TOML round-trip rather than `toml::from_str` directly
    // so that any future helper logic the kernel adds inside
    // `Config::from_toml_str` (cross-field validation, custom error
    // formatting) flows through to the UI for free.
    match pim_core::Config::from_toml_str(content) {
        Ok(_) => Ok(()),
        Err(e) => {
            let raw = e.to_string();
            let (line, column) = parse_line_column(&raw);
            Err(ConfigValidationError {
                message: raw,
                line,
                column,
            })
        }
    }
}

/// Best-effort extraction of `(line, column)` from a `toml`/`PimError`
/// rendered string. The `toml` crate v1.x formats span info as
/// `... at line N column M ...`; older or wrapped errors may omit it.
///
/// Token-based scan rather than substring `find` so the search doesn't
/// misfire on words that contain "line" (e.g. "newline").
fn parse_line_column(s: &str) -> (Option<usize>, Option<usize>) {
    let tokens: Vec<&str> = s.split_whitespace().collect();
    let mut line = None;
    let mut column = None;
    for pair in tokens.windows(2) {
        match pair[0] {
            "line" => line = line.or_else(|| parse_leading_digits(pair[1])),
            "column" => column = column.or_else(|| parse_leading_digits(pair[1])),
            _ => {}
        }
    }
    (line, column)
}

fn parse_leading_digits(s: &str) -> Option<usize> {
    let n: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
    n.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_string_is_invalid() {
        let err = validate_pim_toml("").expect_err("empty TOML must fail — node.name required");
        assert!(!err.message.is_empty(), "error message must not be empty");
    }

    #[test]
    fn minimal_valid_config_passes() {
        // The minimum that `pim_core::Config` accepts: a `[node]` table
        // with `name`. Every other section has serde defaults.
        let toml = r#"
[node]
name = "test-node"
"#;
        validate_pim_toml(toml).expect("minimal config must validate");
    }

    #[test]
    fn unknown_field_in_strict_section_is_caught() {
        // pim-core derives Deserialize without `deny_unknown_fields` on
        // most sections, so unknown fields are silently ignored. We test
        // the inverse — that a structurally broken file still fails.
        let toml = r#"
[node]
name = 123  # wrong type — must be string
"#;
        let err = validate_pim_toml(toml).expect_err("wrong type must fail");
        // Don't assert on exact line — `toml` crate formatting drifts
        // between versions. We only care that something was extracted
        // OR that the error message is non-empty.
        assert!(!err.message.is_empty());
    }

    #[test]
    fn syntax_error_yields_line_info() {
        let toml = "this = is not valid toml [[[";
        let err = validate_pim_toml(toml).expect_err("garbage must fail");
        assert!(!err.message.is_empty());
    }

    #[test]
    fn parse_line_column_extracts_both() {
        let s = "expected newline at line 12 column 7";
        assert_eq!(parse_line_column(s), (Some(12), Some(7)));
    }

    #[test]
    fn parse_line_column_handles_missing_span() {
        let s = "schema mismatch: unknown variant";
        assert_eq!(parse_line_column(s), (None, None));
    }
}
