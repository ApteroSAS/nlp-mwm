import { notifyCall } from '@/utils/openAIAssistant'
import type { APIRoute } from 'astro'

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const resp = await notifyCall(body)
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(JSON.stringify(resp), { headers })
}
