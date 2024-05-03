import { Index, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { useThrottleFn } from 'solidjs-use'
import { generateSignature } from '@/utils/auth'
import { accumulateOrGetValue } from '@/aptero/api/Accumulator'
import { FrontEndCommandAPI } from '@/aptero/api/FrontEndCommandAPI2'
import IconClear from './icons/Clear'
import MessageItem from './MessageItem'
import IconReport from './icons/Report'

import ErrorMessageItem from './ErrorMessageItem'
import type { ChatMessage, ErrorMessage } from '@/types'

const frontEndCommandAPI = new FrontEndCommandAPI()

export default () => {
  let inputRef: HTMLTextAreaElement

  const [currentSystemRoleSettings, setCurrentSystemRoleSettings] = createSignal('')

  const [systemRoleEditing] = createSignal(false)
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentError, setCurrentError] = createSignal<ErrorMessage>()
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [controller, setController] = createSignal<AbortController>(null)
  const [isStick, setStick] = createSignal(false)
  const [popupVisible, setPopupVisible] = createSignal(false)
  const [threadId, setThreadId] = createSignal<string | null>(null)

  // We add a Default MODEL that can be changed using a Query string!
  const [currentModel, setCurrentModel] = createSignal('gpt-3.5-turbo')

  createEffect(() => (isStick() && smoothToBottom()))

  onMount(() => {
    // console.log('onMount')
    let lastPostion = window.scrollY
    const url = new URL(window.location.href)
    const params = url.searchParams

    window.addEventListener('scroll', () => {
      const nowPostion = window.scrollY
      nowPostion < lastPostion && setStick(false)
      lastPostion = nowPostion
    })

    if (params.get('model'))
      setCurrentModel(params.get('model'))

    try {
      if (params.get('intro')) {
        setMessageList([{
          content: params.get('intro'),
          role: 'assistant',
        }])
      }

      if (params.get('prompt'))
        setCurrentSystemRoleSettings(params.get('prompt'))

      if (localStorage.getItem('stickToBottom') === 'stick')
        setStick(true)
    } catch (err) {
      console.error(err)
    }
    // Do not save if the ignorecache is set to true
    if (!params.get('ignorecache')) {
      window.addEventListener('beforeunload', handleBeforeUnload)
      onCleanup(() => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      })
    }
    (async() => {
      await frontEndCommandAPI.listen()
      const roomDescription = await Promise.race([
        frontEndCommandAPI.describe(),
        new Promise(resolve => setTimeout(() => resolve(''), 3000)),
      ])
      const roomDescriptionStr = roomDescription ? `\n\n\nHere is a technical description (as if you used describe) of the room: ${JSON.stringify(roomDescription)}` : ''
      fetch('./api/create', {
        method: 'POST',
        body: JSON.stringify({
          threadId, // TODO load from storage to retreive previous thread // empty to start a new convo
          model: currentModel(),
          systemPrompt: currentSystemRoleSettings() + roomDescriptionStr,
          useTool: !!roomDescription,
        }),
      }).then(response => response.json()).then((data) => {
        console.log(data.id)
        setThreadId(data.id)
        setLoading(false)
      }).catch((error) => {
        console.error('Error:', error)
      })
    })()
  })

  const handleBeforeUnload = () => {
    // console.log('handleBeforeUnload')
    localStorage.setItem('messageList', JSON.stringify(messageList()))
    localStorage.setItem('systemRoleSettings', currentSystemRoleSettings())
    isStick() ? localStorage.setItem('stickToBottom', 'stick') : localStorage.removeItem('stickToBottom')
  }

  const handleButtonClick = async() => {
    // console.log('send', inputRef.value)
    const inputValue = inputRef.value
    if (!inputValue)
      return

    inputRef.value = ''
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ])
    requestWithLatestMessage()
    instantToBottom()
  }

  const smoothToBottom = useThrottleFn(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, 300, false, true)

  const instantToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  }

  const requestWithLatestMessage = async() => {
    // console.log('requestWithLatestMessage')
    setLoading(true)
    setCurrentAssistantMessage('')
    setCurrentError(null)
    const storagePassword = localStorage.getItem('pass')
    try {
      const controller = new AbortController()
      setController(controller)
      const requestMessageList = [...messageList()]
      if (currentSystemRoleSettings() && currentModel().startsWith('gpt')) {
        requestMessageList.unshift({
          role: 'system',
          content: currentSystemRoleSettings(),
        })
      }
      // console.log(currentModel())
      const timestamp = Date.now()
      const response = await fetch('./api/generate', {
        method: 'POST',
        body: JSON.stringify({
          model: currentModel(), // We add the model to the request so we can change it using the current Query string
          messages: requestMessageList,
          system: currentModel().startsWith('claude') ? currentSystemRoleSettings() : undefined,
          time: timestamp,
          pass: storagePassword,
          assistantId: threadId(),
          sign: await generateSignature({
            t: timestamp,
            m: requestMessageList?.[requestMessageList.length - 1]?.content || '',
          }),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const error = await response.json()
        console.error(error.error)
        setCurrentError(error.error)
        throw new Error('Request failed')
      }
      const data = response.body
      if (!data)
        throw new Error('No data')

      const reader = data.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) {
          let chunk = decoder.decode(value)
          chunk = accumulateOrGetValue(chunk)
          if (chunk) {
            if (chunk.startsWith('JSON://')) {
              const json = JSON.parse(chunk.replace('JSON://', ''))
              if (json.type === 'function') {
                setCurrentAssistantMessage(`${currentAssistantMessage()} \n **Executing Function: ${json.function.name}** \n`)
                frontEndCommandAPI.execCommand(json).then(async(res) => {
                  const payload = { assistantId: threadId(), toolCallId: json.id, output: res }
                  await fetch('./api/notifyCall', { method: 'POST', body: JSON.stringify(payload) })
                  console.log(res)
                }).catch((err) => {
                  console.error(err)
                })
              }
              console.log(json)
            } else {
              if (chunk === '\n' && currentAssistantMessage().endsWith('\n'))
                continue
              if (chunk)
                setCurrentAssistantMessage(currentAssistantMessage() + chunk)

              isStick() && instantToBottom()
            }
          }
        }
        done = readerDone
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
      setController(null)
      return
    }
    archiveCurrentMessage()
    isStick() && instantToBottom()
  }

  const archiveCurrentMessage = () => {
    // console.log('archiveCurrentMessage')
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ])
      setCurrentAssistantMessage('')
      setLoading(false)
      setController(null)
      inputRef.focus()
    }
  }

  const clear = () => {
    // console.log('clear')
    const url = new URL(window.location.href)
    const params = url.searchParams
    inputRef.value = ''
    inputRef.style.height = 'auto'
    if (params.get('intro')) {
      setMessageList([{
        content: params.get('intro'),
        role: 'assistant',
      }])
    } else {
      setMessageList([])
    }
    setCurrentAssistantMessage('')
    setCurrentError(null)
  }

  const stopStreamFetch = () => {
    // console.log('stopStreamFetch')
    if (controller()) {
      controller().abort()
      archiveCurrentMessage()
    }
  }

  const retryLastFetch = () => {
    // console.log('retryLastFetch')
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1]
      if (lastMessage.role === 'assistant')
        setMessageList(messageList().slice(0, -1))

      requestWithLatestMessage()
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    // console.log('handleKeydown', e)
    if (e.isComposing || e.shiftKey)
      return

    if (e.keyCode === 13) {
      e.preventDefault()
      handleButtonClick()
    }
  }

  const report = () => {
    setPopupVisible(!popupVisible())
  }

  const hidePopup = () => {
    setPopupVisible(false)
  }

  const copyAll = () => { // Copy all the messages to the clipboard (including the currentSystemRoleSettings at the beggining) and sepparated by a comma
    let reportText = `{"role":"system","content":${JSON.stringify(currentSystemRoleSettings())}},`
    messageList().forEach((message) => {
      reportText += JSON.stringify(message)
      if (message !== messageList()[messageList().length - 1])
        reportText += ','
    })
    reportText = `[${reportText}]`
    navigator.clipboard.writeText(reportText)
  }

  const openReport = () => { // Open the page only
    window.open('https://openai.com/form/chat-model-feedback/', '_blank')
  }

  return (
    <div class="chatSpace" >
      {/*
      <SystemRoleSettings
        canEdit={() => messageList().length === 0}
        systemRoleEditing={systemRoleEditing}
        setSystemRoleEditing={setSystemRoleEditing}
        currentSystemRoleSettings={currentSystemRoleSettings}
        setCurrentSystemRoleSettings={setCurrentSystemRoleSettings}
      />
      */}
      {popupVisible() && (
        <div class="report-popup">
          <p class="content">You will be redirected to the OpenAi website</p>
          <div class="content">
            <button class="content" gen-slate-btn style="margin: 0 1em" onClick={copyAll}>Copy Chat</button>
            <button class="content" gen-slate-btn style="margin: 0 1em" onClick={openReport}>Open Form</button>
          </div>
          <button class="content" onClick={hidePopup}>Close</button>
        </div>
      )}
      <Index each={messageList()}>
        {(message, index) => (
          <MessageItem
            role={message().role}
            message={message().content}
            showRetry={() => ((message().role === 'assistant' && index === messageList().length - 1)
                || (message().role === 'user' && index === messageList().length - 1 && !loading()))}// also retry if the last message is user message the AI is not working on it.
            onRetry={retryLastFetch}
          />
        )}
      </Index>
      {currentAssistantMessage() && (
        <MessageItem
          role="assistant"
          message={currentAssistantMessage}
        />
      )}
      { currentError() && <ErrorMessageItem data={currentError()} onRetry={retryLastFetch} /> }
      <Show
        when={!loading()}
        fallback={() => (
          <div class="gen-cb-wrapper">
            <span>AI is thinking...</span>
            <div class="gen-cb-stop" onClick={stopStreamFetch}>Stop</div>
          </div>
        )}
      >
        <div class:op-50={systemRoleEditing()}>
          <div>
            <textarea
              ref={inputRef!}
              disabled={systemRoleEditing()}
              onKeyDown={handleKeydown}
              placeholder="Enter something..."
              autocomplete="off"
              autofocus
              onInput={() => {
                inputRef.style.height = 'auto'
                inputRef.style.height = `${inputRef.scrollHeight}px`
              }}
              style={{ width: '100%' }}
              rows="1"
              class="gen-textarea"
            />
            <div
              style={{
                'display': 'flex',
                'gap': '10px',
                'flex-direction': 'row-reverse',
              }}
            >
              <button onClick={handleButtonClick} disabled={systemRoleEditing()} gen-slate-btn>
                Send
              </button>
              <button title="Clear" onClick={clear} disabled={systemRoleEditing()} gen-slate-btn>
                <IconClear />
              </button>
              <button title="Report" onClick={report} disabled={systemRoleEditing()} gen-slate-btn>
                <IconReport />
              </button>
              <div
                class="rounded-md hover:bg-slate/10 w-fit h-fit transition-colors active:scale-90"
                class:stick-btn-on={isStick()}
              >
                <button title="stick to bottom" type="button" onClick={() => setStick(!isStick())} gen-slate-btn>
                  <div i-ph-arrow-down-bold />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      <div class="sub-footer" style="opacity: 0.6; text-align: center;">
        You can report any inappropriate content using the report button
      </div>

    </div>
  )
}
