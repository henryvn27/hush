use crate::api::{TranscriptSearchResult, TranscriptSegment};
use chrono::Utc;
use sqlx::{Connection, Error as SqlxError, QueryBuilder, Sqlite, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

pub struct TranscriptsRepository;

impl TranscriptsRepository {
    /// Saves a new meeting and its associated transcript segments.
    /// This function uses a transaction to ensure that either both the meeting
    /// and all its transcripts are saved, or none of them are.
    pub async fn save_transcript(
        pool: &SqlitePool,
        meeting_title: &str,
        transcripts: &[TranscriptSegment],
        folder_path: Option<String>,
    ) -> Result<String, SqlxError> {
        let meeting_id = format!("meeting-{}", Uuid::new_v4());

        let mut conn = pool.acquire().await?;
        let mut transaction = conn.begin().await?;

        let now = Utc::now();

        // 1. Create the new meeting
        let result = sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, folder_path) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&meeting_id)
        .bind(meeting_title)
        .bind(now)
        .bind(now)
        .bind(&folder_path)
        .execute(&mut *transaction)
        .await;

        if let Err(e) = result {
            error!("Failed to create meeting '{}': {}", meeting_title, e);
            transaction.rollback().await?;
            return Err(e);
        }

        info!("Successfully created meeting with id: {}", meeting_id);

        // 2. Save each transcript segment with audio timing fields
        for segment in transcripts {
            let transcript_id = format!("transcript-{}", Uuid::new_v4());
            let result = sqlx::query(
                "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time, audio_end_time, duration)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&transcript_id)
            .bind(&meeting_id)
            .bind(&segment.text)
            .bind(&segment.timestamp)
            .bind(segment.audio_start_time)
            .bind(segment.audio_end_time)
            .bind(segment.duration)
            .execute(&mut *transaction)
            .await;

            if let Err(e) = result {
                error!(
                    "Failed to save transcript segment for meeting {}: {}",
                    meeting_id, e
                );
                transaction.rollback().await?;
                return Err(e);
            }
        }

        info!(
            "Successfully saved {} transcript segments for meeting {}",
            transcripts.len(),
            meeting_id
        );

        // Mirror completed meetings into the canonical Hush event layer.
        // Keep the compatibility meeting and canonical event atomic so a
        // failed index write cannot leave two different local truths.
        crate::memory::create_event_for_meeting(
            &mut transaction,
            &meeting_id,
            meeting_title,
            folder_path.as_deref(),
            transcripts,
        )
        .await?;

        transaction.commit().await?;

        Ok(meeting_id)
    }

    /// Searches for a query string within the transcripts.
    /// It returns a list of matching transcripts with context.
    pub async fn search_transcripts(
        pool: &SqlitePool,
        query: &str,
    ) -> Result<Vec<TranscriptSearchResult>, SqlxError> {
        Self::search_transcripts_scoped(pool, query, None).await
    }

    pub async fn search_meeting_transcripts(
        pool: &SqlitePool,
        query: &str,
        meeting_id: &str,
    ) -> Result<Vec<TranscriptSearchResult>, SqlxError> {
        Self::search_transcripts_scoped(pool, query, Some(meeting_id)).await
    }

    /// Returns the selected meeting's saved transcript and summary in
    /// chronological order for the persistent meeting inspector. Unlike
    /// global recall search, this is intentionally not keyword-filtered:
    /// questions about summaries, action items, or conclusions may depend on
    /// text far from the first match. A summary-only meeting yields one source;
    /// a meeting with no saved source material yields none.
    pub async fn get_meeting_transcripts_for_recall(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<TranscriptSearchResult>, SqlxError> {
        sqlx::query_as::<_, (String, String, String, String, String, Option<String>)>(
            "SELECT m.id, m.title, COALESCE(t.transcript, ''), COALESCE(t.timestamp, 'not available'), m.created_at, s.result FROM meetings m \
             LEFT JOIN transcripts t ON m.id = t.meeting_id \
             LEFT JOIN summary_processes s ON m.id = s.meeting_id \
             WHERE m.id = ? AND (t.meeting_id IS NOT NULL OR NULLIF(TRIM(COALESCE(s.result, '')), '') IS NOT NULL) \
             ORDER BY t.audio_start_time ASC, t.timestamp ASC",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await
        .map(|rows| {
            rows.into_iter()
                .map(
                    |(id, title, transcript, timestamp, meeting_date, summary)| TranscriptSearchResult {
                        id,
                        title,
                        match_context: transcript,
                        timestamp,
                        meeting_date: Some(meeting_date),
                        summary,
                    },
                )
                .collect()
        })
    }

    async fn search_transcripts_scoped(
        pool: &SqlitePool,
        query: &str,
        meeting_id: Option<&str>,
    ) -> Result<Vec<TranscriptSearchResult>, SqlxError> {
        let terms = Self::search_terms(query);
        if terms.is_empty() {
            return Ok(Vec::new());
        }

        let mut builder = QueryBuilder::<Sqlite>::new(
            "SELECT m.id, m.title, t.transcript, t.timestamp, m.created_at, s.result FROM meetings m \
             JOIN transcripts t ON m.id = t.meeting_id \
             LEFT JOIN summary_processes s ON m.id = s.meeting_id WHERE ",
        );
        if let Some(meeting_id) = meeting_id {
            builder.push("m.id = ").push_bind(meeting_id).push(" AND (");
        }
        for (index, term) in terms.iter().enumerate() {
            if index > 0 {
                builder.push(" OR ");
            }
            builder
                .push("(LOWER(t.transcript) LIKE ")
                .push_bind(format!("%{term}%"))
                .push(" OR LOWER(m.title) LIKE ")
                .push_bind(format!("%{term}%"))
                .push(" OR LOWER(COALESCE(s.result, '')) LIKE ")
                .push_bind(format!("%{term}%"))
                .push(")");
        }
        if meeting_id.is_some() {
            builder.push(")");
        }
        builder.push(" ORDER BY m.created_at DESC LIMIT 64");

        let rows = builder
            .build_query_as::<(String, String, String, String, String, Option<String>)>()
            .fetch_all(pool)
            .await?;

        let minimum_score = if meeting_id.is_none() && terms.len() >= 3 {
            2
        } else {
            1
        };
        let mut results = rows
            .into_iter()
            .filter_map(
                |(id, title, transcript, timestamp, meeting_date, summary)| {
                    let haystack = format!(
                        "{} {} {}",
                        title.to_lowercase(),
                        transcript.to_lowercase(),
                        summary.as_deref().unwrap_or_default().to_lowercase()
                    );
                    let score = terms
                        .iter()
                        .filter(|term| haystack.contains(term.as_str()))
                        .count();
                    if score < minimum_score {
                        return None;
                    }
                    let match_context = Self::get_match_context(&transcript, &terms);
                    Some((
                        score,
                        TranscriptSearchResult {
                            id,
                            title,
                            match_context,
                            timestamp,
                            meeting_date: Some(meeting_date),
                            summary,
                        },
                    ))
                },
            )
            .collect::<Vec<_>>();
        results.sort_by_key(|(score, _)| std::cmp::Reverse(*score));

        Ok(results.into_iter().map(|(_, result)| result).collect())
    }

    fn search_terms(query: &str) -> Vec<String> {
        const STOP_WORDS: &[&str] = &[
            "about", "from", "have", "meetings", "meeting", "that", "the", "this", "what", "when",
            "where", "which", "with", "would", "were", "did", "does", "our", "was", "and", "how",
            "who",
        ];
        let mut terms = query
            .split(|character: char| !character.is_alphanumeric())
            .map(str::to_lowercase)
            .filter(|term| term.chars().count() >= 3 && !STOP_WORDS.contains(&term.as_str()))
            .collect::<Vec<_>>();
        terms.sort();
        terms.dedup();
        terms.truncate(12);
        terms
    }

    /// Helper function to extract a snippet of text around the first match of a query.
    fn get_match_context(transcript: &str, terms: &[String]) -> String {
        let transcript_lower = transcript.to_lowercase();
        let match_character = terms
            .iter()
            .filter_map(|term| transcript_lower.find(term))
            .min()
            .map(|byte_index| transcript[..byte_index].chars().count())
            .unwrap_or(0);
        let characters = transcript.chars().collect::<Vec<_>>();
        let start = match_character.saturating_sub(100);
        let end = (match_character + 200).min(characters.len());
        let mut context = characters[start..end].iter().collect::<String>();
        if start > 0 {
            context.insert_str(0, "...");
        }
        if end < characters.len() {
            context.push_str("...");
        }
        context
    }
}

#[cfg(test)]
mod tests {
    use super::TranscriptsRepository;
    use sqlx::sqlite::SqlitePoolOptions;

    #[test]
    fn recall_search_extracts_meaningful_terms_from_a_question() {
        assert_eq!(
            TranscriptsRepository::search_terms("What did we decide about microphone audio?"),
            vec!["audio", "decide", "microphone"]
        );
    }

    #[tokio::test]
    async fn recall_search_matches_question_keywords_without_an_exact_sentence() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO meetings VALUES ('meeting-1', 'Audio test', '2026-07-12')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO transcripts VALUES ('meeting-1', 'The microphone picked up the sentence clearly.', '00:40')")
            .execute(&pool)
            .await
            .unwrap();

        let results =
            TranscriptsRepository::search_transcripts(&pool, "What did the microphone pick up?")
                .await
                .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "meeting-1");
        assert!(results[0].match_context.contains("microphone picked up"));
    }

    #[tokio::test]
    async fn meeting_recall_never_leaks_matches_from_another_meeting() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO meetings VALUES ('open', 'Open meeting', '2026-07-12'), ('other', 'Other meeting', '2026-07-11')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO transcripts VALUES ('open', 'We discussed safety.', '00:10'), ('other', 'We discussed safety and robotics.', '00:20')")
            .execute(&pool).await.unwrap();

        let results = TranscriptsRepository::search_meeting_transcripts(
            &pool,
            "What did we discuss about safety?",
            "open",
        )
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "open");
    }

    #[tokio::test]
    async fn meeting_inspector_recall_returns_complete_chronological_segments() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT, audio_start_time REAL)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO meetings VALUES ('open', 'Open meeting', '2026-07-12')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO transcripts VALUES ('open', 'The conclusion and action items are at the end.', '00:40', 40), ('open', 'Henry opened the discussion.', '00:05', 5)")
            .execute(&pool)
            .await
            .unwrap();

        let results = TranscriptsRepository::get_meeting_transcripts_for_recall(&pool, "open")
            .await
            .unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].match_context, "Henry opened the discussion.");
        assert!(results[1]
            .match_context
            .contains("action items are at the end"));
    }

    #[tokio::test]
    async fn meeting_inspector_uses_summary_only_and_rejects_an_empty_meeting() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT, audio_start_time REAL)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO meetings VALUES ('summary-only', 'Summary meeting', '2026-07-13'), ('empty', 'Empty meeting', '2026-07-13')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO summary_processes VALUES ('summary-only', '{\"markdown\":\"Saved local decision.\"}')")
            .execute(&pool)
            .await
            .unwrap();

        let summary =
            TranscriptsRepository::get_meeting_transcripts_for_recall(&pool, "summary-only")
                .await
                .unwrap();
        let empty = TranscriptsRepository::get_meeting_transcripts_for_recall(&pool, "empty")
            .await
            .unwrap();

        assert_eq!(summary.len(), 1);
        assert!(summary[0].match_context.is_empty());
        assert!(summary[0]
            .summary
            .as_deref()
            .unwrap()
            .contains("Saved local decision"));
        assert!(empty.is_empty());
    }

    #[tokio::test]
    async fn global_recall_drops_single_term_noise_for_multi_term_questions() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO meetings VALUES ('relevant', 'AI review', '2026-07-12'), ('noise', 'Greeting', '2026-07-11')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO transcripts VALUES ('relevant', 'Henry discussed local AI and human review.', '00:10'), ('noise', 'My name is Henry.', '00:20')")
            .execute(&pool).await.unwrap();

        let results = TranscriptsRepository::search_transcripts(
            &pool,
            "What did Henry discuss about local AI and human review?",
        )
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "relevant");
    }

    #[tokio::test]
    async fn global_recall_searches_saved_summaries_and_returns_meeting_metadata() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE meetings (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE transcripts (meeting_id TEXT, transcript TEXT, timestamp TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE summary_processes (meeting_id TEXT PRIMARY KEY, result TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO meetings VALUES ('meeting-1', 'Strategy review', '2026-07-13T10:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO transcripts VALUES ('meeting-1', 'The team reviewed open work.', '00:10')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(r###"INSERT INTO summary_processes VALUES ('meeting-1', '{"markdown":"## Decision\nAdopt local model governance."}')"###)
            .execute(&pool)
            .await
            .unwrap();

        let results = TranscriptsRepository::search_transcripts(
            &pool,
            "What did we decide about local model governance?",
        )
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].meeting_date.as_deref(),
            Some("2026-07-13T10:00:00Z")
        );
        assert!(results[0]
            .summary
            .as_deref()
            .unwrap()
            .contains("local model governance"));
    }
}
