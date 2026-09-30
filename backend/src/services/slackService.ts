import axios from 'axios';

/**
 * Send a Slack message via Slack Web API (chat.postMessage).
 * The accessToken is the OAuth token stored per user.
 * If channelId is null, tries to use the user's DM or a default channel.
 */
export async function sendSlackNotification(
  accessToken: string,
  channelId: string | null,
  message: string,
  slackUserId: string | null = null
): Promise<void> {
  if (!accessToken) return;

  let channel = channelId;
  if (!channel && slackUserId) {
    const conversation = await axios.post(
      'https://slack.com/api/conversations.open',
      { users: slackUserId },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!conversation.data.ok || !conversation.data.channel?.id) {
      throw new Error(`Slack conversations.open failed: ${conversation.data.error || 'unknown error'}`);
    }
    channel = conversation.data.channel.id;
  }
  if (!channel) throw new Error('No Slack notification destination is available');

  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel,
      text: message,
      mrkdwn: true,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.data.ok) {
    throw new Error(`Slack chat.postMessage failed: ${response.data.error || 'unknown error'}`);
  }
}
