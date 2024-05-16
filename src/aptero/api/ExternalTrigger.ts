export class ExternalTrigger {
  callback: (message: string) => void
  onExternalTrigger(callback: (message: string) => void) {
    this.callback = callback
  }

  notifyExternalTrigger(message: string) {
    this.callback(message)
  }
}

export const externalTrigger = new ExternalTrigger()
