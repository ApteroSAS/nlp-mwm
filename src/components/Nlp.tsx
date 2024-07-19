import EventEmitter from 'eventemitter3'
import { createSignal, onMount } from 'solid-js'
import { Paper } from '@/components/Paper'
import { getEmoji } from '@/components/GetEmoji'
import { InfoButton } from '@/components/InfoButton'
import type { Component } from 'solid-js'
import type { Emotions } from '@/components/Emotions'

// Global event bus
export const events = new EventEmitter()

// NLP API endpoint
const API_URL = 'https://nlp.aptero.co/backend/nlp'

export const EmotionDisplay: Component<{
  emotions: Emotions
}> = (props) => {
  const emojiSize = (percentage: number): string => {
    const alpha = 2
    const size = Math.max(15, Math.min(50, percentage * alpha * 100))
    return `${size}px`
  }
  return (
    <div
      style={{
        'display': 'flex',
        'flex-direction': 'row',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        'justify-content': 'center',
      }}
    >
      {Object.entries(props.emotions).filter(([_, value]) => value >= 0.035).map(([emotion, value]) => (
        // eslint-disable-next-line react/jsx-key
        <div style={{ 'font-size': emojiSize(value), 'padding': '0px', 'text-align': 'center' }}>
          {getEmoji(emotion)}
          <div style={{ 'font-size': '0.6rem', 'margin-top': '-10px' }}>
            <b>{Math.round(value * 100)}%</b>
          </div>
        </div>
      ))}
    </div>
  )
}

// Component to display emotions
export const Nlp = () => {
  const [lastEmotions, setLastEmotions] = createSignal<Emotions>({
    angry: 0,
    disgust: 0,
    fear: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprise: 0,
  })
  const [accumulatedEmotions, setAccumulatedEmotions] = createSignal<Emotions>({
    angry: 0,
    disgust: 0,
    fear: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprise: 0,
  })
  const [messageNumber, setMessageNumber] = createSignal(0)

  const count = messageNumber()
  const meanEmotions = {
    angry: accumulatedEmotions().angry / count,
    disgust: accumulatedEmotions().disgust / count,
    fear: accumulatedEmotions().fear / count,
    happy: accumulatedEmotions().happy / count,
    neutral: accumulatedEmotions().neutral / count,
    sad: accumulatedEmotions().sad / count,
    surprise: accumulatedEmotions().surprise / count,
  }

  onMount(() => {
    const handleEvent = async(text) => {
      // Placeholder for API call
      const response = await fetch(`${API_URL}/predict?text=${text}`)
      const data = await response.json()
      console.log(data)
      // weight adjustment
      // data.neutral = data.neutral / 3
      // neutralize the neutral
      data.neutral = 0
      setLastEmotions(data)
      setMessageNumber(messageNumber() + 1)
      setAccumulatedEmotions({
        angry: accumulatedEmotions().angry + data.angry,
        disgust: accumulatedEmotions().disgust + data.disgust,
        fear: accumulatedEmotions().fear + data.fear,
        happy: accumulatedEmotions().happy + data.happy,
        neutral: accumulatedEmotions().neutral + data.neutral,
        sad: accumulatedEmotions().sad + data.sad,
        surprise: accumulatedEmotions().surprise + data.surprise,
      })
    }

    events.on('inputText', handleEvent)
    return () => {
      events.off('inputText', handleEvent)
    }
  })

  return (
    <Paper>
      감정 분석 (Emotion Analysis) <InfoButton />
      <EmotionDisplay emotions={lastEmotions()} />
    </Paper>
  )
}
