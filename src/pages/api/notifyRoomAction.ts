import { notifyRoomAction } from '@/utils/openAIAssistant'
import type { APIRoute } from 'astro'

export const post: APIRoute = async(context) => {
  const { roomid, description, reaction, context: contextResp } = await context.request.json()
  const resp = await notifyRoomAction(roomid, description, reaction, contextResp)
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(JSON.stringify(resp), { headers })
}
