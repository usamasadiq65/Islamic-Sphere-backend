const Anthropic = require('@anthropic-ai/sdk');
const Session = require("../models/session.model");
const CONFIG = require("../config");

// Check for API key
const apiKey = CONFIG.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

let anthropic = null;
if (apiKey) {
  console.log(`✅ Anthropic API Key loaded (length: ${apiKey.length} characters)`);
  anthropic = new Anthropic({
    apiKey: apiKey,
  });
} else {
  console.warn("⚠️ No Anthropic API key found. Transcript analysis will be disabled.");
}

const transcriptAnalysisService = {
  /**
   * Analyze transcript using OpenAI GPT-4
   * Returns: refined transcript, summary, actionItems, keyPoints
   */
  async analyzeTranscript(transcriptText) {
    console.log("[AI Analysis] Starting transcript analysis...");

    if (!transcriptText || transcriptText.trim().length === 0) {
      console.log("[AI Analysis] Empty transcript, skipping analysis.");
      return null;
    }

    if (!anthropic) {
      console.log("[AI Analysis] Anthropic not configured, skipping analysis.");
      return null;
    }

    try {
      // Build the analysis prompt for Islamic session/lecture context
      const prompt = `You are an AI assistant analyzing a transcript from an Islamic educational session or lecture. The transcript may contain errors, unclear words, or incomplete phrases from the speech-to-text system.

**TRANSCRIPT:**
${transcriptText}

**YOUR TASK:**
Analyze this Islamic session/lecture and provide the following in JSON format:

1. **refinedTranscript**: Clean up the transcript, fix any obvious errors, replace unclear words with best guesses based on context. Keep the speaker labels if present. Make it more readable while preserving the Islamic content accurately.

2. **summary**: A concise 2-3 paragraph summary of the session. Include:
   - Main topic and theme discussed
   - Key Islamic teachings, Quran verses, or Hadith mentioned
   - Important points made by the scholar/speaker
   - Overall spiritual takeaways

3. **actionItems**: An array of action items or practical advice given during the session. Include things like:
   - Recommended prayers or duas
   - Suggested readings or studies
   - Practical life advice based on Islamic teachings
   - Follow-up topics to explore
   If no action items mentioned, return empty array.

4. **keyPoints**: An array of key discussion points from the session. Include:
   - Major Islamic concepts discussed
   - Quran verses or Hadith referenced
   - Important questions addressed
   - Memorable quotes or statements

**IMPORTANT:**
- Return ONLY valid JSON, no markdown formatting
- Be respectful and accurate with Islamic content
- Use this exact structure:
{
  "refinedTranscript": "cleaned transcript here...",
  "summary": "summary text here...",
  "actionItems": ["action 1", "action 2"],
  "keyPoints": ["point 1", "point 2"]
}`;

      console.log("[AI Analysis] Sending request to Anthropic Claude...");

      const completion = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 3000,
        temperature: 0.3,
        system: "You are an expert at analyzing Islamic educational content. You help summarize lectures, sessions, and discussions about Islam with accuracy and respect. You always respond with valid JSON only, no markdown formatting.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText = completion.content[0].text;
      console.log("[AI Analysis] Received response from Anthropic");

      // Parse the JSON response
      const analysis = JSON.parse(responseText);

      console.log("[AI Analysis] ✅ Analysis complete!");
      console.log(`[AI Analysis] Summary length: ${analysis.summary?.length || 0} chars`);
      console.log(`[AI Analysis] Action items found: ${analysis.actionItems?.length || 0}`);
      console.log(`[AI Analysis] Key points found: ${analysis.keyPoints?.length || 0}`);

      return {
        refinedTranscript: analysis.refinedTranscript || transcriptText,
        summary: analysis.summary || "",
        actionItems: analysis.actionItems || [],
        keyPoints: analysis.keyPoints || [],
      };
    } catch (error) {
      console.error("[AI Analysis] Error analyzing transcript:", error.message);
      if (error.response) {
        console.error("[AI Analysis] Anthropic API Error:", error.response);
      }
      return null;
    }
  },

  /**
   * Process a Session: analyze transcript and update MongoDB
   * @param {string} sessionId - MongoDB ObjectId of the Session
   */
  async processSession(sessionId) {
    console.log(`[AI Analysis] Processing Session: ${sessionId}`);

    try {
      const session = await Session.findById(sessionId);

      if (!session) {
        console.log(`[AI Analysis] Session not found: ${sessionId}`);
        return { success: false, error: "Session not found" };
      }

      if (!session.transcript) {
        console.log(`[AI Analysis] No transcript available for Session: ${sessionId}`);
        return { success: false, error: "No transcript available" };
      }

      // Analyze the transcript
      const analysis = await this.analyzeTranscript(session.transcript);

      if (!analysis) {
        console.log(`[AI Analysis] Analysis failed for Session: ${sessionId}`);
        // Update status to failed
        await Session.findByIdAndUpdate(sessionId, { transcriptStatus: 'failed' });
        return { success: false, error: "Analysis failed" };
      }

      // Update the Session with analysis results
      await Session.findByIdAndUpdate(sessionId, {
        transcript: analysis.refinedTranscript,
        summary: analysis.summary,
        actionItems: analysis.actionItems,
        keyPoints: analysis.keyPoints,
        transcriptStatus: 'completed'
      });

      console.log(`[AI Analysis] ✅ Session ${sessionId} updated successfully!`);

      return {
        success: true,
        data: {
          summary: analysis.summary,
          actionItems: analysis.actionItems,
          keyPoints: analysis.keyPoints,
        },
      };
    } catch (error) {
      console.error(`[AI Analysis] Error processing Session ${sessionId}:`, error);
      // Try to update status to failed
      try {
        await Session.findByIdAndUpdate(sessionId, { transcriptStatus: 'failed' });
      } catch (updateError) {
        console.error("[AI Analysis] Could not update session status:", updateError);
      }
      return { success: false, error: error.message };
    }
  },
};

module.exports = transcriptAnalysisService;
