import { createSignal } from 'solid-js'
import MarkdownIt from 'markdown-it'
import mdKatex from 'markdown-it-katex'
import mdHighlight from 'markdown-it-highlightjs'
import { useClipboard, useEventListener } from 'solidjs-use'
import IconRefresh from './icons/Refresh'
import type { Accessor } from 'solid-js'
import type { ChatMessage } from '@/types'

interface Props {
  role: ChatMessage['role']
  message: Accessor<string> | string
  showRetry?: Accessor<boolean>
  onRetry?: () => void
}

export default ({ role, message, showRetry, onRetry }: Props) => {
  const urlParams = new URLSearchParams(window.location.search)
  const customIconUser = urlParams.get('customIconUser')
  const customIconAssistant = urlParams.get('customIconAssistant')

  let userBase = 'bg-rouge'
  let assistantBase = 'bg-jaune'
  let userIcon = ''
  let assistantIcon = ''

  if (customIconUser) {
    userBase = ''
    userIcon = customIconUser
  }
  if (customIconAssistant) {
    assistantBase = ''
    assistantIcon = customIconAssistant
  }

  const roleClass = {
    system: 'bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300', // how?
    user: userBase,
    assistant: assistantBase,
  }
  const roleImage = {
    system: '', // how?
    user: userIcon,
    assistant: assistantIcon,
  }

  const [source] = createSignal('')
  const { copy, copied } = useClipboard({ source, copiedDuring: 1000 })

  useEventListener('click', (e) => {
    const el = e.target as HTMLElement
    let code = null

    if (el.matches('div > div.copy-btn')) {
      code = decodeURIComponent(el.dataset.code!)
      copy(code)
    }
    if (el.matches('div > div.copy-btn > svg')) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      code = decodeURIComponent(el.parentElement?.dataset.code!)
      copy(code)
    }
  })

  const htmlString = () => {
    const md = MarkdownIt({
      linkify: true,
      breaks: true,
    }).use(mdKatex).use(mdHighlight)
    const fence = md.renderer.rules.fence!
    md.renderer.rules.fence = (...args) => {
      const [tokens, idx] = args
      const token = tokens[idx]
      const rawCode = fence(...args)

      return `<div relative>
      <div data-code=${encodeURIComponent(token.content)} class="copy-btn gpt-copy-btn group">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32"><path fill="currentColor" d="M28 10v18H10V10h18m0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Z" /><path fill="currentColor" d="M4 18H2V4a2 2 0 0 1 2-2h14v2H4Z" /></svg>
            <div class="group-hover:op-100 gpt-copy-tips">
              ${copied() ? 'Copied' : 'Copy'}
            </div>
      </div>
      ${rawCode}
      </div>`
    }

    if (typeof message === 'function')
      return md.render(message())
    else if (typeof message === 'string')
      return md.render(message)

    return ''
  }

  return (
    <div class="py-2 -mx-4 px-4 transition-colors md:hover:bg-slate/3">
      <div class="flex gap-3 rounded-lg" class:op-75={role === 'user'}>
        <div class={`shrink-0 w-7 h-7 mt-4 rounded-full op-80 drop-shadow-md ${roleClass[role]}`}>
          <img src={roleImage[role]} onerror="this.style.display='none'" style="border-radius: 999px; object-fit: cover; width: 100%; height: 100%;" />
        </div>
        <div class="message prose break-words overflow-hidden" innerHTML={htmlString()} />
      </div>
      {showRetry?.() && onRetry && (
        <div class="fie px-3 mb-2">
          <div onClick={onRetry} class="gpt-retry-btn">
            <IconRefresh />
            <span>재생성</span>
          </div>
        </div>
      )}
    </div>
  )
}
