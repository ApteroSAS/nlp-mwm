import { processOpenAI } from '@/utils/openAI'
import type { APIRoute } from 'astro'

// get request
// NLP API endpoint
const API_URL = 'https://nlp.aptero.co/backend/nlp'

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { text } = body as {
    text: string
  }
  const response = await fetch(`${API_URL}/predict?text=${text}`)
  const data = await response.json() as {
    angry: number
    disgust: number
    fear: number
    happy: number
    neutral: number
    sad: number
    surprise: number
  }

  // TODO send to chat gpt to improve ther esult
  try {
    const prompt = 'Evaluate the sentiment (like a NLP) of the following next message the user provide.'
      + 'Very iportant Only answer in JSON format no other sentences. If you are unsure of what you should imput just return 0.0 in the coresponding field. The message you answer will be parsed by a '
      + 'JSON.parse(await responseChatGPT.resultstr()). each number represent a percentage of sentiment of the sentence as a percentage between 0.0 and 1.0'
      + ' the format of the json should be as follow {\n'
      + '    "angry": number\n'
      + '    "disgust": number\n'
      + '    "fear": number\n'
      + '    "happy": number\n'
      + '    "neutral": number\n'
      + '    "sad": number\n'
      + '    "surprise": number\n'
      + '  }.'
    const responseChatGPT = await processOpenAI([{ role: 'system', content: prompt }, { role: 'user', content: text }], 'gpt-4o')
    let resultstr = await responseChatGPT.text()
    resultstr = resultstr.replace('```json', '')
    resultstr = resultstr.replace('```', '')
    const chatJson = JSON.parse(resultstr) as {
      angry: number
      disgust: number
      fear: number
      happy: number
      neutral: number
      sad: number
      surprise: number
    }
    console.log(chatJson)
    // ensure chatJson data validity type and field presence
    if (!chatJson) {
      throw new TypeError('Invalid JSON')
    }
    if (typeof chatJson.angry !== 'number'
        || typeof chatJson.disgust !== 'number'
        || typeof chatJson.fear !== 'number'
        || typeof chatJson.happy !== 'number'
        || typeof chatJson.neutral !== 'number'
        || typeof chatJson.sad !== 'number'
        || typeof chatJson.surprise !== 'number') {
      throw new TypeError('Invalid type')
    }
    data.angry = chatJson.angry > data.angry ? chatJson.angry : data.angry
    data.disgust = chatJson.disgust > data.disgust ? chatJson.disgust : data.disgust
    data.fear = chatJson.fear > data.fear ? chatJson.fear : data.fear
    data.happy = chatJson.happy > data.happy ? chatJson.happy : data.happy
    data.sad = chatJson.sad > data.sad ? chatJson.sad : data.sad
    data.surprise = chatJson.surprise > data.surprise ? chatJson.surprise : data.surprise
    // just take the neutral from chatGPT
    data.neutral = chatJson.neutral
  } catch (e) {
    console.error(e)
  }

  console.log(data)
  return new Response(JSON.stringify(data), { status: 200 })
}
