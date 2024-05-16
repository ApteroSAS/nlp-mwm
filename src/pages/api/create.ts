import OpenAI from 'openai'
import { createAssistant } from '@/utils/openAIAssistant'
import type { APIRoute } from 'astro'

const apiKey = import.meta.env.OPENAI_API_KEY

const openai = new OpenAI({
  apiKey, // This is the default and can be omitted
})

export const post: APIRoute = async(context) => {
  const body = await context.request.json()

  const { threadId, model, systemPrompt, useTool, id } = body
  const tid = await createOrRetrieveThread(threadId, model, systemPrompt, useTool, id)

  return new Response(JSON.stringify({
    id: tid,
  }))
}

/**
 * in our case the name of this assistant is the threadId (since we have custom prompt for every assistant / room)
 * @param threadId
 * @param model
 * @param systemPrompt
 * @param useTool
 * @param id
 */
export async function createOrRetrieveThread(threadId: string, model: string, systemPrompt: string, useTool: boolean, id: string): Promise<string> {
  let thread
  try {
    thread = await openai.beta.threads.retrieve(threadId)
  } catch (e) {
    /* ignore */
  }
  if (!thread) {
    thread = await openai.beta.threads.create()
  }
  const assistant = await createAssistant(thread.id, model, systemPrompt, useTool, id)
  return assistant.id
}
