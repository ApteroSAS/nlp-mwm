import { notifyCall } from '@/utils/openAIAssistant'
import type { APIRoute } from 'astro'

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const resp = await notifyCall(body)
  return new Response(JSON.stringify(resp))
}
