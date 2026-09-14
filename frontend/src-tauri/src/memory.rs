//! Canonical local event and retrieval commands.
//!
//! This layer sits beside the existing meeting APIs. Meetings remain a
//! compatibility surface while capture modes converge on one event model.

use chrono::Utc;
use serde::Serialize;
use sqlx::{FromRow, Sqlite, Transaction};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct HushTimelineItem {
    pub id: String,
    pub title: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub source_device_type: String,
    pub modality: String,
    pub status: String,
    pub privacy_class: String,
    pub segment_count: i64,
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct HushSearchHit {
    pub event_id: String,
    pub segment_id: String,
    pub title: String,
    pub started_at: String,
    pub source_device_type: String,
    pub modality: String,
    pub text: String,
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
    pub derivation_kind: String,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct HushTranscriptSegment {
    pub id: String,
    pub event_id: String,
    pub text: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub start_seconds: Option<f64>,
    pub end_seconds: Option<f64>,
    pub speaker_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HushEventDetail {
    pub id: String,
    pub title: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub source_device_id: String,
    pub source_device_type: String,
    pub modality: String,
    pub status: String,
    pub privacy_class: String,
    pub summary: Option<String>,
    pub segments: Vec<HushTranscriptSegment>,
}

fn bounded_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(50).clamp(1, 200)
}

fn search_match_query(query: &str) -> String {
    query
        .split(|character: char| !character.is_alphanumeric())
        .map(str::trim)
        .filter(|term| term.chars().count() >= 2)
        .take(12)
        .map(|term| format!("\"{}\"*", term.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[tauri::command]
pub async fn hush_timeline(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<HushTimelineItem>, String> {
    sqlx::query_as::<_, HushTimelineItem>(
        "SELECT e.id, e.title, e.started_at, e.ended_at, e.source_device_type,
                e.modality, e.status, e.privacy_class,
                COUNT(s.id) AS segment_count,
                (SELECT s2.text FROM hush_transcript_segments s2
                 WHERE s2.event_id = e.id ORDER BY s2.start_seconds ASC, s2.created_at ASC LIMIT 1) AS preview
         FROM hush_events e
         LEFT JOIN hush_transcript_segments s ON s.event_id = e.id
         GROUP BY e.id
         ORDER BY e.started_at DESC
         LIMIT ?",
    )
    .bind(bounded_limit(limit))
    .fetch_all(state.db_manager.pool())
    .await
    .map_err(|error| format!("Could not read the local Hush timeline: {error}"))
}

#[tauri::command]
pub async fn hush_search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<HushSearchHit>, String> {
    let match_query = search_match_query(&query);
    if match_query.is_empty() {
        return Ok(Vec::new());
    }

    sqlx::query_as::<_, HushSearchHit>(
        "SELECT s.event_id, s.id AS segment_id, e.title, e.started_at,
                e.source_device_type, e.modality, s.text, s.start_seconds,
                s.end_seconds, 'observed' AS derivation_kind, 1.0 AS confidence
         FROM hush_transcript_fts f
         JOIN hush_transcript_segments s ON s.id = f.segment_id
         JOIN hush_events e ON e.id = s.event_id
         WHERE f.hush_transcript_fts MATCH ?
         ORDER BY e.started_at DESC, s.start_seconds ASC
         LIMIT ?",
    )
    .bind(match_query)
    .bind(bounded_limit(limit))
    .fetch_all(state.db_manager.pool())
    .await
    .map_err(|error| format!("Could not search the local Hush timeline: {error}"))
}

#[tauri::command]
pub async fn hush_get_event(
    state: State<'_, AppState>,
    event_id: String,
) -> Result<Option<HushEventDetail>, String> {
    let event = sqlx::query_as::<_, (String, String, String, Option<String>, String, String, String, String, String, Option<String>)>(
        "SELECT id, title, started_at, ended_at, source_device_id, source_device_type,
                modality, status, privacy_class, summary
         FROM hush_events WHERE id = ?",
    )
    .bind(event_id.trim())
    .fetch_optional(state.db_manager.pool())
    .await
    .map_err(|error| format!("Could not read the local Hush event: {error}"))?;

    let Some((id, title, started_at, ended_at, source_device_id, source_device_type, modality, status, privacy_class, summary)) = event else {
        return Ok(None);
    };

    let segments = sqlx::query_as::<_, HushTranscriptSegment>(
        "SELECT id, event_id, text, started_at, ended_at, start_seconds, end_seconds, speaker_label
         FROM hush_transcript_segments WHERE event_id = ?
         ORDER BY start_seconds ASC, created_at ASC",
    )
    .bind(&id)
    .fetch_all(state.db_manager.pool())
    .await
    .map_err(|error| format!("Could not read Hush transcript segments: {error}"))?;

    Ok(Some(HushEventDetail {
        id,
        title,
        started_at,
        ended_at,
        source_device_id,
        source_device_type,
        modality,
        status,
        privacy_class,
        summary,
        segments,
    }))
}

#[tauri::command]
pub async fn hush_delete_event(
    state: State<'_, AppState>,
    event_id: String,
) -> Result<bool, String> {
    let mut transaction = state.db_manager.pool().begin().await
        .map_err(|error| format!("Could not prepare local Hush event deletion: {error}"))?;
    sqlx::query("DELETE FROM hush_transcript_fts WHERE event_id = ?")
        .bind(event_id.trim())
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Could not remove the local Hush search entry: {error}"))?;
    let result = sqlx::query("DELETE FROM hush_events WHERE id = ?")
        .bind(event_id.trim())
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Could not delete the local Hush event: {error}"))?;
    transaction.commit().await
        .map_err(|error| format!("Could not finish deleting the local Hush event: {error}"))?;
    Ok(result.rows_affected() > 0)
}

pub async fn create_event_for_meeting(
    transaction: &mut Transaction<'_, Sqlite>,
    meeting_id: &str,
    title: &str,
    folder_path: Option<&str>,
    segments: &[crate::api::TranscriptSegment],
) -> Result<String, sqlx::Error> {
    let event_id = format!("event-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();
    let started_at = now.clone();
    let ended_at: Option<String> = None;

    sqlx::query(
        "INSERT INTO hush_events
         (id, title, started_at, ended_at, source_device_id, source_device_type,
          modality, status, privacy_class, source_uri, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'mac', 'mac', 'meeting', 'transcribed', 'standard', ?, ?, ?)",
    )
    .bind(&event_id)
    .bind(title)
    .bind(started_at)
    .bind(ended_at)
    .bind(folder_path)
    .bind(&now)
    .bind(&now)
    .execute(&mut **transaction)
    .await?;

    for segment in segments {
        let segment_id = format!("segment-{}", Uuid::new_v4());
        sqlx::query(
            "INSERT INTO hush_transcript_segments
             (id, event_id, meeting_id, transcript_id, text, started_at, ended_at,
              start_seconds, end_seconds, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&segment_id)
        .bind(&event_id)
        .bind(meeting_id)
        .bind(&segment.id)
        .bind(&segment.text)
        .bind(&segment.timestamp)
        .bind(&segment.timestamp)
        .bind(segment.audio_start_time)
        .bind(segment.audio_end_time)
        .bind(&now)
        .execute(&mut **transaction)
        .await?;

        sqlx::query("INSERT INTO hush_transcript_fts (text, event_id, segment_id) VALUES (?, ?, ?)")
            .bind(&segment.text)
            .bind(&event_id)
            .bind(&segment_id)
            .execute(&mut **transaction)
            .await?;

        sqlx::query(
            "INSERT INTO hush_provenance
             (id, derived_type, derived_id, source_event_id, source_segment_id,
              start_seconds, end_seconds, derivation_kind, confidence, created_at)
             VALUES (?, 'transcript_segment', ?, ?, ?, ?, ?, 'observed', 1.0, ?)",
        )
        .bind(format!("provenance-{}", Uuid::new_v4()))
        .bind(&segment_id)
        .bind(&event_id)
        .bind(&segment_id)
        .bind(segment.audio_start_time)
        .bind(segment.audio_end_time)
        .bind(&now)
        .execute(&mut **transaction)
        .await?;
    }

    sqlx::query(
        "INSERT INTO hush_jobs
         (id, event_id, stage, status, attempts, available_at, finished_at, created_at, updated_at)
         VALUES (?, ?, 'INDEXED', 'completed', 1, ?, ?, ?, ?)",
    )
    .bind(format!("job-{}", Uuid::new_v4()))
    .bind(&event_id)
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .execute(&mut **transaction)
    .await?;

    Ok(event_id)
}

#[cfg(test)]
mod tests {
    use super::search_match_query;

    #[test]
    fn builds_safe_prefix_match_query() {
        assert_eq!(search_match_query("What did David say?"), "\"What\"* AND \"did\"* AND \"David\"* AND \"say\"*");
        assert_eq!(search_match_query("!?"), "");
    }
}
