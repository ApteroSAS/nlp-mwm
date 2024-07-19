// Helper function to return emoji based on the emotion
export function getEmoji(emotion) {
  const emojis = {
    angry: '😠',
    disgust: '🤢',
    fear: '😨',
    happy: '😊',
    neutral: '🙂', // '😐',
    sad: '😢',
    surprise: '😮',
  }
  return emojis[emotion]
}
