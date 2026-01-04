const cron = require("node-cron");
const botDispatchService = require("./botDispatch.service");

const startCronJobs = () => {
  // Schedule the bot dispatch job to run every 1 minute
  cron.schedule("*/1 * * * *", () => {
    console.log("[Cron] Running bot dispatch job...");
    botDispatchService.dispatchBots();
  });
  console.log("✅ Bot dispatch cron job scheduled to run every 1 minute.");
};

module.exports = { startCronJobs };
