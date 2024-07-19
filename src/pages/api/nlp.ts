import { processOpenAI } from '@/utils/openAIAssistant'
import { processClaude } from '@/utils/anthropicAI'
import { verifySignature } from '@/utils/auth'
import type { APIRoute } from 'astro'
import type { ChatMessage } from '@/types'

const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { sign, time, messages, pass, model, system, assistantId } = body as {
    sign: string
    time: number
    messages: ChatMessage[]
    pass: string
    model: string
    system: string
    assistantId: string
  }
  if (!messages) {
    return new Response(JSON.stringify({
      error: {
        message: 'No input text.',
      },
    }), { status: 400 })
  }
  if (sitePassword && !(sitePassword === pass || passList.includes(pass))) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid password.',
      },
    }), { status: 401 })
  }
  if (import.meta.env.PROD && !await verifySignature({ t: time, m: messages?.[messages.length - 1]?.content || '' }, sign)) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid signature.',
      },
    }), { status: 401 })
  }
  // start of the logic part

  try {
    const isClaudeModel = model.startsWith('claude')
    if (isClaudeModel) {
      return processClaude(messages, model, system)
    } else {
      // just send the last message since assistant have context
      const message = [messages[messages.length - 1]]
      return processOpenAI(message, assistantId)
    }
  } catch (e) {
    return new Response(JSON.stringify({
      error: {
        message: e.message,
      },
    }), { status: 500 })
  }
}
