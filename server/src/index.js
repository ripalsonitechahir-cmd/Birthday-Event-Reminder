const config = require('./config');
const app = require('./app');
const { startReminderJob } = require('./jobs/reminders');

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  startReminderJob();
});
