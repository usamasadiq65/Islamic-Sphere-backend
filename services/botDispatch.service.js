const Session = require("../models/session.model");
const axios = require("axios");

const botDispatchService = {
  /**
   * Finds upcoming sessions starting within 1 minute and dispatches a Recall.ai bot.
   */
  async dispatchBots() {
    console.log("[BotDispatch] Running cron job to dispatch bots...");

    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 1 * 60 * 1000);

    try {
      // Find sessions that:
      // 1. Have a zoom/meet link
      // 2. Haven't had a bot sent yet (no recallBotId)
      // 3. Start within the next minute
      // 4. Status is pending (not already processing/completed)
      
      // Get today's date in YYYY-MM-DD format for comparison
      const todayStr = now.toISOString().split('T')[0];
      
      // Get current time in HH:MM format
      const nowTimeStr = now.toTimeString().slice(0, 5);
      const oneMinTimeStr = oneMinuteFromNow.toTimeString().slice(0, 5);

      const upcomingSessions = await Session.find({
        zoomLink: { $exists: true, $ne: null, $ne: '' },
        recallBotId: { $exists: false }, // Bot not sent yet
        transcriptStatus: 'pending',
        date: todayStr, // Only today's sessions
        startTime: { $gte: nowTimeStr, $lte: oneMinTimeStr }
      });

      if (upcomingSessions.length === 0) {
        console.log("[BotDispatch] No upcoming sessions found within the next minute.");
        return;
      }

      console.log(`[BotDispatch] Found ${upcomingSessions.length} upcoming session(s) to join.`);

      for (const session of upcomingSessions) {
        console.log(`[BotDispatch] Processing session: ${session._id} - ${session.name}`);
        
        if (session.zoomLink) {
          try {
            console.log(`[BotDispatch] Sending bot to meeting: ${session.zoomLink}`);

            const botResponse = await axios.post(
              "https://us-west-2.recall.ai/api/v1/bot/",
              {
                meeting_url: session.zoomLink,
                bot_name: "Islamic Sphere Recorder",
                metadata: {
                  sessionId: session._id.toString(),
                },
              },
              {
                headers: {
                  Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log(`[BotDispatch] ✅ Bot successfully sent! Bot ID: ${botResponse.data.id}`);

            // Update session with bot ID and status
            await Session.findByIdAndUpdate(session._id, {
              recallBotId: botResponse.data.id,
              transcriptStatus: 'recording'
            });

            console.log(`[BotDispatch] Updated session ${session._id} with recallBotId.`);
          } catch (error) {
            console.error(
              `[BotDispatch] ❌ Failed to send bot for session ${session._id}:`,
              error.response?.data || error.message
            );
            // Mark as failed
            await Session.findByIdAndUpdate(session._id, {
              transcriptStatus: 'failed'
            });
          }
        }
      }
    } catch (error) {
      console.error("[BotDispatch] Error fetching upcoming sessions:", error);
    }
  },
};

module.exports = botDispatchService;
