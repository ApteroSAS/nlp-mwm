
import OpenAI from 'openai'
import type { ChatMessage } from '@/types'

const defModel = import.meta.env.OPENAI_API_MODEL || 'gpt-3.5-turbo'
const apiKey = import.meta.env.OPENAI_API_KEY

const openai = new OpenAI({
  apiKey, // This is the default and can be omitted
})

interface ThreadContext{
  assistantId: string
  threadId: string
  runId?: string
  encoder: TextEncoder
  controller?: ReadableStreamDefaultController<any>
}

const contexts = new Map<string, ThreadContext>()

/**
 * in our case the name of this assistant is the threadId (since we have custom prompt for every assistant / room)
 * @param threadId
 * @param model
 * @param prompt
 * @param useTool
 */
export async function createAssistant(threadId: string, model: string = defModel, prompt?: string, useTool?: boolean): Promise<OpenAI.Beta.Assistants.Assistant> {
  (async() => {
    try {
      // cleanup old assistants delete assistant of more that a day old



      for await (const assistant of openai.beta.assistants.list()) {
        if (assistant.created_at && new Date(assistant.created_at * 1000).getTime() < (Date.now() - 24 * 60 * 60 * 1000)) {
          try {
            const existingAssistant = await openai.beta.assistants.retrieve(assistant.id)
            if (existingAssistant) {
              try {
                await openai.beta.assistants.del(assistant.id)
                console.log('->Deleted assistant', assistant.id)
              } catch (error: any) {
                console.error(`-->Error deleting assistant ${assistant.id}:`, error)
              }
            }
          } catch (error: any) {
            if (error.status === 404) {
              console.log(`Assistant ${assistant.id} not found, skipping deletion.`)
            } else {
              console.error(`--->Error deleting assistant ${assistant.id}:`, error)
            }
          }
        }
      }


      
    } catch (error: any) {
      console.error('Error during assistant cleanup:', error)
    }
  })()

  if (!prompt) prompt = 'You are a personal assistant'

  return openai.beta.assistants.create({
    name: 'Aptero Assistant',
    instructions: `${prompt}\n\n Only one tool at a time is supported`,
    tools: useTool
      ? [
          {
            type: 'function',
            function: {
              name: 'describe',
              description: 'Describe the scene and the object of the scene',
            },
          },
          {
            type: 'function',
            function: {
              name: 'moveToWaypoint',
              description: 'Teleport the client to a given waypoint name (the name must be the same as the one defined in opal)',
              parameters: {
                type: 'object',
                properties: {
                  waypoint: {
                    type: 'string',
                    description: 'The waypoint name to teleport to',
                  },
                },
                required: ['waypoint'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'spawnAttach',
              description: 'Spawn a media (image, video, audio) and attach it to a designated media frame (usually named MFxxx or Media Frame xxx)',
              parameters: {
                type: 'object',
                properties: {
                  mediaFrameName: {
                    type: 'string',
                    description: 'The name of the media frame in Opal',
                  },
                  url: {
                    type: 'string',
                    description: 'URL of the media to be spawned',
                  },
                },
                required: ['mediaFrameName', 'url'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'spawn',
              description: 'Spawn a media directly in front of the player',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'URL of the media to be spawned',
                  },
                },
                required: ['url'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'removeFromMediaFrame',
              description: 'Remove a media from a designated media frame',
              parameters: {
                type: 'object',
                properties: {
                  mediaFrameName: {
                    type: 'string',
                    description: 'The name of the media frame from which to remove media',
                  },
                },
                required: ['mediaFrameName'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'triggerAnimation',
              description: 'Trigger an animation on a designated element',
              parameters: {
                type: 'object',
                properties: {
                  animName: {
                    type: 'string',
                    description: 'The name of the animation in the glb',
                  },
                  actionSpeed: {
                    type: 'number',
                    description: 'Speed of the animation, default to 1',
                  },
                  actionReclick: {
                    type: 'number',
                    description: '0: pause and resume, 1: reset and play again, 2: stop and reset the animation',
                  },
                  actionLoop: {
                    type: 'boolean',
                    description: 'Loop the animation an infinite amount of time, default to false',
                  },
                  actionRepeat: {
                    type: 'number',
                    description: 'Number of times the animation should be repeated, default to 1',
                  },
                },
                required: ['animName'],
              },
            },
          },
        ]
      : [],
    model,
    metadata: {
      threadId,
    },
  })
}

export const processOpenAI = async(
  message: ChatMessage,
  assistantId: string,
) => {
  const assistant = await openai.beta.assistants.retrieve(assistantId)
  const threadId: string = (assistant.metadata as any).threadId
  if (contexts.has(assistant.id)) {
    try {
      const context = contexts.get(assistant.id)
      context.controller.close()
      contexts.delete(assistant.id)
      await openai.beta.threads.runs.cancel(
        context.threadId,
        context.runId,
      )
    } catch (e) {
      console.error('Error closing previous thread', e)
    }
  }

  await openai.beta.threads.messages.create(
    threadId,
    {
      role: message.role as 'user' | 'assistant',
      content: message.content,
    },
  )
  const rawStream = await openai.beta.threads.runs.create(
    threadId,
    { assistant_id: assistant.id, stream: true },
  )
  const context: ThreadContext = {
    assistantId: assistant.id,
    threadId,
    runId: '',
    encoder: new TextEncoder(),
  }
  contexts.set(assistant.id, context)
  const stream = new ReadableStream({
    async start(controller) {
      context.controller = controller
      for await (const event of rawStream) {
        await processEvent(event, context)
      }
    },
  })

  return new Response(stream)
}

async function processEvent(event: OpenAI.Beta.Assistants.AssistantStreamEvent,
  context: ThreadContext,
) {
  const ignoredEvents = [
    'thread.run.step.delta',
    'thread.run.step.in_progress',
    'thread.run.queued',
    'thread.run.in_progress',
    'thread.run.step.created',
    'thread.run.step.completed',
    'thread.message.completed',
    'thread.message.in_progress',
    'thread.message.created',
  ]
  // https://platform.openai.com/docs/api-reference/runs/createRun
  if (event.event === 'thread.run.created') {
    context.runId = event.data.id
  } else if (event.event === 'thread.run.requires_action') {
    try {
      for (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
        console.log('requires_action', toolCall)
        const payload = `JSON://${JSON.stringify(toolCall)}`
        const queue = context.encoder.encode(`$${payload.length} ${payload}`)
        context.controller.enqueue(queue)
      }
    } catch (e) {
      context.controller.error(e)
    }
  } else if (event.event === 'thread.message.delta') {
    const data = event.data
    try {
      for (const delta of data.delta.content) {
        const text = delta
        if (text.type === 'text') {
          const queue = context.encoder.encode(text.text.value)
          context.controller.enqueue(queue)
        } else {
          context.controller.error(new Error('Unsupported delta type'))
        }
      }
    } catch (e) {
      context.controller.error(e)
    }
  } else if (ignoredEvents.includes(event.event)) {
    // console.log('ignored event', event.event)
    /* ignore */
  } else if (event.event === 'thread.run.completed') {
    context.controller.close()
    contexts.delete(context.assistantId)
  } else {
    console.log('Unhandled event', event)
  }
}

export async function notifyCall(data: { assistantId: string, toolCallId: string, output: any }) {
  if (!data || !data.assistantId || !data.toolCallId) {
    console.error('notifyCall', data)
    return
  }
  const context = contexts.get(data.assistantId)
  if (!context) {
    console.log('notifyCall', data)
    console.log(contexts.keys())
    return
  }
  if (typeof data.output === 'object') data.output = JSON.stringify(data.output)
  await submitToolOutputs(
    [{
      tool_call_id: data.toolCallId,
      output: data.output || 'done',
    }],
    context,
  )
}

async function submitToolOutputs(toolOutputs: { tool_call_id: string, output: string }[], context: ThreadContext) {
  try {
    // Use the submitToolOutputsStream helper
    const stream = openai.beta.threads.runs.submitToolOutputsStream(
      context.threadId,
      context.runId,
      { tool_outputs: toolOutputs },
    )
    for await (const event of stream) {
      await processEvent(event, context)
    }
  } catch (error) {
    console.error('Error submitting tool outputs:', error)
  }
}
