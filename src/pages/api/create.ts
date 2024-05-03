import OpenAI from 'openai'
import { createAssistant } from '@/utils/openAIAssistant'
import type { APIRoute } from 'astro'

const apiKey = import.meta.env.OPENAI_API_KEY

const openai = new OpenAI({
  apiKey, // This is the default and can be omitted
})

export const post: APIRoute = async(context) => {
  const body = await context.request.json()

  const { threadId, model, systemPrompt, useTool } = body
  const id = await createOrRetrieveThread(threadId, model, systemPrompt, useTool)

  return new Response(JSON.stringify({
    id,
  }))
}

/**
 * in our case the name of this assistant is the threadId (since we have custom prompt for every assistant / room)
 * @param threadId
 * @param model
 * @param systemPrompt
 * @param useTool
 */
export async function createOrRetrieveThread(threadId: string, model: string, systemPrompt: string, useTool: boolean): Promise<string> {
  let thread
  try {
    thread = await openai.beta.threads.retrieve(threadId)
  } catch (e) {
    /* ignore */
  }
  if (!thread) {
    thread = await openai.beta.threads.create()
  }
  const assistant = await createAssistant(thread.id, model, systemPrompt, useTool)
  return assistant.id
}
