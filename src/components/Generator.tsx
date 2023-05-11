import { Index, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { useThrottleFn } from 'solidjs-use'
import { generateSignature } from '@/utils/auth'
import IconClear from './icons/Clear'
import MessageItem from './MessageItem'

import SystemRoleSettings from './SystemRoleSettings'
import ErrorMessageItem from './ErrorMessageItem'
import type { ChatMessage, ErrorMessage } from '@/types'

export default () => {
  let inputRef: HTMLTextAreaElement

  const [currentSystemRoleSettings, setCurrentSystemRoleSettings] = createSignal(
    'You are a representative of Aptero. Aptero fournit des mondes virtuels personnalisables pour les '
      + 'entreprises et a développé une technologie d’espaces 3D immersifs en web qui s’intègre directement sur les '
      + 'outils de collaboration tels que Microsoft Teams. Ils ont remporté le premier prix de la solution Business de '
      + 'Co-Working auprès du grand jury composé notamment de Mr.Graylin (Président Chine à HTC), Sandra Rodriguez '
      + '(Professeur au MIT), Timoni West (Directrice Produit à Unity) ou encore Jeremy Bailenson (Professeur à '
      + 'Stanford). Ils ont également remporté le prix Laval Virtual Best Virtual World and Metaverse Prize 2023 et ont '
      + 'été invités par l’ambassadeur français en Corée à rencontrer la présidente de l’Institut Français, Eva Nguyen '
      + 'Binh. Ils ont également annoncé leur expansion au Chili cette année et leur collaboration avec une start-up '
      + 'coréenne dynamique, Procyan. En outre, ils ont déployé leur solution chez Paris CDG Alliance pour Noé, '
      + 'l’univers métiers. Ils sont également accélérés en 2023 par Bigbang Angels, Inc. en Corée. Voici les '
      + 'co-fondateurs : Pierre-Henri Fricot (CTO) Cedric CHANE CHING (CEO) Christian GOMEZ CARVAJAL (COO)',
  )

  const [systemRoleEditing, setSystemRoleEditing] = createSignal(false)
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentError, setCurrentError] = createSignal<ErrorMessage>()
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [controller, setController] = createSignal<AbortController>(null)
  const [isStick, setStick] = createSignal(false)

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

    try {
      if (localStorage.getItem('messageList') && localStorage.getItem('messageList') !== '[]') {
        setMessageList(JSON.parse(localStorage.getItem('messageList')))
      } else if (params.get('intro')) {
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
    setLoading(false);
    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
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
      if (currentSystemRoleSettings()) {
        requestMessageList.unshift({
          role: 'system',
          content: currentSystemRoleSettings(),
        })
      }
      const timestamp = Date.now()
      const response = await fetch('./api/generate', {
        method: 'POST',
        body: JSON.stringify({
          messages: requestMessageList,
          time: timestamp,
          pass: storagePassword,
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
          const char = decoder.decode(value)
          if (char === '\n' && currentAssistantMessage().endsWith('\n'))
            continue

          if (char)
            setCurrentAssistantMessage(currentAssistantMessage() + char)

          isStick() && instantToBottom()
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
        <div class="gen-text-wrapper" class:op-50={systemRoleEditing()}>
          <div class="rounded-md hover:bg-slate/10 w-fit h-fit transition-colors active:scale-90" class:stick-btn-on={isStick()}>
            <div>
              <button title="stick to bottom" type="button" onClick={() => setStick(!isStick())} gen-slate-btn>
                <div i-ph-arrow-down-bold />
              </button>
            </div>
          </div>
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
            rows="1"
            class="gen-textarea"
          />
          <button onClick={handleButtonClick} disabled={systemRoleEditing()} gen-slate-btn>
            Send
          </button>
          <button title="Clear" onClick={clear} disabled={systemRoleEditing()} gen-slate-btn>
            <IconClear />
          </button>
        </div>
      </Show>

    </div>
  )
}
