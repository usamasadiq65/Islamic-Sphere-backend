const Session = require("../models/session.model");
const transcriptAnalysisService = require("../services/transcriptAnalysis.service");
const axios = require("axios");

const webhookController = {
  /**
   * Handles incoming webhooks from Recall.ai
   */
  async handleRecallWebhook(req, res) {
    const { body } = req;

    // Log the entire incoming payload for debugging
    console.log(
      "[Webhook] Received Recall.ai webhook:",
      JSON.stringify(body, null, 2)
    );

    // Basic validation: check for event type and data object
    if (!body.event || !body.data) {
      return res.status(400).json({ message: "Invalid payload structure" });
    }

    const eventType = body.event;

    // Handle different event types
    if (eventType === "recording.done") {
      return await handleRecordingDone(req, res, body);
    } else if (eventType === "transcript.done") {
      return await handleTranscriptDone(req, res, body);
    } else {
      console.log(`[Webhook] Ignoring event type: ${eventType}`);
      return res
        .status(200)
        .json({ message: `Event type ${eventType} ignored` });
    }
  },
};

/**
 * Handle recording.done event
 */
async function handleRecordingDone(req, res, body) {
  // Extract data from the actual Recall.ai payload structure
  const bot = body.data?.bot;
  const recording = body.data?.recording;

  if (!bot || !recording) {
    console.log("[Webhook] Missing bot or recording data in payload.");
    return res.status(400).json({ message: "Invalid payload structure" });
  }

  const metadata = bot.metadata;
  const recordingId = recording.id;
  const botId = bot.id;

  // We need an identifier to find our Session - can use sessionId from metadata
  if (!metadata || !metadata.sessionId) {
    console.log(
      "[Webhook] Payload missing bot.metadata.sessionId. Cannot process."
    );
    return res
      .status(400)
      .json({ message: "Payload metadata must contain sessionId" });
  }

  const { sessionId } = metadata;
  console.log(`[Webhook] Processing recording.done for sessionId: ${sessionId}`);
  console.log(`[Webhook] Recording ID: ${recordingId}`);

  try {
    // Find the session by MongoDB _id
    const session = await Session.findById(sessionId);

    if (!session) {
      console.log(`[Webhook] No matching Session found for sessionId: ${sessionId}`);
      return res.status(404).json({ message: "Session not found" });
    }

    // Store the recording ID and update status
    session.recordingId = recordingId;
    session.recallBotId = botId;
    session.transcriptStatus = "processing";
    await session.save();

    console.log(
      `[Webhook] Updated Session ${session._id} with recording ID and status 'processing'.`
    );

    // Immediately respond with 200 OK
    res.status(200).json({ message: "Recording URL saved successfully" });

    // Now kick off async transcription job
    console.log(
      `[Webhook] Creating async transcription job for recording: ${recordingId}`
    );

    const transcriptCreateUrl = `https://us-west-2.recall.ai/api/v1/recording/${recordingId}/create_transcript/`;

    try {
      const transcriptJobResponse = await axios.post(
        transcriptCreateUrl,
        {
          provider: {
            recallai_async: {
              language_code: "en",
            },
          },
          diarization: {
            use_separate_streams_when_available: true,
          },
        },
        {
          headers: {
            Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
            "Content-Type": "application/json",
            accept: "application/json",
          },
        }
      );

      console.log(
        `[Webhook] Async transcription job created successfully:`,
        transcriptJobResponse.data
      );
    } catch (transcriptError) {
      console.error(
        "[Webhook] Error creating async transcription job:",
        transcriptError.response?.data || transcriptError.message
      );
      // Don't fail the webhook - just log the error
    }
  } catch (error) {
    console.error("[Webhook] Error processing recording.done:", error);
    // Already responded, so just log
  }
}

/**
 * Handle transcript.done event
 */
async function handleTranscriptDone(req, res, body) {
  // Extract data from the actual Recall.ai payload structure
  const bot = body.data?.bot;
  const transcript = body.data?.transcript;

  if (!bot || !transcript) {
    console.log("[Webhook] Missing bot or transcript data in payload.");
    return res.status(400).json({ message: "Invalid payload structure" });
  }

  const metadata = bot.metadata;
  const transcriptId = transcript.id;

  // We need an identifier to find our Session
  if (!metadata || !metadata.sessionId) {
    console.log(
      "[Webhook] Payload missing bot.metadata.sessionId. Cannot process."
    );
    return res
      .status(400)
      .json({ message: "Payload metadata must contain sessionId" });
  }

  const { sessionId } = metadata;
  console.log(`[Webhook] Processing transcript.done for sessionId: ${sessionId}`);
  console.log(`[Webhook] Transcript ID: ${transcriptId}`);

  try {
    // Find the session by MongoDB _id
    const session = await Session.findById(sessionId);

    if (!session) {
      console.log(`[Webhook] No matching Session found for sessionId: ${sessionId}`);
      return res.status(404).json({ message: "Session not found" });
    }

    // Immediately respond with 200 OK
    res.status(200).json({ message: "Transcript processing initiated" });

    // Fetch the transcript metadata to get the download URL
    const transcriptMetaUrl = `https://us-west-2.recall.ai/api/v1/transcript/${transcriptId}/`;

    console.log(`[Webhook] Fetching transcript metadata from: ${transcriptMetaUrl}`);

    const transcriptMetaResponse = await axios.get(transcriptMetaUrl, {
      headers: {
        Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
        accept: "application/json",
      },
    });

    const downloadUrl = transcriptMetaResponse.data?.data?.download_url;

    if (!downloadUrl) {
      console.error(
        "[Webhook] No download_url found in transcript metadata:",
        transcriptMetaResponse.data
      );
      await Session.findByIdAndUpdate(sessionId, { transcriptStatus: 'failed' });
      return;
    }

    console.log(`[Webhook] Downloading transcript from: ${downloadUrl}`);

    // Download the actual transcript data
    const transcriptDataResponse = await axios.get(downloadUrl);
    const transcriptData = transcriptDataResponse.data;

    // Log the raw transcript data to see its structure
    console.log(
      `[Webhook] Raw transcript data structure:`,
      JSON.stringify(transcriptData, null, 2)
    );

    let transcriptText = "";
    let transcriptDataStructured = [];

    // Parse transcript based on structure
    if (Array.isArray(transcriptData)) {
      // Array of transcript entries with speaker and text
      transcriptDataStructured = transcriptData.map((entry) => {
        // Extract participant information
        const participant = entry.participant || {};
        const speakerName = participant.name || "Unknown";
        const isHost = participant.is_host || false;

        // Extract words array
        let wordsArray = [];
        let textForPlainTranscript = "";

        if (entry.words && Array.isArray(entry.words)) {
          // Build both the structured words array and plain text
          wordsArray = entry.words.map((w) => ({
            text: w.text || "",
            start: w.start_timestamp?.relative || 0,
            end: w.end_timestamp?.relative || 0,
          }));

          textForPlainTranscript = entry.words
            .map((w) => w.text || "")
            .join(" ");
        } else if (entry.text) {
          textForPlainTranscript = entry.text;
        }

        // Add to plain text transcript
        transcriptText += `${speakerName}: ${textForPlainTranscript}\n`;

        // Return structured data
        return {
          speaker: speakerName,
          isHost: isHost,
          participantId: participant.id || null,
          platform: participant.platform || "unknown",
          email: participant.email || null,
          words: wordsArray,
          fullText: textForPlainTranscript,
        };
      });

      // Remove trailing newline from plain transcript
      transcriptText = transcriptText.trim();
    } else if (typeof transcriptData === "string") {
      transcriptText = transcriptData;
    } else if (transcriptData.text) {
      transcriptText = transcriptData.text;
    } else if (transcriptData.transcript) {
      // Some providers return { transcript: [...] }
      if (Array.isArray(transcriptData.transcript)) {
        transcriptDataStructured = transcriptData.transcript.map((entry) => {
          const participant = entry.participant || {};
          const speakerName = participant.name || "Unknown";
          const isHost = participant.is_host || false;

          let wordsArray = [];
          let textForPlainTranscript = "";

          if (entry.words && Array.isArray(entry.words)) {
            wordsArray = entry.words.map((w) => ({
              text: w.text || "",
              start: w.start_timestamp?.relative || 0,
              end: w.end_timestamp?.relative || 0,
            }));

            textForPlainTranscript = entry.words
              .map((w) => w.text || "")
              .join(" ");
          } else if (entry.text) {
            textForPlainTranscript = entry.text;
          }

          transcriptText += `${speakerName}: ${textForPlainTranscript}\n`;

          return {
            speaker: speakerName,
            isHost: isHost,
            participantId: participant.id || null,
            platform: participant.platform || "unknown",
            email: participant.email || null,
            words: wordsArray,
            fullText: textForPlainTranscript,
          };
        });

        transcriptText = transcriptText.trim();
      } else {
        transcriptText = String(transcriptData.transcript);
      }
    } else {
      // Fallback: stringify the whole response
      transcriptText = JSON.stringify(transcriptData, null, 2);
    }

    // Update the session with both plain text and structured transcript
    session.transcript = transcriptText;
    session.transcriptData = transcriptDataStructured;
    session.transcriptId = transcriptId;
    session.transcriptStatus = "processing"; // Will be set to 'completed' after AI analysis
    await session.save();

    console.log(`[Webhook] Updated Session ${session._id} with transcript.`);
    console.log(`[Webhook] Transcript length: ${transcriptText.length} characters`);
    console.log(`[Webhook] Structured transcript entries: ${transcriptDataStructured.length}`);
    console.log(`[Webhook] Transcript preview: ${transcriptText.substring(0, 200)}...`);

    // Automatically trigger AI analysis after transcript is saved
    console.log(`[Webhook] Triggering AI analysis for Session ${session._id}...`);

    // Run AI analysis asynchronously (don't wait for it)
    transcriptAnalysisService
      .processSession(session._id)
      .then((result) => {
        if (result.success) {
          console.log(`[Webhook] ✅ AI analysis completed for Session ${session._id}`);
        } else {
          console.error(`[Webhook] ❌ AI analysis failed for Session ${session._id}:`, result.error);
        }
      })
      .catch((error) => {
        console.error(`[Webhook] ❌ AI analysis error for Session ${session._id}:`, error);
      });
  } catch (error) {
    console.error(
      "[Webhook] Error processing transcript.done:",
      error.response?.data || error.message
    );
    // Try to update status to failed
    try {
      await Session.findByIdAndUpdate(sessionId, { transcriptStatus: 'failed' });
    } catch (updateError) {
      console.error("[Webhook] Could not update session status:", updateError);
    }
  }
}

module.exports = webhookController;
