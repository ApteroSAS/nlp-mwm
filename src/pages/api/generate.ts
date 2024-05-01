// #vercel-disable-blocks
import { ProxyAgent, fetch } from 'undici'
// #vercel-end
import { generatePayload, parseOpenAIStream } from '@/utils/openAI'
import { parseClaudeStream, generateClaudePayload } from '@/utils/anthropicAI'
import { verifySignature } from '@/utils/auth'
import type { APIRoute } from 'astro'

const apiKey = import.meta.env.OPENAI_API_KEY
const httpsProxy = import.meta.env.HTTPS_PROXY
const baseUrl = ((import.meta.env.OPENAI_API_BASE_URL) || 'https://api.openai.com').trim().replace(/\/$/, '')
const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

const claudeApiKey = import.meta.env.ANTHROPIC_API_KEY
const claudeBaseUrl = ((import.meta.env.ANTHROPIC_API_BASE_URL) || 'https://api.anthropic.com').trim().replace(/\/$/, '')

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { sign, time, messages, pass , model, system} = body
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
  const isClaudeModel = model.startsWith('claude');
  const initOptions = isClaudeModel
    ? generateClaudePayload(claudeApiKey, messages, model, system)
    : generatePayload(apiKey, messages, model);
  // #vercel-disable-blocks
  if (httpsProxy)
    initOptions.dispatcher = new ProxyAgent(httpsProxy)
  // #vercel-end

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  const response = await fetch(
    isClaudeModel ? `${claudeBaseUrl}/v1/messages` : `${baseUrl}/v1/chat/completions`,
    //@ts-expect-error
    initOptions
  ).catch((err: Error) => {
    console.error(err)
    return new Response(JSON.stringify({
      error: {
        code: err.name,
        message: err.message,
      },
    }), { status: 500 })
  }) as Response

  return isClaudeModel ? parseClaudeStream(response) : parseOpenAIStream(response);
}
