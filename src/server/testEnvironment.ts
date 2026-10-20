import { vi } from 'vitest'

class TestStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

class TestCustomEvent<T> extends Event {
  readonly detail: T

  constructor(type: string, options?: CustomEventInit<T>) {
    super(type, options)
    this.detail = options?.detail as T
  }
}

export function installBrowserTestEnvironment() {
  const fakeWindow = Object.assign(new EventTarget(), {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    location: { reload: vi.fn() },
  }) as unknown as Window
  vi.stubGlobal('window', fakeWindow)
  vi.stubGlobal('localStorage', new TestStorage())
  vi.stubGlobal('sessionStorage', new TestStorage())
  vi.stubGlobal('CustomEvent', TestCustomEvent)
}
